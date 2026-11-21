// police.js — the Solara PD dragnet: a living wanted system.
// Roadblocks go up ahead of the player, spike strips shred tires, the heat
// only cools when no cop can actually see the player, and police dispatch
// talks the whole chase over the radio. All original content for Solara Bay.
import { WORLD, ROAD_HALF, clamp, dist2, angDiff } from './state.js';
import { pointInBuilding, nearestRoadLine, onRoad, ROAD_LINES, collideCircle } from './city.js';
import { setToast, spawnParticles, makeCar } from './entities.js';

// --- tuning ---
const LOS_RANGE = 650;        // how far a cop can spot the player (px)
const HELI_LOS_RANGE = 900;   // the helicopter sees further
const HIDE_AFTER = 6;         // seconds unseen before the player counts as hidden
const HIDDEN_COOL = 0.30;     // wanted stars lost per second while hidden
const BLOCK_AHEAD = 520;      // roadblock distance ahead of the player
const BLOCK_LIFE = 50;        // seconds a roadblock stands before it packs up
const BLOCK_RESPAWN = 14;     // seconds between new roadblocks
const SPIKE_HIT_SPEED = 60;   // must be moving this fast to shred a tire
const RADIO_CD = 7;           // seconds between dispatch chatter lines

// Dispatch chatter: the radio voice of the chase. Picked by situation, so
// the player hears the PD react instead of reading a static wanted number.
const RADIO_BLOCK = [
  'DISPATCH: Roadblock going up — all units converge on the suspect',
  'DISPATCH: Unit 12, block the avenue. Suspect is coming your way',
  'DISPATCH: Roadblock set — spike strips out, nobody gets through',
  'DISPATCH: Seal the intersections. I want that car boxed in',
];
const RADIO_SPIKE = [
  'DISPATCH: Suspect just hit the strips — tires are going flat!',
  'DISPATCH: Spikes worked, suspect is limping. Close in, units!',
  'DISPATCH: Strips did their job — he is not outrunning anyone now',
];
const RADIO_HIDDEN = [
  'DISPATCH: Lost visual on the suspect… searching the area',
  'DISPATCH: Suspect slipped the cordon. Eyes open, all units',
  'DISPATCH: Nobody has eyes on him. Check the alleys and the park',
];
const RADIO_SPOTTED = [
  'DISPATCH: Visual again — suspect spotted, all units respond!',
  'DISPATCH: There he is! Do not let him out of your sight',
  'DISPATCH: Eyes on the suspect — all units, converge!',
];
const RADIO_DRAGNET = [
  'DISPATCH: DRAGNET — full perimeter, every road out of the district closed',
  'DISPATCH: Five stars. Nobody leaves Solara Bay tonight',
];
const RADIO_BUSTED_NEAR = [
  'DISPATCH: Suspect cornered — move in and take him down',
];
const RADIO_SEARCH = [
  'DISPATCH: All units, search the last known position — he is in there somewhere',
  'DISPATCH: Cordon the block. He was seen there minutes ago, he has not gone far',
];

function pickLine(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

export function initDragnet(G) {
  G.roadblocks = [];   // {x, y, angle, t, life, spikes: bool, cops: [{dx, dy}]}
  G.spikes = [];       // {x, y, angle, block}
  G.heat = { seen: false, seenT: 0, hiddenT: 0, everSeen: false };
  G.lastSeen = null;   // {x, y} — where the PD last saw the player
  G.radioCd = 0;
  G.blockCd = 4;
  G.dragnetOn = false;
}

// Straight-line sight between two points, blocked by any building in the
// way. Sampled in steps so a wall, a shop or a tower breaks the view.
export function hasLineOfSight(G, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  const steps = Math.max(4, Math.floor(d / 40));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointInBuilding(G.city, ax + dx * t, ay + dy * t)) return false;
  }
  return true;
}

// Nearest point on the road grid to (x, y), snapped to a centreline.
function snapToRoad(G, x, y) {
  const lx = nearestRoadLine(x), ly = nearestRoadLine(y);
  // pick the closer centreline; the road runs along it
  if (Math.abs(x - lx) <= Math.abs(y - ly)) return { x: lx, y, vertical: true };
  return { x, y: ly, vertical: false };
}

