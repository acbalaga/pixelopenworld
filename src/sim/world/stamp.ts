import { CHUNK_TILES, createChunk, tileIndex, type Chunk } from './chunk';

/**
 * Stamp format v0 (minimal; M4 extends it). A stamp is a grid of characters plus a legend.
 * Each legend entry names the ground terrain and, optionally, tile ids for the detail, object
 * and overhead layers of that cell. The grid's top left is world tile (0, 0). The grid size
 * must be a multiple of the chunk size (32). Collision is derived from `collisionOf`.
 */
export interface StampCell {
  ground: number;
  detail?: number;
  object?: number;
  overhead?: number;
}

/** A stamp: legend plus rows of equal length. */
export interface Stamp {
  id: string;
  legend: Readonly<Record<string, StampCell>>;
  rows: readonly string[];
  /** Objects by world tile, for example spawn points. */
  objects?: readonly { x: number; y: number; kind: string }[];
}

/** Collision value of a cell, from the ground terrain and the object tile. */
export type CollisionOf = (cell: StampCell) => number;

/** Builds the chunks a stamp covers. Throws with the row and column of any bad cell. */
export function buildChunks(stamp: Stamp, collisionOf: CollisionOf): Chunk[] {
  const h = stamp.rows.length;
  const w = stamp.rows[0]?.length ?? 0;
  if (w === 0 || w % CHUNK_TILES !== 0 || h % CHUNK_TILES !== 0) {
    throw new Error(`stamp ${stamp.id}: size ${w}x${h} is not a multiple of ${CHUNK_TILES}`);
  }
  const chunks = new Map<string, Chunk>();
  stamp.rows.forEach((row, y) => {
    if (row.length !== w)
      throw new Error(`stamp ${stamp.id} row ${y}: width ${row.length}, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const cell = stamp.legend[row[x] as string];
      if (!cell)
        throw new Error(`stamp ${stamp.id} row ${y} col ${x}: unknown character '${row[x]}'`);
      const cx = Math.floor(x / CHUNK_TILES);
      const cy = Math.floor(y / CHUNK_TILES);
      const key = `${cx},${cy}`;
      let c = chunks.get(key);
      if (!c) {
        c = createChunk(cx, cy);
        chunks.set(key, c);
      }
      const i = tileIndex(x - cx * CHUNK_TILES, y - cy * CHUNK_TILES);
      c.ground[i] = cell.ground;
      c.detail[i] = cell.detail ?? 0;
      c.object[i] = cell.object ?? 0;
      c.overhead[i] = cell.overhead ?? 0;
      c.collision[i] = collisionOf(cell);
    }
  });
  for (const o of stamp.objects ?? []) {
    const c = chunks.get(`${Math.floor(o.x / CHUNK_TILES)},${Math.floor(o.y / CHUNK_TILES)}`);
    if (!c)
      throw new Error(`stamp ${stamp.id}: object ${o.kind} at ${o.x},${o.y} is outside the stamp`);
    c.objects.push({ x: o.x - c.cx * CHUNK_TILES, y: o.y - c.cy * CHUNK_TILES, kind: o.kind });
  }
  return [...chunks.values()].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
}
