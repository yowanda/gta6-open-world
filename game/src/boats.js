// boats.js — drivable speedboats and the Bay Runner race in Solara Bay.
// Two wooden docks on the east shore moor a speedboat each. Walk onto a
// dock and press E to climb aboard; the boat only runs on water, turns
// wide, outruns any car on land, and leaves a foam wake. A timed buoy
// race off the Marina dock pays cash, following the street-race pattern
// in activities.js. All original content.
import { WORLD, clamp, dist2 } from './state.js';
import { setToast } from './entities.js';

export const WATER_X = 2470;          // water starts here (matches city.js beach)
export const BOAT_TOP = 560;          // faster than any car on land
export const BOAT_ACCEL = 320;
export const BAY_RACE_PRIZE = 1200;
export const BAY_RACE_LIMIT = 75;     // seconds to round all four buoys

// The docks: wooden piers reaching from the sand into the bay. (x, y) is
// the board point where Rico stands to climb aboard; (bx, by) is the
// mooring in the water beside the pier head.
export const DOCKS = [
  { name: 'Marina Dock', x: 2445, y: 1150, bx: 2545, by: 1150 },
  { name: 'Portside Dock', x: 2445, y: 2050, bx: 2545, by: 2050 },
];
// Bay Runner buoys: the start buoy floats by the Marina dock, then three
// markers run down the bay and back to the start to finish.
export const BAY_START = { x: 2545, y: 1050 };
export const BAY_RACE_POINTS = [
  { x: 2545, y: 550 }, { x: 2545, y: 1750 }, { x: 2545, y: 2350 }, { x: 2545, y: 1050 },
];

export function makeBoat(dock) {
  const d = DOCKS[dock];
  return {
    x: d.bx, y: d.by, angle: -Math.PI / 2, speed: 0,
    dock, moored: true,
    color: dock === 0 ? '#e74c3c' : '#f1c40f',
  };
}

export function initBoats(G) {
  G.boats = DOCKS.map((d, i) => makeBoat(i));
  G.boatRace = null;
}

// --- boarding: only from a dock, only into a boat moored at that dock ---
function tryBoardBoat(G, audio) {
  const p = G.player;
  for (const d of DOCKS) {
    if (dist2(p.x, p.y, d.x, d.y) > 80 * 80) continue;
    const b = G.boats.find(b => b.moored && dist2(b.x, b.y, d.bx, d.by) < 150 * 150);
    if (!b) continue;
    b.moored = false;
    p.inBoat = b;
    p.onFoot = false;
    p.x = b.x; p.y = b.y; p.angle = b.angle;
    setToast(G, 'Aboard the speedboat — W throttle, A/D steer, E at a dock to get out');
    audio.pickup();
    return true;
  }
  return false;
}

// --- leaving: only at a dock, the boat is tied up at its mooring again ---
function exitBoat(G) {
  const p = G.player;
  const b = p.inBoat;
  if (!b) return false;
  let near = null;
  for (const d of DOCKS) {
    if (dist2(b.x, b.y, d.x, d.y) < 120 * 120) { near = d; break; }
  }
  if (!near) {
    setToast(G, 'Bring the boat to a dock to get out');
    return false;
  }
  b.x = near.bx; b.y = near.by; b.angle = -Math.PI / 2; b.speed = 0; b.moored = true;
  p.x = near.x; p.y = near.y; p.angle = -Math.PI / 2;
  p.inBoat = null;
  p.onFoot = true;
  p.speed = 0;
  return true;
}

function spawnWake(G, b) {
  // foam at the stern, drifting back as the boat pushes on
  const sx = b.x - Math.cos(b.angle) * 46, sy = b.y - Math.sin(b.angle) * 46;
  for (let i = 0; i < 2; i++) {
    G.particles.push({
      x: sx + (Math.random() - 0.5) * 16, y: sy + (Math.random() - 0.5) * 16,
      vx: -Math.cos(b.angle) * 30 + (Math.random() - 0.5) * 40,
      vy: -Math.sin(b.angle) * 30 + (Math.random() - 0.5) * 40,
      life: 0.9, max: 0.9, size: 5 + Math.random() * 4, color: '#dff3fa',
    });
  }
}

