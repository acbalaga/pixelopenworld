/** Seeded PRNG (sfc32) with named, independent, serializable streams. */

/** The streams. Adding a roll to one never shifts another. Add new names at the end. */
export const STREAM_NAMES = ['combat', 'loot', 'world', 'travelers', 'misc'] as const;
/** A stream name. */
export type StreamName = (typeof STREAM_NAMES)[number];

/** State of one stream: four uint32 words. */
export interface Rng {
  s: [number, number, number, number];
}

/** All streams of a sim. Plain data, saved as is. */
export type RngStreams = Record<StreamName, Rng>;

function mix32(h: number): number {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function nameHash(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Builds one stream from a master seed and a name. */
export function createStream(seed: number, name: StreamName): Rng {
  let h = mix32((seed >>> 0) ^ nameHash(name));
  const s: [number, number, number, number] = [0, 0, 0, 0];
  for (let i = 0; i < 4; i++) {
    h = mix32((h + 0x9e3779b9) >>> 0);
    s[i] = h;
  }
  const r: Rng = { s };
  for (let i = 0; i < 12; i++) nextU32(r);
  return r;
}

/** Builds every stream from a master seed. */
export function createStreams(seed: number): RngStreams {
  const out = {} as RngStreams;
  for (const n of STREAM_NAMES) out[n] = createStream(seed, n);
  return out;
}

/** Next uint32. */
export function nextU32(r: Rng): number {
  const s = r.s;
  const t = (((s[0] + s[1]) | 0) + s[3]) | 0;
  s[3] = (s[3] + 1) | 0;
  s[0] = s[1] ^ (s[1] >>> 9);
  s[1] = (s[2] + (s[2] << 3)) | 0;
  s[2] = (((s[2] << 21) | (s[2] >>> 11)) + t) | 0;
  return t >>> 0;
}

/** Next float in [0, 1). */
export function next(r: Rng): number {
  return nextU32(r) / 4294967296;
}

/** Integer in [min, max], both inclusive. */
export function int(r: Rng, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error(`bad int range ${min}..${max}`);
  }
  return min + Math.floor(next(r) * (max - min + 1));
}

/** True with probability p (0 never, 1 always). */
export function chance(r: Rng, p: number): boolean {
  return next(r) < p;
}

/** A uniformly chosen element. Throws on an empty array. */
export function pick<T>(r: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty array');
  return items[int(r, 0, items.length - 1)] as T;
}

/** A weighted choice. Weights must be non-negative with a positive sum. */
export function weighted<T>(r: Rng, table: readonly (readonly [T, number])[]): T {
  let total = 0;
  for (const [, w] of table) {
    if (!(w >= 0)) throw new Error('negative weight');
    total += w;
  }
  if (!(total > 0)) throw new Error('weights sum to zero');
  let roll = next(r) * total;
  let last: T | undefined;
  for (const [item, w] of table) {
    if (w === 0) continue;
    last = item;
    if (roll < w) return item;
    roll -= w;
  }
  return last as T;
}
