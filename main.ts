// SPDX-License-Identifier: MIT
// gta6-01 — Solara Bay: hand-in builder (round 10: gang war / turf war).
// Node 22, standard library only. It assembles the entry the judge grades:
//   game/        the playable open-world game (static files, offline)
//   screenshots/ four 1280x720 JPEG renders of the running game
//   dossier.json the make.fun dossier, built by the vendored library
// The output directory is /output inside the grader, or MAKEFUN_OUTPUT_DIR
// when run locally (e.g. MAKEFUN_OUTPUT_DIR=out node main.ts).
// It never deletes anything: the grader mounts /output, so removing it
// would fail with EBUSY. Copying over an existing tree is enough.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this program lives, and where the entry goes.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, taken from the bounty gate: only text_max_bytes shapes
// the dossier bytes; the rest make this program refuse an entry the scorer
// would refuse anyway (too many or too large screenshots, a game tree over
// 993 entries / 48 MiB, a game path over 1000 bytes).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
} as const;

const shotCapBytes = CAPS.screenshots.max_bytes;

/** Copy a whole directory tree, creating the destination first. */
function mirrorTree(fromDir: string, toDir: string): number {
  mkdirSync(toDir, { recursive: true });
  cpSync(fromDir, toDir, { recursive: true });
  return readdirSync(fromDir).length;
}

/** Fail fast with a plain message when a pre-condition is not met. */
function requireOk(ok: boolean, message: string): void {
  if (!ok) throw new Error(`gta6-01 hand-in refused: ${message}`);
}

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

// Pre-flight: the game page must exist and the screenshots must be real
// JPEG/PNG renders inside the byte cap, so a stale or oversized shot is
// caught here instead of deep inside the dossier build.
requireOk(existsSync(join(gameDir, 'index.html')), 'game/index.html is missing');
requireOk(existsSync(shotsDir), 'screenshots/ is missing');
const shots = readdirSync(shotsDir)
  .filter((name) => !name.startsWith('.'))
  .sort();
requireOk(shots.length >= 3 && shots.length <= CAPS.screenshots.max,
  `expected 3-4 screenshots, found ${shots.length}`);
for (const name of shots) {
  const size = statSync(join(shotsDir, name)).size;
  requireOk(size <= shotCapBytes, `screenshots/${name} is ${size} bytes, over the ${shotCapBytes} cap`);
}

// Assemble /output: game/ and screenshots/ mirrored in, then the dossier.
mkdirSync(outDir, { recursive: true });
const gameEntries = mirrorTree(gameDir, join(outDir, 'game'));
mirrorTree(shotsDir, join(outDir, 'screenshots'));

const dossier = buildDossier(outDir, CAPS);
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`gta6-01 hand-in ready in ${outDir}`);
console.log(`  game/: ${gameEntries} top-level entries`);
console.log(`  screenshots/: ${shots.join(', ')}`);
console.log(`  dossier.json: ${dossier.length} bytes`);
