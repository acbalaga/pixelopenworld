// CLI: `tsx tools/bake-assets/index.ts [--validate | --check]`.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPRITES, TILES } from '../../src/content/sprites';
import { bakeAll } from './bake';
import { bakePwa } from './pwa';
import { decodePng } from './png';
import { ATTACKS } from '../../src/content/combat/attacks';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { SFX } from '../../src/content/audio/sfx';
import { validateDefs } from './validate';
import { validateCreatures } from './validateCreatures';
import { validateRealItems } from './validateItems';
import { validateDialogue } from './validateDialogue';
import { validateReachability } from './validateReachability';
import { validateRegions } from './validateRegions';

/** Sprite, creature and spawner validation together. */
function validateAll(): string[] {
  return [
    ...validateDefs(SPRITES, TILES),
    ...validateCreatures(CREATURES, SPAWNERS, {
      attacks: ATTACKS,
      sprites: new Set(SPRITES.map((s) => s.id)),
      sfx: new Set(SFX.map((s) => s.id)),
    }),
    ...validateRealItems(new Set(SPRITES.map((s) => s.id))),
    ...validateDialogue(),
    ...validateReachability(),
    ...validateRegions(),
  ];
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'baked');
const publicDir = join(root, 'public');
const mode = process.argv[2];

if (mode === '--validate') {
  const errors = validateAll();
  if (errors.length > 0) {
    console.error(`validate: ${errors.length} error(s)\n${errors.map((e) => `  ${e}`).join('\n')}`);
    process.exit(1);
  }
  console.log(
    `validate: ${SPRITES.length} sprites, ${TILES.length} tiles, ${Object.keys(CREATURES).length} creatures, ${Object.keys(SPAWNERS).length} spawners ok`,
  );
  process.exit(0);
}

let files;
try {
  files = bakeAll(SPRITES, TILES);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}

/** PNGs compare by decoded pixels (zlib builds differ), everything else byte for byte. */
function sameFile(name: string, a: Buffer, b: Buffer): boolean {
  if (!name.endsWith('.png')) return a.equals(b);
  const x = decodePng(a);
  const y = decodePng(b);
  return (
    x.width === y.width && x.height === y.height && Buffer.from(x.data).equals(Buffer.from(y.data))
  );
}

const bytes = (v: Uint8Array | string): Buffer =>
  typeof v === 'string' ? Buffer.from(v) : Buffer.from(v);

if (mode === '--check') {
  const diffs: string[] = [];
  for (const [name, v] of bakePwa()) {
    const p = join(publicDir, name);
    if (!existsSync(p) || !sameFile(name, readFileSync(p), bytes(v))) diffs.push(`public/${name}`);
  }
  for (const [name, v] of files) {
    const p = join(outDir, name);
    if (!existsSync(p) || !sameFile(name, readFileSync(p), bytes(v))) diffs.push(name);
  }
  const have = existsSync(outDir)
    ? readdirSync(outDir).filter((n) => n !== '.gitkeep' && n !== 'world')
    : [];
  for (const n of have) if (!files.has(n)) diffs.push(`${n} (stale)`);
  if (diffs.length > 0) {
    console.error(
      `bake drift: baked/ differs from the definitions: ${diffs.join(', ')}. Run npm run bake.`,
    );
    process.exit(1);
  }
  console.log('bake: baked/ is up to date');
} else {
  mkdirSync(outDir, { recursive: true });
  for (const n of readdirSync(outDir))
    if (n !== '.gitkeep' && n !== 'world') rmSync(join(outDir, n));
  for (const [name, v] of files) writeFileSync(join(outDir, name), bytes(v));
  console.log(`bake: wrote ${files.size} files to baked/`);
  for (const [name, v] of bakePwa()) {
    mkdirSync(dirname(join(publicDir, name)), { recursive: true });
    writeFileSync(join(publicDir, name), bytes(v));
  }
  console.log('bake: wrote the PWA icons and manifest to public/');
}
