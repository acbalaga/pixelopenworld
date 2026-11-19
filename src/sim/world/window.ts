/**
 * The streaming windows (tech/01, World streaming). Pure functions of chunk coordinates, so the
 * sim, the platform loader and the tests all agree on what is active and what is loaded.
 *
 * - Active: the 3 x 3 chunks around the avatar's chunk. Creatures and spawners run here.
 * - Loaded: the 5 x 5 chunks around it. Tile data is resident and map objects are materialized.
 *   Creatures in the loaded ring are frozen. Nothing is simulated outside it.
 */

/** Chunks from the avatar's chunk to the edge of the active window. */
export const ACTIVE_RADIUS = 1;
/** Chunks from the avatar's chunk to the edge of the loaded window. */
export const LOADED_RADIUS = 2;

/** Chunk edge in px (32 tiles of 16 px). Kept here so the sim need not import the renderer. */
export const CHUNK_PX = 512;

export interface ChunkRef {
  cx: number;
  cy: number;
}

/** Chunk coordinate of a world px coordinate. Rounds toward negative infinity. */
export function chunkOfPx(v: number): number {
  return Math.floor(v / CHUNK_PX);
}

/** Stable string key for a chunk, used in the save (`deltas`) and in caches. */
export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

/** Parses {@link chunkKey}. Returns null for anything else. */
export function parseChunkKey(key: string): ChunkRef | null {
  const m = /^(-?\d+),(-?\d+)$/.exec(key);
  return m ? { cx: Number(m[1]), cy: Number(m[2]) } : null;
}

/** True if (cx, cy) is within `radius` chunks of (ax, ay), square window. */
export function inWindow(cx: number, cy: number, ax: number, ay: number, radius: number): boolean {
  return Math.abs(cx - ax) <= radius && Math.abs(cy - ay) <= radius;
}

/** Every chunk of the square window of `radius` around (ax, ay), row by row. */
export function windowChunks(ax: number, ay: number, radius: number): ChunkRef[] {
  const out: ChunkRef[] = [];
  for (let cy = ay - radius; cy <= ay + radius; cy++)
    for (let cx = ax - radius; cx <= ax + radius; cx++) out.push({ cx, cy });
  return out;
}

/**
 * The loaded window in the order to fetch it. The active 3 x 3 comes first, nearest first. The
 * outer ring follows, and within it the chunks ahead of the direction of travel `(dx, dy)` (each
 * -1, 0 or 1) come before the ones behind. Ties break by row then column so the order is stable.
 */
export function loadOrder(ax: number, ay: number, dx: number, dy: number): ChunkRef[] {
  const score = (c: ChunkRef): number => {
    const ox = c.cx - ax;
    const oy = c.cy - ay;
    const ring = Math.max(Math.abs(ox), Math.abs(oy));
    const ahead = ox * dx + oy * dy;
    // The ring dominates. Inside a ring, ahead sorts first, then closer in Manhattan terms.
    return ring * 1000 - ahead * 10 + Math.abs(ox) + Math.abs(oy);
  };
  return windowChunks(ax, ay, LOADED_RADIUS).sort(
    (a, b) => score(a) - score(b) || a.cy - b.cy || a.cx - b.cx,
  );
}

/** Direction of travel from one chunk to another, each axis -1, 0 or 1. */
export function travelDir(from: ChunkRef, to: ChunkRef): { dx: number; dy: number } {
  return { dx: Math.sign(to.cx - from.cx), dy: Math.sign(to.cy - from.cy) };
}
