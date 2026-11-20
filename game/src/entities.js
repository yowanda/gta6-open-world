// entities.js — player, cars, traffic, pedestrians, police and combat.
// The player walks, steals and drives; the city reacts with traffic, cops and gangs.
import { WORLD, ROAD_HALF, clamp, lerp, dist2, angDiff, pick, WEAPONS, CAR_MODELS, CAR_COLORS } from './state.js';
import { collideCircle, onRoad, randomRoadPos, pointInBuilding, nearestRoadLine, ROAD_LINES } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0, vx: 0, vy: 0,
    inCar: null,           // car object when driving
    onFoot: true,
    run: false,
    fireCd: 0, reloadT: 0,
    hurtT: 0, dead: false,
  };
}

export function makeCar(x, y, angle, model, color, kind) {
  return {
    x, y, angle, speed: 0, model: model || pick(Math.random, CAR_MODELS),
    color: color || pick(Math.random, CAR_COLORS),
    kind: kind || 'traffic',   // traffic | parked | player | police
    ai: null,                  // traffic AI state
    hp: 100, smoke: 0, brake: false, siren: false,
    id: Math.random().toString(36).slice(2, 8),
  };
}

export function spawnTraffic(G, n) {
  const rng = G.rng;
  for (let i = 0; i < n; i++) {
    const p = randomRoadPos(rng);
    const c = makeCar(p.x, p.y, p.dir, undefined, undefined, 'traffic');
    c.speed = 90 + rng() * 70;
    c.ai = { dir: p.dir, targetSpeed: c.speed, wait: 0 };
    G.cars.push(c);
  }
  // parked cars along roads
  for (let i = 0; i < 14; i++) {
    const p = randomRoadPos(rng);
    const line = nearestRoadLine(p.x < p.y ? p.x : p.y);
    const vertical = Math.abs(p.x - line) < 4;
    const off = ROAD_HALF + 26;
    const x = vertical ? line + (rng() < 0.5 ? off : -off) : p.x;
    const y = vertical ? p.y : line + (rng() < 0.5 ? off : -off);
    if (pointInBuilding(G.city, x, y)) continue;
    G.cars.push(makeCar(x, y, vertical ? 0 : Math.PI / 2, undefined, undefined, 'parked'));
  }
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPos(G.rng);
    const side = G.rng() < 0.5 ? 1 : -1;
    const vertical = Math.abs(p.x - nearestRoadLine(p.x)) < 4;
    const x = vertical ? p.x + side * (ROAD_HALF + 12) : p.x;
    const y = vertical ? p.y : p.y + side * (ROAD_HALF + 12);
    if (pointInBuilding(G.city, x, y)) continue;
    G.peds.push({
      x, y, angle: G.rng() * Math.PI * 2, speed: 22 + G.rng() * 18,
      color: pick(G.rng, ['#f39c12', '#8e44ad', '#16a085', '#d35400', '#2c3e50', '#c0392b', '#7f8c8d']),
      walk: G.rng() * 10, panic: 0, dir: G.rng() < 0.5 ? 1 : -1, axis: vertical ? 'y' : 'x',
    });
  }
}

