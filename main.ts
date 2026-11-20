// main.ts — Solara Bay entry program for make.fun gta6-01.
// Node 22, standard library only. It hands the game in: copies game/ and
// screenshots/ from this repository into the output directory and writes
// dossier.json there with buildDossier from vendor/makefun-game.ts.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The repository root is the directory this file lives in.
const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Start from a clean output directory so a stale file can never leak into
// the entry and so two runs write byte-identical output.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// Copy the two handed-in trees verbatim, in a fixed order.
for (const tree of ['game', 'screenshots']) {
  const src = join(repoRoot, tree);
  if (!existsSync(src)) throw new Error(`main.ts: ${tree}/ is missing from the repository`);
  cpSync(src, join(outDir, tree), { recursive: true });
}

// The dossier is built from the copied trees, with the competition's caps.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);
console.log(`main.ts: wrote ${dossierPath} (${dossier.length} bytes)`);
