import { describe, expect, it } from 'vitest';
import { BUILT_DUNGEONS } from '../../src/content/world/dungeons/registry';
import { roomAt } from '../../src/content/world/rooms';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { Solid, decodeChunk } from '../../src/sim/world/chunk';
import { TileWorld } from '../../src/sim/world/world';
import { bakeRegion } from '../../tools/bake-world/bake';

const grid = new TileWorld();
for (const [name, v] of bakeRegion(DAWNMEADOW, STAMPS))
  if (/^dawnmeadow\/chunk-\d+-\d+\.bin$/.test(name)) grid.set(decodeChunk(v as Uint8Array));

/**
 * Playtest: step through a door, move one tile, and land in another room or out in the sea. A
 * fixture's `arrive` is where someone coming TO it stands, so it must point into the room that
 * fixture is in. For room-to-room edges and back doors it pointed into the room at the other end,
 * so most landings were in the wall (and since POW-M5-20 the wall behind a doorway is an open arch).
 */
describe('dungeon landings', () => {
  for (const d of BUILT_DUNGEONS) {
    it(`${d.def.id}: every portal lands the avatar on open floor inside the room it leads to`, () => {
      const fx = d.fixtures();
      for (const f of fx) {
        if (f.type !== 'portal') continue;
        const dest = fx.find((g) => g.kind === f.to);
        expect(dest, `${f.kind} leads somewhere`).toBeDefined();
        if (!dest?.at || !dest.arrive) continue;
        // Feet land at the tile's middle plus the offset (see fixturesSystem), and stand in the tile above their line.
        const feet = { x: dest.at.x * 16 + 8 + dest.arrive[0], y: dest.at.y * 16 + 8 + dest.arrive[1] };
        const tx = Math.floor(feet.x / 16);
        const ty = Math.floor((feet.y - 1) / 16);
        const label = `${f.kind} to ${dest.kind}`;
        expect(grid.solidAt(tx, ty), label).toBe(Solid.None);
        const room = roomAt(tx, ty, 'dawnmeadow');
        expect(room?.id, label).toBe(roomAt(dest.at.x, dest.at.y, 'dawnmeadow')?.id);
        // Not in the wall ring of a dungeon room: that is where a doorway arch is, and past it is the sea.
        if (room && room.id.startsWith('dungeon.'))
          expect(
            tx > room.x0 && tx < room.x1 - 1 && ty > room.y0 && ty < room.y1 - 1,
            `${label} lands inside the walls`,
          ).toBe(true);
      }
    });
  }
});
