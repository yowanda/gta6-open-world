// shots.js — stages real gameplay scenes for screenshots.
// ?shot=cover | race | chase | mission — the game itself renders these states;
// this only places the player, cars and police, then starts play.
import { makeCar, spawnTraffic, spawnPeds, setToast } from './entities.js';
import { startMission } from './missions.js';
import { RACE_POINTS } from './activities.js';

export function stageShot(G, name, audio) {
  G.shotMode = name;
  G.state = 'playing';
  const p = G.player;
  if (name === 'cover') {
    // Dusk on the Strip: Rico in a red Sports car, timed Getaway mission live,
    // 2-star heat, traffic and pedestrians all around, HUD + minimap + timer
    G.clockMin = 18 * 60 + 40;
    p.x = 1170; p.y = 910;
    const c = makeCar(1170, 910, 0, { name: 'Sports', w: 44, l: 80, speed: 480, accel: 360 }, '#e74c3c', 'player');
    c.speed = 240;
    G.cars.push(c);
    p.inCar = c; p.onFoot = false;
    spawnTraffic(G, 10);
    spawnPeds(G, 18);
    G.money = 12850; G.health = 92; G.armor = 60;
    G.missionsDone = 6;
    startMission(G, 6, audio);
    G.wanted = 2;
  } else if (name === 'race') {
    // Street race on the Strip: checkpoint 1 ahead, race timer on the HUD
    G.clockMin = 15 * 60 + 10;
    p.x = 1170; p.y = 910;
    const c = makeCar(1170, 910, 0, { name: 'Sports', w: 44, l: 80, speed: 480, accel: 360 }, '#f1c40f', 'player');
    c.speed = 400;
    G.cars.push(c);
    p.inCar = c; p.onFoot = false;
    spawnTraffic(G, 12);
    spawnPeds(G, 16);
    G.money = 5420; G.health = 100; G.armor = 25;
    G.missionsDone = 1;
    G.race = { active: true, cp: 0, t: 23.4, points: RACE_POINTS, cooldown: 0 };
    G.raceFlash = 0;
    setToast(G, 'STREET RACE! Checkpoint 1/6 — $1500 for the win');
  } else if (name === 'chase') {
    // Four-star police chase at night: cruisers closing in, PD helicopter
    // overhead with its spotlight, sirens, escape step of The Bank Job live
    G.clockMin = 21 * 60 + 30;
    p.x = 1430; p.y = 1430;
    const c = makeCar(1430, 1430, Math.PI, { name: 'Comet', w: 46, l: 84, speed: 420, accel: 300 }, '#3498db', 'player');
    c.speed = 320;
    G.cars.push(c);
    p.inCar = c; p.onFoot = false;
    spawnTraffic(G, 8);
    spawnPeds(G, 10);
    G.money = 2100; G.health = 64; G.armor = 0;
    G.wanted = 4;
    G.missionsDone = 4;
    startMission(G, 4, audio);
    // jump to the escape step: lose the heat
    G.mission.step = 2;
    G.mission.heatApplied = true;
    // police already on scene — staged a little farther out so the player's
    // car is still visibly driving when the shot is taken
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      // face the player: the angle from the cruiser to the player is a + PI
      const pc = makeCar(p.x + Math.cos(a) * 430, p.y + Math.sin(a) * 430, Math.atan2(-Math.sin(a), -Math.cos(a)), { name: 'Sedan', w: 46, l: 92, speed: 360, accel: 260 }, '#1e3a5f', 'police');
      pc.siren = true; pc.speed = 380;
      G.cars.push(pc);
    }
    // helicopter already overhead (updatePolice would spawn it on the next tick)
    G.heli = { x: p.x + 220, y: p.y - 220, angle: Math.PI * 0.75 };
  } else if (name === 'mission') {
    // The finale on foot at the marina: Dario Voss and his crew, SMG out,
    // mission objective and kill counter on the HUD
    G.clockMin = 12 * 60 + 5;
    p.x = 2240; p.y = 1300; p.onFoot = true; p.inCar = null;
    p.angle = Math.PI / 4;
    spawnTraffic(G, 6);
    spawnPeds(G, 12);
    G.money = 9400; G.health = 88; G.armor = 40;
    G.ammo.smg = 120; G.weapon = 'smg';
    G.missionsDone = 7;
    startMission(G, 7, audio);
    // jump mission to the kill step — the fight stays clear of the minimap
    G.mission.step = 1;
    G.mission.killsAtStart = G.kills;
    G.mission.spawned = false;
    for (let i = 0; i < 7; i++) {
      G.enemies.push({ x: 2340 + (Math.random() - 0.5) * 160, y: 1300 + (Math.random() - 0.5) * 160, angle: 0, hp: 60, fireCd: 1, gang: true });
    }
    G.enemies.push({ x: 2340, y: 1300, angle: 0, hp: 220, fireCd: 1, gang: true, boss: true, name: 'Dario Voss' });
    G.mission.spawned = true;
    // a few bullets in the air for action
    G.bullets.push({ x: p.x + 60, y: p.y - 20, vx: 600, vy: 200, life: 0.4, dmg: 0, fromPlayer: true });
  }
  // aim the camera at the player immediately
  G.cam.x = p.x; G.cam.y = p.y;
}
