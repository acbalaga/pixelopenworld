import type { SpriteDef } from './types';

/** Marks a transparent pixel in an index grid. */
export const TRANSPARENT = 255;

/** Expands one frame of a sprite into a row-major grid of palette indices. */
export function gridFromDef(def: SpriteDef, frame: string): Uint8Array {
  const [w, h] = def.size;
  const rows = def.frames[frame];
  if (!rows) throw new Error(`sprite ${def.id} has no frame ${frame}`);
  const out = new Uint8Array(w * h).fill(TRANSPARENT);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = def.key[rows[y]?.[x] as string];
      if (idx !== null && idx !== undefined) out[y * w + x] = idx;
    }
  }
  return out;
}
