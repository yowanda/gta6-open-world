// shots.js — stages real gameplay scenes for screenshots.
// ?shot=cover | drive | chase | mission — the game itself renders these states;
// this only places the player, cars and police, then starts play.
import { makeCar, spawnTraffic, spawnPeds } from './entities.js';
import { startMission } from './missions.js';

export function stageShot(G, name, audio) {
  G.shotMode = name;
  G.state = 'playing';
  const p = G.player;
  if (name === 'cover') {
    // Driving downtown at dusk, traffic all around, HUD + minimap + mission live
    G.clockMin = 18 * 60 + 40;
    p.x = 910; p.y = 1170;
    const c = makeCar(910, 1170, 0, { name: 'Sports', w: 44, l: 80, speed: 480, accel: 360 }, '#e74c3c', 'player');
    c.speed = 240;
    G.cars.push(c);
    p.inCar = c; p.onFoot = false;
    spawnTraffic(G, 10);
    spawnPeds(G, 18);
    G.money = 12850; G.health = 92; G.armor = 60;
    G.missionsDone = 3;
    startMission(G, 3, audio);
    G.wanted = 1;
  } else if (name === 'drive') {
    // High-speed run down the Strip avenue
    G.clockMin = 15 * 60 + 10;
    p.x = 910; p.y = 910;
    const c = makeCar(910, 910, 0, { name: 'Sports', w: 44, l: 80, speed: 480, accel: 360 }, '#f1c40f', 'player');
    c.speed = 400;
    G.cars.push(c);
    p.inCar = c; p.onFoot = false;
    spawnTraffic(G, 12);
    spawnPeds(G, 16);
    G.money = 5420; G.health = 100; G.armor = 25;
    G.missionsDone = 1;
    startMission(G, 1, audio);
  } else if (name === 'chase') {
    // Three-star police chase at night, sirens, cops closing in
    G.clockMin = 21 * 60 + 30;
    p.x = 1430; p.y = 1430;
    const c = makeCar(1430, 1430, Math.PI, { name: 'Comet', w: 46, l: 84, speed: 420, accel: 300 }, '#3498db', 'player');
    c.speed = 320;
    G.cars.push(c);
    p.inCar = c; p.onFoot = false;
    spawnTraffic(G, 8);
    spawnPeds(G, 10);
    G.money = 2100; G.health = 64; G.armor = 0;
    G.wanted = 3;
    G.missionsDone = 4;
    startMission(G, 4, audio);
    // police already on scene
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      // face the player: the angle from the cruiser to the player is a + PI
      const pc = makeCar(p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320, Math.atan2(-Math.sin(a), -Math.cos(a)), { name: 'Sedan', w: 46, l: 92, speed: 360, accel: 260 }, '#1e3a5f', 'police');
      pc.siren = true; pc.speed = 380;
      G.cars.push(pc);
    }
  } else if (name === 'mission') {
    // On foot at the warehouse, Vultures gang fight, mission objective on HUD
    G.clockMin = 12 * 60 + 5;
    p.x = 560; p.y = 700; p.onFoot = true; p.inCar = null;
    p.angle = Math.PI / 4;
    spawnTraffic(G, 6);
    spawnPeds(G, 12);
    G.money = 3400; G.health = 88; G.armor = 40;
    G.ammo.smg = 120; G.weapon = 'smg';
    G.missionsDone = 3;
    startMission(G, 3, audio);
    // jump mission to the kill step
    G.mission.step = 1;
    G.mission.killsAtStart = G.kills;
    G.mission.spawned = false;
    for (let i = 0; i < 5; i++) {
      G.enemies.push({ x: 650 + (Math.random() - 0.5) * 140, y: 650 + (Math.random() - 0.5) * 140, angle: 0, hp: 60, fireCd: 1, gang: true });
    }
    G.mission.spawned = true;
    // a few bullets in the air for action
    G.bullets.push({ x: p.x + 60, y: p.y - 20, vx: 600, vy: 200, life: 0.4, dmg: 0, fromPlayer: true });
  }
  // aim the camera at the player immediately
  G.cam.x = p.x; G.cam.y = p.y;
}
