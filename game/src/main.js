// main.js — Solara Bay: an original open-world crime game.
// Boots the canvas, runs the loop, and wires city, entities, missions, HUD and audio.
import { createGame, clamp, lerp, dist2, nightFactor } from './state.js';
import { generateCity } from './city.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { makePlayer, spawnTraffic, spawnPeds, updatePlayer, updateTraffic, updatePeds, updatePolice, updateCombat, setToast, exitCar } from './entities.js';
import { startMission, updateMissions, currentStep } from './missions.js';
import { initDragnet, updateDragnet } from './police.js';
import { updateActivities } from './activities.js';
import { initBoats, updateBoats, boatPrompt, DOCKS } from './boats.js';
import { drawWorld } from './render.js';
import { drawHUD, drawMenu, drawPause, drawEndScreen } from './hud.js';
import { saveGame, loadSave, applySave, saveInfo } from './save.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const G = createGame();
const input = new Input(canvas);
const audio = new AudioSys();

let vw = 0, vh = 0;
function resize() {
  vw = window.innerWidth;
  vh = window.innerHeight;
  canvas.width = vw; canvas.height = vh;
}
window.addEventListener('resize', resize);
resize();

G.city = generateCity();
initBoats(G);
G.player = makePlayer(420, 460);
G.cam.x = G.player.x; G.cam.y = G.player.y;

// hidden packages around the city (collectible activity)
const pkgSpots = [[390, 1430], [1690, 390], [2210, 650], [650, 2210], [1950, 1170], [1170, 2210], [910, 1690], [2400, 390], [1430, 2210], [390, 910]];
for (const [x, y] of pkgSpots) G.pickups.push({ x, y, kind: 'package', val: 0, t: 0 });
G.pickups.push({ x: 650, y: 1950, kind: 'health', val: 0, t: 0 });
G.pickups.push({ x: 1690, y: 650, kind: 'armor', val: 0, t: 0 });

// expose a small hook for automated play-testing (not part of the game UI)
window.__game = G;
window.__shotReady = false;

function refreshSaveInfo() {
  const info = saveInfo(G);
  G.hasSave = !!info;
  if (info) { G.saveMoney = info.money; G.saveMissions = info.missions; }
}
refreshSaveInfo();

function newGame() {
  G.money = 500; G.health = 100; G.armor = 0;
  G.ammo = { pistol: 120, smg: 0, shotgun: 0 }; G.weapon = 'pistol';
  G.missionsDone = 0; G.score = 0; G.kills = 0; G.carsStolen = 0;
  G.wanted = 0; G.mission = null; G.missionIdx = 0; G.nextMissionAt = undefined;
  G.enemies = []; G.cops = []; G.bullets = []; G.pickups = [];
  G.cars = []; G.peds = [];
  G.heli = null; G.taxi = null; G.race = null;
  G.bounty = null; G.bountyCd = 0;
  initBoats(G);
  G.weather = 'clear'; G.weatherT = 75 + Math.random() * 60;
  initDragnet(G);
  for (const [x, y] of pkgSpots) G.pickups.push({ x, y, kind: 'package', val: 0, t: 0 });
  G.player = makePlayer(420, 460);
  G.cam.x = G.player.x; G.cam.y = G.player.y;
  G.clockMin = 16 * 60 + 24;
  spawnTraffic(G, 16);
  spawnPeds(G, 34);
  G.state = 'playing';
  setToast(G, 'Welcome to Solara Bay, Rico. Mara is waiting at the Pelican Motel.');
  audio.ensure(); audio.startMusic();
}

