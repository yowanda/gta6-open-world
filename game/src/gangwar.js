// gangwar.js — turf war between Solara Bay's two street gangs.
// The Vultures (purple) and the Cobras (green) fight over three turf
// zones drawn on the streets. A war erupts on its own every so often:
// both gangs send shooters, park gang cars as cover and throw up
// barricades, one of them burning. The zone changes colour when it is
// taken, the HUD tracks all three zones, and Rico gets paid when he
// helps flip one. Picking a side has a price: every turf fighter Rico
// guns down turns that gang against him, and at three kills the gang
// shoots him on sight even between wars. Everything here is visual
// first: the fight is meant to be seen — tracers, smoke, coloured turf,
// spray-painted tags — not read in a menu.
import { clamp, dist2, angDiff } from './state.js';
import { collideCircle, nearestRoadLine } from './city.js';
import { makeCar, spawnParticles, setToast } from './entities.js';

// The two gangs. Colours are the whole identity: purple Vultures,
// green Cobras, readable at a glance in the world, on the HUD and on
// the minimap. A fighter's tag letter matches the gang's first letter.
export const GANGS = {
  vultures: { name: 'Vultures', color: '#8e44ad', dark: '#6c3483', tag: 'V', enemy: 'cobras' },
  cobras: { name: 'Cobras', color: '#27ae60', dark: '#1e8449', tag: 'C', enemy: 'vultures' },
};

// Turf zones: rectangles over real streets and blocks, one per
// neighbourhood that matters. The Strip is the prize fight in the
// middle of the map, Downtown is Cobra ground, the Boardwalk is where
// the story ends — and where Rook's Vultures hold the sand.
export const TURF_ZONES = [
  { id: 'strip', name: 'The Strip', x: 1690, y: 1170, w: 390, h: 260, owner: 'vultures' },
  { id: 'downtown', name: 'Downtown', x: 1040, y: 780, w: 390, h: 390, owner: 'cobras' },
  { id: 'boardwalk', name: 'Boardwalk', x: 2080, y: 1170, w: 390, h: 390, owner: 'vultures' },
];

// How many shooters each side sends to a war, and how long a war can
// run before it fizzles out with nobody taking the zone.
export const WAR_FIGHTERS = 5;
export const WAR_LIMIT = 90;
export const WAR_REWARD = 500;
export const WAR_COOLDOWN = 60;

// Fresh turf state: zones as defined above, no war running, the first
// war a short drive away so a new game shows one quickly.
export function createTurf() {
  return {
    zones: TURF_ZONES.map((z) => ({ ...z })),
    war: null,            // {zone, t, limit, kills:{vultures,cobras}, playerKills}
    cooldown: 25,         // seconds until the next war may erupt
    bannerT: 0,           // seconds the GANG WAR banner stays up
    wins: { vultures: 0, cobras: 0 },
    // standing with each gang: 0 neutral, down one per turf fighter
    // Rico kills. At -3 the gang turns hostile and shoots Rico on sight.
    standing: { vultures: 0, cobras: 0 },
  };
}

// A gang fighter is a normal enemy entry with a gang string and the
// turf flag: combat's player bullets still hurt him, but his own AI
// lives here (updateGangWar), not in updateCombat, so he fights the
// other gang instead of chasing Rico.
function makeFighter(x, y, gang, fireCd) {
  return { x, y, angle: gang === 'vultures' ? 0 : Math.PI, hp: 60, fireCd, gang, turf: true };
}

