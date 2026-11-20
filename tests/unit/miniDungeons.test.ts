import { describe, expect, it } from 'vitest';
import { SPAWNERS } from '../../src/content/creatures';
import { ITEMS } from '../../src/content/items';
import { BUILT_DUNGEONS } from '../../src/content/world/dungeons/registry';
import { MINIS } from '../../src/content/world/dungeons/minis';
import { MOUTHS } from '../../src/content/world/dungeons/mouths';
import { dungeonOfRoom } from '../../src/content/world/dungeons';
import { FIXTURES } from '../../src/content/world/fixtures';
import { roomAt } from '../../src/content/world/rooms';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { STAMPS } from '../../src/content/world/stamps';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { Solid, decodeChunk } from '../../src/sim/world/chunk';
import { newStream } from '../../src/sim/world/stream';
import { TileWorld } from '../../src/sim/world/world';
import { bakeRegion } from '../../tools/bake-world/bake';
import { validateDungeon } from '../../tools/bake-world/validateDungeon';

const files = bakeRegion(DAWNMEADOW, STAMPS);
const grid = new TileWorld();
for (const [name, v] of files)
  if (/^dawnmeadow\/chunk-\d+-\d+\.bin$/.test(name)) grid.set(decodeChunk(v as Uint8Array));

describe('Dawnmeadow mini-dungeons (M4-11)', () => {
  it('are ten, each a mini with a region, an estimate and its own rooms', () => {
    expect(MINIS.map((m) => m.def.id)).toEqual(
      ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm10', 'm11'].map((n) => `dungeon.${n}`),
    );
    for (const m of MINIS) {
      expect(m.def.mini, m.def.id).toBe(true);
      expect(m.def.region).toBe('dawnmeadow');
      expect(m.def.estMinutes).toBeGreaterThanOrEqual(5);
      expect(m.def.estMinutes).toBeLessThanOrEqual(10);
      expect(m.def.rooms.length).toBeGreaterThanOrEqual(2);
      expect(m.def.rooms.length).toBeLessThanOrEqual(3);
    }
    expect(new Set(BUILT_DUNGEONS.map((d) => d.def.id)).size).toBe(BUILT_DUNGEONS.length);
  });

  it('pass the dungeon validator: every room, key and way back', () => {
    for (const m of MINIS) expect(validateDungeon(m.def), m.def.id).toEqual([]);
  });

  it('place only fixtures, spawners and markers that exist, with real loot', () => {
    for (const m of MINIS) {
      for (const r of m.def.rooms)
        for (const o of STAMPS[r.stamp.id]!.objects ?? []) {
          if (o.kind.startsWith('marker.')) continue;
          if (o.kind.startsWith('spawner.'))
            expect(SPAWNERS[o.kind], `${r.id} ${o.kind}`).toBeDefined();
          else expect(FIXTURES[o.kind], `${m.def.id} ${r.id}: ${o.kind}`).toBeDefined();
        }
      for (const f of m.parts())
        for (const l of f.loot?.items ?? [])
          expect(ITEMS[l.item], `${f.kind} ${l.item}`).toBeDefined();
    }
  });

  it('keep their rooms in the rock under the sea, found as dungeon rooms', () => {
    for (const m of MINIS)
      for (const r of m.rooms()) {
        expect(r.y0, r.id).toBeGreaterThanOrEqual(12 * 32);
        const mid = { x: Math.floor((r.x0 + r.x1) / 2), y: Math.floor((r.y0 + r.y1) / 2) };
        expect(roomAt(mid.x, mid.y, 'dawnmeadow')?.id).toBe(r.id);
        expect(dungeonOfRoom(r.id)).toBe(m.def.id);
      }
  });

  it('stand every portal and marker on open floor, and every mouth on open ground', () => {
    for (const m of MINIS)
      for (const f of m.fixtures()) {
        expect(f.at, f.kind).toBeDefined();
        expect(grid.solidAt(f.at!.x, f.at!.y), f.kind).toBe(Solid.None);
        if (f.type === 'portal') expect(FIXTURES[f.to!], f.kind).toBeDefined();
      }
    for (const [n, site] of Object.entries(MOUTHS)) {
      if (!MINIS.some((m) => m.def.id === `dungeon.${n}`)) continue;
      expect(grid.solidAt(site.portal.x, site.portal.y), n).toBe(Solid.None);
    }
  });
});

describe('scripted runs through the mini-dungeons', () => {
  function game(): { s: SimState; me: number } {
    const s = createDemoState(5, 0);
    s.region = 'dawnmeadow';
    s.tick = 10_000;
    s.world = grid;
    s.stream = newStream(grid, false);
    const f = feetAt(2, 2);
    return { s, me: createAvatar(s, f.x, f.y) };
  }
  const roomOfAvatar = (s: SimState, me: number): string | undefined => {
    const p = s.entities.comps.pos[me]!;
    return roomAt(Math.floor(p.x / 256 / 16), Math.floor((p.y / 256 - 1) / 16), 'dawnmeadow')?.id;
  };
  const stand = (s: SimState, me: number, t: { x: number; y: number }): void => {
    s.entities.comps.pos[me] = { x: px(t.x * 16 + 8), y: px(t.y * 16 + 8) };
    for (let i = 0; i < 3; i++) stepWorld(s, me, { commands: [] } as never);
  };

  for (const m of MINIS) {
    it(`${m.def.id}: in at the mouth, through every edge, out at the exit`, () => {
      const { s, me } = game();
      stand(s, me, MOUTHS[m.def.id.replace('dungeon.', '')]!.portal);
      expect(roomOfAvatar(s, me), 'mouth').toBe(m.roomId(m.def.entrance));
      for (const e of m.def.edges) {
        stand(s, me, m.regionTile(e.from, e.at));
        expect(roomOfAvatar(s, me), `${e.from} to ${e.to}`).toBe(m.roomId(e.to));
      }
      // Back at the entrance room's exit, out into the open.
      stand(s, me, m.regionTile(m.def.entrance, m.spec.mouth.exit));
      expect(roomOfAvatar(s, me), 'exit').toBe('room.region');
    });
  }

  it('m2: the back door comes out west of the gorge, in the open', () => {
    const m2 = MINIS.find((m) => m.def.id === 'dungeon.m2')!;
    const d = m2.spec.doors![0]!;
    const { s, me } = game();
    stand(s, me, m2.regionTile(d.room, d.tile));
    expect(roomOfAvatar(s, me)).toBe('room.region');
    const p = s.entities.comps.pos[me]!;
    expect(Math.abs(p.x / 256 / 16 - d.at.x)).toBeLessThan(3);
    expect(d.at.x).toBeLessThan(26);
  });
});
