import { createHash } from 'node:crypto';
import { SLICE_MAP } from '../../src/content/world/slice-map';
import { encodeChunk } from '../../src/sim/world/chunk';
import { buildChunks } from '../../src/sim/world/stamp';
import { collisionOfCell } from '../bake-assets/world';
import type { WorldFiles } from './bake';

const sha = (b: Uint8Array): string => createHash('sha256').update(b).digest('hex').slice(0, 16);

/**
 * The hand-built slice map, baked as the region `slice` so it streams like any other region.
 * Same files and manifest shape as `bakeRegion`, minus what a hand-built map has none of.
 */
export function bakeSliceRegion(): WorldFiles {
  const out: WorldFiles = new Map();
  const files: { file: string; cx: number; cy: number; hash: string }[] = [];
  let w = 0;
  let h = 0;
  for (const c of buildChunks(SLICE_MAP, collisionOfCell)) {
    const bytes = encodeChunk(c);
    const file = `chunk-${c.cx}-${c.cy}.bin`;
    out.set(`slice/${file}`, bytes);
    files.push({ file, cx: c.cx, cy: c.cy, hash: sha(bytes) });
    w = Math.max(w, c.cx + 1);
    h = Math.max(h, c.cy + 1);
  }
  const hash = sha(Buffer.from(files.map((f) => `${f.file}:${f.hash}`).join('\n')));
  const manifest = { version: 1, region: 'slice', hash, chunks: { w, h }, files, interiors: [] };
  out.set('slice/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  return out;
}