export function nearestCar(G, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of G.cars) {
    const d = dist2(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function addWanted(G, n) {
  G.wanted = clamp(G.wanted + n, 0, 5);
  G.wantedTimer = 0;
}

export function tryEnterCar(G, audio) {
  const p = G.player;
  const c = nearestCar(G, p.x, p.y, 70);
  if (!c) return;
  if (c.kind === 'police') { setToast(G, 'That car belongs to the Solara PD!'); return; }
  p.inCar = c;
  p.onFoot = false;
  c.kind = 'player';
  c.ai = null;
  if (c.parked) c.parked = false;
  if (c.kindBefore !== 'player') { /* first steal */ }
  const wasParked = c.wasParked;
  if (wasParked || c.kind === 'traffic') { /* stealing a car draws heat */ }
  if (c.stolen !== true) {
    c.stolen = true;
    G.carsStolen++;
    addWanted(G, 1);
    setToast(G, 'Car stolen — ' + c.model.name + ' — the PD has been tipped off!');
    audio.pickup();
  }
  p.x = c.x; p.y = c.y; p.angle = c.angle;
}

export function exitCar(G) {
  const p = G.player;
  if (!p.inCar) return;
  const c = p.inCar;
  const side = { x: Math.cos(c.angle + Math.PI / 2), y: Math.sin(c.angle + Math.PI / 2) };
  p.x = c.x + side.x * 40; p.y = c.y + side.y * 40;
  p.angle = c.angle;
  p.inCar = null;
  p.onFoot = true;
  p.speed = 0;
  c.speed = Math.max(0, c.speed * 0.3);
}

export function setToast(G, text) { G.message = text; G.messageT = 4; }

export function hurtPlayer(G, dmg, audio) {
  const p = G.player;
  if (p.dead || G.state !== 'playing') return;
  let left = dmg;
  if (G.armor > 0) { const absorbed = Math.min(G.armor, left * 0.6); G.armor -= absorbed; left -= absorbed; }
  G.health -= left;
  p.hurtT = 0.4;
  if (G.health <= 0) {
    G.health = 0;
    p.dead = true;
    G.state = 'wasted';
    audio.fail();
    audio.setEngine(0); audio.setSiren(false);
  }
}

function fireBullet(G, x, y, angle, dmg, fromPlayer, audio) {
  const w = WEAPONS[G.weapon];
  const spread = (Math.random() - 0.5) * (w.spread || 0.08);
  G.bullets.push({ x, y, vx: Math.cos(angle + spread) * w.speed, vy: Math.sin(angle + spread) * w.speed, life: w.range / w.speed, dmg, fromPlayer });
  G.stats.shots++;
  if (fromPlayer) { G.ammo[G.weapon] = Math.max(0, (G.ammo[G.weapon] || 0) - 1); audio.shoot(); }
  else audio.enemyShoot();
  // muzzle flash particle
  G.particles.push({ x: x + Math.cos(angle) * 20, y: y + Math.sin(angle) * 20, vx: 0, vy: 0, life: 0.08, max: 0.08, size: 10, color: '#ffd93d' });
}

export function playerShoot(G, audio) {
  const p = G.player;
  if (p.fireCd > 0 || p.inCar) return;
  const w = WEAPONS[G.weapon];
  if ((G.ammo[G.weapon] || 0) <= 0) { audio.click(); setToast(G, 'Out of ammo — visit Ironworks Gun Shop'); return; }
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) fireBullet(G, p.x, p.y, p.angle, w.dmg, true, audio);
  p.fireCd = w.rate;
}

export function updatePlayer(G, input, audio, dt) {
  const p = G.player;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);
  if (p.dead) return;

  if (input.hit('e')) { if (p.inCar) exitCar(G); else tryEnterCar(G, audio); }
  if (input.hit('1')) { G.weapon = 'pistol'; audio.click(); }
  if (input.hit('2') && G.ammo.smg > 0) { G.weapon = 'smg'; audio.click(); }
  if (input.hit('3') && G.ammo.shotgun > 0) { G.weapon = 'shotgun'; audio.click(); }
  if (input.hit('m')) { G.muted = !G.muted; audio.setMuted(G.muted); }

  if (p.inCar) {
    const c = p.inCar;
    const ax = input.axis();
    let fwd = -ax.y; // W = forward
    if (G.shotMode) fwd = 1; // staged screenshots: keep the car rolling
    const steer = ax.x;
    const top = c.model.speed;
    c.speed += fwd * c.model.accel * dt;
    if (fwd === 0) c.speed -= Math.sign(c.speed) * 120 * dt;
    if (input.down(' ') ) { c.speed -= Math.sign(c.speed) * 500 * dt; c.brake = true; } else c.brake = false;
    c.speed = clamp(c.speed, -140, top);
    if (Math.abs(c.speed) < 4 && fwd === 0) c.speed = 0;
    const turn = steer * 2.1 * clamp(Math.abs(c.speed) / 120, 0, 1) * (c.speed >= 0 ? 1 : -1);
    c.angle += turn * dt;
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const hit = collideCircle(G.city, nx, ny, 22);
    if (Math.abs(hit.x - nx) > 0.5 || Math.abs(hit.y - ny) > 0.5) {
      if (Math.abs(c.speed) > 160) { audio.crash(); spawnParticles(G, c.x, c.y, 8, '#f39c12'); }
      c.speed *= 0.4;
    }
    c.x = hit.x; c.y = hit.y;
    // car-car bump
    for (const o of G.cars) {
      if (o === c) continue;
      const d = dist2(c.x, c.y, o.x, o.y);
      if (d < 46 * 46) {
        const dd = Math.sqrt(d) || 1;
        const push = (46 - dd) / 2;
        const ux = (c.x - o.x) / dd, uy = (c.y - o.y) / dd;
        c.x += ux * push; c.y += uy * push;
        if (o.kind === 'traffic' && Math.abs(c.speed) > 60) { o.speed = Math.max(0, o.speed - 60); audio.crash(); }
        if (Math.abs(c.speed) > 200) { c.speed *= 0.7; }
      }
    }
    p.x = c.x; p.y = c.y; p.angle = c.angle; p.speed = c.speed;
    audio.setEngine(Math.abs(c.speed) / top);
    // run over pedestrians (crime!)
    for (const ped of G.peds) {
      if (Math.abs(c.speed) > 80 && dist2(c.x, c.y, ped.x, ped.y) < 40 * 40) {
        ped.dead = true;
        spawnParticles(G, ped.x, ped.y, 10, '#c0392b');
        addWanted(G, 1);
        audio.hit();
      }
    }
  } else {
    const ax = input.axis();
    const run = input.down('shift');
    const sp = run ? 240 : 150;
    let mx = ax.x, my = ax.y;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    p.vx = lerp(p.vx, mx * sp, 1 - Math.pow(0.001, dt));
    p.vy = lerp(p.vy, my * sp, 1 - Math.pow(0.001, dt));
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    const hit = collideCircle(G.city, nx, ny, 14);
    p.x = hit.x; p.y = hit.y;
    // aim at mouse
    const mdx = G.mouse.wx - p.x, mdy = G.mouse.wy - p.y;
    if (Math.hypot(mdx, mdy) > 10) p.angle = Math.atan2(mdy, mdx);
    if (G.mouse.down || input.down('f')) playerShoot(G, audio);
    audio.setEngine(0);
  }
}

