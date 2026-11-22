// state.js — shared game state, constants and helpers for Solara Bay.
// All original content: a fictional sun-soaked coastal city, its people and story.
export const WORLD = 2600;            // world is WORLD x WORLD px
export const ROAD_GAP = 260;          // distance between road centrelines
export const ROAD_HALF = 34;          // half road width
export const TILE = 260;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
// nightFactor: 0 in daylight, up to 1 in deep night. Shared by the main
// loop (screen tint) and the renderer (headlights, lamp glow, spotlights).
export function nightFactor(clockMin) {
  const h = (clockMin / 60) % 24;
  if (h >= 6 && h < 18) return 0;
  if (h >= 18 && h < 20) return (h - 18) / 2;
  if (h >= 20 || h < 5) return 1;
  return (6 - h) * 0.5 + 0.2;
}
export function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
// Flat tires change how a car drives. The top speed, the launch and the
// steering all degrade per blown tire (see game/src/police.js).
export function tireFactor(car) {
  const flat = car.flat || 0;
  if (flat <= 0) return 1;
  return Math.max(0.22, 1 - 0.24 * flat);
}
// Wobble a damaged car pulls to one side while it rolls.
export function tireWobble(G, car, dt) {
  const flat = car.flat || 0;
  if (flat <= 0 || Math.abs(car.speed || 0) < 30) return 0;
  return Math.sin(G.time * 9 + car.x * 0.01) * 0.35 * flat * dt * clamp(Math.abs(car.speed) / 200, 0, 1);
}
export function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// Seeded RNG for the world layout so every session plays the same city.
export function createGame() {
  const rng = mulberry32(20261121);
  return {
    rng,
    time: 0,                 // seconds since load
    clockMin: 16 * 60 + 24,  // game clock, minutes (starts late afternoon)
    state: 'menu',           // menu | playing | paused | wasted | busted | storydone
    menuSel: 0,
    pausedSel: 0,
    city: null,
    player: null,
    cars: [],                // traffic + parked + police cars
    peds: [],
    cops: [],                // on-foot police
    enemies: [],             // rival gang members
    bullets: [],
    particles: [],
    pickups: [],             // cash, health, armor, packages
    markers: [],
    wanted: 0,               // 0..5 stars (float for decay)
    wantedTimer: 0,
    money: 500,
    health: 100,
    armor: 0,
    weapon: 'pistol',
    ammo: { pistol: 120, smg: 0, shotgun: 0 },
    score: 0,
    kills: 0,
    carsStolen: 0,
    missionsDone: 0,
    mission: null,           // active mission runtime
    missionIdx: 0,
    dialog: null,            // {lines:[], i:0}
    message: null,           // toast {text, t}
    messageT: 0,
    cam: { x: 1300, y: 1300, zoom: 1 },
    mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false },
    keys: {},
    shotMode: null,          // screenshot staging name
    muted: false,
    stats: { shots: 0, hits: 0, fares: 0, racesWon: 0, raceBest: 0, bounties: 0, bountyCash: 0, boatBest: 0, turfWarsWon: 0, turfKills: 0 },
    heli: null,            // police helicopter at 4+ stars {x, y, angle}
    taxi: null,            // taxi fare job {stage, x, y, fare, t}
    race: null,            // street race {cp, t, points, cooldown}
    raceFlash: 0,          // timer for the race-start banner
    boats: [],             // speedboats moored at the docks (see boats.js)
    boatRace: null,        // Bay Runner buoy race {cp, t, points, cooldown}
    bounty: null,          // Vulture bounty round {left, total, t} while one runs
    bountyCd: 0,           // seconds until the next bounty round may start
    turf: null,            // turf war state: zones, running war, cooldown (see gangwar.js)
    barricades: [],        // war barricades {x, y, angle, burning, t}
    weather: 'clear',      // clear | rain — rolls over on its own timer
    weatherT: 75 + rng() * 60,
    saveSlot: 'solara-bay-save-v1',
  };
}

export const WEAPONS = {
  pistol:  { name: 'Pistol',   dmg: 26, rate: 0.28, spread: 0.05, speed: 900, range: 520, auto: false },
  smg:     { name: 'SMG',      dmg: 14, rate: 0.09, spread: 0.11, speed: 950, range: 460, auto: true },
  shotgun: { name: 'Shotgun',  dmg: 16, rate: 0.85, spread: 0.28, speed: 780, range: 300, auto: false, pellets: 6 },
};

export const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c', '#34495e', '#fd79a8', '#fdcb6e', '#00cec9'];
export const CAR_MODELS = [
  { name: 'Comet', w: 46, l: 84, speed: 420, accel: 300 },
  { name: 'Sedan', w: 46, l: 92, speed: 360, accel: 260 },
  { name: 'Taxi', w: 46, l: 92, speed: 370, accel: 270 },
  { name: 'Van', w: 50, l: 104, speed: 300, accel: 200 },
  { name: 'Sports', w: 44, l: 80, speed: 480, accel: 360 },
  { name: 'Truck', w: 54, l: 120, speed: 280, accel: 180 },
  { name: 'Interceptor', w: 46, l: 88, speed: 520, accel: 400 },
  // round 7: three more ways to move. Stallion is a muscle car — brutal
  // launch, lower top end. Limo is long and heavy, slow to get going.
  // Rider is a motorbike: the fastest thing in the city, but it stops
  // like a bike and has no bodywork to hide behind.
  { name: 'Stallion', w: 48, l: 88, speed: 440, accel: 390 },
  { name: 'Limo', w: 50, l: 132, speed: 300, accel: 170 },
  { name: 'Rider', w: 22, l: 72, speed: 540, accel: 430 },
];
