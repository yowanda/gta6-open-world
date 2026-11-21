// missions.js — the story of Rico Vega in Solara Bay: nine missions, a fixer,
// a rival gang, and a final score. Each mission is steps with markers and rewards.
import { dist2 } from './state.js';
import { setToast, spawnParticles } from './entities.js';

export const STORY = [
  {
    id: 'm1', title: 'Fresh Off the Bus', reward: 500,
    brief: 'Rico Vega just rolled into Solara Bay with $500 and a name to make. Mara Quinn, the fixer at the Pelican Motel, wants a word.',
    steps: [
      { type: 'goto', x: 420, y: 420, label: 'Go to the Pelican Motel', radius: 60 },
      { type: 'talk', label: 'Talk to Mara Quinn' },
    ],
    dialog: [
      'MARA: Rico Vega. You look hungry. Good — hungry men get rich in Solara Bay.',
      'MARA: First job is easy. Get yourself some wheels. Any wheels. The city won\'t miss one car.',
      'RICO: And if the owner misses it?',
      'MARA: Then drive fast, sweetheart.',
    ],
  },
  {
    id: 'm2', title: 'Borrowed Wheels', reward: 800,
    brief: 'Mara needs a clean ride for a job tonight. Steal any car and bring it to the chop shop on Portside.',
    steps: [
      { type: 'steal', label: 'Steal a car (walk up and press E)' },
      { type: 'drive', x: 2210, y: 1950, label: 'Deliver the car to the chop shop', radius: 70 },
    ],
    dialog: [
      'MARA: The chop shop pays for anything with four wheels and no questions.',
      'MARA: Bring it in one piece and I\'ll cut you in.',
    ],
  },
  {
    id: 'm3', title: 'The Pickup', reward: 1200,
    brief: 'A package is waiting at the marina. Grab it and bring it to Mara — and keep your head down, the PD is jumpy tonight.',
    steps: [
      { type: 'goto', x: 2400, y: 1300, label: 'Go to the marina', radius: 70 },
      { type: 'collect', label: 'Collect the package' },
      { type: 'drive', x: 420, y: 420, label: 'Bring the package back to Mara', radius: 70 },
    ],
    dialog: [
      'MARA: Package is at the marina, slip 12. Don\'t open it. Don\'t drop it. Don\'t get caught with it.',
    ],
  },
  {
    id: 'm4', title: 'Turfwars', reward: 1800,
    brief: 'The Vultures — Dario Voss\'s crew — are muscling in on Mara\'s corner by the old warehouse. Clear them out.',
    steps: [
      { type: 'goto', x: 650, y: 650, label: 'Go to the old warehouse', radius: 90 },
      { type: 'kill', count: 5, label: 'Deal with the Vultures (0/5)' },
      { type: 'goto', x: 420, y: 420, label: 'Report back to Mara', radius: 70 },
    ],
    dialog: [
      'MARA: The Vultures think this corner is theirs now. Show them it isn\'t.',
      'RICO: Five of them? That\'s a lot of Vultures.',
      'MARA: Then you\'d better shoot straight.',
    ],
    spawnEnemies: [{ x: 650, y: 650, n: 5 }],
  },
  {
    id: 'm5', title: 'The Bank Job', reward: 3500,
    brief: 'Solara Bank. Midday. Grab the cash from the vault room and get out before the PD locks the block down.',
    steps: [
      { type: 'goto', x: 1170, y: 910, label: 'Get to Solara Bank', radius: 80 },
      { type: 'collect', label: 'Grab the vault cash' },
      { type: 'escape', label: 'Lose the heat — get your wanted level to zero', heat: 3 },
      { type: 'drive', x: 420, y: 420, label: 'Get back to the safehouse', radius: 70 },
    ],
    dialog: [
      'MARA: The bank keeps its cash in a back room, and the back room keeps its door unlocked at noon.',
      'MARA: Grab it, run, and don\'t stop till the stars are gone.',
    ],
  },
  {
    id: 'm6', title: 'The Big Score', reward: 8000,
    brief: 'The Neon Palms Casino vault. Dario Voss himself guards the take. This is the job that makes Rico Vega a legend — or a headline.',
    steps: [
      { type: 'goto', x: 1430, y: 1170, label: 'Get to the Neon Palms Casino', radius: 90 },
      { type: 'kill', count: 6, label: 'Get past Dario\'s crew (0/6)' },
      { type: 'collect', label: 'Crack the casino vault' },
      { type: 'escape', label: 'Escape the PD dragnet', heat: 4 },
      { type: 'drive', x: 2400, y: 1300, label: 'Reach the yacht at the marina', radius: 80 },
    ],
    dialog: [
      'MARA: One last job, Rico. The casino vault. Voss is inside with his whole crew.',
      'RICO: And after?',
      'MARA: After, you\'re not Rico Vega the nobody. You\'re Rico Vega the legend. The yacht is waiting.',
    ],
    spawnEnemies: [{ x: 1430, y: 1170, n: 6 }],
  },
  {
    id: 'm7', title: 'The Getaway Driver', reward: 4500,
    brief: 'Mara has a courier job with a hard deadline: lift the casino cash bag and drive it across town to the marina before the PD roadblocks go up.',
    steps: [
      { type: 'goto', x: 1430, y: 1170, label: 'Get to the Neon Palms Casino', radius: 90 },
      { type: 'collect', label: 'Grab the cash bag' },
      { type: 'timedrive', x: 2400, y: 1300, label: 'Race the cash to the marina yacht', radius: 80, secs: 75 },
    ],
    dialog: [
      'MARA: Courier job, Rico. Bag is at the casino. Marina yacht leaves in 75 seconds — miss it and the money walks.',
      'RICO: Seventy-five seconds across town? You like me that much?',
      'MARA: I like you alive. Drive like it.',
    ],
  },
  {
    id: 'm8', title: "Dario's Last Stand", reward: 12000,
    brief: 'Dario Voss is loading his yacht at the marina to skip town with Mara\'s money. End it there — him, his crew, and the whole Vultures problem.',
    steps: [
      { type: 'goto', x: 2400, y: 1300, label: 'Get to the marina yacht', radius: 90 },
      { type: 'kill', count: 8, label: "Take down Dario's crew (0/8)" },
      { type: 'collect', label: "Take back Mara's money" },
      { type: 'escape', label: 'Escape the PD dragnet', heat: 5 },
      { type: 'drive', x: 420, y: 420, label: 'Get back to the Pelican Motel', radius: 70 },
    ],
    dialog: [
      'MARA: Voss is at the marina, loading his yacht with MY money. He does not leave Solara Bay.',
      'RICO: Eight of them, and Voss himself. That\'s the whole crew.',
      'MARA: Then finish it, Rico. Finish all of it.',
    ],
    spawnEnemies: [{ x: 2400, y: 1300, n: 7 }],
    spawnBoss: { x: 2400, y: 1300, hp: 220, name: 'Dario Voss' },
  },
  {
    id: 'm9', title: "Rook's Reckoning", reward: 15000,
    brief: 'Dario is gone, but his lieutenant Rook has taken the Vultures and the whole Sunset Boardwalk. Mara wants the ledger he keeps — and Rook out of Solara Bay for good.',
    steps: [
      { type: 'goto', x: 2400, y: 1300, label: 'Get to the Sunset Boardwalk', radius: 90 },
      { type: 'kill', count: 7, label: "Break Rook's crew (0/7)" },
      { type: 'collect', label: "Take Rook's ledger" },
      { type: 'escape', label: 'Escape the PD dragnet', heat: 4 },
      { type: 'drive', x: 420, y: 420, label: 'Get back to the Pelican Motel', radius: 70 },
    ],
    dialog: [
      'MARA: Voss is fish food, but his dog Rook picked up the leash. He runs the Boardwalk now.',
      'RICO: And the ledger?',
      'MARA: Rook keeps it on him. Bring it back and the Vultures are finished — for good this time.',
    ],
    spawnEnemies: [{ x: 2380, y: 1300, n: 5 }],
    spawnBruiser: { x: 2320, y: 1360, hp: 130 },
    spawnBoss: { x: 2460, y: 1300, hp: 260, name: 'Rook' },
  },
];