// Start a war over a zone: five shooters a side on opposite ends of
// the street, a gang car parked as cover for each side, and three
// barricades across the middle, one of them on fire. Positions are
// fixed offsets, so a staged war looks the same every time.
export function startGangWar(G, zone, audio, opts = {}) {
  const z = typeof zone === 'string'
    ? G.turf.zones.find((zz) => zz.id === zone)
    : zone;
  if (!z) return;
  // a new war clears the last one's fighters and barricades
  G.enemies = G.enemies.filter((e) => !e.turf);
  G.barricades = [];
  const n = opts.fighters || WAR_FIGHTERS;
  G.turf.war = {
    zone: z, t: 0, limit: WAR_LIMIT,
    kills: { vultures: 0, cobras: 0 }, playerKills: 0,
    driveby: null,       // the car currently doing a drive-by, if any
    drivebyAt: 18 + Math.random() * 6, // first pass, then every ~30 s
  };
  G.turf.bannerT = 4;
  const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
  for (let i = 0; i < n; i++) {
    const fy = cy - ((n - 1) / 2) * 70 + i * 70;
    G.enemies.push(makeFighter(z.x + 40, fy, 'vultures', 0.6 + i * 0.25));
    G.enemies.push(makeFighter(z.x + z.w - 40, fy, 'cobras', 0.8 + i * 0.25));
  }
  // gang cars as rolling cover: purple sedan for the Vultures, green
  // for the Cobras, parked mid-street between the two lines so neither
  // car sits under the war label at the top of the zone. They stay
  // parked; Rico can steal one after the war.
  const vc = makeCar(z.x + 60, cy, Math.PI / 2,
    { name: 'Sedan', w: 46, l: 92, speed: 360, accel: 260 }, '#8e44ad', 'gang');
  vc.gangTag = 'V';
  G.cars.push(vc);
  const cc = makeCar(z.x + z.w - 60, cy, -Math.PI / 2,
    { name: 'Sedan', w: 46, l: 92, speed: 360, accel: 260 }, '#27ae60', 'gang');
  cc.gangTag = 'C';
  G.cars.push(cc);
  // barricades across the middle of the fight: the first one burns and
  // smokes for the whole war, the other two are sandbag cover
  G.barricades.push({ x: cx, y: cy - 40, angle: 0.3, burning: true, t: 0 });
  G.barricades.push({ x: cx - 70, y: cy + 50, angle: -0.4, burning: false, t: 0 });
  G.barricades.push({ x: cx + 80, y: cy + 40, angle: 0.9, burning: false, t: 0 });
  if (!opts.quiet) {
    // Rico standing in the zone gets a sharper warning than a bystander
    const p = G.player;
    const inside = p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h;
    setToast(G, inside
      ? 'GANG WAR — you are standing in ' + z.name + '. Pick a side, Rico.'
      : 'GANG WAR — ' + z.name + ' is up for grabs. Pick a side, Rico.');
  }
  if (audio && audio.radio) audio.radio();
}

// A small Cobra hit-squad pushing into the Boardwalk while Rook's
// Vultures hold it — the cover shot's background fight. No war object,
// no banner, no gang cars: just three green shooters, one burning
// barricade and the turf tint under the story's final fight. The squad
// stages on the mission fight itself (Rook's crew is at y 1220-1400),
// because the player's car rolls north while the shot settles and the
// camera follows it: anything staged south of y 1440 falls out of frame.
export function stageSkirmish(G) {
  const spots = [[2350, 1330], [2380, 1400], [2320, 1380]];
  for (const [x, y] of spots) {
    G.enemies.push({ x, y, angle: Math.PI, hp: 60, fireCd: 1.2, gang: 'cobras', turf: true });
  }
  G.barricades.push({ x: 2340, y: 1360, angle: 0.5, burning: true, t: 0 });
  G.turf.cooldown = 1e9; // staged shot: no full war may erupt on top of it
}

// One turf fighter's shot: a tracer with the shooter's gang on it, so
// combat knows it may only hurt the rival gang (and Rico, if he stands
// in the crossfire). Same speed as an SMG round, a little spread.
function gangFire(G, e, targetAngle, audio) {
  const spread = (Math.random() - 0.5) * 0.11;
  const a = targetAngle + spread;
  G.bullets.push({
    x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 18,
    vx: Math.cos(a) * 950, vy: Math.sin(a) * 950,
    life: 0.5, dmg: 7, fromPlayer: false, gang: e.gang,
  });
  G.particles.push({
    x: e.x + Math.cos(a) * 22, y: e.y + Math.sin(a) * 22,
    vx: 0, vy: 0, life: 0.08, max: 0.08, size: 10, color: '#ffd93d',
  });
  if (audio && audio.enemyShoot) audio.enemyShoot();
}