// Place one roadblock on the road ahead of the player, across the road the
// player is travelling on, with cruisers angled to close it off.
function spawnRoadblock(G, audio, forceSpikes) {
  const p = G.player;
  const stars = Math.floor(G.wanted + 0.001);
  // aim ahead of the player's motion (or facing, when on foot)
  const heading = p.inCar ? Math.atan2(Math.sin(p.angle), Math.cos(p.angle)) : p.angle;
  let bx = p.x + Math.cos(heading) * BLOCK_AHEAD;
  let by = p.y + Math.sin(heading) * BLOCK_AHEAD;
  bx = clamp(bx, 120, WORLD - 120); by = clamp(by, 120, WORLD - 120);
  const snap = snapToRoad(G, bx, by);
  // never stack two blocks on the same stretch
  for (const b of G.roadblocks) {
    if (dist2(b.x, b.y, snap.x, snap.y) < 500 * 500) return false;
  }
  const roadAngle = snap.vertical ? Math.PI / 2 : 0;
  const withSpikes = forceSpikes || stars >= 3 || Math.random() < 0.5;
  // Orientation note (verified against drawCar): a car drawn with
  // rotate(a) has its long axis along a + 90 degrees, so a cruiser parked
  // ACROSS a road takes the same angle value as traffic travelling along
  // that road (0 for an east-west road, PI/2 for a north-south road).
  // Local offsets are (along-road, across-road), rotated by roadAngle.
  const block = {
    x: snap.x, y: snap.y, angle: roadAngle, t: 0, life: BLOCK_LIFE,
    spikes: withSpikes,
    // two cruisers parked nose-to-nose across the road, angled to close it
    cruisers: [
      { dx: 0, dy: -ROAD_HALF * 0.55, a: roadAngle + 0.35 },
      { dx: 0, dy: ROAD_HALF * 0.55, a: roadAngle - 0.35 },
    ],
    // two foot cops standing the line, one each side of the strip
    cops: [
      { dx: -26, dy: -ROAD_HALF - 14, a: roadAngle },
      { dx: 26, dy: ROAD_HALF + 14, a: roadAngle + Math.PI },
    ],
  };
  // rotate the local offsets into world space: a roadblock on a vertical
  // road is the same shape turned 90 degrees
  const ca = Math.cos(roadAngle), sa = Math.sin(roadAngle);
  for (const c of block.cruisers) {
    const wx = c.dx * ca - c.dy * sa, wy = c.dx * sa + c.dy * ca;
    c.x = snap.x + wx; c.y = snap.y + wy;
  }
  for (const c of block.cops) {
    const wx = c.dx * ca - c.dy * sa, wy = c.dx * sa + c.dy * ca;
    c.x = snap.x + wx; c.y = snap.y + wy;
  }
  if (withSpikes) {
    // the strip's long axis runs across the road: roadAngle + 90 degrees
    G.spikes.push({ x: snap.x, y: snap.y, angle: roadAngle + Math.PI / 2, block });
  }
  G.roadblocks.push(block);
  return true;
}

