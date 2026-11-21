# gta6-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/yowanda/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/yowanda/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solara Bay** — an original open-world crime game that plays offline in a desktop browser from static files. Rico Vega just rolled into a sun-soaked coastal city with $500 and a name to make. Steal cars, outrun the Solara PD, run eight story missions for fixer Mara Quinn, and pull the Big Score at the Neon Palms Casino. Nothing here comes from any commercial game: the city, characters, vehicles, names, story, art and sounds are all original.

## The city

- **Solara Bay** — a 2600×2600 open world: Downtown towers, Old Town, the Marina District, Palm Heights, the Strip, Portside, a central park, and a beach with animated water on the east edge.
- **On foot and by car** — walk, run, steal any parked or traffic car (E), and drive with arcade handling, handbrake turns, and collisions.
- **Traffic and pedestrians** — cars drive the road grid with lane discipline and slow for each other; pedestrians stroll the sidewalks and panic when guns go off.
- **Wanted level and police** — crimes raise 0–5 stars. Police cruisers with flashing light bars chase and ram you; foot cops hunt you at 2+ stars; at 4+ stars a PD helicopter hovers overhead with a spotlight and the heat never fades while it watches. Lose the heat and it fades — or pay $300 at the Pay 'n' Spray. Get caught and you're **Busted**; get killed and you're **Wasted**.
- **Missions and a story** — eight missions with dialogue, objective markers, a compass arrow, and cash rewards: Fresh Off the Bus, Borrowed Wheels, The Pickup, Turfwars, The Bank Job, The Big Score, The Getaway Driver (a 75-second timed run), and Dario's Last Stand (a finale against boss Dario Voss).
- **Side activities** — drive a Taxi cab to run fares across town (quick drop-offs earn tips), and drive through the checkered flag on the Strip to start a six-checkpoint street race against the clock ($1,500 prize).
- **Combat** — mouse-aim shooting with pistol, SMG and shotgun (buy them at the Ironworks Gun Shop), rival Vultures gang members with HP bars, and police who shoot back.
- **HUD with minimap** — health/armor bars, cash, score, wanted stars, game clock, weapon and ammo, speedometer, live minimap with mission, police, helicopter, taxi and race blips, an objective tracker, a mission countdown timer, and a taxi/race status bar.
- **Start and save** — title menu with New Game / Continue / How to Play, pause menu, and auto-save at the Pelican Motel safehouse (localStorage).
- **Polish** — day/night cycle with a dusk-to-night tint, headlight cones and glowing street lamps after dark, district names painted on the streets, damage smoke from battered cars, synthesized WebAudio sound (engine hum, sirens, gunshots, pickups) and a funk bassline, particles, muzzle flashes, and screen toasts.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse | Aim (on foot) |
| Click / F | Shoot |
| E | Enter / steal a car, exit a car, talk, interact |
| Shift | Run |
| Space | Handbrake |
| 1 / 2 / 3 | Pistol / SMG / Shotgun |
| P / Esc | Pause |
| M | Mute |

## Run it

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080 in desktop Chrome
```

No build step, no network requests — every file the game loads is under `game/`. The entry program (`main.ts`, Node 22) copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# run it twice and compare: both runs must write byte-identical output
sha256sum out/dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=vpa00rt3&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
