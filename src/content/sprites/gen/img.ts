import type { AnimDef, AtlasGroup, SpriteDef } from '../types';

/** Small seeded RNG for generators (mulberry32). Same seed, same art, on every machine. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A pixel canvas of palette indices. `null` is transparent. */
export class Img {
  readonly p: (number | null)[][];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.p = Array.from({ length: h }, () => Array<number | null>(w).fill(null));
  }
  get(x: number, y: number): number | null {
    return this.p[y]?.[x] ?? null;
  }
  set(x: number, y: number, c: number | null): void {
    const row = this.p[y];
    if (row && x >= 0 && x < this.w) row[x] = c;
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: number | null): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }
  /** Paints only pixels that are already filled. */
  recolorWhere(test: (x: number, y: number) => boolean, c: number): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) if (this.get(x, y) !== null && test(x, y)) this.set(x, y, c);
  }
}

/** Moves the drawing vertically so its lowest filled row lands on `row`. */
export function alignBottom(src: Img, row: number): Img {
  let low = -1;
  for (let y = 0; y < src.h; y++) if (src.p[y]?.some((c) => c !== null)) low = y;
  if (low < 0) return src;
  const out = new Img(src.w, src.h);
  const dy = row - low;
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) out.set(x, y + dy, src.get(x, y));
  return out;
}

const CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Character used for a palette index in generated text grids. */
export function charFor(index: number): string {
  return CHARS[index] as string;
}

/** Turns drawn images into a SpriteDef with a key built from the indices actually used. */
export function toSprite(
  id: string,
  group: AtlasGroup,
  origin: readonly [number, number],
  frames: Readonly<Record<string, Img>>,
  anims?: Readonly<Record<string, AnimDef>>,
): SpriteDef {
  const names = Object.keys(frames);
  const first = frames[names[0] as string] as Img;
  const used = new Set<number>();
  const grids: Record<string, string[]> = {};
  for (const name of names) {
    const img = frames[name] as Img;
    grids[name] = img.p.map((row) =>
      row
        .map((c) => {
          if (c === null) return '.';
          used.add(c);
          return charFor(c);
        })
        .join(''),
    );
  }
  const key: Record<string, number | null> = { '.': null };
  for (const c of [...used].sort((a, b) => a - b)) key[charFor(c)] = c;
  return {
    id,
    group,
    size: [first.w, first.h],
    origin,
    key,
    frames: grids,
    ...(anims ? { anims } : {}),
  };
}

/**
 * Adds a 1 px outline in the darkest neutral around a silhouette (art bible rule 2). On the lit
 * side (top and left light, so right and below edges) every third outline pixel is left out so
 * the light edge breaks up. The drawing needs a 1 px clear margin.
 */
export function outlined(src: Img): Img {
  const out = new Img(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) out.set(x, y, src.get(x, y));
  const solid = (x: number, y: number): boolean => src.get(x, y) !== null;
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      if (solid(x, y)) continue;
      const right = solid(x + 1, y);
      const below = solid(x, y + 1);
      const left = solid(x - 1, y);
      const above = solid(x, y - 1);
      if (!(right || below || left || above)) continue;
      if ((right || below) && !left && !above && (x + y) % 3 === 0) continue;
      out.set(x, y, 0);
    }
  }
  return out;
}

/** Four tones of one material, dark to light. */
export type Tones4 = readonly [number, number, number, number];

/** Fills an ellipse, shaded by light from the top left: lit rim light, lower right dark. */
export function shadedEllipse(
  im: Img,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tones: Tones4,
): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const l = -dx * 0.55 - dy * 0.85;
      im.set(x, y, l > 0.55 ? tones[3] : l > 0.05 ? tones[2] : l > -0.5 ? tones[1] : tones[0]);
    }
  }
}