// A roadblock staged by hand (screenshots, missions): one block a fixed
// distance ahead of the player on the road they are on, spikes included.
export function stageRoadblock(G, ahead) {
  if (!G.roadblocks) initDragnet(G);
  const p = G.player;
  const d = ahead || 420;
  const bx = clamp(p.x + Math.cos(p.angle) * d, 120, WORLD - 120);
  const by = clamp(p.y + Math.sin(p.angle) * d, 120, WORLD - 120);
  const snap = snapToRoad(G, bx, by);
  const roadAngle = snap.vertical ? Math.PI / 2 : 0;
  const ca = Math.cos(roadAngle), sa = Math.sin(roadAngle);
  const block = {
    x: snap.x, y: snap.y, angle: roadAngle, t: 0, life: BLOCK_LIFE, spikes: true,
    cruisers: [
      { dx: 0, dy: -ROAD_HALF * 0.55, a: roadAngle + 0.35 },
      { dx: 0, dy: ROAD_HALF * 0.55, a: roadAngle - 0.35 },
    ],
    cops: [
      { dx: -26, dy: -ROAD_HALF - 14, a: roadAngle },
      { dx: 26, dy: ROAD_HALF + 14, a: roadAngle + Math.PI },
    ],
  };
  for (const c of block.cruisers) {
    const wx = c.dx * ca - c.dy * sa, wy = c.dx * sa + c.dy * ca;
    c.x = snap.x + wx; c.y = snap.y + wy;
  }
  for (const c of block.cops) {
    const wx = c.dx * ca - c.dy * sa, wy = c.dx * sa + c.dy * ca;
    c.x = snap.x + wx; c.y = snap.y + wy;
  }
  G.spikes.push({ x: snap.x, y: snap.y, angle: roadAngle + Math.PI / 2, block });
  G.roadblocks.push(block);
  G.heat.seen = true; G.heat.seenT = 0; G.heat.hiddenT = 0; G.heat.everSeen = true;
  return block;
}

// One car crossing a spike strip: tires pop one at a time, handling falls
// apart, and dispatch cheers. Police cruisers can eat their own strips too.
function hitSpikeStrip(G, car, strip, audio, isPlayer) {
  car.flat = Math.min(4, (car.flat || 0) + 1);
  car.spikeCd = 1.2; // one strip cannot shred the whole set in one frame
  spawnParticles(G, car.x, car.y, 10, '#2c3e50');
  spawnParticles(G, car.x, car.y, 6, '#f1c40f');
  if (audio && audio.tirePop) audio.tirePop();
  if (isPlayer) {
    if (car.flat === 1) setToast(G, 'Spike strip! Front tire blown — handling is shot');
    else if (car.flat === 2) setToast(G, 'Two tires down — the car is limping!');
    else if (car.flat >= 3) setToast(G, 'Tires shredded — get to Pay \'n\' Spray (R) or ditch the car');
    if (G.radioCd <= 0) {
      G.radioCd = RADIO_CD;
      setToast(G, pickLine(G.rng, RADIO_SPIKE));
      if (audio && audio.radio) audio.radio();
    }
    // a shredded tire is a crime the PD notices: a little more heat
    G.wanted = clamp(G.wanted + 0.25, 0, 5);
  } else {
    car.speed *= 0.6;
  }
}

// The dragnet's heart: can anyone see the player right now? A cruiser, a
// foot cop or the helicopter, each with a real line of sight past buildings.
function computeSeen(G) {
  const p = G.player;
  if (p.dead) return false;
  for (const c of G.cars) {
    if (c.kind !== 'police') continue;
    const d2 = dist2(c.x, c.y, p.x, p.y);
    if (d2 < LOS_RANGE * LOS_RANGE && hasLineOfSight(G, c.x, c.y, p.x, p.y)) return true;
  }
  for (const cop of G.cops) {
    const d2 = dist2(cop.x, cop.y, p.x, p.y);
    if (d2 < (LOS_RANGE * 0.8) * (LOS_RANGE * 0.8) && hasLineOfSight(G, cop.x, cop.y, p.x, p.y)) return true;
  }
  if (G.heli) {
    const d2 = dist2(G.heli.x, G.heli.y, p.x, p.y);
    // the helicopter sees over rooftops: no building check, longer range
    if (d2 < HELI_LOS_RANGE * HELI_LOS_RANGE) return true;
  }
  // roadblock crews watch their own stretch of road
  for (const b of G.roadblocks) {
    const d2 = dist2(b.x, b.y, p.x, p.y);
    if (d2 < 420 * 420 && hasLineOfSight(G, b.x, b.y, p.x, p.y)) return true;
  }
  return false;
}

// A block that packs up leaves its spike strip behind for a while: the
// road stays dangerous after the cruisers have gone.
function retireBlockSpikes(G, block) {
  for (const s of G.spikes) {
    if (s.block === block) { s.block = null; s.linger = 12; }
  }
}

