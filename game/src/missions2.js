// missions2.js — Side Jobs: three chained job-givers in Solara Bay.
// Eddie Malone (chop shop, Portside), Lena Cruz (marina) and Ozzy Park
// (Sunset Boardwalk) each hand Rico a chain of three jobs. A chain pays
// cash per job, ends with an unlock (a car, a bike, a shotgun), and shows
// its progress on the HUD and the Jobs board (J). All original content.
import { WORLD, clamp, dist2, CAR_MODELS } from './state.js';
import { setToast, spawnParticles, makeCar, exitCar } from './entities.js';
import { collideCircle, randomRoadPos } from './city.js';

// --- the givers: where they stand, what they pay, what they unlock ---
export const SIDE_GIVERS = [
  { id: 'eddie', name: 'Eddie Malone', title: 'The Wrench — chop shop, Portside', x: 2210, y: 1950, color: '#e67e22' },
  { id: 'lena', name: 'Lena Cruz', title: 'Harbor Queen — the marina', x: 2340, y: 1240, color: '#2ecc71' },
  { id: 'ozzy', name: 'Ozzy Park', title: 'Boardwalk King — Sunset Boardwalk', x: 2280, y: 1560, color: '#9b59b6' },
];

export const SIDE_CHAINS = [
  {
    giver: 0, id: 'eddie', name: 'Eddie\'s Chop Shop', unlockLabel: 'Unlock: Stallion muscle car at the chop shop',
    jobs: [
      {
        id: 'e1', title: 'Hot Wheels, Cold Cash', reward: 900,
        brief: 'Eddie pays for anything with four wheels and no questions. Steal a car, bring it to his chop shop on Portside.',
        dialog: [
          'EDDIE: Rico! Mara says you can drive. Prove it — bring me a car. Any car. Don\'t scratch it too much.',
          'RICO: And the owner?',
          'EDDIE: The owner is about to learn about insurance. Chop shop is on Portside — yellow marker, can\'t miss it.',
        ],
        steps: [
          { type: 'steal', label: 'Steal a car (walk up and press E)' },
          { type: 'drive', x: 2210, y: 1950, label: 'Deliver the car to Eddie\'s chop shop', radius: 70 },
        ],
      },
      {
        id: 'e2', title: 'The Getaway', reward: 1600,
        brief: 'Eddie\'s last driver got pinched. A hot car has to cross town to the Pelican Motel — with the PD already looking for it.',
        dialog: [
          'EDDIE: Got a car that needs to be at the Motel in ninety seconds, and the PD already has its plate.',
          'RICO: Ninety seconds across town?',
          'EDDIE: Drive like the rent is due, Rico. Because it is.',
        ],
        steps: [
          { type: 'goto', x: 2210, y: 1950, label: 'Meet Eddie at the chop shop', radius: 70 },
          { type: 'timedrive', x: 420, y: 420, label: 'Outrun the heat to the Pelican Motel', radius: 70, secs: 90, heat: 2 },
        ],
      },
      {
        id: 'e3', title: 'The Boss\'s Joyride', reward: 2600,
        brief: 'A buyer at the marina wants a fast ride, no questions, cash in hand. Steal one, deliver it to the yacht, then vanish.',
        dialog: [
          'EDDIE: Big buyer at the marina. Wants something fast, something loud. You deliver, you get paid, you disappear.',
          'RICO: And the PD?',
          'EDDIE: The PD is your problem, kid. That\'s why I pay you.',
        ],
        steps: [
          { type: 'steal', label: 'Steal a fast ride for the buyer' },
          { type: 'drive', x: 2400, y: 1300, label: 'Deliver the ride to the marina yacht', radius: 80 },
          { type: 'escape', label: 'Lose the heat — get your wanted level to zero', heat: 3 },
        ],
        unlock: 'stallion',
      },
    ],
  },
  {
    giver: 1, id: 'lena', name: 'Lena\'s Harbor Run', unlockLabel: 'Unlock: free Shotgun + 24 shells from Lena\'s stash',
    jobs: [
      {
        id: 'l1', title: 'Slip Twelve', reward: 1200,
        brief: 'Lena\'s crate is waiting at the marina, slip 12. Grab it, bring it to the Pelican Motel, and don\'t open it.',
        dialog: [
          'LENA: Crate at the marina, slip twelve. Don\'t open it. Don\'t drop it. Don\'t get chatty about it.',
          'RICO: What\'s in it?',
          'LENA: Money, if you deliver it. Trouble, if you don\'t.',
        ],
        steps: [
          { type: 'goto', x: 2400, y: 1300, label: 'Go to the marina, slip 12', radius: 70 },
          { type: 'collect', label: 'Grab the crate' },
          { type: 'drive', x: 420, y: 420, label: 'Bring the crate to the Pelican Motel', radius: 70 },
        ],
      },
      {
        id: 'l2', title: 'Customs Dodge', reward: 2200,
        brief: 'A parcel at the Boardwalk has customs written all over it. Cut through the park, lose the PD, and get it to the Motel.',
        dialog: [
          'LENA: Parcel at the Boardwalk. The PD sniffed the last one, so this time you go through the park, not the avenues.',
          'RICO: The park is not a road, Lena.',
          'LENA: Then drive it like it is one.',
        ],
        steps: [
          { type: 'goto', x: 2280, y: 1560, label: 'Pick up the parcel at the Boardwalk', radius: 70 },
          { type: 'collect', label: 'Grab the parcel' },
          { type: 'drive', x: 1300, y: 1300, label: 'Cut through the central park', radius: 80, heat: 2 },
          { type: 'escape', label: 'Lose the heat — get your wanted level to zero', heat: 2 },
          { type: 'drive', x: 420, y: 420, label: 'Deliver to the Pelican Motel', radius: 70 },
        ],
      },
      {
        id: 'l3', title: 'The Last Crate', reward: 4000,
        brief: 'The Vultures are sitting on Lena\'s last crate at the casino. Clear them out, grab it, and race it to the marina yacht.',
        dialog: [
          'LENA: The Vultures took my last crate and parked it at the casino like it was theirs.',
          'RICO: How many?',
          'LENA: Four. And the yacht leaves in eighty seconds once you\'ve got it. Don\'t be late, Rico.',
        ],
        steps: [
          { type: 'goto', x: 1430, y: 1170, label: 'Get to the Neon Palms Casino', radius: 90 },
          { type: 'kill', count: 4, label: 'Clear the Vultures off the crate (0/4)' },
          { type: 'collect', label: 'Grab the last crate' },
          { type: 'timedrive', x: 2400, y: 1300, label: 'Race the crate to the marina yacht', radius: 80, secs: 80 },
        ],
        unlock: 'shotgun',
      },
    ],
  },
  {
    giver: 2, id: 'ozzy', name: 'Ozzy\'s Boardwalk', unlockLabel: 'Unlock: Rider motorbike parked on the Boardwalk',
    jobs: [
      {
        id: 'o1', title: 'Walk the Kid Home', reward: 1000,
        brief: 'Ozzy\'s nephew Timmy is stuck on the Boardwalk after dark and the Vultures are out. Walk him home to the central park — on foot, and stay close.',
        dialog: [
          'OZZY: My nephew Timmy is on the Boardwalk and the Vultures are sniffing around. Walk him to the park.',
          'RICO: You want me to babysit?',
          'OZZY: I want you to walk a kid home safe. A thousand bucks says you can.',
        ],
        steps: [
          { type: 'goto', x: 2280, y: 1560, label: 'Meet Timmy at the Boardwalk', radius: 70 },
          { type: 'escort', x: 1300, y: 1300, label: 'Walk Timmy home to the park — stay on foot, stay close', radius: 80 },
        ],
      },
      {
        id: 'o2', title: 'The Shakedown', reward: 2000,
        brief: 'A debtor skipped town in his car with Ozzy\'s money. Run the car down — get close and hold on till he gives up — then bring the cash back.',
        dialog: [
          'OZZY: A debtor of mine is doing a hundred down the Strip with my money in his glovebox.',
          'RICO: So I chase him?',
          'OZZY: You catch him. Get right on his bumper and stay there till he quits. Then bring me what\'s mine.',
        ],
        steps: [
          { type: 'chase', label: 'Run down the debtor\'s car — get close and hold on (in a car!)' },
          { type: 'collect', label: 'Collect the debt' },
          { type: 'drive', x: 2280, y: 1560, label: 'Bring the cash back to Ozzy', radius: 70 },
        ],
      },
      {
        id: 'o3', title: 'Boardwalk Blitz', reward: 5000,
        brief: 'The Vultures are shaking down Ozzy\'s stalls on the Boardwalk. Clear them out, lose the PD, and report back.',
        dialog: [
          'OZZY: The Vultures are leaning on my stalls, Rico. My Boardwalk. My people.',
          'RICO: How many?',
          'OZZY: Five. Make it loud, make it final, and don\'t bring the PD back here with you.',
        ],
        steps: [
          { type: 'goto', x: 2280, y: 1560, label: 'Get to the Boardwalk', radius: 90 },
          { type: 'kill', count: 5, label: 'Clear the Vultures off the Boardwalk (0/5)' },
          { type: 'escape', label: 'Lose the heat — get your wanted level to zero', heat: 3 },
          { type: 'drive', x: 2280, y: 1560, label: 'Report back to Ozzy', radius: 70 },
        ],
        unlock: 'rider',
      },
    ],
  },
];

