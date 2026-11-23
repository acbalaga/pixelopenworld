import { STAMPS } from './stamps';

/**
 * Where the settlements stand in a region, as the stamp and its top left tile. Camps do not
 * count inside one (POW-M4-23C). A test checks these against the region spec's placements.
 */
export const REGION_SETTLEMENTS: Readonly<
  Record<string, readonly { stamp: string; x: number; y: number }[]>
> = {
  dawnmeadow: [
    { stamp: 'hearthford', x: 164, y: 164 },
    { stamp: 'millbrook', x: 272, y: 96 },
    { stamp: 'reedmouth', x: 296, y: 236 },
    { stamp: 'stonecrop', x: 164, y: 36 },
  ],
};

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const cache = new Map<string, readonly Rect[]>();

/** The tile rectangles (x1 and y1 exclusive) of a region's settlements. */
export function settlementRects(region: string): readonly Rect[] {
  const hit = cache.get(region);
  if (hit) return hit;
  const rects = (REGION_SETTLEMENTS[region] ?? []).flatMap((s) => {
    const layers = STAMPS[s.stamp]?.layers;
    const rows = layers?.ground ?? layers?.object ?? layers?.detail ?? [];
    const w = rows[0]?.length ?? 0;
    return w > 0 ? [{ x0: s.x, y0: s.y, x1: s.x + w, y1: s.y + rows.length }] : [];
  });
  cache.set(region, rects);
  return rects;
}

/** True when the tile is inside a settlement of the region. */
export function inSettlement(region: string, tx: number, ty: number): boolean {
  return settlementRects(region).some((r) => tx >= r.x0 && tx < r.x1 && ty >= r.y0 && ty < r.y1);
}
