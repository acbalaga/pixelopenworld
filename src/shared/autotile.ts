/**
 * 47-tile blob autotiling. A tile's eight neighbors are packed into a bit mask (set means the
 * neighbor is the same overlay terrain). Diagonal bits only matter when both adjacent edge bits
 * are set, which collapses the 256 possible masks to 47 distinct pictures.
 */

export const NB = { N: 1, NE: 2, E: 4, SE: 8, S: 16, SW: 32, W: 64, NW: 128 } as const;

/** Clears diagonal bits that do not change the picture. */
export function canonicalMask(mask: number): number {
  let m = mask & 0xff;
  if (!(m & NB.N && m & NB.E)) m &= ~NB.NE;
  if (!(m & NB.S && m & NB.E)) m &= ~NB.SE;
  if (!(m & NB.S && m & NB.W)) m &= ~NB.SW;
  if (!(m & NB.N && m & NB.W)) m &= ~NB.NW;
  return m;
}

/** The 47 canonical masks, ascending. Index in this list is the blob index. */
export const BLOB_MASKS: readonly number[] = [
  ...new Set(Array.from({ length: 256 }, (_, m) => canonicalMask(m))),
].sort((a, b) => a - b);

const INDEX = new Map(BLOB_MASKS.map((m, i) => [m, i]));

/** Blob index 0 to 46 for a neighbor mask. */
export function blobIndex(mask: number): number {
  return INDEX.get(canonicalMask(mask)) as number;
}

/** What one 8x8 quadrant of the tile looks like. */
export type Quad = 'full' | 'edge_h' | 'edge_v' | 'corner' | 'inner';

/** Quadrant types for a mask. For each quadrant: its two adjacent edges and its diagonal. */
export function quadrants(mask: number): { tl: Quad; tr: Quad; bl: Quad; br: Quad } {
  const q = (edgeA: boolean, edgeB: boolean, diag: boolean): Quad => {
    // edgeA is the vertical neighbor (N or S), edgeB the horizontal one (W or E).
    if (!edgeA && !edgeB) return 'corner';
    if (!edgeA) return 'edge_h';
    if (!edgeB) return 'edge_v';
    return diag ? 'full' : 'inner';
  };
  const has = (b: number): boolean => (mask & b) !== 0;
  return {
    tl: q(has(NB.N), has(NB.W), has(NB.NW)),
    tr: q(has(NB.N), has(NB.E), has(NB.NE)),
    bl: q(has(NB.S), has(NB.W), has(NB.SW)),
    br: q(has(NB.S), has(NB.E), has(NB.SE)),
  };
}
