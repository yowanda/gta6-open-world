// save.js — localStorage save / load for Solara Bay.
export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      money: G.money, health: G.health, armor: G.armor,
      ammo: G.ammo, weapon: G.weapon,
      missionsDone: G.missionsDone, score: G.score, kills: G.kills, carsStolen: G.carsStolen,
      x: p.x, y: p.y, clockMin: G.clockMin, wanted: 0,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(G.saveSlot, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadSave(G) {
  try {
    const raw = localStorage.getItem(G.saveSlot);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function applySave(G, d) {
  G.money = d.money; G.health = d.health; G.armor = d.armor;
  G.ammo = d.ammo; G.weapon = d.weapon || 'pistol';
  G.missionsDone = d.missionsDone; G.score = d.score; G.kills = d.kills || 0; G.carsStolen = d.carsStolen || 0;
  G.player.x = d.x; G.player.y = d.y;
  G.clockMin = d.clockMin || 16 * 60;
  G.wanted = 0;
  G.player.dead = false;
}

export function saveInfo(G) {
  const d = loadSave(G);
  if (!d) return null;
  return { money: d.money, missions: d.missionsDone };
}