export function initSideJobs(G) {
  G.side = {
    done: [0, 0, 0],       // jobs finished per chain
    active: null,          // active job runtime, or null
    unlocks: { stallion: false, rider: false, shotgun: false },
    jobsDone: 0,
    cashEarned: 0,
    boardOpen: false,
    nearGiver: -1,         // chain index the player can talk to, or -1
  };
}

export function sideChainDone(G, ci) {
  return (G.side?.done?.[ci] || 0) >= SIDE_CHAINS[ci].jobs.length;
}

export function currentSideStep(G) {
  const a = G.side?.active;
  if (!a) return null;
  return a.job.steps[a.step] || null;
}

// The giver the player can talk to right now, or -1. Only on foot, only
// when no story mission and no side job is running, and only when the
// chain still has jobs left.
export function sideGiverNear(G) {
  if (!G.side || G.side.active || G.mission || G.dialog) return -1;
  const p = G.player;
  if (!p.onFoot) return -1;
  for (let i = 0; i < SIDE_GIVERS.length; i++) {
    if (sideChainDone(G, i)) continue;
    const g = SIDE_GIVERS[i];
    if (dist2(p.x, p.y, g.x, g.y) < 75 * 75) return i;
  }
  return -1;
}

export function startSideJob(G, chainIdx, audio, quiet) {
  const chain = SIDE_CHAINS[chainIdx];
  const jobIdx = G.side.done[chainIdx];
  const job = chain.jobs[jobIdx];
  if (!job) return false;
  G.side.active = {
    chain: chainIdx, jobIdx, job, step: 0,
    killsAtStart: G.kills, stolenAtStart: G.carsStolen,
    spawned: false, collectSpawned: false, dialogShown: false,
    stepStartT: undefined, timeLeft: undefined, heatStep: -1,
    escort: null, target: null, catchT: 0, killLabel: null,
  };
  if (!quiet && job.dialog) G.dialog = { lines: job.dialog, i: 0 };
  setToast(G, 'Side job: ' + job.title + ' — ' + chain.name);
  if (audio && audio.mission) audio.mission();
  updateSideMarker(G);
  return true;
}