export function startMission(G, idx, audio) {
  const def = STORY[idx];
  if (!def) { G.mission = null; return; }
  G.mission = {
    def, step: 0, killsAtStart: G.kills,
    escapeT: 0, spawned: false, collectSpawned: false,
  };
  G.missionIdx = idx;
  // Dialogue plays when the talk step is reached (see updateMissions), not here.
  setToast(G, 'New mission: ' + def.title);
  audio.mission();
  updateMarker(G);
}

export function currentStep(G) {
  if (!G.mission) return null;
  return G.mission.def.steps[G.mission.step] || null;
}

export function updateMarker(G) {
  const s = currentStep(G);
  G.markers = [];
  if (!s) return;
  if (s.x !== undefined) G.markers.push({ x: s.x, y: s.y, label: s.label, radius: s.radius || 70 });
  else if (s.type === 'steal') G.markers.push({ x: G.player.x, y: G.player.y, label: s.label, follow: true });
  else if (s.type === 'talk' || s.type === 'collect' || s.type === 'kill' || s.type === 'escape') {
    const anchor = s.type === 'kill' ? { x: G.mission.def.steps[0].x, y: G.mission.def.steps[0].y } : { x: G.player.x, y: G.player.y };
    G.markers.push({ x: anchor.x, y: anchor.y, label: s.label, follow: s.type !== 'kill' });
  }
}

function advanceStep(G, audio) {
  G.mission.step++;
  G.mission.stepStartT = undefined;
  G.mission.timeLeft = undefined;
  audio.pickup();
  if (G.mission.step >= G.mission.def.steps.length) completeMission(G, audio);
  else updateMarker(G);
}

function completeMission(G, audio) {
  const def = G.mission.def;
  G.money += def.reward;
  G.missionsDone++;
  G.score += 1000 + def.reward;
  G.mission = null;
  G.markers = [];
  setToast(G, 'Mission complete: ' + def.title + '  +$' + def.reward);
  audio.cash();
  audio.mission();
  if (G.missionsDone >= STORY.length) {
    G.state = 'storydone';
    audio.mission();
  } else {
    // next mission auto-starts after a beat
    G.nextMissionAt = G.time + 3;
  }
}