function respawn() {
  const p = G.player;
  if (p.inCar) { const c = p.inCar; G.cars = G.cars.filter(x => x !== c); }
  if (p.inBoat) {
    // the boat is towed back to its home dock; Rico wakes up on land
    const b = p.inBoat, d = DOCKS[b.dock];
    b.x = d.bx; b.y = d.by; b.angle = -Math.PI / 2; b.speed = 0; b.moored = true;
    p.inBoat = null; p.onFoot = true;
  }
  p.inCar = null; p.onFoot = true; p.dead = false;
  p.x = 650; p.y = 1950; // Solara General Hospital
  const fee = G.money - Math.floor(G.money * 0.9); // 10% hospital fee, taken before the deduction
  G.money = Math.floor(G.money * 0.9);
  G.health = 100; G.armor = 0; G.wanted = 0; G.cops = [];
  G.heli = null; G.taxi = null; G.race = null;
  G.bounty = null; G.bountyCd = 0;
  initDragnet(G);
  G.enemies = G.enemies.filter(e => !e.bounty);
  G.cars = G.cars.filter(c => c.kind !== 'police');
  G.cam.x = p.x; G.cam.y = p.y;
  G.state = 'playing';
  setToast(G, 'Patched up at Solara General. -$' + fee + ' in fees.');
}

// --- interactions: shops, safehouse, spray shop ---
function updateInteractions(dt) {
  const p = G.player;
  const city = G.city;
  const near = (pt, r) => dist2(p.x, p.y, pt.x, pt.y) < r * r;
  G.nearShop = null;
  // tire repair works from the driver's seat: roll into Pay 'n' Spray and
  // press R — no need to get out while the PD is still looking for you
  if (p.inCar && near(city.spray, 90)) {
    G.nearShop = 'spray';
    if (input.hit('r')) {
      const c = p.inCar;
      if ((c.flat || 0) > 0 && G.money >= 150) {
        G.money -= 150; c.flat = 0;
        setToast(G, 'Fresh rubber all round — $150');
        audio.cash();
      } else if ((c.flat || 0) > 0) setToast(G, 'Tire repair costs $150');
      else setToast(G, 'Pay \'n\' Spray: tires are fine — get out (E) to clear heat');
    }
    return;
  }
  if (!p.onFoot) return;
  if (near(city.gunshop, 70)) G.nearShop = 'gun';
  else if (near(city.spray, 80)) G.nearShop = 'spray';
  else if (near(city.safehouse, 80)) G.nearShop = 'safe';
  else if (near(city.hospital, 80)) G.nearShop = 'hospital';
  if (G.nearShop === 'safe' && G.state === 'playing') {
    // safehouse auto-saves and heals
    if (!G._safeT) G._safeT = 0;
    G._safeT += dt;
    if (G._safeT > 2) { G._safeT = 0; if (saveGame(G)) setToast(G, 'Game saved at the Pelican Motel'); G.health = 100; }
  } else G._safeT = 0;
  if (input.hit('e') && G.nearShop) {
    if (G.nearShop === 'gun') {
      if (G.ammo.smg === 0 && G.money >= 800) { G.money -= 800; G.ammo.smg = 120; G.weapon = 'smg'; setToast(G, 'Bought SMG + 120 rounds — $800'); audio.cash(); }
      else if (G.ammo.shotgun === 0 && G.money >= 1200) { G.money -= 1200; G.ammo.shotgun = 24; G.weapon = 'shotgun'; setToast(G, 'Bought Shotgun + 24 shells — $1200'); audio.cash(); }
      else if (G.money >= 200) { G.money -= 200; G.ammo[G.weapon] += G.weapon === 'shotgun' ? 12 : 60; setToast(G, 'Ammo restocked — $200'); audio.cash(); }
      else setToast(G, 'Ironworks Gun Shop: not enough cash');
    } else if (G.nearShop === 'spray') {
      if (G.wanted >= 1 && G.money >= 300) { G.money -= 300; G.wanted = 0; G.cops = []; G.cars = G.cars.filter(c => c.kind !== 'police'); setToast(G, 'New paint, new plates — heat cleared, $300'); audio.pickup(); }
      else if (G.wanted < 1) setToast(G, 'Pay \'n\' Spray: no heat on you right now');
      else setToast(G, 'Pay \'n\' Spray: need $300');
    } else if (G.nearShop === 'hospital') {
      if (G.health < 100 && G.money >= 150) { G.money -= 150; G.health = 100; setToast(G, 'Treated at Solara General — $150'); audio.pickup(); }
      else if (G.health >= 100) setToast(G, 'Solara General: you look fine');
      else setToast(G, 'Solara General: treatment costs $150');
    }
  }
}

