/**
 * Named waters of Dawnmeadow (POW-M6-05). A caught fish's record keeps the place it came from, found
 * as the nearest of these to the spot. Tiles, in the region's own coordinates.
 */
export interface FishPlace {
  id: string;
  x: number;
  y: number;
}

export const FISH_PLACES: readonly FishPlace[] = [
  { id: 'lark', x: 242, y: 164 },
  { id: 'reedmouth', x: 302, y: 247 },
  { id: 'millbrook_pond', x: 351, y: 112 },
  { id: 'south_coast', x: 144, y: 312 },
];

/** The place nearest to tile (x, y). Ties go to the first listed. */
export function placeOf(x: number, y: number): string {
  let best = FISH_PLACES[0] as FishPlace;
  let bd = Infinity;
  for (const p of FISH_PLACES) {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = p;
    }
  }
  return best.id;
}