export function updateDragnet(G, dt, audio) {
  if (!G.roadblocks) initDragnet(G);
  const p = G.player;
  const stars = Math.floor(G.wanted + 0.001);
  G.radioCd = Math.max(0, G.radioCd - dt);
  G.blockCd = Math.max(0, G.blockCd - dt);

  // --- line of sight / hidden state ---
  const seen = stars > 0 ? computeSeen(G) : false;
  if (seen) {
    // the PD always knows where it last saw the player — when the trail
    // goes cold, the cruisers search that spot instead of homing in on
    // the player through the walls (see updatePolice in entities.js)
    G.lastSeen = { x: p.x, y: p.y };
    if (!G.heat.seen && G.heat.everSeen && G.radioCd <= 0) {
      G.radioCd = RADIO_CD;
      setToast(G, pickLine(G.rng, RADIO_SPOTTED));
      if (audio && audio.radio) audio.radio();
    }
    G.heat.seen = true;
    G.heat.seenT += dt;
    G.heat.hiddenT = 0;
    G.heat.everSeen = true;
    G.wantedTimer = 0; // seen: the old decay clock never starts
  } else {
    G.heat.seen = false;
    G.heat.seenT = 0;
    G.heat.hiddenT += dt;
    if (G.heat.hiddenT > HIDE_AFTER && G.wanted > 0) {
      // hidden: the heat bleeds off fast while nobody can see the player.
      // Ducking into an alley, a park or the beach actually works now.
      // (Gated on wanted itself, not the floored star count: below one
      // whole star the decay still has to finish the job.)
      const before = G.wanted;
      G.wanted = Math.max(0, G.wanted - HIDDEN_COOL * dt);
      if (G.wanted < 0.5) G.wanted = 0;
      if (before > 0 && G.wanted === 0) {
        setToast(G, 'You lost them — the heat is gone. Stay clean, Rico.');
        if (audio && audio.pickup) audio.pickup();
      }
    }
  }
  // first time slipping out of sight, dispatch admits it on the radio
  // and sends the cruisers to search the last known position
  if (!seen && G.heat.hiddenT > HIDE_AFTER && G.heat.hiddenT < HIDE_AFTER + dt + 0.01
    && stars > 0 && G.heat.everSeen && G.radioCd <= 0) {
    G.radioCd = RADIO_CD;
    setToast(G, G.lastSeen && G.cars.some(c => c.kind === 'police')
      ? pickLine(G.rng, RADIO_SEARCH)
      : pickLine(G.rng, RADIO_HIDDEN));
    if (audio && audio.radio) audio.radio();
  }

  // --- roadblocks: how many, and where ---
  const wantBlocks = stars >= 5 ? 3 : stars >= 3 ? 2 : stars >= 2 ? 1 : 0;
  if (stars >= 5 && !G.dragnetOn) {
    G.dragnetOn = true;
    setToast(G, pickLine(G.rng, RADIO_DRAGNET));
    if (audio && audio.radio) audio.radio();
  } else if (stars < 5) {
    G.dragnetOn = false;
  }
  if (wantBlocks > 0 && G.blockCd <= 0 && G.roadblocks.length < wantBlocks) {
    if (spawnRoadblock(G, audio, stars >= 5)) {
      G.blockCd = BLOCK_RESPAWN;
      if (G.radioCd <= 0) {
        G.radioCd = RADIO_CD;
        setToast(G, pickLine(G.rng, RADIO_BLOCK));
        if (audio && audio.radio) audio.radio();
      }
    } else {
      G.blockCd = 4; // no good spot this time; try again soon
    }
  }
  // age roadblocks out; a block with no heat left packs up and leaves
  for (const b of G.roadblocks) b.t += dt;
  if (stars < 2 || G.roadblocks.length > wantBlocks) {
    G.roadblocks.sort((a, b) => b.t - a.t);
    while (G.roadblocks.length > 0 && (stars < 2 || G.roadblocks.length > wantBlocks || G.roadblocks[0].t > BLOCK_LIFE)) {
      const gone = G.roadblocks.shift();
      retireBlockSpikes(G, gone);
    }
  } else {
    G.roadblocks = G.roadblocks.filter(b => {
      if (b.t <= BLOCK_LIFE) return true;
      retireBlockSpikes(G, b);
      return false;
    });
  }
  // lingering strips fade out on their own timer
  for (const s of G.spikes) if (s.linger !== undefined) s.linger -= dt;
  G.spikes = G.spikes.filter(s => s.linger === undefined || s.linger > 0);

  // --- spike strips: who drives over one ---
  const checkStrip = (car, isPlayer) => {
    if (!car) return;
    // cool down first, then check: the early return below must not freeze it
    car.spikeCd = Math.max(0, (car.spikeCd || 0) - dt);
    if (car.spikeCd > 0) return;
    for (const s of G.spikes) {
      // across the strip: near its centre line, on either side of the road
      const dx = car.x - s.x, dy = car.y - s.y;
      const along = dx * Math.cos(s.angle) + dy * Math.sin(s.angle);
      const across = -dx * Math.sin(s.angle) + dy * Math.cos(s.angle);
      if (Math.abs(along) < ROAD_HALF + 10 && Math.abs(across) < 14) {
        if (Math.abs(car.speed || 0) > SPIKE_HIT_SPEED || isPlayer) {
          hitSpikeStrip(G, car, s, audio, isPlayer);
          return;
        }
      }
    }
  };
  if (p.inCar) checkStrip(p.inCar, true);
  // a cruiser can eat its own department's strips — and so can traffic:
  // a limping sedan crawling away from a strip is part of the chaos
  for (const c of G.cars) {
    if (c.kind === 'police' || c.kind === 'traffic') checkStrip(c, false);
  }

  // --- roadblock crews open fire when the player rolls up on their line ---
  for (const b of G.roadblocks) {
    for (const cp of b.cops) {
      cp.fireCd = Math.max(0, (cp.fireCd || 1) - dt);
      if (cp.fireCd <= 0 && !p.dead && dist2(cp.x, cp.y, p.x, p.y) < 300 * 300) {
        cp.fireCd = 1.4 + Math.random() * 0.8;
        const a = Math.atan2(p.y - cp.y, p.x - cp.x) + (Math.random() - 0.5) * 0.2;
        G.bullets.push({ x: cp.x, y: cp.y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.6, dmg: 7, fromPlayer: false });
        spawnParticles(G, cp.x, cp.y, 3, '#ffd93d');
        if (audio && audio.enemyShoot) audio.enemyShoot();
      }
    }
  }

  // --- roadblock cruisers are solid: the player cannot ghost through ---
  if (p.inCar) {
    const c = p.inCar;
    for (const b of G.roadblocks) {
      for (const rc of b.cruisers) {
        const d2 = dist2(c.x, c.y, rc.x, rc.y);
        if (d2 < 46 * 46) {
          const d = Math.sqrt(d2) || 1;
          const push = (46 - d) / 2;
          const ux = (c.x - rc.x) / d, uy = (c.y - rc.y) / d;
          c.x += ux * push; c.y += uy * push;
          if (Math.abs(c.speed) > 120) {
            c.speed *= 0.55;
            c.crashCd = 0.5;
            spawnParticles(G, c.x, c.y, 6, '#f39c12');
            if (audio && audio.crash) audio.crash();
          } else {
            c.speed *= 0.9;
          }
        }
      }
    }
    // same rule as the traffic bump: a shove never puts the car through
    // a wall or off the map
    const fixed = collideCircle(G.city, c.x, c.y, 22);
    c.x = clamp(fixed.x, 40, WORLD - 40); c.y = clamp(fixed.y, 40, WORLD - 40);
  }

  // --- busted warning: a foot cop closing in on foot gets a radio call ---
  if (!p.inCar && stars > 0 && G.radioCd <= 0) {
    for (const cop of G.cops) {
      if (dist2(cop.x, cop.y, p.x, p.y) < 120 * 120) {
        G.radioCd = RADIO_CD;
        setToast(G, pickLine(G.rng, RADIO_BUSTED_NEAR));
        if (audio && audio.radio) audio.radio();
        break;
      }
    }
  }
}