// Staging helper for screenshots and play-tests: start a job with no
// dialog in the way, ready to play from step 0.
export function stageSideJob(G, chainIdx, jobIdx, audio) {
  if (!G.side) initSideJobs(G);
  G.side.done[chainIdx] = jobIdx;
  startSideJob(G, chainIdx, audio, true);
  return !!G.side.active;
}

export function updateSideMarker(G) {
  const a = G.side?.active;
  if (!a) return;
  const s = currentSideStep(G);
  G.markers = [];
  if (!s) return;
  if (s.x !== undefined) G.markers.push({ x: s.x, y: s.y, label: s.label, radius: s.radius || 70 });
  else if (s.type === 'steal' || s.type === 'collect' || s.type === 'kill' || s.type === 'escape') {
    const anchor = s.type === 'kill'
      ? { x: a.job.steps[0].x ?? G.player.x, y: a.job.steps[0].y ?? G.player.y }
      : { x: G.player.x, y: G.player.y };
    G.markers.push({ x: anchor.x, y: anchor.y, label: s.label, follow: s.type !== 'kill' });
  } else if (s.type === 'escort' && a.escort) {
    G.markers.push({ x: s.x, y: s.y, label: s.label, radius: s.radius || 80 });
  } else if (s.type === 'chase' && a.target) {
    G.markers.push({ x: a.target.x, y: a.target.y, label: s.label, follow: true });
  }
}

