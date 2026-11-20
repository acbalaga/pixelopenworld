import { describe, expect, it } from 'vitest';
import { FRAGMENT_SLOTS, fragmentMarker } from '../../src/content/pois/fragments';
import { DUNGEONS } from '../../src/content/world/dungeons';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { CHUNK_TILES, Solid, decodeChunk } from '../../src/sim/world/chunk';
import { bakeRegion } from '../../tools/bake-world/bake';

describe('lore fragment slots (M4-11)', () => {
  const files = bakeRegion(DAWNMEADOW, STAMPS);
  const open = (x: number, y: number): boolean => {
    const c = decodeChunk(
      files.get(
        `dawnmeadow/chunk-${Math.floor(x / CHUNK_TILES)}-${Math.floor(y / CHUNK_TILES)}.bin`,
      ) as Uint8Array,
    );
    return c.collision[(y % CHUNK_TILES) * CHUNK_TILES + (x % CHUNK_TILES)] === Solid.None;
  };

  it('are the eighteen of the region doc, DM-F01 to DM-F18, each once', () => {
    expect(FRAGMENT_SLOTS.map((f) => f.id)).toEqual(
      Array.from({ length: 18 }, (_v, i) => `dm_f${String(i + 1).padStart(2, '0')}`),
    );
  });

  it('puts each placed slot on open ground, or in a room of its dungeon, as exactly one marker', () => {
    for (const f of FRAGMENT_SLOTS) {
      const kind = fragmentMarker(f.id);
      const outside = DAWNMEADOW.placements.filter((p) => p.kind === kind);
      const rooms = Object.values(DUNGEONS).flatMap((d) =>
        d.rooms.flatMap((r) =>
          (r.stamp.objects ?? []).filter((o) => o.kind === kind).map(() => d.id),
        ),
      );
      if (f.pending) {
        expect(outside.length + rooms.length, f.id).toBe(0);
        continue;
      }
      expect(outside.length + rooms.length, f.id).toBe(1);
      if (f.at) {
        expect(outside[0]).toMatchObject({ x: f.at.x, y: f.at.y });
        expect(open(f.at.x, f.at.y), `${f.id} at ${f.at.x}, ${f.at.y}`).toBe(true);
      } else expect(rooms[0], f.id).toBe(f.dungeon);
    }
  });

  it('leave no player-facing string: a marker has no text', () => {
    for (const f of FRAGMENT_SLOTS) expect(Object.keys(f)).not.toContain('text');
  });
});