// Nearest living enemy that is not on this fighter's side. Mission
// enemies carry gang:true (a boolean), which is hostile to both gangs,
// so a staged Cobra squad shoots Rook's Vultures on sight.
function nearestRival(G, e) {
  let best = null, bd = 1e18;
  for (const o of G.enemies) {
    if (o.hp <= 0 || o === e || o.gang === e.gang) continue;
    const d = dist2(e.x, e.y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return { foe: best, d2: bd };
}

// The war clock. Called once a frame from the main loop, after combat:
// it starts wars, drives every turf fighter, smokes the burning
// barricades, and settles a zone when one side is wiped out.
export function updateGangWar(G, dt, audio) {
  if (!G.turf) return;
  const T = G.turf;
  if (T.bannerT > 0) T.bannerT -= dt;

  // no war running: count down to the next eruption, then pick a zone.
  // Never during a staged screenshot, and never while the player is
  // sailing — a turf war is a street fight, not a boat chase.
  if (!T.war) {
    T.cooldown -= dt;
    if (T.cooldown <= 0 && !G.shotMode && !G.player.inBoat && G.state === 'playing') {
      const zone = T.zones[Math.floor(Math.random() * T.zones.length)];
      startGangWar(G, zone, audio);
      T.cooldown = WAR_COOLDOWN;
    }
    // barricades age out only between wars, so a war never loses cover
    for (const b of G.barricades) b.t += dt;
    G.barricades = G.barricades.filter((b) => b.t < 30);
    return;
  }

  // --- a war is running ---
  const war = T.war;
  war.t += dt;
  const z = war.zone;
  // a running gunfight draws the PD: the heat creeps up while the war
  // runs, so a long war ends with cruisers on top of the gangs
  if (war.t > 10) G.wanted = clamp(G.wanted + dt * 0.03, 0, 3);
  // the fight stays in its zone: fighters are clamped to the zone plus
  // a sidewalk's worth of spill, so the war never wanders across town
  const zx0 = z.x - 120, zy0 = z.y - 120, zx1 = z.x + z.w + 120, zy1 = z.y + z.h + 120;
  let aliveV = 0, aliveC = 0;
  for (const e of G.enemies) {
    if (!e.turf || e.hp <= 0) continue;
    if (e.gang === 'vultures') aliveV++;
    else if (e.gang === 'cobras') aliveC++;
    // target: the nearest rival first. With no rival in sight, a gang
    // Rico has wronged (standing -3 or worse) turns its guns on him —
    // the price of picking a side. A gang he has never shot ignores him.
    const { foe, d2 } = nearestRival(G, e);
    let tx = null, ty = null, td = Infinity;
    if (foe) { tx = foe.x; ty = foe.y; td = Math.sqrt(d2); }
    else {
      const st = (T.standing && T.standing[e.gang]) || 0;
      const p = G.player;
      if (st <= -3 && p.onFoot && !p.dead && G.state === 'playing') {
        const pd = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
        if (pd < 460) { tx = p.x; ty = p.y; td = pd; }
      }
    }
    if (tx === null) continue; // nobody to fight: hold position
    const want = Math.atan2(ty - e.y, tx - e.x);
    e.angle += clamp(angDiff(want, e.angle), -3 * dt, 3 * dt);
    const d = td;
    if (d > 380) {
      // too far to hit: close the distance, in a slight weave so the
      // street never looks like a firing line standing still
      const weave = Math.sin(G.time * 2 + e.y * 0.01) * 0.4;
      const a = want + weave;
      const nx = e.x + Math.cos(a) * 100 * dt;
      const ny = e.y + Math.sin(a) * 100 * dt;
      const hit = collideCircle(G.city, nx, ny, 12);
      e.x = clamp(hit.x, zx0, zx1);
      e.y = clamp(hit.y, zy0, zy1);
    } else {
      // in range: hold ground, strafe a step, and shoot
      const strafe = Math.sin(G.time * 1.5 + e.x * 0.02) * 30 * dt;
      const px = -Math.sin(e.angle), py = Math.cos(e.angle);
      const hit = collideCircle(G.city, e.x + px * strafe, e.y + py * strafe, 12);
      e.x = clamp(hit.x, zx0, zx1);
      e.y = clamp(hit.y, zy0, zy1);
      e.fireCd -= dt;
      if (e.fireCd <= 0 && d < 460) {
        e.fireCd = 0.85 + Math.random() * 0.7;
        gangFire(G, e, want, audio);
      }
    }
  }

  // reinforcements: a war that drags past 45 seconds draws two more
  // shooters a side, so a stalemate breaks instead of fizzling quietly
  if (!war.reinforced && war.t > 45) {
    war.reinforced = true;
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    G.enemies.push(makeFighter(z.x + 40, cy - 100, 'vultures', 0.5));
    G.enemies.push(makeFighter(z.x + 40, cy + 100, 'vultures', 0.7));
    G.enemies.push(makeFighter(z.x + z.w - 40, cy - 100, 'cobras', 0.5));
    G.enemies.push(makeFighter(z.x + z.w - 40, cy + 100, 'cobras', 0.7));
    setToast(G, 'Both gangs send reinforcements to ' + z.name);
  }

  // drive-by: twice a war, a gang car cruises the zone's road and its
  // passenger hoses the rival side from the window, then peels off.
  // The car is a normal gang car, so it draws with its tag letter and
  // Rico can steal it afterwards if it is still in one piece.
  if (!war.driveby && war.t > war.drivebyAt) {
    const side = Math.random() < 0.5 ? 'vultures' : 'cobras';
    const line = nearestRoadLine(z.y + z.h / 2);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const car = makeCar(dir > 0 ? z.x - 120 : z.x + z.w + 120, line, dir > 0 ? 0 : Math.PI,
      { name: 'Sedan', w: 46, l: 92, speed: 360, accel: 260 }, GANGS[side].color, 'gang');
    car.gangTag = GANGS[side].tag;
    car.driveDir = dir;
    G.cars.push(car);
    war.driveby = { car, side, fireCd: 0.8 };
    war.drivebyAt = war.t + 30;
    setToast(G, GANGS[side].name + ' drive-by on ' + z.name + '!');
  }
  if (war.driveby) {
    const db = war.driveby;
    const car = db.car;
    car.x += car.driveDir * 260 * dt;
    car.angle = car.driveDir > 0 ? 0 : Math.PI;
    db.fireCd -= dt;
    if (db.fireCd <= 0) {
      db.fireCd = 1.1 + Math.random() * 0.4;
      // the passenger shoots the nearest rival from the window
      let best = null, bd = 1e18;
      for (const o of G.enemies) {
        if (o.hp <= 0 || o.gang === db.side) continue;
        const d = dist2(car.x, car.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best && bd < 520 * 520) {
        const a = Math.atan2(best.y - car.y, best.x - car.x);
        G.bullets.push({
          x: car.x, y: car.y,
          vx: Math.cos(a) * 950, vy: Math.sin(a) * 950,
          life: 0.5, dmg: 7, fromPlayer: false, gang: db.side,
        });
        G.particles.push({
          x: car.x + Math.cos(a) * 22, y: car.y + Math.sin(a) * 22,
          vx: 0, vy: 0, life: 0.08, max: 0.08, size: 10, color: '#ffd93d',
        });
      }
    }
    // past the zone: the car peels off and the street is quiet again
    if (car.x < z.x - 200 || car.x > z.x + z.w + 200) {
      G.cars = G.cars.filter((c) => c !== car);
      war.driveby = null;
    }
  }

  // burning barricades smoke and spit flame for the whole war
  for (const b of G.barricades) {
    if (!b.burning) continue;
    if (Math.random() < dt * 14) {
      G.particles.push({
        x: b.x + (Math.random() - 0.5) * 24, y: b.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 12, vy: -34 - Math.random() * 20,
        life: 1.1 + Math.random() * 0.5, max: 1.6, size: 6 + Math.random() * 7, color: '#777',
      });
    }
    if (Math.random() < dt * 8) {
      G.particles.push({
        x: b.x + (Math.random() - 0.5) * 20, y: b.y + (Math.random() - 0.5) * 8,
        vx: 0, vy: -26, life: 0.35, max: 0.35, size: 5 + Math.random() * 6,
        color: Math.random() < 0.5 ? '#e67e22' : '#f1c40f',
      });
    }
  }

  // --- settling the zone ---
  const over = aliveV === 0 || aliveC === 0 || war.t >= war.limit;
  if (!over) return;
  if (war.t < war.limit && (aliveV === 0 || aliveC === 0)) {
    const winner = aliveV > 0 ? 'vultures' : 'cobras';
    z.owner = winner;
    T.wins[winner]++;
    G.stats.turfWarsWon++;
    // the winners leave two patrollers on their new turf: regular gang
    // members who hold the street and shoot Rico if he walks through it
    if (G.enemies.length <= 12) {
      const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
      G.enemies.push({ x: cx - 60, y: cy - 40, angle: 0, hp: 60, fireCd: 2, gang: winner, turf: false });
      G.enemies.push({ x: cx + 60, y: cy + 40, angle: Math.PI, hp: 60, fireCd: 2.5, gang: winner, turf: false });
    }
    if (war.playerKills > 0) {
      // Rico tipped it: the zone, the cash and the score are his
      G.money += WAR_REWARD;
      G.score += WAR_REWARD;
      setToast(G, 'TURF CLAIMED — ' + z.name + ' flies ' + GANGS[winner].name + ' colours now. +$' + WAR_REWARD);
      if (audio && audio.cash) audio.cash();
    } else {
      setToast(G, GANGS[winner].name + ' take ' + z.name + ' — the map just changed');
    }
  } else {
    // time ran out with both gangs still standing: nobody takes it
    setToast(G, 'The ' + z.name + ' war fizzles out — no gang takes the turf');
  }
  // survivors walk off: the street belongs to the winner's colour now,
  // not to stragglers, and the next war starts from a clean street.
  // A drive-by car caught mid-pass peels off with the war.
  if (war.driveby) G.cars = G.cars.filter((c) => c !== war.driveby.car);
  G.enemies = G.enemies.filter((e) => !e.turf);
  // spoils of war: the winners leave ammo and armour where they stood
  if (war.t < war.limit) {
    G.pickups.push({ x: z.x + z.w / 2, y: z.y + z.h / 2, kind: 'smg', val: 0, t: 0 });
    G.pickups.push({ x: z.x + z.w / 2 + 50, y: z.y + z.h / 2 + 30, kind: 'armor', val: 0, t: 0 });
  }
  T.war = null;
  T.cooldown = WAR_COOLDOWN;
}

// --- drawing ---

// Turf tint on the ground: each zone wears its owner's colour, the war
// zone pulses between the two gangs' colours, and every zone carries
// its name and owner so the map reads as territory at a glance. A zone
// label that would land under the HUD's own top-left panels is skipped:
// the tint and the dashed border still mark the turf, without text
// bleeding out from behind a panel.
export function drawTurfZones(ctx, G, vw, vh) {
  if (!G.turf) return;
  ctx.save();
  ctx.textAlign = 'left';
  for (const z of G.turf.zones) {
    const owner = z.owner === 'neutral' ? null : GANGS[z.owner];
    const col = owner ? owner.color : '#95a5a6';
    const inWar = G.turf.war && G.turf.war.zone === z;
    // ground tint: stronger and pulsing while the zone is fought over
    const pulse = inWar ? 0.10 + 0.06 * Math.sin(G.time * 6) : 0.08;
    ctx.fillStyle = inWar
      ? (Math.floor(G.time * 2) % 2 === 0 ? GANGS.vultures.color : GANGS.cobras.color)
      : col;
    ctx.globalAlpha = pulse;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.globalAlpha = 1;
    // dashed border in the owner's colour
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    ctx.strokeRect(z.x, z.y, z.w, z.h);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // zone name + owner on a dark chip, top-left inside the zone —
    // unless that corner sits under the HUD's top-left panels, where
    // the chip would read as a glitch peeking out from behind them
    const labelSx = (z.x + 8 - G.cam.x) * G.cam.zoom + vw / 2;
    const labelSy = (z.y + 8 - G.cam.y) * G.cam.zoom + vh / 2;
    const underHud = labelSx < 250 && labelSy > 4 && labelSy < 240;
    ctx.font = 'bold 15px sans-serif';
    const label = z.name.toUpperCase() + '  •  ' + (owner ? owner.name.toUpperCase() : 'CONTESTED');
    const w = ctx.measureText(label).width + 18;
    if (!underHud) {
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      ctx.fillRect(z.x + 8, z.y + 8, w, 24);
      ctx.fillStyle = inWar ? '#ff5a4e' : col;
      ctx.fillText(label, z.x + 17, z.y + 25);
    }
    // spray-painted gang tags on the asphalt: the owner's letter, big
    // and faded, one in each corner of the zone — territory you can read
    // from the street without opening any menu
    if (owner) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.font = 'bold 46px sans-serif';
      ctx.fillStyle = col;
      ctx.translate(z.x + 46, z.y + z.h - 26);
      ctx.rotate(-0.14);
      ctx.fillText(owner.tag, 0, 0);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.font = 'bold 34px sans-serif';
      ctx.fillStyle = col;
      ctx.translate(z.x + z.w - 58, z.y + 66);
      ctx.rotate(0.18);
      ctx.fillText(owner.tag, 0, 0);
      ctx.restore();
    }
    // a war zone shouts: live counts on a chip at the top of the zone,
    // clear of the fighters and of Rico in the middle of the street
    if (inWar) {
      const war = G.turf.war;
      const av = G.enemies.filter((e) => e.turf && e.gang === 'vultures' && e.hp > 0).length;
      const ac = G.enemies.filter((e) => e.turf && e.gang === 'cobras' && e.hp > 0).length;
      ctx.textAlign = 'center';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      const mid = 'GANG WAR  •  VULTURES ' + av + ' — ' + ac + ' COBRAS';
      const mw = ctx.measureText(mid).width + 24;
      ctx.fillRect(z.x + z.w / 2 - mw / 2, z.y + 40, mw, 32);
      ctx.fillStyle = '#ff5a4e';
      ctx.fillText(mid, z.x + z.w / 2, z.y + 63);
      ctx.textAlign = 'left';
      void war;
    }
  }
  ctx.restore();
}

// Barricades: striped road barriers with sandbags, drawn above the
// street and below the fighters. The burning one flickers with drawn
// flame on top of the smoke particles the update loop emits.
export function drawBarricades(ctx, G) {
  for (const b of G.barricades || []) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    // sandbags at the feet
    ctx.fillStyle = '#8a7a55';
    for (const [sx, sy] of [[-26, 12], [-8, 14], [10, 12], [26, 10]]) {
      ctx.beginPath(); ctx.ellipse(sx, sy, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    }
    // striped barrier board: red / white, the colour of a road closed
    // for a fight rather than for works
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#e74c3c' : '#f5f5f5';
      ctx.fillRect(-32 + i * 13, -14, 13, 12);
    }
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(-30, -2, 6, 18);
    ctx.fillRect(24, -2, 6, 18);
    // the burning barricade: flame licks over the board, flickering
    // with the clock so no two frames draw it the same
    if (b.burning) {
      const fl = 1 + Math.sin(G.time * 11 + b.x) * 0.25;
      ctx.fillStyle = 'rgba(230,126,34,0.9)';
      ctx.beginPath(); ctx.ellipse(0, -20, 16 * fl, 12 * fl, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(241,196,15,0.9)';
      ctx.beginPath(); ctx.ellipse(0, -18, 9 * fl, 7 * fl, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

// Which turf zone a point stands in, or null on open ground. The HUD
// uses it to tell Rico whose turf he is walking through.
export function zoneAt(G, x, y) {
  if (!G.turf) return null;
  return G.turf.zones.find((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h) || null;
}

// Zones held per gang, the leader, and wars Rico has helped win — for
// the end screen and any panel that wants the scoreboard in one line.
export function turfSummary(G) {
  if (!G.turf) return null;
  const v = G.turf.zones.filter((z) => z.owner === 'vultures').length;
  const c = G.turf.zones.filter((z) => z.owner === 'cobras').length;
  return {
    vultures: v, cobras: c,
    leader: v > c ? 'vultures' : c > v ? 'cobras' : null,
    warsWon: G.stats.turfWarsWon,
  };
}

// Counts for the HUD: live fighters per gang in the running war, or
// null when the streets are quiet.
export function warCounts(G) {
  if (!G.turf || !G.turf.war) return null;
  return {
    zone: G.turf.war.zone,
    vultures: G.enemies.filter((e) => e.turf && e.gang === 'vultures' && e.hp > 0).length,
    cobras: G.enemies.filter((e) => e.turf && e.gang === 'cobras' && e.hp > 0).length,
    tLeft: Math.max(0, Math.ceil(G.turf.war.limit - G.turf.war.t)),
  };
}
