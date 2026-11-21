// city.js — generates the city of Solara Bay: road grid, districts, buildings,
// beach, park, marina, and collision helpers. All original layout.
import { WORLD, ROAD_GAP, ROAD_HALF, mulberry32, pick } from './state.js';

export const ROAD_LINES = [];
for (let i = 0; i < 10; i++) ROAD_LINES.push(130 + i * ROAD_GAP);

export function nearestRoadLine(v) {
  let best = ROAD_LINES[0], bd = 1e9;
  for (const l of ROAD_LINES) { const d = Math.abs(v - l); if (d < bd) { bd = d; best = l; } }
  return best;
}
export function onRoad(x, y) {
  for (const l of ROAD_LINES) {
    if (Math.abs(x - l) < ROAD_HALF + 6) return true;
    if (Math.abs(y - l) < ROAD_HALF + 6) return true;
  }
  return false;
}
// distance from point to nearest road centreline (for sidewalk placement)
export function roadDist(x, y) {
  let bx = 1e9, by = 1e9;
  for (const l of ROAD_LINES) { bx = Math.min(bx, Math.abs(x - l)); by = Math.min(by, Math.abs(y - l)); }
  return Math.min(bx, by);
}

const DISTRICT_NAMES = [
  ['Downtown', '#c9a86a'], ['Old Town', '#b08968'], ['Marina District', '#7fb3c8'],
  ['Palm Heights', '#a3b18a'], ['The Strip', '#e07a5f'], ['Portside', '#8d99ae'],
];
const BUILDING_COLORS = ['#d9b48f', '#c98f6b', '#a8b8c4', '#e0cfa8', '#b5a58f', '#9db3a8', '#d3a6a0', '#8fa8bf', '#e8d8b0', '#c4b49a'];

export function generateCity() {
  const rng = mulberry32(777);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const districts = [];
  // Districts: 3x2 grid of named neighbourhoods
  for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 2; gy++) {
    districts.push({
      name: DISTRICT_NAMES[gy * 3 + gx][0],
      x: gx * 880 + 20, y: gy * 1300 + 20, w: 840, h: 1260,
    });
  }
  // Buildings: one or two per block (blocks are between roads)
  for (let bx = 0; bx < 9; bx++) for (let by = 0; by < 9; by++) {
    const x0 = ROAD_LINES[bx] + ROAD_HALF + 14;
    const x1 = ROAD_LINES[bx + 1] - ROAD_HALF - 14;
    const y0 = ROAD_LINES[by] + ROAD_HALF + 14;
    const y1 = ROAD_LINES[by + 1] - ROAD_HALF - 14;
    // Central park block
    if (bx === 4 && by === 4) {
      for (let i = 0; i < 26; i++) trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), r: 10 + rng() * 8 });
      continue;
    }
    // Beach strip: east edge is sand + water, no buildings in last column
    if (bx === 8) continue;
    const downtown = bx >= 3 && bx <= 5 && by >= 2 && by <= 4;
    const n = downtown ? 2 : (rng() < 0.55 ? 2 : 1);
    for (let k = 0; k < n; k++) {
      const bw = 60 + rng() * 70, bh = 60 + rng() * 70;
      const px = x0 + (k === 0 ? 6 : (x1 - x0) / 2 + 4) + rng() * 8;
      const py = y0 + 6 + rng() * 10;
      const w = Math.min(bw, x1 - px - 6), h = Math.min(bh, y1 - py - 6);
      if (w < 40 || h < 40) continue;
      buildings.push({
        x: px, y: py, w, h,
        color: pick(rng, BUILDING_COLORS),
        height: downtown ? 26 + rng() * 42 : 8 + rng() * 16,
        roof: rng(),
        label: downtown && rng() < 0.3 ? pick(rng, ['SOLARA BANK', 'PALMS HOTEL', 'NEON CASINO', 'CITY HALL', 'MARINA TOWER']) : null,
      });
    }
    // street trees and lamps on block corners
    if (rng() < 0.6) trees.push({ x: x0 + 10, y: y0 + 10, r: 9 + rng() * 5 });
    if (rng() < 0.5) trees.push({ x: x1 - 12, y: y1 - 12, r: 9 + rng() * 5 });
    lamps.push({ x: ROAD_LINES[bx] + ROAD_HALF + 4, y: ROAD_LINES[by] + ROAD_HALF + 4 });
  }
  // Beach palms along the east strip
  for (let i = 0; i < 18; i++) trees.push({ x: 2380 + rng() * 90, y: 60 + rng() * 2480, r: 11 + rng() * 5, palm: true });

  // Sunset Boardwalk: shop stalls on the sand strip, each a small labelled
  // building the player can walk between and take cover behind. Their y
  // slots sit in the gaps between the road lines, never on a road.
  const stallNames = ['ARCADE', 'SURF SHOP', 'TACOS', 'PIER GIFTS', 'SLUSH', 'BOARD RENTALS'];
  const stallYs = [500, 760, 1040, 1560, 1820, 2080];
  for (let i = 0; i < stallNames.length; i++) {
    buildings.push({
      x: 2362, y: stallYs[i], w: 72, h: 46,
      color: pick(rng, ['#e07a5f', '#7fb3c8', '#f2c14e', '#a3b18a', '#e07a9f', '#8d99ae']),
      height: 6 + rng() * 6,
      roof: rng(),
      label: stallNames[i],
    });
  }

  return {
    buildings, trees, lamps, districts,
    boardwalk: {
      pier: { x: 2470, y: 1282, w: 95, h: 36 },
      wheel: { x: 2430, y: 1300, r: 55 },
    },
    beach: { x0: 2350, waterX: 2470 },   // sand from 2350, water from 2470
    park: { x: ROAD_LINES[4] + ROAD_HALF + 14, y: ROAD_LINES[4] + ROAD_HALF + 14, w: ROAD_GAP - 2 * ROAD_HALF - 28, h: ROAD_GAP - 2 * ROAD_HALF - 28 },
    safehouse: { x: 420, y: 420 },
    gunshop: { x: 1690, y: 650 },
    spray: { x: 1950, y: 1690 },
    hospital: { x: 650, y: 1950 },
    bank: { x: 1170, y: 910 },
    casino: { x: 1430, y: 1170 },
    marina: { x: 2400, y: 1300 },
  };
}

// Circle vs building AABB collision; returns corrected position.
export function collideCircle(city, x, y, r) {
  let nx = x, ny = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx, dy = ny - cy, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 0.0001) { ny = b.y - r; continue; }
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * r;
      ny = cy + (dy / d) * r;
    }
  }
  nx = Math.max(20, Math.min(WORLD - 20, nx));
  ny = Math.max(20, Math.min(WORLD - 20, ny));
  return { x: nx, y: ny };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  return null;
}

// Random road position (for spawning traffic / police). dir is the heading
// along the road: 0 / PI drive along x, +/-PI/2 along y.
export function randomRoadPos(rng) {
  const vertical = rng() < 0.5;
  const line = ROAD_LINES[Math.floor(rng() * ROAD_LINES.length)];
  const along = 60 + rng() * (WORLD - 120);
  return vertical ? { x: line, y: along, dir: rng() < 0.5 ? 0 : Math.PI } : { x: along, y: line, dir: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
}
