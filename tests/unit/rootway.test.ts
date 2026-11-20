import { describe, expect, it } from 'vitest';
import {
  ROOTWAY,
  ROOTWAY_MOUTH,
  regionTile,
  rootwayRooms,
} from '../../src/content/world/dungeons/rootway';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { dungeonOfRoom } from '../../src/content/world/dungeons';
import { FIXTURES } from '../../src/content/world/fixtures';
import { roomAt, roomsOf } from '../../src/content/world/rooms';
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

describe('the Rootway graph', () => {
  it('passes the dungeon validator: every room, the key and the way back', () => {
    expect(validateDungeon(ROOTWAY)).toEqual([]);
  });

  it('has the ten rooms of the region doc and both routes from the fork', () => {
    expect(ROOTWAY.rooms.map((r) => r.id)).toEqual([
      'r1',
      'r2',
      'r3a',
      'r3b',
      'r4',
      'r5',
      'r6',
      'r7',
      'r8',
      'r9',
    ]);
    const out = (id: string): string[] =>
      ROOTWAY.edges.filter((e) => e.from === id).map((e) => e.to);
    expect(out('r2').sort()).toEqual(['r3a', 'r3b']);
    expect(out('r3a')).toEqual(['r4']);
    expect(out('r3b')).toEqual(['r4']);
  });

  it('has a dark gallery, a resetting puzzle room, a locked den and a shortcut and drop to the mouth', () => {
    expect(ROOTWAY.rooms.find((r) => r.id === 'r4')?.dark).toBe(true);
    expect(ROOTWAY.rooms.find((r) => r.id === 'r6')?.reset).toBe(true);
    const e = (a: string, b: string) => ROOTWAY.edges.find((x) => x.from === a && x.to === b);
    expect(e('r7', 'r8')).toMatchObject({ kind: 'locked', key: 'item.root_key' });
    expect(e('r7', 'r1')?.kind).toBe('shortcut');
    expect(e('r8', 'r1')?.kind).toBe('oneWay');
    expect(e('r7', 'r9')?.skill).toBe('skill.heavy_arms');
  });

  it('is found by the room lookup, as a dungeon, only in Dawnmeadow', () => {
    for (const r of rootwayRooms()) {
      const mid = { x: Math.floor((r.x0 + r.x1) / 2), y: Math.floor((r.y0 + r.y1) / 2) };
      expect(roomAt(mid.x, mid.y, 'dawnmeadow')?.id).toBe(r.id);
      expect(dungeonOfRoom(r.id)).toBe('dungeon.rootway');
    }
    // Open ground elsewhere in Dawnmeadow, and the Rootway's coordinates are rock on the slice.
    expect(roomAt(190, 190, 'dawnmeadow')?.outdoors).toBe(true);
    expect(
      roomsOf('dawnmeadow').filter((r) => !r.outdoors && r.id.startsWith('dungeon.rootway.')),
    ).toHaveLength(10);
  });

  it('places every fixture and portal it names, and every portal leads to a marker or a portal', () => {
    for (const r of ROOTWAY.rooms)
      for (const o of STAMPS[`rootway_${r.id}`]!.objects ?? []) {
        if (
          o.kind.startsWith('marker.') ||
          o.kind.startsWith('node.') ||
          o.kind.startsWith('spawner.')
        )
          continue;
        expect(FIXTURES[o.kind], `${r.id}: ${o.kind}`).toBeDefined();
      }
    for (const f of Object.values(FIXTURES).filter(
      (x) => x.kind.startsWith('fixture.rw_e') || x.kind.startsWith('fixture.rootway_'),
    ))
      if (f.type === 'portal') {
        expect(FIXTURES[f.to!], f.kind).toBeDefined();
        expect(f.at, f.kind).toBeDefined();
      }
  });

  it('stands every portal on open floor in the baked region', () => {
    const solid = (x: number, y: number): number => grid.solidAt(x, y);
    for (const f of Object.values(FIXTURES)) {
      if (!f.at || (f.type !== 'portal' && f.type !== 'arrival')) continue;
      expect(solid(f.at.x, f.at.y), f.kind).toBe(Solid.None);
    }
  });

  it('has open ground around the mouth at the great oak', () => {
    for (let dy = 0; dy <= 2; dy++)
      for (let dx = -1; dx <= 1; dx++)
        expect(grid.solidAt(ROOTWAY_MOUTH.x + dx, ROOTWAY_MOUTH.y + dy), `${dx},${dy}`).toBe(
          Solid.None,
        );
  });
});