// --- day / night lighting (0 = day, 1 = deep night) ---
function darkness() {
  return nightFactor(G.clockMin) * 0.45;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  if (G.state === 'playing') G.clockMin += dt * 1.0; // 1 game-minute per second
  if (G.messageT > 0) G.messageT -= dt;

  // mouse world position
  G.mouse.x = input.mouse.x; G.mouse.y = input.mouse.y;
  G.mouse.wx = G.cam.x + (input.mouse.x - vw / 2) / G.cam.zoom;
  G.mouse.wy = G.cam.y + (input.mouse.y - vh / 2) / G.cam.zoom;
  G.mouse.down = input.mouse.down;

  if (G.state === 'menu') {
    if (G.showHelp) { if (input.hit('enter') || input.hit(' ') || input.hit('escape') || input.mouse.clicked) { G.showHelp = false; audio.click(); } }
    else {
      if (input.hit('w') || input.hit('arrowup')) { G.menuSel = (G.menuSel + 3 - 1) % 3; audio.click(); }
      if (input.hit('s') || input.hit('arrowdown')) { G.menuSel = (G.menuSel + 1) % 3; audio.click(); }
      if (input.hit('enter') || input.hit(' ')) {
        audio.ensure(); audio.click();
        if (G.menuSel === 0) newGame();
        else if (G.menuSel === 1 && G.hasSave) {
          const d = loadSave(G);
          if (d) { newGame(); applySave(G, d); setToast(G, 'Save loaded — welcome back to Solara Bay'); }
        } else if (G.menuSel === 2 || (G.menuSel === 1 && !G.hasSave)) G.showHelp = true;
      }
    }
  } else if (G.state === 'playing') {
    if (input.hit('p') || input.hit('escape')) { G.state = 'paused'; G.pausedSel = 0; audio.click(); }
    else if (G.dialog) {
      if (input.hit('e') || input.hit('enter') || input.hit(' ') || input.mouse.clicked) {
        G.dialog.i++;
        if (G.dialog.i >= G.dialog.lines.length) G.dialog = null;
        audio.click();
      }
    } else {
      updateBoats(G, input, audio, dt); // boards, sails, Bay Runner — before the player update eats E
      updatePlayer(G, input, audio, dt);
      updateTraffic(G, dt);
      updatePeds(G, dt, audio);
      updatePolice(G, dt, audio);
      updateDragnet(G, dt, audio);
      updateCombat(G, dt, audio);
      updateMissions(G, input, audio, dt);
      updateActivities(G, input, audio, dt);
      updateInteractions(dt);
      // weather rolls over on its own: clear skies, then rain, then clear
      G.weatherT -= dt;
      if (G.weatherT <= 0) {
        if (G.weather === 'clear') {
          if (Math.random() < 0.35) {
            G.weather = 'rain'; G.weatherT = 45 + Math.random() * 45;
            setToast(G, 'Rain over Solara Bay — roads are slick');
          } else G.weatherT = 60 + Math.random() * 60;
        } else {
          G.weather = 'clear'; G.weatherT = 75 + Math.random() * 90;
          setToast(G, 'The rain lets up over Solara Bay');
        }
      }
    }
    // camera follows player with velocity look-ahead
    const p = G.player;
    const tx = p.x + (p.vx || 0) * 0.25 + ((p.inCar || p.inBoat) ? Math.cos(p.angle) * 60 : 0);
    const ty = p.y + (p.vy || 0) * 0.25 + ((p.inCar || p.inBoat) ? Math.sin(p.angle) * 60 : 0);
    G.cam.x = lerp(G.cam.x, tx, 1 - Math.pow(0.001, dt));
    G.cam.y = lerp(G.cam.y, ty, 1 - Math.pow(0.001, dt));
    // never show the void beyond the city edge
    const hw = vw / 2 / G.cam.zoom, hh = vh / 2 / G.cam.zoom;
    G.cam.x = clamp(G.cam.x, Math.min(hw, 1300), Math.max(2600 - hw, 1300));
    G.cam.y = clamp(G.cam.y, Math.min(hh, 1300), Math.max(2600 - hh, 1300));
    G.cam.zoom = lerp(G.cam.zoom, p.inCar ? 0.82 : 1.0, dt * 2);
  } else if (G.state === 'paused') {
    if (input.hit('p') || input.hit('escape')) { G.state = 'playing'; audio.click(); }
    if (input.hit('w') || input.hit('arrowup')) { G.pausedSel = (G.pausedSel + 4 - 1) % 4; audio.click(); }
    if (input.hit('s') || input.hit('arrowdown')) { G.pausedSel = (G.pausedSel + 1) % 4; audio.click(); }
    if (input.hit('enter') || input.hit(' ')) {
      audio.click();
      if (G.pausedSel === 0) G.state = 'playing';
      else if (G.pausedSel === 1) { if (saveGame(G)) setToast(G, 'Game saved'); G.state = 'playing'; }
      else if (G.pausedSel === 2) { const d = loadSave(G); if (d) { newGame(); applySave(G, d); } G.state = 'playing'; }
      else if (G.pausedSel === 3) { G.state = 'menu'; refreshSaveInfo(); }
    }
  } else if (G.state === 'wasted' || G.state === 'busted' || G.state === 'storydone') {
    if (input.hit('enter') || input.hit(' ')) {
      audio.click();
      if (G.state === 'storydone') { G.state = 'menu'; refreshSaveInfo(); }
      else respawn();
    }
  }

  // --- draw ---
  ctx.clearRect(0, 0, vw, vh);
  if (G.state === 'menu') {
    drawMenu(ctx, G, vw, vh);
  } else {
    drawWorld(ctx, G, vw, vh);
    // night tint
    const d = darkness();
    if (d > 0.01) { ctx.fillStyle = 'rgba(10,16,48,' + d + ')'; ctx.fillRect(0, 0, vw, vh); }
    if (G.state !== 'paused') drawHUD(ctx, G, vw, vh);
    // interaction prompt
    if (G.state === 'playing' && G.nearShop && !G.dialog) {
      const labels = {
        gun: 'Ironworks Gun Shop — E: buy weapon / ammo',
        spray: G.player.inCar
          ? (G.player.inCar.flat > 0 ? 'Pay \'n\' Spray — R: fix tires ($150)' : 'Pay \'n\' Spray — tires fine, get out (E) to clear heat')
          : 'Pay \'n\' Spray — E: clear wanted ($300)',
        safe: 'Pelican Motel — safehouse (auto-save)',
        hospital: 'Solara General — E: treatment ($150)',
      };
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = ctx.measureText(labels[G.nearShop]).width + 36;
      ctx.fillRect(vw / 2 - w / 2, vh - 190, w, 28);
      ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(labels[G.nearShop], vw / 2, vh - 171);
    }
    if (G.state === 'paused') drawPause(ctx, G, vw, vh);
    // dock prompt: what E does with a speedboat, when no shop is nearer
    const bp = G.state === 'playing' && !G.nearShop && !G.dialog ? boatPrompt(G) : null;
    if (bp) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const w = ctx.measureText(bp).width + 36;
      ctx.fillRect(vw / 2 - w / 2, vh - 190, w, 28);
      ctx.fillStyle = '#7fd4e8'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText(bp, vw / 2, vh - 171);
    }
    if (G.state === 'wasted') drawEndScreen(ctx, G, vw, vh, 'wasted');
    if (G.state === 'busted') drawEndScreen(ctx, G, vw, vh, 'busted');
    if (G.state === 'storydone') drawEndScreen(ctx, G, vw, vh, 'storydone');
  }

  input.endFrame();
  requestAnimationFrame(frame);
}

// screenshot staging: ?shot=cover|bounty|chase|mission
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  // pre-populate the world so the scene is alive, then stage the shot
  spawnTraffic(G, 6);
  spawnPeds(G, 10);
  stageShot(G, shot, audio);
  // let the world settle a few frames, then flag ready for the screenshot tool
  let frames = 0;
  const settle = () => {
    frames++;
    if (frames > 45) { window.__shotReady = true; return; }
    requestAnimationFrame(settle);
  };
  // run one update tick manually so traffic/police positions settle
  updateTraffic(G, 0.5);
  updatePolice(G, 0.5, audio);
  requestAnimationFrame(settle);
}
requestAnimationFrame(frame);