function advanceSideStep(G, audio) {
  const a = G.side.active;
  a.step++;
  a.stepStartT = undefined;
  a.timeLeft = undefined;
  a.spawned = false;
  a.collectSpawned = false;
  a.escort = null;
  if (audio && audio.pickup) audio.pickup();
  if (a.step >= a.job.steps.length) completeSideJob(G, audio);
  else updateSideMarker(G);
}

function grantUnlock(G, kind, audio) {
  if (kind === 'stallion') {
    const model = CAR_MODELS.find(m => m.name === 'Stallion');
    const c = makeCar(2210, 1950, Math.PI / 2, model, '#e74c3c', 'parked');
    G.cars.push(c);
    G.side.unlocks.stallion = true;
    setToast(G, 'Unlocked: Stallion muscle car — parked at Eddie\'s chop shop');
  } else if (kind === 'rider') {
    const model = CAR_MODELS.find(m => m.name === 'Rider');
    const c = makeCar(2280, 1560, 0, model, '#00cec9', 'parked');
    G.cars.push(c);
    G.side.unlocks.rider = true;
    setToast(G, 'Unlocked: Rider motorbike — parked on the Boardwalk');
  } else if (kind === 'shotgun') {
    G.ammo.shotgun = (G.ammo.shotgun || 0) + 24;
    G.weapon = 'shotgun';
    G.side.unlocks.shotgun = true;
    setToast(G, 'Unlocked: Shotgun + 24 shells from Lena\'s stash — press 3');
  }
  if (audio && audio.cash) audio.cash();
}

function completeSideJob(G, audio) {
  const a = G.side.active;
  const job = a.job;
  const chain = SIDE_CHAINS[a.chain];
  G.money += job.reward;
  G.side.cashEarned += job.reward;
  G.score += 500 + job.reward;
  G.side.done[a.chain]++;
  G.side.jobsDone++;
  const finishedChain = G.side.done[a.chain] >= chain.jobs.length;
  if (finishedChain) {
    G.money += 1000;
    G.side.cashEarned += 1000;
    setToast(G, 'Chain complete: ' + chain.name + '  +$' + job.reward + ' + $1000 bonus');
  } else {
    setToast(G, 'Side job done: ' + job.title + '  +$' + job.reward);
  }
  if (job.unlock) grantUnlock(G, job.unlock, audio);
  if (audio && audio.cash) audio.cash();
  if (audio && audio.mission) audio.mission();
  G.side.active = null;
  G.markers = [];
  // the story picks up again after a beat, never mid-job
  G.nextMissionAt = G.time + 3;
}

