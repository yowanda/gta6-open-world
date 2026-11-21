// activities.js — side activities in Solara Bay: taxi fares and street races.
// Both pay cash, show on the HUD and the minimap, and need no mission to play.
// Taxi: drive a Taxi cab and fares appear. Race: drive through the checkered
// flag on the Strip avenue to start a checkpoint race against the clock.
import { WORLD, dist2, clamp } from './state.js';
import { setToast, spawnParticles } from './entities.js';
import { randomRoadPos } from './city.js';

export const RACE_START = { x: 1170, y: 910 };
// Six checkpoints looping the Strip and Downtown avenues (all on road lines).
export const RACE_POINTS = [
  { x: 1950, y: 910 }, { x: 1950, y: 1690 }, { x: 910, y: 1690 },
  { x: 910, y: 390 }, { x: 1430, y: 390 }, { x: 1170, y: 910 },
];
export const RACE_PRIZE = 1500;
export const RACE_LIMIT = 150; // seconds to finish the whole loop

function roadPointNear(G, px, py, minD, maxD) {
  for (let tries = 0; tries < 12; tries++) {
    const pos = randomRoadPos(G.rng);
    const d = Math.hypot(pos.x - px, pos.y - py);
    if (d >= minD && d <= maxD) return { x: pos.x, y: pos.y };
  }
  return { x: clamp(px + 400, 100, WORLD - 100), y: clamp(py, 100, WORLD - 100) };
}

function startFare(G) {
  const p = G.player;
  const spot = roadPointNear(G, p.x, p.y, 350, 900);
  G.taxi = { stage: 'pickup', x: spot.x, y: spot.y, fare: 0, t: 0, tx: 0, ty: 0 };
  setToast(G, 'Taxi fare: pick up the passenger at the green $ marker');
}

function dropFare(G, audio) {
  const p = G.player;
  const dest = roadPointNear(G, p.x, p.y, 400, 1000);
  const dist = Math.round(Math.hypot(dest.x - p.x, dest.y - p.y));
  const fare = 60 + Math.min(160, Math.floor(dist / 8));
  G.taxi = { stage: 'dropoff', x: dest.x, y: dest.y, fare, t: 0, tx: p.x, ty: p.y };
  setToast(G, 'Passenger aboard — drop them off for $' + fare);
  audio.pickup();
}