export function spawnParticles(G, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 120;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + Math.random() * 0.4, max: 0.8, size: 3 + Math.random() * 4, color });
  }
}

// ---------- Traffic ----------
export function updateTraffic(G, dt) {
  const p = G.player;
  for (const c of G.cars) {
    if (c.kind !== 'traffic' || !c.ai) continue;
    // keep traffic near player: respawn far cars closer
    if (dist2(c.x, c.y, p.x, p.y) > 1600 * 1600) {
      const pos = randomRoadPos(G.rng);
      c.x = p.x + (G.rng() < 0.5 ? -1 : 1) * (500 + G.rng() * 400);
      c.y = p.y + (G.rng() < 0.5 ? -1 : 1) * (500 + G.rng() * 400);
      c.x = clamp(c.x, 60, WORLD - 60); c.y = clamp(c.y, 60, WORLD - 60);
      c.angle = pos.dir; c.ai.dir = pos.dir; c.speed = c.ai.targetSpeed;
      continue;
    }
    // drive along current axis; at intersections sometimes turn
    const onV = Math.abs(Math.sin(c.ai.dir)) < 0.1; // moving along x
    const axisPos = onV ? c.x : c.y;
    const line = nearestRoadLine(axisPos);
    // snap onto lane (right-hand traffic, offset 16)
    const laneOff = 16;
    if (onV) {
      c.y += (line + (c.ai.dir === 0 ? laneOff : -laneOff) - c.y) * Math.min(1, dt * 4);
      c.x += Math.cos(c.ai.dir) * c.speed * dt;
    } else {
      c.x += (line + (c.ai.dir === Math.PI / 2 ? -laneOff : laneOff) - c.x) * Math.min(1, dt * 4);
      c.y += Math.sin(c.ai.dir) * c.speed * dt;
    }
    // slow for cars ahead
    for (const o of G.cars) {
      if (o === c) continue;
      const dx = o.x - c.x, dy = o.y - c.y;
      const ahead = dx * Math.cos(c.ai.dir) + dy * Math.sin(c.ai.dir);
      if (ahead > 0 && ahead < 90 && Math.abs(dx * Math.sin(c.ai.dir) - dy * Math.cos(c.ai.dir)) < 40) {
        c.speed = Math.max(0, c.speed - 200 * dt);
      }
    }
    c.speed = lerp(c.speed, c.ai.targetSpeed, dt * 0.5);
    // at intersection, maybe turn
    const crossPos = onV ? c.y : c.x;
    const crossLine = nearestRoadLine(crossPos);
    if (Math.abs(crossPos - crossLine) < 6 && Math.random() < 0.5) {
      const opts = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter(a => Math.abs(angDiff(a, c.ai.dir)) > 2.5);
      if (Math.random() < 0.6) { const na = pick(Math.random, opts); c.ai.dir = na; c.angle = na; }
    }
    c.angle = c.ai.dir;
    c.x = clamp(c.x, 40, WORLD - 40); c.y = clamp(c.y, 40, WORLD - 40);
  }
  // light separation so traffic does not stack on one spot
  const tc = G.cars.filter(x => x.kind === 'traffic');
  for (let i = 0; i < tc.length; i++) for (let j = i + 1; j < tc.length; j++) {
    const a = tc[i], b = tc[j];
    const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
    if (d2 < 50 * 50 && d2 > 0.01) {
      const d = Math.sqrt(d2), push = (50 - d) / 2 / d;
      a.x -= dx * push; a.y -= dy * push;
      b.x += dx * push; b.y += dy * push;
    }
  }
}

