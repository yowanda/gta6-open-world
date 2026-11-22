// render.js — draws the whole world: sun-soaked streets, buildings with height,
// beach and water, traffic, people, police, bullets and effects.
import { WORLD, ROAD_HALF, clamp, nightFactor } from './state.js';
import { pointInBuilding, ROAD_LINES } from './city.js';
import { RACE_START, RACE_POINTS, BOUNTY_REWARD } from './activities.js';
import { drawDocks, drawBuoys, drawBoats } from './boats.js';
import { drawDragnet } from './police.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, G, vw, vh) {
  const cam = G.cam;
  const z = cam.zoom;
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);

  // ground
  ctx.fillStyle = '#b8a67c'; // dry grass / dirt base
  ctx.fillRect(0, 0, WORLD, WORLD);
  // beach sand + water
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(2350, 0, 250, WORLD);
  const wt = G.time * 0.6;
  ctx.fillStyle = '#2fa8c9';
  ctx.fillRect(2470, 0, 130, WORLD);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 0; y < WORLD; y += 90) {
    const wob = Math.sin(y * 0.02 + wt) * 8;
    ctx.fillRect(2462 + wob, y, 6, 34);
  }
  // Sunset Boardwalk: the pier reaching into the water and the ferris
  // wheel turning over the sand — the skyline of the new east-side strip.
  const bw = G.city.boardwalk;
  if (bw) {
    ctx.fillStyle = '#8a6b48';
    ctx.fillRect(bw.pier.x, bw.pier.y, bw.pier.w, bw.pier.h);
    ctx.fillStyle = '#6e5439';
    for (let px = bw.pier.x + 8; px < bw.pier.x + bw.pier.w; px += 18) {
      ctx.fillRect(px, bw.pier.y, 3, bw.pier.h);
      ctx.fillRect(px, bw.pier.y + bw.pier.h, 4, 10);
    }
    const w = bw.wheel;
    const spin = G.time * 0.25;
    ctx.strokeStyle = '#3a3f4a'; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w.x - 34, w.y + 52); ctx.lineTo(w.x, w.y);
    ctx.moveTo(w.x + 34, w.y + 52); ctx.lineTo(w.x, w.y);
    ctx.stroke();
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = spin + (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r);
      ctx.stroke();
      ctx.fillStyle = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71'][i % 4];
      ctx.beginPath();
      ctx.arc(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath(); ctx.arc(w.x, w.y, 7, 0, Math.PI * 2); ctx.fill();
    // after dark the wheel wears coloured bulbs around its rim
    if (nightFactor(G.clockMin) > 0.25) {
      for (let i = 0; i < 8; i++) {
        const a = spin + (i / 8) * Math.PI * 2;
        ctx.fillStyle = ['#ff5a4e', '#ffd93d', '#2ecc71', '#3498db'][i % 4];
        ctx.beginPath();
        ctx.arc(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(60,45,30,0.35)';
    ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('B O A R D W A L K', 2410, 120);
  }
  // park
  const park = G.city.park;
  ctx.fillStyle = '#7fb069';
  ctx.fillRect(park.x - 6, park.y - 6, park.w + 12, park.h + 12);
  ctx.fillStyle = '#5da271';
  ctx.beginPath(); ctx.ellipse(park.x + park.w / 2, park.y + park.h / 2, 46, 30, 0, 0, Math.PI * 2); ctx.fill();

  // city blocks (sidewalk + block fill)
  for (let bx = 0; bx < 9; bx++) for (let by = 0; by < 9; by++) {
    const x0 = ROAD_LINES[bx] + ROAD_HALF, y0 = ROAD_LINES[by] + ROAD_HALF;
    const x1 = ROAD_LINES[bx + 1] - ROAD_HALF, y1 = ROAD_LINES[by + 1] - ROAD_HALF;
    if (bx === 8) continue; // beach column
    ctx.fillStyle = (bx + by) % 2 === 0 ? '#cbb98d' : '#c2af82';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  // roads
  ctx.fillStyle = '#3d3d46';
  for (const l of ROAD_LINES) {
    ctx.fillRect(l - ROAD_HALF, 0, ROAD_HALF * 2, WORLD);
    ctx.fillRect(0, l - ROAD_HALF, WORLD, ROAD_HALF * 2);
  }
  // lane dashes
  ctx.fillStyle = '#f5d76e';
  for (const l of ROAD_LINES) {
    for (let v = 20; v < WORLD; v += 56) { ctx.fillRect(l - 2, v, 4, 26); ctx.fillRect(v, l - 2, 26, 4); }
  }
  // crosswalks at intersections
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const lx of ROAD_LINES) for (const ly of ROAD_LINES) {
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(lx + i * 9 - 3, ly - ROAD_HALF - 2, 5, 10);
      ctx.fillRect(lx + i * 9 - 3, ly + ROAD_HALF - 8, 5, 10);
    }
  }
  // district names painted on the streets so the city reads as neighbourhoods
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px sans-serif';
  for (const d of G.city.districts) {
    ctx.fillStyle = 'rgba(60,45,30,0.28)';
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }
  // street lamps glow after dark
  const night = nightFactor(G.clockMin);
  if (night > 0.25) {
    for (const lamp of G.city.lamps) {
      ctx.fillStyle = 'rgba(255,214,120,' + (0.5 * night) + ')';
      ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd678';
      ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  // trees
  for (const t of G.city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.palm ? '#2f9e44' : '#4caf50';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#81c784';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  // buildings with pseudo-3D height
  for (const b of G.city.buildings) {
    const h = b.height;
    // south-east wall (height illusion)
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w + h * 0.45, b.y - h * 0.45);
    ctx.lineTo(b.x + b.w + h * 0.45, b.y + b.h - h * 0.45); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + h * 0.45, b.y + b.h - h * 0.45);
    ctx.lineTo(b.x + b.w + h * 0.45, b.y + b.h - h * 0.45); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath(); ctx.fill();
    // roof
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x, b.y, b.w, 5);
    // windows: a deterministic pattern from the block grid; | 0 floors the float
    ctx.fillStyle = 'rgba(40,60,90,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26)), rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if ((i * 7 + j * 3 + b.roof * 10 | 0) % 3 !== 0) ctx.fillRect(b.x + 8 + i * 24, b.y + 8 + j * 24, 12, 12);
    }
    if (b.label) {
      ctx.fillStyle = '#20242c';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }
    // boardwalk stalls get a striped awning on their street side
    if (b.x >= 2350) {
      for (let s = 0; s < 6; s++) {
        ctx.fillStyle = s % 2 === 0 ? '#fff' : '#e74c3c';
        ctx.fillRect(b.x + s * 12, b.y + b.h, 12, 8);
      }
    }
  }
  // mission / place markers on the ground
  for (const m of G.markers) {
    const mx = m.follow ? G.player.x : m.x, my = m.follow ? G.player.y : m.y;
    const pulse = 1 + Math.sin(G.time * 5) * 0.15;
    ctx.strokeStyle = '#ffd93d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(mx, my, (m.radius || 60) * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,217,61,0.12)';
    ctx.beginPath(); ctx.arc(mx, my, (m.radius || 60) * pulse, 0, Math.PI * 2); ctx.fill();
    // bouncing beacon
    const by = my - 46 - Math.abs(Math.sin(G.time * 4)) * 14;
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath(); ctx.moveTo(mx, by + 16); ctx.lineTo(mx - 10, by - 6); ctx.lineTo(mx + 10, by - 6); ctx.closePath(); ctx.fill();
  }
  // pickups
  for (const pk of G.pickups) {
    const bob = Math.sin(G.time * 4 + pk.x) * 3;
    if (pk.kind === 'cash') { ctx.fillStyle = '#2ecc71'; }
    else if (pk.kind === 'health') { ctx.fillStyle = '#e74c3c'; }
    else if (pk.kind === 'armor') { ctx.fillStyle = '#3498db'; }
    else if (pk.kind === 'package') { ctx.fillStyle = '#f39c12'; }
    else { ctx.fillStyle = '#9b59b6'; }
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : pk.kind === 'armor' ? 'A' : '!', pk.x, pk.y + bob + 4);
  }
  // PD dragnet: spike strips and roadblock cruisers, under the traffic
  drawDragnet(ctx, G);
  // the marina docks and the Bay Runner buoys on the water
  drawDocks(ctx, G);
  drawBuoys(ctx, G);
  // cars
  for (const c of G.cars) drawCar(ctx, c, G);
  // speedboats ride on the water, above the docks
  drawBoats(ctx, G);
  // headlight cones after dark: the player's car and police cruisers cut the night
  if (night > 0.25) {
    for (const c of G.cars) {
      if (c.kind !== 'player' && c.kind !== 'police') continue;
      const fx = Math.cos(c.angle), fy = Math.sin(c.angle);
      const bx = c.x + fx * (c.model.l / 2), by = c.y + fy * (c.model.l / 2);
      ctx.fillStyle = 'rgba(255,240,170,' + (0.13 * night) + ')';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + fx * 260 - fy * 70, by + fy * 260 + fx * 70);
      ctx.lineTo(bx + fx * 260 + fy * 70, by + fy * 260 - fx * 70);
      ctx.closePath(); ctx.fill();
    }
  }
  // taxi fare + race markers (green $ and checkered race gates)
  if (G.taxi) {
    const bob = Math.sin(G.time * 4) * 3;
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.arc(G.taxi.x, G.taxi.y + bob, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', G.taxi.x, G.taxi.y + bob + 5);
  }
  if (!G.race || !G.race.active) {
    // checkered race flag on the Strip when no race is running
    const f = RACE_START;
    ctx.fillStyle = '#111';
    ctx.fillRect(f.x - 12, f.y - 12, 24, 24);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      if ((i + j) % 2 === 0) ctx.fillRect(f.x - 12 + i * 8, f.y - 12 + j * 8, 8, 8);
    }
  } else {
    const cp = G.race.points[G.race.cp];
    if (cp) {
      ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cp.x, cp.y, 56, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('CP ' + (G.race.cp + 1) + '/' + G.race.points.length, cp.x, cp.y - 66);
    }
    for (let i = G.race.cp + 1; i < G.race.points.length; i++) {
      ctx.fillStyle = 'rgba(46,204,113,0.55)';
      ctx.beginPath(); ctx.arc(G.race.points[i].x, G.race.points[i].y, 8, 0, Math.PI * 2); ctx.fill();
    }
  }
  // pedestrians
  for (const ped of G.peds) {
    if (ped.dead) continue;
    const bob = Math.sin(ped.walk) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(ped.x, ped.y + 8, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y + bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3 + bob * 0.3, 5, 0, Math.PI * 2); ctx.fill();
  }
  // on-foot cops
  for (const cop of G.cops) {
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath(); ctx.arc(cop.x, cop.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(cop.x + Math.cos(cop.angle) * 3, cop.y + Math.sin(cop.angle) * 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PD', cop.x, cop.y - 13);
  }
  // enemies (Vultures gang) — the boss is bigger, gold-trimmed, named;
  // the bruiser is bigger and rust-red; bounty targets wear a red $ tag
  for (const e of G.enemies) {
    const r = e.boss ? 14 : e.bruiser ? 13 : 10;
    ctx.fillStyle = e.boss ? '#8e44ad' : e.bruiser ? '#7d2e1d' : '#6c3483';
    ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.fill();
    if (e.boss) {
      ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, r + 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(e.name || 'BOSS', e.x, e.y - r - 10);
    }
    if (e.bounty) {
      ctx.fillStyle = '#ff5a4e'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('$' + BOUNTY_REWARD, e.x, e.y - r - 12);
    }
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle) * 3, e.y + Math.sin(e.angle) * 3, 5, 0, Math.PI * 2); ctx.fill();
    // hp bar
    const maxHp = e.boss ? (e.maxHp || 220) : 60;
    ctx.fillStyle = '#222'; ctx.fillRect(e.x - 14, e.y - r - 8, 28, 4);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(e.x - 14, e.y - r - 8, 28 * Math.max(0, e.hp / maxHp), 4);
  }
  // player
  drawPlayer(ctx, G);
  // police helicopter: dark body, spinning rotor, spotlight on the player
  if (G.heli) {
    const h = G.heli;
    if (night > 0.25) {
      ctx.fillStyle = 'rgba(255,240,170,' + (0.10 * night) + ')';
      ctx.beginPath();
      ctx.moveTo(h.x, h.y);
      ctx.lineTo(G.player.x - 40, G.player.y - 40);
      ctx.lineTo(G.player.x + 40, G.player.y + 40);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(h.x + 6, h.y + 8, 26, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(h.x, h.y); ctx.rotate(h.angle);
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath(); ctx.ellipse(0, 0, 24, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    const rot = G.time * 30;
    ctx.beginPath(); ctx.moveTo(Math.cos(rot) * 34, Math.sin(rot) * 34); ctx.lineTo(-Math.cos(rot) * 34, -Math.sin(rot) * 34); ctx.stroke();
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath(); ctx.arc(18, 0, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // bullets
  ctx.strokeStyle = '#ffe66d'; ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.stroke();
  }
  // rain: slanted streaks over the visible streets, driven by the clock
  // so the weather reads the same from any camera angle
  if (G.weather === 'rain') {
    ctx.strokeStyle = 'rgba(180,200,220,0.35)';
    ctx.lineWidth = 2;
    const vx0 = cam.x - vw / 2 / z - 40, vy0 = cam.y - vh / 2 / z - 40;
    const vwW = vw / z + 80, vhW = vh / z + 80;
    for (let i = 0; i < 90; i++) {
      const rx = vx0 + ((i * 173 + G.time * 620) % vwW);
      const ry = vy0 + ((i * 311 + G.time * 900) % vhW);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 7, ry + 20);
      ctx.stroke();
    }
  }
  // particles
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawCar(ctx, c, G) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const m = c.model, w = m.w, l = m.l;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -w / 2 + 3, -l / 2 + 4, w, l, 8); ctx.fill();
  // body — the Rider is a motorbike, not a car: a slim frame, a rider
  // leaning over it, and two wheels in line instead of four at the corners
  if (m.name === 'Rider') {
    ctx.fillStyle = c.color;
    roundRect(ctx, -w / 2, -l / 2, w, l, 8); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(0, -l / 2 + 12, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(0, 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0e7c7b';
    ctx.beginPath(); ctx.arc(0, 12, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-4, -l / 2 - 4, 8, 12); ctx.fillRect(-4, l / 2 - 8, 8, 12);
  } else {
    ctx.fillStyle = c.color;
    roundRect(ctx, -w / 2, -l / 2, w, l, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, -w / 2, -l / 2, w, 14, 9); ctx.fill();
    // windshield + rear window
    ctx.fillStyle = '#1c2733';
    roundRect(ctx, -w / 2 + 5, -l / 2 + 18, w - 10, 14, 4); ctx.fill();
    roundRect(ctx, -w / 2 + 5, l / 2 - 32, w - 10, 12, 4); ctx.fill();
    // roof
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    roundRect(ctx, -w / 2 + 4, -6, w - 8, 26, 5); ctx.fill();
    // wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(-w / 2 - 3, -l / 2 + 10, 6, 16); ctx.fillRect(w / 2 - 3, -l / 2 + 10, 6, 16);
    ctx.fillRect(-w / 2 - 3, l / 2 - 26, 6, 16); ctx.fillRect(w / 2 - 3, l / 2 - 26, 6, 16);
  }
  // headlights
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(-w / 2 + 5, -l / 2 - 2, 8, 4); ctx.fillRect(w / 2 - 13, -l / 2 - 2, 8, 4);
  // damage smoke from a battered engine
  if (c.hp < 50 && c.hp > 0) {
    const puff = Math.sin(G.time * 9 + c.x * 0.01) * 4;
    ctx.fillStyle = 'rgba(120,120,120,0.55)';
    ctx.beginPath(); ctx.arc(-w / 4 + puff, -l / 2 - 8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 4 - puff, -l / 2 - 14, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (c.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 2);
    // light bar
    const flash = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(-14, -l / 2 + 34, 12, 5);
    ctx.fillStyle = flash ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(2, -l / 2 + 34, 12, 5);
  }
  if (c.kind === 'player') {
    ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 2;
    roundRect(ctx, -w / 2 - 3, -l / 2 - 3, w + 6, l + 6, 11); ctx.stroke();
  }
  if (c.kind === 'traffic' && c.model.name === 'Taxi') {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2);
  }
  ctx.restore();
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.inCar || p.dead) return;
  const bob = (Math.abs(p.vx) + Math.abs(p.vy) > 10) ? Math.sin(G.time * 12) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 9, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  // body — Rico Vega: teal jacket
  ctx.rotate(p.angle);
  ctx.fillStyle = '#0e7c7b';
  ctx.beginPath(); ctx.arc(0, bob * 0.3, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(6, bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
  // gun in hand
  ctx.fillStyle = '#222';
  ctx.fillRect(8, -2, 12, 4);
  // aim line (faint)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(70, 0); ctx.stroke();
  ctx.restore();
  if (p.hurtT > 0) {
    ctx.strokeStyle = 'rgba(231,76,60,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.stroke();
  }
}
