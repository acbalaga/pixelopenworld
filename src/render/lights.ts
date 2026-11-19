import { LIGHTS, type LightDef } from '../content/world/atmosphere';
import { TILESET } from '../content/world/tileset';
import { CHUNK_TILES, tileIndex, type Chunk } from '../sim/world/chunk';

/** A light placed in the world, in px. */
export interface PlacedLight {
  x: number;
  y: number;
  def: LightDef;
}

/** Tile ids (1-based, as the object layer holds them) that glow, by tile. */
const GLOW = new Map<number, LightDef>();
TILESET.forEach((id, i) => {
  const def = LIGHTS.tiles[id];
  if (def) GLOW.set(i + 1, def);
});

/**
 * The lights that map tiles make (torches on walls, lit windows), found once when a chunk arrives
 * and dropped with it. Fixture and lantern lights are found each frame by the caller.
 */
export class LightIndex {
  private byChunk = new Map<string, PlacedLight[]>();

  add(chunk: Chunk): void {
    const out: PlacedLight[] = [];
    for (let y = 0; y < CHUNK_TILES; y++)
      for (let x = 0; x < CHUNK_TILES; x++) {
        const def = GLOW.get(chunk.object[tileIndex(x, y)] as number);
        if (def)
          out.push({
            x: (chunk.cx * CHUNK_TILES + x) * 16 + 8,
            y: (chunk.cy * CHUNK_TILES + y) * 16 + 8,
            def,
          });
      }
    this.byChunk.set(`${chunk.cx},${chunk.cy}`, out);
  }

  remove(cx: number, cy: number): void {
    this.byChunk.delete(`${cx},${cy}`);
  }

  /** Calls `fn` for every light within `margin` px of the view. */
  forVisible(
    x0: number,
    y0: number,
    w: number,
    h: number,
    margin: number,
    fn: (l: PlacedLight) => void,
  ): void {
    for (const list of this.byChunk.values())
      for (const l of list)
        if (
          l.x > x0 - margin &&
          l.x < x0 + w + margin &&
          l.y > y0 - margin &&
          l.y < y0 + h + margin
        )
          fn(l);
  }
}
