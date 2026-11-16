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
