// hud.js — HUD (health, armor, money, wanted stars, minimap, objective,
// speed, clock, toasts, dialogs) and the menu / pause / end screens.
import { WORLD, ROAD_HALF, clamp } from './state.js';
import { ROAD_LINES } from './city.js';
import { currentStep, STORY } from './missions.js';
import { BOUNTY_REWARD } from './activities.js';
import { DOCKS, BAY_START, BAY_RACE_POINTS } from './boats.js';

export function drawHUD(ctx, G, vw, vh) {
  const p = G.player;
  // --- top-left: health / armor / money
  ctx.textAlign = 'left';
  panel(ctx, 12, 12, 230, 92);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText('RICO VEGA', 24, 34);
  bar(ctx, 24, 42, 200, 12, G.health / 100, '#2ecc71', '#222');
  bar(ctx, 24, 58, 200, 8, G.armor / 100, '#3498db', '#222');
  ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 16px sans-serif';
  ctx.fillText('$' + G.money.toLocaleString('en-US'), 24, 90);
  ctx.fillStyle = '#ffd93d'; ctx.font = '12px sans-serif';
  ctx.fillText('Score ' + G.score.toLocaleString('en-US'), 150, 90);

  // --- top-right: wanted stars + clock
  panel(ctx, vw - 232, 12, 220, 62);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 24px sans-serif';
  const stars = Math.floor(G.wanted + 0.001);
  let s = '';
  for (let i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
  ctx.fillText(s, vw - 24, 42);
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
  const hh = Math.floor(G.clockMin / 60) % 24, mm = Math.floor(G.clockMin % 60);
  ctx.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  •  Solara Bay', vw - 24, 64);

  // --- minimap (top-right, below stars)
  drawMinimap(ctx, G, vw - 212, 86, 200, 200);
  // bounty cooldown countdown under the minimap
  if (!G.bounty && G.bountyCd > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif';
    ctx.fillText('Next Vulture bounty in ' + Math.ceil(G.bountyCd) + 's', vw - 112, 330);
  }
  // dragnet heat status: spotted or hidden, and how the heat is moving
  if (G.wanted > 0 && G.heat) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    if (G.heat.seen) {
      ctx.fillStyle = '#ff5a4e';
      ctx.fillText('SPOTTED — the PD can see you', vw - 112, 348);
    } else if (G.heat.hiddenT > 6) {
      ctx.fillStyle = '#2ecc71';
      ctx.fillText('HIDDEN — stay out of sight, heat is cooling', vw - 112, 348);
    } else {
      ctx.fillStyle = '#ffd93d';
      ctx.fillText('BREAKING LINE OF SIGHT…', vw - 112, 348);
    }
  }

  // --- mission objective (top-centre)
  const step = currentStep(G);
  if (G.mission) {
    ctx.textAlign = 'center';
    panel(ctx, vw / 2 - 260, 12, 520, 54);
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText('MISSION: ' + G.mission.def.title, vw / 2, 32);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
    ctx.fillText(step ? step.label : '', vw / 2, 52);
    // distance to objective
    if (step && step.x !== undefined) {
      const d = Math.round(Math.hypot(p.x - step.x, p.y - step.y));
      ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif';
      ctx.fillText(d + ' m', vw / 2 + 230, 52);
    }
    // timed mission countdown
    if (G.mission.timeLeft !== undefined) {
      ctx.fillStyle = G.mission.timeLeft < 15 ? '#ff5a4e' : '#ffd93d';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(Math.ceil(G.mission.timeLeft) + 's', vw / 2 + 230, 32);
    }
  } else if (G.missionsDone === 0) {
    ctx.textAlign = 'center';
    panel(ctx, vw / 2 - 200, 12, 400, 34);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
    ctx.fillText('Head to the Pelican Motel — follow the yellow marker', vw / 2, 34);
  }

  // --- side activity (taxi fare / street race / bounty / Bay Runner) under the mission panel
  if (G.taxi || (G.race && G.race.active) || G.bounty || (G.boatRace && G.boatRace.active)) {
    ctx.textAlign = 'center';
    panel(ctx, vw / 2 - 260, 72, 520, 34);
    ctx.font = 'bold 14px sans-serif';
    if (G.boatRace && G.boatRace.active) {
      ctx.fillStyle = '#7fd4e8';
      const cp = G.boatRace.points[G.boatRace.cp];
      const d = cp ? Math.round(Math.hypot(p.x - cp.x, p.y - cp.y)) : 0;
      ctx.fillText('BAY RUNNER  •  BUOY ' + (G.boatRace.cp + 1) + '/' + G.boatRace.points.length + '  •  ' + G.boatRace.t.toFixed(1) + 's  •  ' + d + ' m', vw / 2, 94);
    } else if (G.race && G.race.active) {
      ctx.fillStyle = '#2ecc71';
      const cp = G.race.points[G.race.cp];
      const d = cp ? Math.round(Math.hypot(p.x - cp.x, p.y - cp.y)) : 0;
      ctx.fillText('STREET RACE  •  CP ' + (G.race.cp + 1) + '/' + G.race.points.length + '  •  ' + G.race.t.toFixed(1) + 's  •  ' + d + ' m', vw / 2, 94);
    } else if (G.bounty) {
      ctx.fillStyle = '#ff5a4e';
      ctx.fillText('VULTURE BOUNTY  •  ' + G.bounty.left + '/' + G.bounty.total + ' left  •  $' + BOUNTY_REWARD + ' each', vw / 2, 94);
    } else if (G.taxi) {
      ctx.fillStyle = '#2ecc71';
      const d = Math.round(Math.hypot(p.x - G.taxi.x, p.y - G.taxi.y));
      ctx.fillText(G.taxi.stage === 'pickup'
        ? 'TAXI FARE  •  Pick up the passenger  •  ' + d + ' m'
        : 'TAXI FARE  •  Drop off the passenger  •  $' + G.taxi.fare + '  •  ' + d + ' m', vw / 2, 94);
    }
  }
  // --- helicopter warning
  if (G.heli) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4e'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('POLICE HELICOPTER OVERHEAD — the heat will not fade while it watches', vw / 2, 122);
  }

  // --- bottom-right: weapon / ammo / speed
  panel(ctx, vw - 212, vh - 96, 200, 84);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif';
  const wname = { pistol: 'Pistol', smg: 'SMG', shotgun: 'Shotgun' }[G.weapon];
  ctx.fillText(wname + '  •  ' + (G.ammo[G.weapon] || 0) + ' ammo', vw - 24, vh - 66);
  ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif';
  ctx.fillText('[1/2/3] switch weapon', vw - 24, vh - 46);
  if (p.inCar) {
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', vw - 24, vh - 20);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText(p.inCar.model.name, vw - 200, vh - 20);
    ctx.textAlign = 'right';
    // flat tires from spike strips: show what is left, and where to fix it
    if ((p.inCar.flat || 0) > 0) {
      const flat = p.inCar.flat;
      ctx.fillStyle = '#ff5a4e'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText('TIRES ' + '●'.repeat(4 - flat) + '○'.repeat(flat) + '  —  R at Pay \'n\' Spray ($150)', vw - 24, vh - 104);
    }
  } else if (p.inBoat) {
    ctx.fillStyle = '#7fd4e8'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(Math.round(Math.abs(p.inBoat.speed) * 0.36) + ' km/h', vw - 24, vh - 20);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText('Speedboat', vw - 200, vh - 20);
    ctx.textAlign = 'right';
  } else {
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText('On foot — press E near a car to steal it', vw - 24, vh - 20);
  }

  // --- bottom-left: controls hint
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(12, vh - 34, 560, 22);
  ctx.fillStyle = '#ddd'; ctx.font = '12px sans-serif';
  ctx.fillText('WASD move/drive/sail  •  Mouse aim, Click shoot  •  E car / board boat  •  Shift run  •  Space brake  •  P pause  •  M mute', 20, vh - 19);

  // --- toast message
  if (G.message && G.messageT > 0) {
    ctx.textAlign = 'center';
    const w = ctx.measureText(G.message).width + 40;
    panel(ctx, vw / 2 - w / 2, vh - 150, w, 34);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(G.message, vw / 2, vh - 128);
  }

  // --- off-screen objective arrow
  if (G.mission && step && step.x !== undefined) {
    const dx = step.x - p.x, dy = step.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 500) {
      const a = Math.atan2(dy, dx);
      const cx = vw / 2 + Math.cos(a) * 190, cy = vh / 2 + Math.sin(a) * 190;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = '#ffd93d';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText(Math.round(d) + ' m', cx, cy + 28);
    }
  }

  // --- dialog box
  if (G.dialog) {
    const line = G.dialog.lines[G.dialog.i];
    panel(ctx, vw / 2 - 330, vh - 210, 660, 96);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(line.split(':')[0] + ':', vw / 2 - 310, vh - 178);
    ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
    wrapText(ctx, line.split(':').slice(1).join(':').trim(), vw / 2 - 310, vh - 156, 620, 19);
    ctx.textAlign = 'right'; ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif';
    ctx.fillText('E / Enter to continue  (' + (G.dialog.i + 1) + '/' + G.dialog.lines.length + ')', vw / 2 + 310, vh - 126);
  }
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke();
}
function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW) { ctx.fillText(line, x, y); y += lh; line = word; }
    else line = test;
  }
  ctx.fillText(line, x, y);
}

