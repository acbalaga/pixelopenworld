import { describe, expect, it } from 'vitest';
import { BUILT_DUNGEONS } from '../../src/content/world/dungeons/registry';
import { FIXTURES } from '../../src/content/world/fixtures';
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
        const feet = {
          x: dest.at.x * 16 + 8 + dest.arrive[0],
          y: dest.at.y * 16 + 8 + dest.arrive[1],
        };
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

/**
 * Playtest: arriving at the Thornwall bell wall put the avatar's feet inside the lowest row of
 * ledges, so walking north carried them through it into a strip they could not climb out of
 * without Athletics 20. A landing must not overlap anything solid that stands in the room. A
 * breakable wall is left out: nobody can arrive behind one until it is broken.
 */
describe('dungeon landings clear of fixtures', () => {
  const NO_BODY = new Set([
    'portal',
    'arrival',
    'plate',
    'snare',
    'torch',
    'arena',
    'rest',
    'vigil',
    'vent',
    'breakable',
  ]);
  for (const d of BUILT_DUNGEONS) {
    it(`${d.def.id}: no landing overlaps a solid fixture`, () => {
      const solids: { kind: string; x0: number; x1: number; y0: number; y1: number }[] = [];
      d.def.rooms.forEach((r, i) => {
        const o = d.roomOrigin(r.id);
        for (const obj of d.stamps[i]!.objects ?? []) {
          const def = FIXTURES[obj.kind];
          if (!def || NO_BODY.has(def.type) || def.hidden) continue;
          const size = def.size ?? 16;
          const cx = (o.x + obj.x) * 16 + 8;
          const feet = (o.y + obj.y) * 16 + 16;
          solids.push({
            kind: obj.kind,
            x0: cx - size / 2,
            x1: cx + size / 2,
            y0: feet - size,
            y1: feet,
          });
        }
      });
      const fx = d.fixtures();
      for (const f of fx) {
        if (f.type !== 'portal') continue;
        const dest = fx.find((g) => g.kind === f.to);
        if (!dest?.at || !dest.arrive) continue;
        const x = dest.at.x * 16 + 8 + dest.arrive[0];
        const y = dest.at.y * 16 + 8 + dest.arrive[1];
        // The avatar's feet box is 10 wide and 8 tall (balance/movement).
        const hit = solids.find((s) => x - 5 < s.x1 && x + 5 > s.x0 && y - 8 < s.y1 && y > s.y0);
        expect(hit?.kind, `${f.kind} to ${dest.kind} lands inside a fixture`).toBeUndefined();
      }
    });
  }
});