function failSideJob(G, audio, reason) {
  const a = G.side.active;
  setToast(G, reason + ' — ' + a.job.title + ' failed, try again');
  if (audio && audio.fail) audio.fail();
  const chain = a.chain;
  G.side.active = null;
  G.markers = [];
  startSideJob(G, chain, audio, true);
}

// --- step helpers ---
function spawnSideEnemies(G, a, s) {
  const p = G.player;
  const anchor = s.x !== undefined ? { x: s.x, y: s.y } : { x: p.x, y: p.y };
  for (let i = 0; i < s.count; i++) {
    G.enemies.push({
      x: anchor.x + (Math.random() - 0.5) * 180, y: anchor.y + (Math.random() - 0.5) * 180,
      angle: 0, hp: 60, fireCd: 1 + Math.random(), gang: true,
    });
  }
  setToast(G, 'The Vultures are here — fight!');
}

function startEscort(G, a, s) {
  const p = G.player;
  a.escort = { x: p.x + 40, y: p.y + 30, name: 'Timmy', speed: 215 };
  setToast(G, 'Timmy is following you — walk him to the park, stay close!');
}

function startChase(G, a, s) {
  const p = G.player;
  // the debtor bolts from a road spot a block away from the player
  let spot = null;
  for (let tries = 0; tries < 10; tries++) {
    const pos = randomRoadPos(G.rng);
    if (Math.hypot(pos.x - p.x, pos.y - p.y) > 320 && Math.hypot(pos.x - p.x, pos.y - p.y) < 700) { spot = pos; break; }
  }
  if (!spot) spot = { x: clamp(p.x + 380, 120, WORLD - 120), y: p.y };
  const model = CAR_MODELS.find(m => m.name === 'Sedan') || CAR_MODELS[1];
  const car = makeCar(spot.x, spot.y, Math.atan2(p.y - spot.y, p.x - spot.x), model, '#f1c40f', 'traffic');
  car.speed = 240;
  car.ai = null;
  G.cars.push(car);
  a.target = car;
  a.catchT = 0;
  setToast(G, 'There he goes! Get in a car and run him down — bumper to bumper!');
}