function drawMinimap(ctx, G, x, y, w, h) {
  panel(ctx, x - 6, y - 6, w + 12, h + 12);
  const s = w / WORLD;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#8a7a55'; ctx.fillRect(x, y, w, h);
  // water + beach
  ctx.fillStyle = '#2fa8c9'; ctx.fillRect(x + 2470 * s, y, w, h);
  ctx.fillStyle = '#e8d49a'; ctx.fillRect(x + 2350 * s, y, 120 * s, h);
  // park
  ctx.fillStyle = '#7fb069';
  ctx.fillRect(x + G.city.park.x * s, y + G.city.park.y * s, G.city.park.w * s, G.city.park.h * s);
  // boardwalk pier + ferris wheel
  if (G.city.boardwalk) {
    ctx.fillStyle = '#8a6b48';
    ctx.fillRect(x + G.city.boardwalk.pier.x * s, y + G.city.boardwalk.pier.y * s, G.city.boardwalk.pier.w * s, Math.max(2, G.city.boardwalk.pier.h * s));
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + G.city.boardwalk.wheel.x * s, y + G.city.boardwalk.wheel.y * s, Math.max(3, G.city.boardwalk.wheel.r * s), 0, Math.PI * 2);
    ctx.stroke();
  }
  // roads
  ctx.fillStyle = '#3d3d46';
  for (const l of ROAD_LINES) {
    ctx.fillRect(x + (l - ROAD_HALF) * s, y, ROAD_HALF * 2 * s, h);
    ctx.fillRect(x, y + (l - ROAD_HALF) * s, w, ROAD_HALF * 2 * s);
  }
  // buildings
  ctx.fillStyle = '#d9b48f';
  for (const b of G.city.buildings) ctx.fillRect(x + b.x * s, y + b.y * s, Math.max(2, b.w * s), Math.max(2, b.h * s));
  // mission marker
  for (const m of G.markers) {
    const mx = m.follow ? G.player.x : m.x, my = m.follow ? G.player.y : m.y;
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath(); ctx.arc(x + mx * s, y + my * s, 5, 0, Math.PI * 2); ctx.fill();
  }
  // police blips
  ctx.fillStyle = '#2d6bff';
  for (const c of G.cars) if (c.kind === 'police') { ctx.beginPath(); ctx.arc(x + c.x * s, y + c.y * s, 3, 0, Math.PI * 2); ctx.fill(); }
  // roadblocks (red squares) and spike strips (orange dots) on the minimap
  if (G.roadblocks) {
    ctx.fillStyle = '#ff2d2d';
    for (const b of G.roadblocks) ctx.fillRect(x + b.x * s - 3, y + b.y * s - 3, 6, 6);
  }
  if (G.spikes) {
    ctx.fillStyle = '#ff9f1a';
    for (const sp of G.spikes) { ctx.beginPath(); ctx.arc(x + sp.x * s, y + sp.y * s, 2.5, 0, Math.PI * 2); ctx.fill(); }
  }
  // helicopter blip (red ring) + taxi / race blips (green)
  if (G.heli) {
    ctx.strokeStyle = '#ff5a4e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + G.heli.x * s, y + G.heli.y * s, 5, 0, Math.PI * 2); ctx.stroke();
  }
  if (G.taxi) {
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.arc(x + G.taxi.x * s, y + G.taxi.y * s, 4, 0, Math.PI * 2); ctx.fill();
  }
  if (G.race && G.race.active && G.race.points[G.race.cp]) {
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.arc(x + G.race.points[G.race.cp].x * s, y + G.race.points[G.race.cp].y * s, 4, 0, Math.PI * 2); ctx.fill();
  }
  // bounty targets (red $ blips)
  if (G.bounty) {
    ctx.fillStyle = '#ff5a4e';
    for (const e of G.enemies) {
      if (!e.bounty) continue;
      ctx.beginPath(); ctx.arc(x + e.x * s, y + e.y * s, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
  // docks (brown ticks), Bay Runner buoys (orange) and the boat (white ring)
  ctx.fillStyle = '#8a6b48';
  for (const d of DOCKS) ctx.fillRect(x + d.bx * s - 2, y + d.by * s - 2, 4, 4);
  ctx.fillStyle = '#ff9f1a';
  ctx.beginPath(); ctx.arc(x + BAY_START.x * s, y + BAY_START.y * s, 3, 0, Math.PI * 2); ctx.fill();
  if (G.boatRace && G.boatRace.active && G.boatRace.points[G.boatRace.cp]) {
    const cp = G.boatRace.points[G.boatRace.cp];
    ctx.beginPath(); ctx.arc(x + cp.x * s, y + cp.y * s, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const b of G.boats || []) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + b.x * s, y + b.y * s, 4, 0, Math.PI * 2); ctx.stroke();
  }
  // player arrow
  const p = G.player;
  ctx.save();
  ctx.translate(x + p.x * s, y + p.y * s); ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  // view rect
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  // city name on its own chip under the map — the old label sat on the
  // stars panel's bottom edge and the two texts collided
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  ctx.beginPath(); ctx.roundRect(x - 6, y + h + 8, w + 12, 20, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SOLARA BAY', x + w / 2, y + h + 22);
}

export function drawMenu(ctx, G, vw, vh) {
  // backdrop: city vista gradient + title
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#1b2a4a'); grad.addColorStop(0.55, '#c96f3f'); grad.addColorStop(1, '#f7b733');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, vw, vh);
  // sun
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath(); ctx.arc(vw * 0.72, vh * 0.3, 70, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,233,168,0.35)';
  ctx.beginPath(); ctx.arc(vw * 0.72, vh * 0.3, 110, 0, Math.PI * 2); ctx.fill();
  // skyline silhouette
  ctx.fillStyle = '#241a2e';
  let bx = 0;
  const rngHeights = [120, 200, 150, 260, 180, 300, 140, 220, 170, 240, 130, 190];
  for (let i = 0; i < 12; i++) {
    const w = vw / 12;
    ctx.fillRect(bx, vh - 180 - rngHeights[i], w - 8, 180 + rngHeights[i]);
    bx += w;
  }
  ctx.fillStyle = '#120e1a'; ctx.fillRect(0, vh - 180, vw, 180);
  // palm silhouettes
  ctx.strokeStyle = '#120e1a'; ctx.lineWidth = 6;
  for (const px of [vw * 0.12, vw * 0.88]) {
    ctx.beginPath(); ctx.moveTo(px, vh - 180); ctx.quadraticCurveTo(px + 20, vh - 260, px + 60, vh - 300); ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd93d';
  ctx.font = 'bold 64px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18;
  ctx.fillText('SOLARA BAY', vw / 2, vh * 0.3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif';
  ctx.fillText('An open-world crime story — steal, drive, run the city', vw / 2, vh * 0.3 + 40);
  ctx.font = '15px sans-serif'; ctx.fillStyle = '#ffd93d';
  ctx.fillText('A completely original game. Not affiliated with any commercial game.', vw / 2, vh * 0.3 + 66);

  const items = [];
  items.push('NEW GAME');
  if (G.hasSave) items.push('CONTINUE  (save: $' + G.saveMoney + ', ' + G.saveMissions + ' missions done)');
  items.push('HOW TO PLAY');
  const y0 = vh * 0.52;
  items.forEach((it, i) => {
    const sel = i === G.menuSel;
    ctx.font = (sel ? 'bold ' : '') + '22px sans-serif';
    ctx.fillStyle = sel ? '#ffd93d' : '#fff';
    if (sel) { ctx.fillText('▶ ' + it, vw / 2, y0 + i * 46); } else ctx.fillText(it, vw / 2, y0 + i * 46);
  });
  ctx.fillStyle = '#ddd'; ctx.font = '14px sans-serif';
  ctx.fillText('WASD move / drive  •  Mouse aim, click to shoot  •  E steal & enter cars  •  P pause', vw / 2, vh - 60);
  ctx.fillText('Missions, wanted stars, police chases, the Neon Palms Casino — all of Solara Bay is yours.', vw / 2, vh - 36);
  if (G.showHelp) {
    panel(ctx, vw / 2 - 340, vh * 0.2, 680, 300);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
    const lines = [
      'HOW TO PLAY',
      '',
      '• Walk with WASD, run with Shift. Aim with the mouse, click to shoot.',
      '• Press E next to any car to steal it. Driving: W/S accelerate & brake,',
      '  A/D steer, Space handbrake. Press E again to get out.',
      '• Crimes raise your wanted level (stars). Police cars and foot cops',
      '  hunt you; lose them and the heat fades. Get busted or wasted and',
      '  you lose some cash and wake up at the hospital.',
      '• At 2+ stars the PD sets roadblocks with spike strips — blown',
      '  tires cripple the car. Break line of sight to go HIDDEN and the',
      '  heat cools fast. Press R at Pay \'n\' Spray to fix tires ($150).',
      '• Follow the yellow marker: missions pay cash. Buy weapons at the',
      '  Ironworks Gun Shop and clear heat at the Pay \'n\' Spray.',
      '• Hidden packages around the city pay $150 each. Progress saves',
      '  automatically at the Pelican Motel safehouse.',
      '• Vulture bounties: three wanted gang members roam the city —',
      '  take them down for $400 each (red $ on the minimap).',
      '• The Sunset Boardwalk has shops, a pier and a ferris wheel.',
      '• Two docks on the east shore moor speedboats — press E on a dock',
      '  to board one, and race the orange buoys for the Bay Runner prize.',
      '• Press P to pause, M to mute.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, vw / 2 - 320, vh * 0.2 + 36 + i * 24));
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffd93d';
    ctx.fillText('Press any key to close', vw / 2, vh * 0.2 + 280);
  }
}

export function drawPause(ctx, G, vw, vh) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', vw / 2, vh * 0.36);
  const items = ['RESUME', 'SAVE GAME', 'RESTART FROM SAVE', 'QUIT TO MENU'];
  items.forEach((it, i) => {
    ctx.font = (i === G.pausedSel ? 'bold ' : '') + '22px sans-serif';
    ctx.fillStyle = i === G.pausedSel ? '#ffd93d' : '#fff';
    ctx.fillText((i === G.pausedSel ? '▶ ' : '') + it, vw / 2, vh * 0.46 + i * 44);
  });
}

export function drawEndScreen(ctx, G, vw, vh, kind) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  if (kind === 'wasted') {
    ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 64px sans-serif';
    ctx.fillText('WASTED', vw / 2, vh * 0.4);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
    ctx.fillText('Rico flatlined. The hospital patched him up — for a fee.', vw / 2, vh * 0.4 + 40);
  } else if (kind === 'busted') {
    ctx.fillStyle = '#3498db'; ctx.font = 'bold 64px sans-serif';
    ctx.fillText('BUSTED', vw / 2, vh * 0.4);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
    ctx.fillText('The Solara PD hauled Rico in. Bail wasn\'t cheap.', vw / 2, vh * 0.4 + 40);
  } else if (kind === 'storydone') {
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 56px sans-serif';
    ctx.fillText('LEGEND OF SOLARA BAY', vw / 2, vh * 0.36);
    ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
    ctx.fillText('Rico Vega pulled the Big Score and sailed off into the sunset.', vw / 2, vh * 0.36 + 40);
    ctx.fillText('Final score: ' + G.score.toLocaleString('en-US') + '   •   Missions: ' + G.missionsDone + '/' + STORY.length + '   •   Cars stolen: ' + G.carsStolen, vw / 2, vh * 0.36 + 74);
    ctx.fillText('Bounties: ' + (G.stats.bounties || 0) + ' rounds cleared   •   Bounty cash: $' + (G.stats.bountyCash || 0).toLocaleString('en-US') + '   •   Taxi fares: ' + (G.stats.fares || 0), vw / 2, vh * 0.36 + 104);
  }
  ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press Enter to continue', vw / 2, vh * 0.62);
}