// --- drawing: roadblocks, spike strips, block crews, hidden ring ---
export function drawDragnet(ctx, G) {
  if (!G.roadblocks) return;
  // spike strips first (under the cars): dark band, hazard chevrons, teeth.
  // A strip left behind by a departed block fades as its timer runs out.
  for (const s of G.spikes) {
    ctx.save();
    if (s.linger !== undefined) ctx.globalAlpha = clamp(s.linger / 4, 0.25, 1);
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-ROAD_HALF - 8, -10, (ROAD_HALF + 8) * 2, 20);
    for (let x = -ROAD_HALF; x < ROAD_HALF; x += 18) {
      ctx.fillStyle = ((x / 18) | 0) % 2 === 0 ? '#ffd93d' : '#111';
      ctx.beginPath();
      ctx.moveTo(x, -10); ctx.lineTo(x + 9, 0); ctx.lineTo(x, 10); ctx.lineTo(x - 9, 0);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#c0c8d0';
    for (let x = -ROAD_HALF + 6; x < ROAD_HALF; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x - 4, -8); ctx.lineTo(x + 4, -8); ctx.lineTo(x, 2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 4, 8); ctx.lineTo(x + 4, 8); ctx.lineTo(x, -2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // roadblock cruisers: PD body, light bar flashing, PD stencil. A pulsing
  // red/blue halo on the asphalt makes the block read at a glance — dark
  // navy on dark asphalt would otherwise vanish into the road.
  for (const b of G.roadblocks) {
    for (const rc of b.cruisers) {
      const flash = Math.floor(G.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? 'rgba(255,45,45,0.20)' : 'rgba(45,107,255,0.20)';
      ctx.beginPath(); ctx.arc(rc.x, rc.y, 52 + Math.sin(G.time * 6) * 4, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(rc.x, rc.y);
      ctx.rotate(rc.a);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-20, -40, 46, 88);
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath(); ctx.roundRect(-23, -44, 46, 88, 9); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(-23, -44, 46, 88, 9); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath(); ctx.roundRect(-23, -44, 46, 14, 9); ctx.fill();
      ctx.fillStyle = '#1c2733';
      ctx.beginPath(); ctx.roundRect(-18, -26, 36, 14, 4); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-18, 12, 36, 12, 4); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(-26, -34, 6, 16); ctx.fillRect(20, -34, 6, 16);
      ctx.fillRect(-26, 18, 6, 16); ctx.fillRect(20, 18, 6, 16);
      ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
      ctx.fillRect(-14, -10, 12, 5);
      ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
      ctx.fillRect(2, -10, 12, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 4);
      ctx.restore();
    }
    // foot cops holding the line
    for (const cp of b.cops) {
      ctx.fillStyle = '#1e3a5f';
      ctx.beginPath(); ctx.arc(cp.x, cp.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f1c27d';
      ctx.beginPath(); ctx.arc(cp.x + Math.cos(cp.a) * 3, cp.y + Math.sin(cp.a) * 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PD', cp.x, cp.y - 13);
    }
    // "ROADBLOCK" stencil on the asphalt behind the line
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('R O A D B L O C K', 0, ROAD_HALF + 26);
    ctx.restore();
  }
  // hidden ring: while the player is unseen and wanted, a green pulse says
  // the heat is cooling — staying out of sight is a real tactic now
  const p = G.player;
  if (G.wanted > 0 && G.heat && !G.heat.seen && G.heat.hiddenT > HIDE_AFTER) {
    const pulse = 1 + Math.sin(G.time * 4) * 0.08;
    ctx.strokeStyle = 'rgba(46,204,113,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(46,204,113,0.14)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
  }
  // dragnet perimeter ring at 5 stars: the whole district is closing in
  if (G.dragnetOn) {
    ctx.strokeStyle = 'rgba(255,45,45,' + (0.35 + Math.sin(G.time * 3) * 0.15) + ')';
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 18]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 560, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}
