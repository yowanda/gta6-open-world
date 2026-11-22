// shots.js — stages real gameplay scenes for screenshots.
// ?shot=cover | bounty | chase | mission | boat — the game itself renders these states;
// this only places the player, cars and police, then starts play.
import { makeCar, spawnTraffic, spawnPeds, setToast } from './entities.js';
import { startMission } from './missions.js';
import { stageRoadblock } from './police.js';
import { RACE_POINTS } from './activities.js';
import { BAY_RACE_POINTS } from './boats.js';
import { startGangWar, stageSkirmish } from './gangwar.js';

export function stageShot(G, name, audio) {
  G.shotMode = name;
  G.state = 'playing';
  const p = G.player;
  if (name === 'cover') {
    // Dusk on the Sunset Boardwalk: Rico in a red Sports car on the coast
    // road, ferris wheel and pier ahead, the Rook's Reckoning mission live.
    // The car starts a block south of the wheel so the camera (which never
    // centres past the city edge) still frames wheel, pier and stalls.
    G.clockMin = 18 * 60 + 40;
    p.x = 2210; p.y = 1560;
    const c = makeCar(2210, 1560, -Math.PI / 2, { name: 'Sports', w: 44, l: 80, speed: 480, accel: 360 }, '#e74c3c', 'player');
    c.speed = 240;
    G.cars.push(c);
    p.inCar = c; p.onFoot = false;
    spawnTraffic(G, 10);
    spawnPeds(G, 18);
    G.money = 18250; G.health = 92; G.armor = 60;
    G.missionsDone = 8;
    startMission(G, 8, audio);
    G.wanted = 2;
    // a Cobra hit-squad is pushing into the Boardwalk turf behind the
    // story fight: green shooters, a burning barricade and the purple
    // turf tint under Rook's crew — the cover shows the gang war too
    stageSkirmish(G);
  } else if (name === 'gangwar') {
    // Turf war on The Strip, mid-fight: five Vultures vs five Cobras
    // trading fire across the street, gang cars as cover, a burning
    // barricade in the middle, Rico in the crossfire with the SMG out.
    // The HUD turf panel and the GANG WAR banner show the war live,
    // and the purple turf tint marks Vulture ground under the fight.
    G.clockMin = 17 * 60 + 40;
    p.x = 1885; p.y = 1300; p.onFoot = true; p.inCar = null;
    p.angle = 0;
    spawnTraffic(G, 8);
    spawnPeds(G, 14);
    G.money = 15200; G.health = 100; G.armor = 60;
    G.ammo.smg = 120; G.weapon = 'smg';
    G.missionsDone = 6;
    G.nextMissionAt = 1e9; // staged shot: no story mission may butt in
    G.bountyCd = 45; // staged shot: the next bounty round stays 45 s out
    startGangWar(G, 'strip', audio);
    G.turf.cooldown = 1e9; // staged shot: no second war may start
    // tracers already in the air when the shutter opens
    G.bullets.push({ x: p.x + 120, y: p.y - 60, vx: 700, vy: 250, life: 0.4, dmg: 0, fromPlayer: false, gang: 'vultures' });
    G.bullets.push({ x: p.x - 100, y: p.y + 40, vx: -700, vy: -150, life: 0.4, dmg: 0, fromPlayer: false, gang: 'cobras' });
    setToast(G, 'GANG WAR — The Strip is up for grabs. Pick a side, Rico.');
  } else if (name === 'bounty') {
    // Bounty hunt on the Boardwalk: Rico on foot, SMG out, three wanted
    // Vultures with red $ tags closing in, bounty panel on the HUD.
    // Staged west of the strip so the camera frames the whole fight.
    G.clockMin = 15 * 60 + 10;
    p.x = 1950; p.y = 1300; p.onFoot = true; p.inCar = null;
    p.angle = 0;
    spawnTraffic(G, 8);
    spawnPeds(G, 12);
    G.money = 6420; G.health = 100; G.armor = 25;
    G.ammo.smg = 120; G.weapon = 'smg';
    G.missionsDone = 3;
    G.nextMissionAt = 1e9; // staged shot: no story mission may butt in
    G.bounty = { left: 3, total: 3, t: 12.5 };
    for (const [ex, ey] of [[2250, 1200], [2280, 1400], [2200, 1150]]) {
      G.enemies.push({ x: ex, y: ey, angle: Math.PI, hp: 60, fireCd: 2.5, gang: true, bounty: true });
    }
    setToast(G, 'BOUNTY: three wanted Vultures are loose — $400 each, red $ on the map');
  } else if (name === 'chase') {
    // Five-star police chase at night: Interceptor cruisers closing in, PD helicopter
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
    G.wanted = 5;
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
      const pc = makeCar(p.x + Math.cos(a) * 430, p.y + Math.sin(a) * 430, Math.atan2(-Math.sin(a), -Math.cos(a)), { name: 'Interceptor', w: 46, l: 88, speed: 520, accel: 400 }, '#1e3a5f', 'police');
      pc.siren = true; pc.speed = 460;
      G.cars.push(pc);
    }
    // helicopter already overhead (updatePolice would spawn it on the next tick)
    G.heli = { x: p.x + 220, y: p.y - 220, angle: Math.PI * 0.75 };
    // a PD roadblock with spike strips ahead of the player on the same
    // road — the dragnet, the helicopter and the escape step in one frame
    p.angle = Math.PI;
    stageRoadblock(G, 420);
  } else if (name === 'mission') {
    // The finale on foot at the Boardwalk: Rook, his Bruiser and his crew,
    // SMG out, mission objective and kill counter on the HUD. The fight is
    // staged a block west of the wheel so the Boardwalk stays in frame.
    G.clockMin = 12 * 60 + 5;
    p.x = 2210; p.y = 1300; p.onFoot = true; p.inCar = null;
    p.angle = 0;
    spawnTraffic(G, 3);
    spawnPeds(G, 8);
    G.money = 16400; G.health = 88; G.armor = 40;
    G.ammo.smg = 120; G.weapon = 'smg';
    G.missionsDone = 8;
    startMission(G, 8, audio);
    // jump mission to the kill step — the fight stays clear of the minimap
    G.mission.step = 1;
    G.mission.killsAtStart = G.kills;
    G.mission.spawned = false;
    for (let i = 0; i < 5; i++) {
      G.enemies.push({ x: 2320 + (Math.random() - 0.5) * 160, y: 1300 + (Math.random() - 0.5) * 160, angle: 0, hp: 60, fireCd: 1.5, gang: true });
    }
    G.enemies.push({ x: 2280, y: 1380, angle: 0, hp: 130, fireCd: 1.5, gang: true, bruiser: true, name: 'Bruiser' });
    G.enemies.push({ x: 2380, y: 1240, angle: 0, hp: 260, fireCd: 1.5, gang: true, boss: true, name: 'Rook' });
    G.mission.spawned = true;
    // a few bullets in the air for action
    G.bullets.push({ x: p.x + 60, y: p.y - 20, vx: 600, vy: 200, life: 0.4, dmg: 0, fromPlayer: true });
  } else if (name === 'boat') {
    // Dusk on the bay: Rico at the helm of the red speedboat off the
    // Boardwalk, ferris wheel and pier behind, wake trailing, the Bay
    // Runner race already running so the HUD shows the buoy progress.
    // The boat runs north from a block south of the wheel so the camera
    // (which never centres past the city edge) still frames wheel, pier
    // and stalls while the wake trails behind it.
    G.clockMin = 18 * 60 + 20;
    const b = G.boats[0];
    // start well south of the wheel and cruise north: the boat covers
    // ~600 px while the shot settles, so it ends by the wheel with its
    // wake trailing south behind it. x=2500 keeps the whole hull in frame
    // (the camera never centres past the city edge, so the bay is a strip
    // on the right of the shot). cp=2 so no buoy is crossed mid-settle.
    b.x = 2500; b.y = 1800; b.angle = -Math.PI / 2; b.speed = 200; b.moored = false;
    p.x = b.x; p.y = b.y; p.angle = b.angle; p.onFoot = false; p.inCar = null;
    p.inBoat = b;
    spawnTraffic(G, 8);
    spawnPeds(G, 12);
    G.money = 9300; G.health = 100; G.armor = 40;
    G.missionsDone = 5;
    G.nextMissionAt = 1e9; // staged shot: no story mission may butt in
    G.bountyCd = 45; // staged shot: the next bounty round stays 45 s out
    G.boatRace = { active: true, cp: 2, t: 24.6, points: BAY_RACE_POINTS, cooldown: 0 };
    setToast(G, 'BAY RUNNER! Round all 4 buoys — $1200 for the win');
  }
  // aim the camera at the player immediately
  G.cam.x = p.x; G.cam.y = p.y;
}