export function updateSideJobs(G, input, audio, dt) {
  if (!G.side) initSideJobs(G);
  const p = G.player;
  if (G.state !== 'playing' || p.dead) return;

  // --- talking to a giver starts the chain's next job ---
  G.side.nearGiver = sideGiverNear(G);
  if (G.side.nearGiver >= 0 && input.hit('e')) {
    const ci = G.side.nearGiver;
    startSideJob(G, ci, audio, false);
    return;
  }

  const a = G.side.active;
  if (!a) return;
  // while a side job runs, the story waits its turn
  G.nextMissionAt = G.time + 5;
  const s = currentSideStep(G);
  if (!s) return;

  // heat that comes with a step (a hot drive, a watched parcel) lands
  // the moment the step starts, never before
  if (s.heat && a.heatStep !== a.step) {
    a.heatStep = a.step;
    G.wanted = Math.max(G.wanted, s.heat);
    setToast(G, 'The PD is onto this one — ' + s.heat + ' stars and climbing!');
  }

  // timed steps: the clock runs from the moment the step starts
  if (s.secs && a.stepStartT === undefined) a.stepStartT = G.time;
  if (s.secs && a.stepStartT !== undefined) {
    a.timeLeft = Math.max(0, s.secs - (G.time - a.stepStartT));
    if (a.timeLeft <= 0) { failSideJob(G, audio, 'Too slow'); return; }
  }

  if (s.type === 'goto' || s.type === 'drive' || s.type === 'timedrive') {
    if (dist2(p.x, p.y, s.x, s.y) < (s.radius || 70) * (s.radius || 70)) advanceSideStep(G, audio);
  } else if (s.type === 'steal') {
    if (G.carsStolen > a.stolenAtStart) advanceSideStep(G, audio);
  } else if (s.type === 'collect') {
    if (!a.collectSpawned) {
      a.collectSpawned = true;
      const prev = a.job.steps[a.step - 1];
      const pos = prev && prev.x !== undefined ? { x: prev.x, y: prev.y } : { x: p.x, y: p.y };
      G.pickups.push({ x: pos.x, y: pos.y, kind: 'cash', val: 0, t: 0, sideJob: true });
      setToast(G, 'Grab it (walk over it)');
    }
    if (!G.pickups.some(pk => pk.sideJob)) advanceSideStep(G, audio);
  } else if (s.type === 'kill') {
    if (!a.spawned) { a.spawned = true; spawnSideEnemies(G, a, s); }
    const done = G.kills - a.killsAtStart;
    if (!a.killLabel) a.killLabel = s.label.replace(/ \(\d+\/\d+\)$/, '');
    s.label = a.killLabel + ' (' + Math.min(done, s.count) + '/' + s.count + ')';
    if (done >= s.count) advanceSideStep(G, audio);
    else if (G.enemies.length === 0 && done < s.count) {
      const need = s.count - done;
      for (let i = 0; i < need; i++) {
        G.enemies.push({ x: p.x + (Math.random() - 0.5) * 400, y: p.y + (Math.random() - 0.5) * 400, angle: 0, hp: 60, fireCd: 1, gang: true });
      }
    }
  } else if (s.type === 'escape') {
    if (G.wanted < 0.5) advanceSideStep(G, audio);
    else if (a.heatStep !== a.step) {
      a.heatStep = a.step;
      G.wanted = Math.max(G.wanted, s.heat || 3);
      setToast(G, 'The PD is on you — lose them!');
    }
  } else if (s.type === 'escort') {
    if (!a.escort) startEscort(G, a, s);
    const e = a.escort;
    // Timmy trails the player on foot; in a car he waits where he is,
    // and if he falls too far behind he hurries to catch up
    const dpe = Math.hypot(e.x - p.x, e.y - p.y);
    if (dpe > 520) { e.x = p.x + 50; e.y = p.y + 40; }
    else if (p.onFoot && dpe > 80) {
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      const nx = e.x + (dx / d) * e.speed * dt;
      const ny = e.y + (dy / d) * e.speed * dt;
      const fixed = collideCircle(G.city, nx, ny, 10);
      e.x = fixed.x; e.y = fixed.y;
    }
    const atDest = dist2(p.x, p.y, s.x, s.y) < (s.radius || 80) * (s.radius || 80);
    if (atDest && Math.hypot(e.x - p.x, e.y - p.y) < 170) {
      spawnParticles(G, e.x, e.y, 12, '#f1c40f');
      advanceSideStep(G, audio);
    }
  } else if (s.type === 'chase') {
    if (!a.target) startChase(G, a, s);
    const t = a.target;
    // the debtor flees from the player, weaving down the roads
    const away = Math.atan2(t.y - p.y, t.x - p.x);
    const weave = Math.sin(G.time * 1.7) * 0.35;
    t.angle = away + weave;
    t.speed = Math.min(320, (t.speed || 0) + 260 * dt);
    const nx = t.x + Math.cos(t.angle) * t.speed * dt;
    const ny = t.y + Math.sin(t.angle) * t.speed * dt;
    const fixed = collideCircle(G.city, nx, ny, 22);
    t.x = clamp(fixed.x, 40, WORLD - 40);
    t.y = clamp(fixed.y, 40, WORLD - 40);
    // he locked his doors: the player cannot just hop into his car
    if (p.inCar === t) { exitCar(G); setToast(G, 'He locked the doors — ram his bumper instead!'); }
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (p.inCar && d < 110) {
      a.catchT += dt;
      if (a.catchT >= 1.2) {
        t.speed = 0;
        spawnParticles(G, t.x, t.y, 14, '#f1c40f');
        setToast(G, 'Caught him! He hands over the cash.');
        // the debt waits where the car stopped
        G.pickups.push({ x: t.x, y: t.y, kind: 'cash', val: 0, t: 0, sideJob: true });
        a.target = null;
        advanceSideStep(G, audio);
      }
    } else {
      a.catchT = Math.max(0, a.catchT - dt * 2);
    }
  }
  updateSideMarker(G);
}

