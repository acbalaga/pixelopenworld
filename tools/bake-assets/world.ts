import { TEST_MAP } from '../../src/content/world/test-map';
import { Terrain, TILESET } from '../../src/content/world/tileset';
import { TILES } from '../../src/content/sprites';
import { Solid, encodeChunk } from '../../src/sim/world/chunk';
import { buildChunks, type CollisionOf, type Stamp } from '../../src/sim/world/stamp';

const byId = new Map(TILES.map((t) => [t.id, t]));

/**
 * Collision for a stamp cell: water ground blocks, and an object tile blocks when its tile
 * definition says `full`. Other shapes are not enforced yet (bushes and ledges come later).
 */
export const collisionOfCell: CollisionOf = (cell) => {
  if (cell.ground === Terrain.Water) return Solid.Water;
  if (cell.object) {
    const def = byId.get(TILESET[cell.object - 1] as string);
    if (def?.collision === 'full') return Solid.Full;
  }
  return Solid.None;
};

/** Chunk file name for a stamp's chunk. */
export function chunkFileName(stampId: string, cx: number, cy: number): string {
  return `chunk-${stampId}-${cx}-${cy}.bin`;
}

/** Bakes a stamp into one binary file per chunk. Deterministic. */
export function bakeStamp(stamp: Stamp): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  for (const c of buildChunks(stamp, collisionOfCell))
    out.set(chunkFileName(stamp.id, c.cx, c.cy), encodeChunk(c));
  return out;
}

/** All baked world files. */
export function bakeWorld(): Map<string, Uint8Array> {
  return new Map([...bakeStamp(TEST_MAP)]);
}