// ---------- Pedestrians ----------
export function updatePeds(G, dt, audio) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.dead) continue;
    // panic if gunfire / player car speeding nearby
    const pd = dist2(ped.x, ped.y, p.x, p.y);
    if (pd < 220 * 220 && (G.bullets.length > 0 || (p.inCar && Math.abs(p.speed) > 200))) ped.panic = 2;
    ped.panic = Math.max(0, ped.panic - dt);
    const sp = ped.panic > 0 ? 170 : ped.speed;
    ped.walk += dt * sp * 0.06;
    if (ped.axis === 'x') {
      ped.x += ped.dir * sp * dt;
      if (Math.random() < dt * 0.05) ped.dir *= -1;
      if (ped.x < 60 || ped.x > WORLD - 60) ped.dir *= -1;
      ped.angle = ped.dir > 0 ? 0 : Math.PI;
    } else {
      ped.y += ped.dir * sp * dt;
      if (Math.random() < dt * 0.05) ped.dir *= -1;
      if (ped.y < 60 || ped.y > WORLD - 60) ped.dir *= -1;
      ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    // stay near road: if drifted into a building, nudge back
    if (pointInBuilding(G.city, ped.x, ped.y)) { ped.dir *= -1; ped.x -= ped.dir * sp * dt * 2; }
    // keep peds near player
    if (pd > 1500 * 1500) {
      const pos = randomRoadPos(G.rng);
      ped.x = clamp(p.x + (G.rng() < 0.5 ? -1 : 1) * (300 + G.rng() * 300), 60, WORLD - 60);
      ped.y = clamp(p.y + (G.rng() < 0.5 ? -1 : 1) * (300 + G.rng() * 300), 60, WORLD - 60);
      ped.dead = false;
    }
  }
  G.peds = G.peds.filter(pd2 => !pd2.dead || Math.random() < 0.2);
  while (G.peds.length < 34) spawnPeds(G, 1);
}

