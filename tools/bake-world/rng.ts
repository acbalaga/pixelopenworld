/**
 * Seeded hash for fill generators. Each tile's roll depends only on the seed, its coordinates and
 * a salt, never on the order tiles are visited, so a bake is repeatable and a change in one place
 * does not shift the dice everywhere else.
 */
export function h32(seed: number, x: number, y: number, salt: number): number {
  let h =
    (seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A roll in [0, 1). */
export function roll(seed: number, x: number, y: number, salt: number): number {
  return h32(seed, x, y, salt) / 4294967296;
}

/** Picks an entry by weight from a roll in [0, 1). */
export function pickWeighted<T extends { weight: number }>(list: readonly T[], r: number): T {
  const total = list.reduce((s, e) => s + e.weight, 0);
  let at = r * total;
  for (const e of list) {
    at -= e.weight;
    if (at < 0) return e;
  }
  return list[list.length - 1] as T;
}
