// save.js — localStorage save / load for Solara Bay.
import { DOCKS } from './boats.js';

export function saveGame(G) {
  try {
    const p = G.player;
    // a save made aboard a boat stores the NEAREST dock, not mid-bay:
    // the boat itself is never saved, it is re-moored when the game loads
    let sx = p.x, sy = p.y;
    if (p.inBoat) {
      let best = DOCKS[0], bd = 1e12;
      for (const d of DOCKS) {
        const dd = (p.inBoat.x - d.x) * (p.inBoat.x - d.x) + (p.inBoat.y - d.y) * (p.inBoat.y - d.y);
        if (dd < bd) { bd = dd; best = d; }
      }
      sx = best.x; sy = best.y;
    }
    const data = {
      money: G.money, health: G.health, armor: G.armor,
      ammo: G.ammo, weapon: G.weapon,
      missionsDone: G.missionsDone, score: G.score, kills: G.kills, carsStolen: G.carsStolen,
      x: sx, y: sy, clockMin: G.clockMin, wanted: 0,
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
    const d = JSON.parse(raw);
    // a save from another game (or a corrupt one) must not load here
    if (typeof d.money !== 'number' || typeof d.missionsDone !== 'number') return null;
    return d;
  } catch (e) { return null; }
}

export function applySave(G, d) {
  G.money = d.money; G.health = d.health; G.armor = d.armor;
  G.ammo = d.ammo; G.weapon = d.weapon || 'pistol';
  G.missionsDone = d.missionsDone; G.score = d.score; G.kills = d.kills || 0; G.carsStolen = d.carsStolen || 0;
  G.player.x = d.x; G.player.y = d.y;
  // never load on foot in open water (an old save made aboard a boat):
  // Rico steps back onto the sand by the Marina dock
  if (G.player.x >= 2470) G.player.x = 2440;
  G.player.inBoat = null; G.player.onFoot = true;
  G.clockMin = d.clockMin || 16 * 60;
  G.wanted = 0;
  G.player.dead = false;
}

export function saveInfo(G) {
  const d = loadSave(G);
  if (!d) return null;
  return { money: d.money, missions: d.missionsDone };
}