export function updateActivities(G, input, audio, dt) {
  const p = G.player;
  if (G.state !== 'playing' || p.dead) return;
  updateBounty(G, audio, dt);

  // --- Taxi fares: only while driving a Taxi cab ---
  const inTaxi = p.inCar && p.inCar.model.name === 'Taxi';
  if (inTaxi && !G.taxi) startFare(G);
  if (!inTaxi && G.taxi) { G.taxi = null; }
  if (G.taxi) {
    const t = G.taxi;
    t.t += dt;
    if (t.stage === 'pickup' && dist2(p.x, p.y, t.x, t.y) < 46 * 46) {
      spawnParticles(G, p.x, p.y, 8, '#2ecc71');
      dropFare(G, audio);
    } else if (t.stage === 'dropoff') {
      if (dist2(p.x, p.y, t.x, t.y) < 46 * 46) {
        // tip for a quick, smooth drop-off (under 75 s, no crash recently)
        const tip = t.t < 75 ? 40 : 0;
        G.money += t.fare + tip;
        G.score += 150;
        G.stats.fares++;
        setToast(G, 'Fare complete: +$' + (t.fare + tip) + (tip ? ' (incl. $40 quick tip)' : ''));
        audio.cash();
        G.taxi = null;
      } else if (t.t > 150) {
        setToast(G, 'The passenger gave up waiting and got out');
        audio.fail();
        G.taxi = null;
      }
    }
  }

  // --- Street race: drive through the flag on the Strip to start ---
  if (G.race && G.race.cooldown > 0) G.race.cooldown -= dt;
  if (!G.race || !G.race.active) {
    if (p.inCar && !G.mission && !G.side?.active && !G.dialog && dist2(p.x, p.y, RACE_START.x, RACE_START.y) < 46 * 46
      && Math.abs(p.inCar.speed) > 60 && (!G.race || G.race.cooldown <= 0)) {
      G.race = { active: true, cp: 0, t: 0, points: RACE_POINTS, cooldown: 0 };
      G.raceFlash = 3;
      setToast(G, 'STREET RACE! Hit all 6 checkpoints — $' + RACE_PRIZE + ' for the win');
      audio.mission();
    }
    return;
  }
  const r = G.race;
  r.t += dt;
  const cp = r.points[r.cp];
  if (cp && dist2(p.x, p.y, cp.x, cp.y) < 56 * 56) {
    r.cp++;
    spawnParticles(G, cp.x, cp.y, 12, '#2ecc71');
    audio.pickup();
    if (r.cp >= r.points.length) {
      const prize = RACE_PRIZE + Math.max(0, Math.floor((RACE_LIMIT - r.t)) * 5);
      G.money += prize;
      G.score += 800;
      G.stats.racesWon++;
      if (!G.stats.raceBest || r.t < G.stats.raceBest) G.stats.raceBest = r.t;
      setToast(G, 'Race won in ' + r.t.toFixed(1) + 's! +$' + prize);
      audio.cash();
      G.race = { active: false, cp: 0, t: 0, points: RACE_POINTS, cooldown: 20 };
      return;
    }
    setToast(G, 'Checkpoint ' + r.cp + '/' + r.points.length);
  }
  if (!p.inCar) {
    setToast(G, 'Race abandoned — you left the car');
    G.race = { active: false, cp: 0, t: 0, points: RACE_POINTS, cooldown: 20 };
  } else if (r.t > RACE_LIMIT) {
    setToast(G, 'Race failed — out of time');
    audio.fail();
    G.race = { active: false, cp: 0, t: 0, points: RACE_POINTS, cooldown: 20 };
  }
}

// --- Vulture bounty: wanted gang members roam the city, $400 a head ---
export const BOUNTY_REWARD = 400;   // cash per Vulture taken down
export const BOUNTY_ROUND = 3;      // targets per round
export const BOUNTY_WAIT = 45;      // seconds between rounds

// A road spot a good way from the player, so the hunt means driving there.
function bountySpawnPoint(G) {
  const p = G.player;
  for (let tries = 0; tries < 10; tries++) {
    const pos = randomRoadPos(G.rng);
    if (Math.hypot(pos.x - p.x, pos.y - p.y) >= 450) return { x: pos.x, y: pos.y };
  }
  return { x: clamp(p.x + 500, 100, WORLD - 100), y: clamp(p.y, 100, WORLD - 100) };
}

export function updateBounty(G, audio, dt) {
  const p = G.player;
  if (G.state !== 'playing' || p.dead || G.mission || G.side?.active || G.dialog) return;
  if (!G.bounty) {
    G.bountyCd = Math.max(0, (G.bountyCd || 0) - dt);
    if (G.bountyCd > 0) return;
    // a new round surfaces: three wanted Vultures, red $ on the minimap
    for (let i = 0; i < BOUNTY_ROUND; i++) {
      const pos = bountySpawnPoint(G);
      G.enemies.push({
        x: pos.x, y: pos.y, angle: 0, hp: 60,
        fireCd: 1 + Math.random(), gang: true, bounty: true,
      });
    }
    G.bounty = { left: BOUNTY_ROUND, total: BOUNTY_ROUND, t: 0 };
    setToast(G, 'BOUNTY: three wanted Vultures are loose — $' + BOUNTY_REWARD + ' each, red $ on the map');
    audio.mission();
    return;
  }
  const b = G.bounty;
  b.t += dt;
  if (b.left <= 0) {
    const pay = BOUNTY_ROUND * BOUNTY_REWARD;
    G.money += pay;
    G.score += 600;
    G.stats.bounties++;
    G.stats.bountyCash = (G.stats.bountyCash || 0) + pay;
    setToast(G, 'Bounty round cleared! +$' + pay);
    audio.cash();
    G.bounty = null;
    G.bountyCd = BOUNTY_WAIT;
  }
}