// prompt for the interaction line in main.js: what E does at a dock
export function boatPrompt(G) {
  const p = G.player;
  if (p.inBoat) {
    for (const d of DOCKS) {
      if (dist2(p.inBoat.x, p.inBoat.y, d.x, d.y) < 120 * 120) return 'E: step off at the ' + d.name;
    }
    return 'E: find a dock to step off';
  }
  if (p.onFoot && !p.inCar) {
    for (const d of DOCKS) {
      if (dist2(p.x, p.y, d.x, d.y) < 80 * 80) {
        const b = (G.boats || []).find(b => b.moored && dist2(b.x, b.y, d.bx, d.by) < 150 * 150);
        if (b) return 'E: board the speedboat at the ' + d.name;
      }
    }
  }
  return null;
}

export function updateBoats(G, input, audio, dt) {
  const p = G.player;
  G._boatE = false;
  if (G.state !== 'playing' || p.dead) return;

  // E boards at a dock or steps off at one. Whatever happens, the press
  // is eaten here so the car-steal in updatePlayer never fires on the
  // same keypress while Rico is on the water.
  if (input.hit('e')) {
    if (p.inBoat) { exitBoat(G); G._boatE = true; }
    else if (!p.inCar && tryBoardBoat(G, audio)) G._boatE = true;
  }

  if (p.inBoat) {
    const b = p.inBoat;
    const ax = input.axis();
    let fwd = -ax.y; // W = throttle
    if (G.shotMode) fwd = 1; // staged screenshots: keep the boat running
    const steer = ax.x;
    b.speed += fwd * BOAT_ACCEL * dt;
    if (fwd === 0) b.speed -= Math.sign(b.speed) * 90 * dt;
    b.speed = clamp(b.speed, -120, BOAT_TOP);
    if (Math.abs(b.speed) < 4 && fwd === 0) b.speed = 0;
    // wide turns: a boat heels and slides, it never pivots like a car
    const turn = steer * 1.25 * clamp(Math.abs(b.speed) / 150, 0, 1) * (b.speed >= 0 ? 1 : -1);
    b.angle += turn * dt;
    const nx = b.x + Math.cos(b.angle) * b.speed * dt;
    const ny = b.y + Math.sin(b.angle) * b.speed * dt;
    // the boat only floats: the shore stops it, it never climbs onto land
    if (nx < WATER_X + 8) { b.x = WATER_X + 8; b.speed *= 0.4; }
    else b.x = clamp(nx, WATER_X + 8, WORLD - 12);
    b.y = clamp(ny, 30, WORLD - 30);
    p.x = b.x; p.y = b.y; p.angle = b.angle; p.speed = b.speed;
    if (Math.abs(b.speed) > 140) spawnWake(G, b);
  }

  updateBayRace(G, audio, dt);
}

// --- Bay Runner: a timed buoy race, same shape as the street race ---
function updateBayRace(G, audio, dt) {
  const p = G.player;
  if (G.boatRace && G.boatRace.cooldown > 0) G.boatRace.cooldown -= dt;
  if (!G.boatRace || !G.boatRace.active) {
    if (p.inBoat && !G.mission && !G.dialog
      && dist2(p.x, p.y, BAY_START.x, BAY_START.y) < 46 * 46
      && Math.abs(p.inBoat.speed) > 60
      && (!G.boatRace || G.boatRace.cooldown <= 0)) {
      G.boatRace = { active: true, cp: 0, t: 0, points: BAY_RACE_POINTS, cooldown: 0 };
      setToast(G, 'BAY RUNNER! Round all 4 buoys — $' + BAY_RACE_PRIZE + ' for the win');
      audio.mission();
    }
    return;
  }
  const r = G.boatRace;
  r.t += dt;
  const cp = r.points[r.cp];
  if (cp && dist2(p.x, p.y, cp.x, cp.y) < 56 * 56) {
    r.cp++;
    spawnWake(G, p.inBoat);
    audio.pickup();
    if (r.cp >= r.points.length) {
      const prize = BAY_RACE_PRIZE + Math.max(0, Math.floor((BAY_RACE_LIMIT - r.t)) * 5);
      G.money += prize;
      G.score += 800;
      G.stats.racesWon++;
      if (!G.stats.boatBest || r.t < G.stats.boatBest) G.stats.boatBest = r.t;
      setToast(G, 'Bay Runner won in ' + r.t.toFixed(1) + 's! +$' + prize);
      audio.cash();
      G.boatRace = { active: false, cp: 0, t: 0, points: BAY_RACE_POINTS, cooldown: 20 };
      return;
    }
    setToast(G, 'Buoy ' + r.cp + '/' + r.points.length);
  }
  if (!p.inBoat) {
    setToast(G, 'Bay Runner abandoned — you left the boat');
    G.boatRace = { active: false, cp: 0, t: 0, points: BAY_RACE_POINTS, cooldown: 20 };
  } else if (r.t > BAY_RACE_LIMIT) {
    setToast(G, 'Bay Runner failed — out of time');
    audio.fail();
    G.boatRace = { active: false, cp: 0, t: 0, points: BAY_RACE_POINTS, cooldown: 20 };
  }
}