// --- world drawing: givers, the escort kid, the fleeing debtor ---
export function drawSideWorld(ctx, G) {
  if (!G.side) return;
  // givers stand where their chain starts: a coloured ring, a "!" tag
  // and their name, so a new player can find work without a menu
  for (let i = 0; i < SIDE_GIVERS.length; i++) {
    const g = SIDE_GIVERS[i];
    const done = sideChainDone(G, i);
    const near = G.side.nearGiver === i;
    const pulse = 1 + Math.sin(G.time * 4 + i) * 0.12;
    ctx.strokeStyle = done ? 'rgba(255,255,255,0.4)' : g.color;
    ctx.lineWidth = near ? 4 : 3;
    ctx.beginPath(); ctx.arc(g.x, g.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = done ? 'rgba(255,255,255,0.12)' : g.color;
    ctx.beginPath(); ctx.arc(g.x, g.y, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(done ? '✓' : '!', g.x, g.y + 4);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
    ctx.fillText(g.name.toUpperCase(), g.x, g.y - 34);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '10px sans-serif';
    ctx.fillText(done ? 'CHAIN DONE' : 'SIDE JOBS — press E', g.x, g.y + 40);
  }
  const a = G.side.active;
  if (!a) return;
  // the escort kid: yellow shirt, name tag, never far from the player
  if (a.escort) {
    const e = a.escort;
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(e.x, e.y - 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TIMMY', e.x, e.y - 16);
  }
  // the fleeing debtor: a red ring and a label so the chase reads
  if (a.target) {
    const t = a.target;
    const pulse = 1 + Math.sin(G.time * 6) * 0.15;
    ctx.strokeStyle = 'rgba(231,76,60,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, 52 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('DEBTOR — STAY ON HIS BUMPER', t.x, t.y - 58);
  }
}

// --- HUD: active side job + chain progress, under the story panel ---
export function drawSidePanel(ctx, G, vw, vh) {
  if (!G.side) return;
  const a = G.side.active;
  const s = currentSideStep(G);
  const lines = [];
  if (a) {
    lines.push({ text: 'SIDE JOB: ' + a.job.title, color: '#ffd93d', bold: true });
    const raw = (s ? s.label : '') + '   (' + (a.step + 1) + '/' + a.job.steps.length + ')';
    const label = raw.length > 38 ? raw.slice(0, 36) + '…' : raw;
    lines.push({ text: label, color: '#fff' });
    if (a.timeLeft !== undefined) {
      lines.push({ text: Math.ceil(a.timeLeft) + 's left', color: a.timeLeft < 15 ? '#ff5a4e' : '#ffd93d', bold: true });
    }
  } else {
    lines.push({ text: 'SIDE JOBS  •  press J for the Jobs board', color: '#ddd' });
  }
  for (let i = 0; i < SIDE_CHAINS.length; i++) {
    const chain = SIDE_CHAINS[i];
    const done = G.side.done[i];
    let dots = '';
    for (let j = 0; j < chain.jobs.length; j++) dots += j < done ? '●' : '○';
    lines.push({
      text: SIDE_GIVERS[chain.giver].name.split(' ')[0] + ' ' + dots + '  ' + done + '/' + chain.jobs.length,
      color: sideChainDone(G, i) ? '#2ecc71' : '#fff',
    });
  }
  const h = 14 + lines.length * 18;
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  ctx.beginPath(); ctx.roundRect(12, 112, 250, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(12, 112, 250, h, 8); ctx.stroke();
  ctx.textAlign = 'left';
  lines.forEach((l, i) => {
    ctx.fillStyle = l.color;
    ctx.font = (l.bold ? 'bold ' : '') + '12px sans-serif';
    ctx.fillText(l.text, 24, 130 + i * 18);
  });
  // off-screen arrow for the side objective, like the story one
  const p = G.player;
  if (a && s && s.x !== undefined) {
    const dx = s.x - p.x, dy = s.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 500) {
      const ang = Math.atan2(dy, dx);
      const cx = vw / 2 + Math.cos(ang) * 150, cy = vh / 2 + Math.sin(ang) * 150;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-9, -10); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.textAlign = 'center'; ctx.fillStyle = '#9b59b6'; ctx.font = 'bold 12px sans-serif';
      ctx.fillText('JOB ' + Math.round(d) + ' m', cx, cy + 26);
    }
  }
  // "talk" prompt when a giver is in reach
  if (G.side.nearGiver >= 0 && !a && G.state === 'playing') {
    const g = SIDE_GIVERS[G.side.nearGiver];
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const label = g.name + ' — E: take the next job (' + SIDE_CHAINS[G.side.nearGiver].jobs[G.side.done[G.side.nearGiver]].title + ')';
    const w = ctx.measureText(label).width + 36;
    ctx.fillRect(vw / 2 - w / 2, vh - 230, w, 28);
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(label, vw / 2, vh - 211);
  }
}

// --- Jobs board (J): every chain, every job, every unlock ---
export function drawJobsBoard(ctx, G, vw, vh) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, vw, vh);
  const w = Math.min(680, vw - 60), h = 560;
  const x0 = (vw - w) / 2, y0 = (vh - h) / 2;
  ctx.fillStyle = 'rgba(10,14,20,0.95)';
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#ffd93d'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 12); ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 24px sans-serif';
  ctx.fillText('SIDE JOBS — SOLARA BAY', x0 + 28, y0 + 42);
  ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
  ctx.fillText('Three fixers, nine jobs, three unlocks. Find a giver (coloured ! on the map), press E, and work the chain.', x0 + 28, y0 + 66);
  ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 14px sans-serif';
  ctx.fillText('Jobs done: ' + G.side.jobsDone + '/9    •    Side-job cash: $' + G.side.cashEarned.toLocaleString('en-US'), x0 + 28, y0 + 90);
  let y = y0 + 122;
  for (let i = 0; i < SIDE_CHAINS.length; i++) {
    const chain = SIDE_CHAINS[i];
    const g = SIDE_GIVERS[chain.giver];
    const done = G.side.done[i];
    ctx.fillStyle = g.color; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(g.name + ' — ' + g.title + '   ' + done + '/' + chain.jobs.length, x0 + 28, y);
    y += 20;
    for (let j = 0; j < chain.jobs.length; j++) {
      const job = chain.jobs[j];
      const mark = j < done ? '✓' : (G.side.active && G.side.active.chain === i && G.side.active.jobIdx === j ? '▶' : '○');
      ctx.fillStyle = j < done ? '#2ecc71' : '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(mark + '  ' + job.title + ' — $' + job.reward.toLocaleString('en-US'), x0 + 48, y);
      ctx.fillStyle = '#aaa'; ctx.font = '12px sans-serif';
      ctx.fillText(job.brief, x0 + 48, y + 13);
      y += 30;
    }
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText(chain.unlockLabel + (done >= chain.jobs.length ? '  ✓ UNLOCKED' : ''), x0 + 48, y);
    y += 26;
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#aaa'; ctx.font = '13px sans-serif';
  ctx.fillText('Press J or Esc to close — the city keeps moving while you read', vw / 2, y0 + h - 18);
}
