// CLI: `tsx tools/bake-world/index.ts [--check]`. Bakes every region spec into `baked/world/`.
// `--check` bakes in memory and fails if the committed bytes differ (the CI drift check).
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGION_SPECS } from '../../src/content/world/regions/index';
import { STAMPS } from '../../src/content/world/stamps/index';
import { BakeError } from '../../src/sim/world/bakeError';
import { bakeRegion, type WorldFiles } from './bake';
import { bakeSliceRegion } from './slice';
import { DUNGEONS } from '../../src/content/world/dungeons';
import { validateDungeon } from './validateDungeon';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'baked', 'world');

/** Bakes every region. */
export function bakeAllRegions(): WorldFiles {
  // A dungeon that can be soft locked, or cannot be finished, fails the bake.
  for (const d of Object.values(DUNGEONS)) {
    const problems = validateDungeon(d);
    if (problems.length > 0) throw new BakeError(d.id, 'dungeon', problems.join('; '));
  }
  const all: WorldFiles = new Map();
  for (const spec of Object.values(REGION_SPECS))
    for (const [name, v] of bakeRegion(spec, STAMPS)) all.set(name, v);
  for (const [name, v] of bakeSliceRegion()) all.set(name, v);
  return all;
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? filesUnder(p) : [relative(outDir, p)];
  });
}

const bytes = (v: Uint8Array | string): Buffer =>
  typeof v === 'string' ? Buffer.from(v) : Buffer.from(v);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let files: WorldFiles;
  try {
    files = bakeAllRegions();
  } catch (e) {
    console.error(e instanceof BakeError ? `bake-world: ${e.message}` : e);
    process.exit(1);
  }
  if (process.argv[2] === '--check') {
    const diffs: string[] = [];
    for (const [name, v] of files) {
      const p = join(outDir, name);
      if (!existsSync(p) || !readFileSync(p).equals(bytes(v))) diffs.push(name);
    }
    for (const n of filesUnder(outDir))
      if (!files.has(n.split('\\').join('/'))) diffs.push(`${n} (stale)`);
    if (diffs.length > 0) {
      console.error(
        `bake-world drift: baked/world differs from the specs: ${diffs.join(', ')}. Run npm run bake:world.`,
      );
      process.exit(1);
    }
    console.log(`bake-world: baked/world is up to date (${files.size} files)`);
  } else {
    rmSync(outDir, { recursive: true, force: true });
    for (const [name, v] of files) {
      const p = join(outDir, name);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, bytes(v));
    }
    console.log(`bake-world: wrote ${files.size} files to baked/world/`);
  }
}