// ---------- Police / wanted ----------
export function updatePolice(G, dt, audio) {
  const p = G.player;
  // decay: wanted fades if no crime for a while and no cop nearby
  G.wantedTimer += dt;
  let copNear = false;
  for (const c of G.cars) if (c.kind === 'police' && dist2(c.x, c.y, p.x, p.y) < 500 * 500) copNear = true;
  if (!copNear && G.wantedTimer > 25 && G.wanted > 0) {
    G.wanted = Math.max(0, G.wanted - dt * 0.12);
    if (G.wanted < 0.5) G.wanted = 0;
  }
  const stars = Math.floor(G.wanted + 0.001);
  const wantCops = stars >= 1 ? Math.min(1 + stars, 6) : 0;
  const policeCars = G.cars.filter(c => c.kind === 'police');
  if (policeCars.length < wantCops) {
    const a = Math.random() * Math.PI * 2;
    const sx = clamp(p.x + Math.cos(a) * 700, 80, WORLD - 80);
    const sy = clamp(p.y + Math.sin(a) * 700, 80, WORLD - 80);
    const pc = makeCar(sx, sy, Math.atan2(p.y - sy, p.x - sx), CAR_MODELS[1], '#1e3a5f', 'police');
    pc.siren = true;
    G.cars.push(pc);
    audio.setSiren(true);
  }
  if (policeCars.length > wantCops) {
    // remove farthest police car
    policeCars.sort((a, b) => dist2(b.x, b.y, p.x, p.y) - dist2(a.x, a.y, p.x, p.y));
    const gone = policeCars[0];
    G.cars.splice(G.cars.indexOf(gone), 1);
  }
  if (wantCops === 0) audio.setSiren(false);
  // police car chase
  for (const c of G.cars) {
    if (c.kind !== 'police') continue;
    const d = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
    const want = Math.atan2(p.y - c.y, p.x - c.x);
    c.angle += clamp(angDiff(want, c.angle), -2.4 * dt, 2.4 * dt);
    const target = d > 260 ? 430 : 300;
    c.speed = lerp(c.speed, target, dt * 0.8);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const hit = collideCircle(G.city, nx, ny, 22);
    if (Math.abs(hit.x - nx) > 0.5 || Math.abs(hit.y - ny) > 0.5) c.speed *= 0.5;
    c.x = hit.x; c.y = hit.y;
    // ram the player
    if (p.inCar && d < 60) {
      p.inCar.speed *= 0.6;
      c.speed *= 0.7;
      if (Math.random() < dt * 2) audio.crash();
    }
    if (!p.inCar && d < 34 && Math.abs(p.speed || 0) < 60) {
      // busted!
      G.state = 'busted';
      audio.fail(); audio.setSiren(false); audio.setEngine(0);
      setToast(G, 'Busted by the Solara PD');
    }
  }
  // on-foot cops at 2+ stars
  const wantFoot = stars >= 2 ? Math.min(stars - 1, 3) : 0;
  if (G.cops.length < wantFoot && Math.random() < dt * 0.5) {
    const a = Math.random() * Math.PI * 2;
    G.cops.push({ x: clamp(p.x + Math.cos(a) * 420, 60, WORLD - 60), y: clamp(p.y + Math.sin(a) * 420, 60, WORLD - 60), angle: 0, hp: 50, fireCd: 1 + Math.random(), speed: 130 });
  }
  for (const cop of G.cops) {
    const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
    cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
    if (d > 260) {
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
    } else {
      cop.fireCd -= dt;
      if (cop.fireCd <= 0 && !p.dead) {
        cop.fireCd = 1.1 + Math.random() * 0.8;
        fireBullet(G, cop.x, cop.y, cop.angle + (Math.random() - 0.5) * 0.2, 8, false, audio);
      }
    }
    const hit = collideCircle(G.city, cop.x, cop.y, 12);
    cop.x = hit.x; cop.y = hit.y;
  }
  if (stars < 2) G.cops = [];
}

