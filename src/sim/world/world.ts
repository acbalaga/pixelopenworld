import { NB } from '../../shared/autotile';
import { CHUNK_TILES, Solid, tileIndex, type Chunk } from './chunk';

/** Floor division that rounds toward negative infinity, for negative tile coordinates. */
export function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/** Numeric chunk key, so lookups in the hot path allocate nothing. */
function chunkKey(cx: number, cy: number): number {
  return (cy + 32768) * 65536 + (cx + 32768);
}

/** A set of loaded chunks with tile-level queries. */
export class TileWorld {
  private chunks = new Map<number, Chunk>();

  constructor(chunks: Iterable<Chunk> = []) {
    for (const c of chunks) this.set(c);
  }

  set(c: Chunk): void {
    this.chunks.set(chunkKey(c.cx, c.cy), c);
  }

  chunk(cx: number, cy: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cy));
  }

  /** Bounds of loaded chunks in tiles, or null if empty. */
  bounds(): { x0: number; y0: number; x1: number; y1: number } | null {
    let b: { x0: number; y0: number; x1: number; y1: number } | null = null;
    for (const c of this.chunks.values()) {
      const x0 = c.cx * CHUNK_TILES;
      const y0 = c.cy * CHUNK_TILES;
      b = b
        ? {
            x0: Math.min(b.x0, x0),
            y0: Math.min(b.y0, y0),
            x1: Math.max(b.x1, x0 + CHUNK_TILES),
            y1: Math.max(b.y1, y0 + CHUNK_TILES),
          }
        : { x0, y0, x1: x0 + CHUNK_TILES, y1: y0 + CHUNK_TILES };
    }
    return b;
  }

  private at(tx: number, ty: number): { c: Chunk; i: number } | null {
    const c = this.chunk(floorDiv(tx, CHUNK_TILES), floorDiv(ty, CHUNK_TILES));
    if (!c) return null;
    return { c, i: tileIndex(tx - c.cx * CHUNK_TILES, ty - c.cy * CHUNK_TILES) };
  }

  /** Terrain id at a tile, or `fallback` outside the loaded world. */
  terrainAt(tx: number, ty: number, fallback = 0): number {
    const t = this.at(tx, ty);
    return t ? (t.c.ground[t.i] as number) : fallback;
  }

  /** Collision value at a tile. Outside the loaded world counts as solid so nothing walks off the map. */
  solidAt(tx: number, ty: number): number {
    const t = this.at(tx, ty);
    return t ? (t.c.collision[t.i] as number) : Solid.Full;
  }

  /**
   * Autotile neighbor mask for a tile of `terrain`: a bit is set where that neighbor has the same
   * terrain. Neighbors outside the loaded world count as set, so the map border draws no edge.
   */
  neighborMask(tx: number, ty: number, terrain: number): number {
    const same = (dx: number, dy: number): boolean => {
      const t = this.terrainAt(tx + dx, ty + dy, terrain);
      return t === 0 || t === terrain;
    };
    return (
      (same(0, -1) ? NB.N : 0) |
      (same(1, -1) ? NB.NE : 0) |
      (same(1, 0) ? NB.E : 0) |
      (same(1, 1) ? NB.SE : 0) |
      (same(0, 1) ? NB.S : 0) |
      (same(-1, 1) ? NB.SW : 0) |
      (same(-1, 0) ? NB.W : 0) |
      (same(-1, -1) ? NB.NW : 0)
    );
  }
}