export function updateMissions(G, input, audio, dt) {
  // auto-start next mission
  if (!G.mission && G.missionsDone < STORY.length && G.state === 'playing') {
    if (G.nextMissionAt === undefined) G.nextMissionAt = G.time + 2;
    if (G.time >= G.nextMissionAt) startMission(G, G.missionsDone, audio);
  }
  if (!G.mission) return;
  const m = G.mission;
  const s = currentStep(G);
  if (!s) return;
  const p = G.player;

  // spawn mission enemies once when the kill step begins
  if (s.type === 'kill' && !m.spawned) {
    m.spawned = true;
    const def = m.def;
    const sp = def.spawnEnemies && def.spawnEnemies[0];
    const cx = sp ? sp.x : p.x, cy = sp ? sp.y : p.y;
    const n = sp ? sp.n : s.count;
    for (let i = 0; i < n; i++) {
      G.enemies.push({
        x: cx + (Math.random() - 0.5) * 160, y: cy + (Math.random() - 0.5) * 160,
        angle: 0, hp: 60, fireCd: 1 + Math.random(), gang: true,
      });
    }
    // story boss: Dario Voss himself, tougher and worth the finale
    if (def.spawnBoss) {
      G.enemies.push({
        x: def.spawnBoss.x, y: def.spawnBoss.y, angle: 0,
        hp: def.spawnBoss.hp, fireCd: 1, gang: true,
        boss: true, name: def.spawnBoss.name,
      });
    }
    // bruiser: a heavy hitter, bigger and twice as hard to drop
    if (def.spawnBruiser) {
      G.enemies.push({
        x: def.spawnBruiser.x, y: def.spawnBruiser.y, angle: 0,
        hp: def.spawnBruiser.hp, fireCd: 1.2, gang: true,
        bruiser: true, name: 'Bruiser',
      });
    }
    setToast(G, 'The Vultures are here — fight!');
  }

  // timed steps: the clock runs from the moment the step starts
  if (s.secs && m.stepStartT === undefined) m.stepStartT = G.time;
  if (s.secs && m.stepStartT !== undefined) {
    m.timeLeft = Math.max(0, s.secs - (G.time - m.stepStartT));
    if (m.timeLeft <= 0) {
      setToast(G, 'Too slow — ' + m.def.title + ' failed, try again');
      audio.fail();
      startMission(G, G.missionIdx, audio);
      return;
    }
  }

  if (s.type === 'goto' || s.type === 'drive' || s.type === 'timedrive') {
    if (dist2(p.x, p.y, s.x, s.y) < (s.radius || 70) * (s.radius || 70)) advanceStep(G, audio);
  } else if (s.type === 'talk') {
    if (dist2(p.x, p.y, 420, 420) < 70 * 70) {
      if (!m.dialogShown) { m.dialogShown = true; if (m.def.dialog) G.dialog = { lines: m.def.dialog, i: 0 }; }
      if (!G.dialog) advanceStep(G, audio);
    }
  } else if (s.type === 'steal') {
    if (G.carsStolen > (m.stolenAtStart ?? (m.stolenAtStart = G.carsStolen))) advanceStep(G, audio);
  } else if (s.type === 'collect') {
    if (!m.collectSpawned) {
      m.collectSpawned = true;
      // the package waits where the previous step sent the player
      const prev = m.def.steps[m.step - 1];
      const pos = prev && prev.x !== undefined ? { x: prev.x, y: prev.y } : { x: p.x, y: p.y };
      G.pickups.push({ x: pos.x, y: pos.y, kind: 'cash', val: 0, t: 0, mission: true });
      setToast(G, 'Grab the package (walk over it)');
    }
    // collected when the mission pickup is taken
    if (!G.pickups.some(pk => pk.mission)) advanceStep(G, audio);
  } else if (s.type === 'kill') {
    const done = G.kills - m.killsAtStart;
    if (!m.killLabel) m.killLabel = s.label.replace(/ \(\d+\/\d+\)$/, '');
    s.label = m.killLabel + ' (' + Math.min(done, s.count) + '/' + s.count + ')';
    if (done >= s.count) advanceStep(G, audio);
    else if (G.enemies.length === 0 && m.spawned && done < s.count) {
      // stragglers: respawn remaining
      const need = s.count - done;
      for (let i = 0; i < need; i++) G.enemies.push({ x: p.x + (Math.random() - 0.5) * 400, y: p.y + (Math.random() - 0.5) * 400, angle: 0, hp: 60, fireCd: 1, gang: true });
    }
  } else if (s.type === 'escape') {
    if (G.wanted < 0.5) advanceStep(G, audio);
    else if (!m.heatApplied) {
      m.heatApplied = true;
      G.wanted = Math.max(G.wanted, s.heat || 3);
      setToast(G, 'The PD is on you — lose them!');
    }
  }
  updateMarker(G);
}
