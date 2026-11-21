// Solara Bay — entry program for make.fun gta6-01.
// Copies game/ and screenshots/ into the output directory, then writes
// dossier.json with buildDossier from vendor/makefun-game.ts.
// Node 22, standard library only. No build step, no network.
//
// The output directory is a fresh mount on the grader, so this program
// only creates it (mkdir, recursive) and never deletes anything inside it.
// Deleting would fail on a mount point, so there is no cleanup step here.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

// Where the entry goes: the harness mounts /output, or MAKEFUN_OUTPUT_DIR
// stands in for it when running locally.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The dossier caps from the competition gate.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// The two source trees, copied in this order: the game first, then its shots.
const trees = ['game', 'screenshots'];

// Make the output directory; it is mounted empty, so creating it is enough.
mkdirSync(outDir, { recursive: true });

for (const name of trees) {
  const from = join(import.meta.dirname, name);
  if (!existsSync(from)) {
    throw new Error(`main.ts: ${name}/ is missing from the repository, cannot hand in`);
  }
  cpSync(from, join(outDir, name), { recursive: true });
}

// Build the dossier from what was just copied and write it out.
const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier.json written: ${dossier.length} bytes`);
