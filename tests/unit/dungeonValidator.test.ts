import { describe, expect, it } from 'vitest';
import type { DungeonDef, DungeonRoom } from '../../src/content/world/dungeons/types';
import { SAMPLE_DUNGEON } from '../../src/content/world/dungeons/sample';
import { Terrain, tilesetId } from '../../src/content/world/tileset';
import { validateDungeon } from '../../tools/bake-world/validateDungeon';

/** A walled room from ASCII rows (`#` wall) with fixture objects at tiles. */
function room(
  id: string,
  rows: readonly string[],
  objects: { x: number; y: number; kind: string }[],
  extra: Partial<DungeonRoom> = {},
): DungeonRoom {
  return {
    id,
    stamp: {
      version: 2,
      id: `t_${id}`,
      legend: {
        '.': { ground: Terrain.Cave },
        '#': { ground: Terrain.Cave, object: tilesetId('tile.cave_wall_top') },
      },
      layers: {
        ground: rows.map((r) => '.'.repeat(r.length)),
        object: rows.map((r) => [...r].map((c) => (c === '#' ? '#' : ' ')).join('')),
      },
      objects,
    },
    ...extra,
  };
}

const withRoom = (d: DungeonDef, id: string, patch: Partial<DungeonRoom>): DungeonDef => ({
  ...d,
  rooms: d.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
});

describe('dungeon validator', () => {
  it('passes the sample dungeon', () => {
    expect(validateDungeon(SAMPLE_DUNGEON)).toEqual([]);
  });

  it('rejects a key that cannot be reached, and the rooms behind its door', () => {
    // The key is gone from room b, and the athletics route to c is not in the declared skills.
    const d = withRoom({ ...SAMPLE_DUNGEON, skills: [] }, 'b', { keys: [] });
    const errors = validateDungeon(d);
    expect(
      errors.some((e) => e.includes('key item.old_key') && e.includes('cannot be reached')),
    ).toBe(true);
    expect(errors.some((e) => e.includes('room c cannot be reached'))).toBe(true);
  });

  it('a key lying behind its own door is not reachable', () => {
    const d: DungeonDef = {
      ...SAMPLE_DUNGEON,
      skills: [],
      // The only key is in c, which only the key opens.
      rooms: SAMPLE_DUNGEON.rooms.map((r) =>
        r.id === 'b' ? { ...r, keys: [] } : r.id === 'c' ? { ...r, keys: ['item.old_key'] } : r,
      ),
    };
    expect(validateDungeon(d).some((e) => e.includes('item.old_key'))).toBe(true);
  });

  it('an alternate route with a skill the dungeon does not declare does not count', () => {
    const d = { ...SAMPLE_DUNGEON, skills: [] };
    // c is still reached through the key door, so only the skill edge is ignored: still sound.
    expect(validateDungeon(d)).toEqual([]);
  });

  it('rejects a one-way drop with no way back to the entrance', () => {
    const d: DungeonDef = {
      ...SAMPLE_DUNGEON,
      edges: SAMPLE_DUNGEON.edges.filter((e) => !(e.from === 'd' && e.to === 'a')),
    };
    const errors = validateDungeon(d);
    expect(errors.some((e) => e.includes('soft lock') && e.includes('room d'))).toBe(true);
  });

  it('rejects an edge that lands on a wall', () => {
    const d: DungeonDef = {
      ...SAMPLE_DUNGEON,
      edges: SAMPLE_DUNGEON.edges.map((e, i) => (i === 0 ? { ...e, arrive: { x: 0, y: 0 } } : e)),
    };
    expect(validateDungeon(d).some((e) => e.includes('not open floor'))).toBe(true);
  });

  describe('block puzzles', () => {
    // A hall with a block on the plate's row. Pushed north against the wall it can never come back.
    const rows = [
      '##########',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '##########',
    ];
    const objs = [
      { x: 3, y: 2, kind: 'fixture.block_puzzle' },
      { x: 7, y: 2, kind: 'fixture.plate_puzzle' },
    ];
    const dungeon = (extra: Partial<DungeonRoom>): DungeonDef => ({
      id: 'dungeon.t',
      skills: [],
      entrance: 'h',
      rooms: [room('h', rows, objs, { start: { x: 1, y: 4 }, ...extra })],
      edges: [],
    });

    it('rejects a block that can be pushed into a corner that seals the plate', () => {
      const errors = validateDungeon(dungeon({}));
      expect(errors.some((e) => e.includes('soft lock') && e.includes('room h'))).toBe(true);
    });

    it('accepts the same room when it resets on entry', () => {
      expect(validateDungeon(dungeon({ reset: true }))).toEqual([]);
    });

    it('accepts a room where no push can seal the plate', () => {
      // One row wide with the plate at the far end: the block can only go along the row.
      const d: DungeonDef = {
        ...dungeon({}),
        rooms: [
          room(
            'h',
            ['#########', '#.......#', '#########'],
            [
              { x: 3, y: 1, kind: 'fixture.block_puzzle' },
              // The plate is at the end of the row, so a block can never be pushed past it.
              { x: 7, y: 1, kind: 'fixture.plate_puzzle' },
            ],
            { start: { x: 1, y: 1 } },
          ),
        ],
      };
      expect(validateDungeon(d)).toEqual([]);
    });

    it('rejects a block puzzle that cannot be solved at all', () => {
      const d: DungeonDef = {
        ...dungeon({}),
        rooms: [
          room(
            'h',
            ['#########', '#.......#', '#########'],
            [
              // The plate is on the wrong side of the block, which cannot be pulled.
              { x: 5, y: 1, kind: 'fixture.block_puzzle' },
              { x: 2, y: 1, kind: 'fixture.plate_puzzle' },
            ],
            { start: { x: 1, y: 1 } },
          ),
        ],
      };
      expect(validateDungeon(d).some((e) => e.includes('cannot be solved'))).toBe(true);
    });
  });
});