// --- drawing: docks, buoys and the boats themselves (called from render.js) ---
export function drawDocks(ctx, G) {
  ctx.textAlign = 'center';
  for (const d of DOCKS) {
    // wooden pier from the sand out into the bay
    ctx.fillStyle = '#8a6b48';
    ctx.fillRect(d.x - 20, d.y - 14, 140, 28);
    ctx.fillStyle = '#6e5439';
    for (let px = d.x - 20; px < d.x + 120; px += 18) {
      ctx.fillRect(px, d.y - 14, 3, 28);
      ctx.fillRect(px, d.y + 14, 4, 10);
    }
    // mooring posts at the pier head
    ctx.fillStyle = '#5d4630';
    ctx.fillRect(d.x + 108, d.y - 20, 6, 8);
    ctx.fillRect(d.x + 108, d.y + 12, 6, 8);
    // painted sign on the sand where the pier meets the shore
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(d.name.toUpperCase(), d.x - 52, d.y - 22);
  }
}

export function drawBuoys(ctx, G) {
  const racing = G.boatRace && G.boatRace.active;
  // the start buoy floats by the Marina dock when no race is running
  if (!racing) {
    ctx.fillStyle = '#ff9f1a';
    ctx.beginPath(); ctx.arc(BAY_START.x, BAY_START.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(BAY_START.x, BAY_START.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff9f1a'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BAY RUNNER', BAY_START.x, BAY_START.y - 22);
  } else {
    const cp = G.boatRace.points[G.boatRace.cp];
    if (cp) {
      ctx.strokeStyle = '#ff9f1a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cp.x, cp.y, 56, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ff9f1a'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BUOY ' + (G.boatRace.cp + 1) + '/' + G.boatRace.points.length, cp.x, cp.y - 66);
    }
    for (let i = G.boatRace.cp + 1; i < G.boatRace.points.length; i++) {
      ctx.fillStyle = 'rgba(255,159,26,0.55)';
      ctx.beginPath(); ctx.arc(G.boatRace.points[i].x, G.boatRace.points[i].y, 8, 0, Math.PI * 2); ctx.fill();
    }
  }
}

export function drawBoats(ctx, G) {
  for (const b of G.boats || []) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    // shadow on the water
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(3, 4, 24, 48, 0, 0, Math.PI * 2); ctx.fill();
    // hull — a speedboat: pointed bow, white topsides, coloured stripe
    ctx.fillStyle = '#f4f6f7';
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(17, -30); ctx.lineTo(20, 34); ctx.lineTo(14, 46);
    ctx.lineTo(-14, 46); ctx.lineTo(-20, 34); ctx.lineTo(-17, -30);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = b.color;
    ctx.fillRect(-20, -6, 40, 10);
    // windshield + cockpit
    ctx.fillStyle = '#1c2733';
    ctx.beginPath(); ctx.moveTo(-13, -26); ctx.lineTo(13, -26); ctx.lineTo(10, -12); ctx.lineTo(-10, -12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-12, 0, 24, 26);
    // outboard motor on the transom
    ctx.fillStyle = '#222';
    ctx.fillRect(-8, 46, 16, 10);
    // the player's boat wears the same gold outline as the player's car
    if (G.player.inBoat === b) {
      ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -56);
      ctx.lineTo(20, -32); ctx.lineTo(23, 34); ctx.lineTo(16, 50);
      ctx.lineTo(-16, 50); ctx.lineTo(-23, 34); ctx.lineTo(-20, -32);
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
}
