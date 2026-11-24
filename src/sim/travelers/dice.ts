/**
 * A number in [0, 1) from the seed, a slot, a salt and a counter. The entity layer's own dice: it
 * never draws from the sim's streams, so what a Traveler does on screen cannot change what the
 * crowd does off it.
 */
export function hash01(seed: number, slot: number, salt: number, n: number): number {
  let h =
    (seed ^
      Math.imul(slot + 1, 0x9e3779b1) ^
      Math.imul(salt + 7, 0x85ebca6b) ^
      Math.imul(n + 3, 0xc2b2ae35)) >>>
    0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