// ---------- Combat / bullets / enemies ----------
export function updateCombat(G, dt, audio) {
  const p = G.player;
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    // building hit
    if (pointInBuilding(G.city, b.x, b.y)) { b.life = 0; spawnParticles(G, b.x, b.y, 3, '#f1c40f'); continue; }
    if (b.fromPlayer) {
      for (const e of G.enemies) {
        if (e.hp > 0 && dist2(b.x, b.y, e.x, e.y) < 18 * 18) {
          e.hp -= b.dmg; b.life = 0; G.stats.hits++;
          spawnParticles(G, b.x, b.y, 5, '#e74c3c');
          if (e.hp <= 0) {
            G.kills++; G.score += 100;
            spawnParticles(G, e.x, e.y, 14, '#c0392b');
            G.pickups.push({ x: e.x, y: e.y, kind: 'cash', val: 60 + Math.floor(Math.random() * 80), t: 0 });
            audio.hit();
          }
          break;
        }
      }
      for (const cop of G.cops) {
        if (cop.hp > 0 && dist2(b.x, b.y, cop.x, cop.y) < 18 * 18) {
          cop.hp -= b.dmg; b.life = 0;
          addWanted(G, 0.5);
          if (cop.hp <= 0) { G.kills++; spawnParticles(G, cop.x, cop.y, 12, '#2c3e50'); }
          break;
        }
      }
      for (const ped of G.peds) {
        if (!ped.dead && dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
          ped.dead = true; b.life = 0;
          spawnParticles(G, b.x, b.y, 8, '#c0392b');
          addWanted(G, 1);
          break;
        }
      }
    } else {
      if (!p.inCar && dist2(b.x, b.y, p.x, p.y) < 16 * 16) {
        b.life = 0;
        hurtPlayer(G, b.dmg, audio);
        spawnParticles(G, b.x, b.y, 4, '#e74c3c');
      } else if (p.inCar && dist2(b.x, b.y, p.x, p.y) < 26 * 26) {
        b.life = 0;
        p.inCar.hp -= b.dmg;
        if (p.inCar.hp <= 0) { explodeCar(G, p.inCar, audio); exitCar(G); hurtPlayer(G, 25, audio); }
      }
    }
  }
  G.bullets = G.bullets.filter(b => b.life > 0 && b.x > 0 && b.x < WORLD && b.y > 0 && b.y < WORLD);
  G.cops = G.cops.filter(c => c.hp > 0);
  // enemies AI
  for (const e of G.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 300) {
      e.x += Math.cos(e.angle) * 110 * dt;
      e.y += Math.sin(e.angle) * 110 * dt;
    } else {
      e.fireCd -= dt;
      if (e.fireCd <= 0) {
        e.fireCd = 0.9 + Math.random() * 0.9;
        fireBullet(G, e.x, e.y, e.angle + (Math.random() - 0.5) * 0.25, 7, false, audio);
      }
    }
    const hit = collideCircle(G.city, e.x, e.y, 12);
    e.x = hit.x; e.y = hit.y;
  }
  G.enemies = G.enemies.filter(e => e.hp > 0);
  // particles
  for (const pt of G.particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
  G.particles = G.particles.filter(pt => pt.life > 0);
  // pickups
  for (const pk of G.pickups) {
    pk.t += dt;
    if (dist2(pk.x, pk.y, p.x, p.y) < 34 * 34) {
      pk.taken = true;
      if (pk.kind === 'cash') { G.money += pk.val; setToast(G, '+$' + pk.val); audio.cash(); }
      else if (pk.kind === 'health') { G.health = Math.min(100, G.health + 40); setToast(G, 'Health +40'); audio.pickup(); }
      else if (pk.kind === 'armor') { G.armor = Math.min(100, G.armor + 50); setToast(G, 'Armor +50'); audio.pickup(); }
      else if (pk.kind === 'package') { G.money += 150; G.score += 250; setToast(G, 'Hidden package found! +$150'); audio.cash(); }
      else if (pk.kind === 'smg') { G.ammo.smg += 60; setToast(G, 'SMG ammo +60'); audio.pickup(); }
      else if (pk.kind === 'shotgun') { G.ammo.shotgun += 12; setToast(G, 'Shotgun shells +12'); audio.pickup(); }
    }
  }
  G.pickups = G.pickups.filter(pk => !pk.taken && pk.t < 90);
}

export function explodeCar(G, car, audio) {
  spawnParticles(G, car.x, car.y, 26, '#e67e22');
  spawnParticles(G, car.x, car.y, 16, '#2c3e50');
  audio.crash();
  audio.noise(0.5, 0.4, 700);
  car.hp = 0;
  if (car.kind === 'player') { /* player car destroyed */ }
  else if (car.kind === 'police') { G.score += 150; }
  G.cars = G.cars.filter(c => c !== car || c.kind === 'player');
  if (car.kind !== 'player') G.cars = G.cars.filter(c => c !== car);
}
