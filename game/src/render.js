// render.js — draws the whole world: sun-soaked streets, buildings with height,
// beach and water, traffic, people, police, bullets and effects.
import { WORLD, ROAD_HALF, clamp } from './state.js';
import { pointInBuilding, ROAD_LINES } from './city.js';

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
    // windows
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
  // cars
  for (const c of G.cars) drawCar(ctx, c, G);
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
  // enemies (Vultures gang)
  for (const e of G.enemies) {
    ctx.fillStyle = '#6c3483';
    ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle) * 3, e.y + Math.sin(e.angle) * 3, 5, 0, Math.PI * 2); ctx.fill();
    // hp bar
    ctx.fillStyle = '#222'; ctx.fillRect(e.x - 14, e.y - 20, 28, 4);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(e.x - 14, e.y - 20, 28 * Math.max(0, e.hp / 60), 4);
  }
  // player
  drawPlayer(ctx, G);
  // bullets
  ctx.strokeStyle = '#ffe66d'; ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath(); ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.stroke();
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
  // body
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
  // headlights
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(-w / 2 + 5, -l / 2 - 2, 8, 4); ctx.fillRect(w / 2 - 13, -l / 2 - 2, 8, 4);
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