describe('scripted clears through the portals', () => {
  /** A game with the whole region baked in and the avatar at a room's tile. */
  function game(): { s: SimState; me: number } {
    const s = createDemoState(5, 0);
    s.region = 'dawnmeadow';
    s.tick = 10_000;
    s.world = grid;
    s.stream = newStream(grid, false);
    const f = feetAt(ROOTWAY_MOUTH.x, ROOTWAY_MOUTH.y + 2);
    return { s, me: createAvatar(s, f.x, f.y) };
  }
  const roomOfAvatar = (s: SimState, me: number): string | undefined => {
    const p = s.entities.comps.pos[me]!;
    return roomAt(Math.floor(p.x / 256 / 16), Math.floor((p.y / 256 - 1) / 16), 'dawnmeadow')?.id;
  };
  const run = (s: SimState, me: number, n = 3): void => {
    for (let i = 0; i < n; i++) stepWorld(s, me, { commands: [] } as never);
  };
  /** Stands on the portal of an edge, and lets the sim step through it. */
  const take = (s: SimState, me: number, room: string, at: { x: number; y: number }): void => {
    const t = regionTile(room, at);
    s.entities.comps.pos[me] = { x: px(t.x * 16 + 8), y: px(t.y * 16 + 16 - 8 + 8) };
    run(s, me);
  };

  const clear = (via: 'r3a' | 'r3b'): string[] => {
    const { s, me } = game();
    run(s, me, 3);
    // The mouth at the great oak leads into R1.
    s.entities.comps.pos[me] = { x: px(ROOTWAY_MOUTH.x * 16 + 8), y: px(ROOTWAY_MOUTH.y * 16 + 8) };
    run(s, me);
    const seen = [roomOfAvatar(s, me)!];
    const edge = (a: string, b: string) => ROOTWAY.edges.find((e) => e.from === a && e.to === b)!;
    for (const [a, b] of [
      ['r1', 'r2'],
      ['r2', via],
      [via, 'r4'],
      ['r4', 'r5'],
      ['r5', 'r6'],
      ['r6', 'r7'],
      ['r7', 'r8'],
      ['r8', 'r1'],
    ] as const) {
      take(s, me, a, edge(a, b).at);
      seen.push(roomOfAvatar(s, me)!);
    }
    return seen;
  };

  it('goes from the mouth through the Root Hall to the den and drops back to the mouth room', () => {
    expect(clear('r3a').map((id) => id.replace('dungeon.rootway.', ''))).toEqual([
      'r1',
      'r2',
      'r3a',
      'r4',
      'r5',
      'r6',
      'r7',
      'r8',
      'r1',
    ]);
  });

  it('goes through the Narrow Crawl the same way', () => {
    expect(clear('r3b').map((id) => id.replace('dungeon.rootway.', ''))).toEqual([
      'r1',
      'r2',
      'r3b',
      'r4',
      'r5',
      'r6',
      'r7',
      'r8',
      'r1',
    ]);
  });

  it('comes out at the great oak from the mouth room, and the shortcut lands in R1', () => {
    const { s, me } = game();
    s.entities.comps.pos[me] = { x: px(ROOTWAY_MOUTH.x * 16 + 8), y: px(ROOTWAY_MOUTH.y * 16 + 8) };
    run(s, me);
    expect(roomOfAvatar(s, me)).toBe('dungeon.rootway.r1');
    take(s, me, 'r1', { x: 8, y: 8 });
    expect(roomOfAvatar(s, me)).toBe('room.region');
    const sc = ROOTWAY.edges.find((e) => e.kind === 'shortcut')!;
    take(s, me, sc.from, sc.at);
    expect(roomOfAvatar(s, me)).toBe('dungeon.rootway.r1');
  });

  it('keeps the avatar in place when the far side has not been streamed in', () => {
    const { s, me } = game();
    const sparse = new TileWorld();
    s.world = sparse;
    s.stream = newStream(sparse, false);
    const at = { x: px(ROOTWAY_MOUTH.x * 16 + 8), y: px(ROOTWAY_MOUTH.y * 16 + 8) };
    s.entities.comps.pos[me] = { ...at };
    run(s, me);
    expect(s.entities.comps.pos[me]).toEqual(at);
  });
});
