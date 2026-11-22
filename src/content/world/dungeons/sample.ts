import type { StampV2 } from '../../../sim/world/stamp';
import { Terrain, tilesetId } from '../tileset';
import type { DungeonDef, DungeonRoom } from './types';

/** A walled cave room from ASCII rows: `#` is wall, anything else is floor. */
function cave(
  id: string,
  rows: readonly string[],
  objects: StampV2['objects'],
  extra: Partial<DungeonRoom> = {},
): DungeonRoom {
  return {
    id,
    stamp: {
      version: 2,
      id: `sample_${id}`,
      legend: {
        '.': { ground: Terrain.Cave },
        '#': { ground: Terrain.Cave, object: tilesetId('tile.cave_wall_top') },
      },
      layers: {
        ground: rows.map((r) => '.'.repeat(r.length)),
        object: rows.map((r) => [...r].map((c) => (c === '#' ? '#' : ' ')).join('')),
      },
      ...(objects ? { objects } : {}),
    },
    ...extra,
  };
}

/**
 * The sample dungeon: the template for real ones and the validator's passing case. It teaches the
 * block and plate in B, twists it with a drop and a locked door, and tests it in the boss room.
 * The entrance A joins B, B holds the key to C (the boss) and a drop into D, D joins A again, and
 * C has a shortcut back to A. Athletics offers a second way into C that skips the key.
 */
export const SAMPLE_DUNGEON: DungeonDef = {
  id: 'dungeon.sample',
  skills: ['skill.athletics'],
  entrance: 'a',
  boss: 'boss.sample',
  rooms: [
    cave(
      'a',
      [
        '############',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '######..####',
      ],
      [],
      { start: { x: 5, y: 3 } },
    ),
    cave(
      'b',
      [
        '############',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '############',
      ],
      [
        { x: 4, y: 2, kind: 'fixture.block_puzzle' },
        { x: 8, y: 2, kind: 'fixture.plate_puzzle' },
        { x: 3, y: 4, kind: 'fixture.chest_key' },
        { x: 9, y: 4, kind: 'fixture.drop_hole' },
        { x: 1, y: 4, kind: 'fixture.reset_post' },
      ],
      { keys: ['item.old_key'], reset: true },
    ),
    cave(
      'c',
      [
        '############',
        '#..........#',
        '#..........#',
        '#..........#',
        '#..........#',
        '############',
      ],
      [],
    ),
    cave('d', ['########', '#......#', '#......#', '########'], []),
  ],
  edges: [
    { from: 'a', to: 'b', kind: 'open', at: { x: 6, y: 4 }, arrive: { x: 1, y: 1 } },
    {
      from: 'b',
      to: 'c',
      kind: 'locked',
      key: 'item.old_key',
      at: { x: 10, y: 1 },
      arrive: { x: 1, y: 1 },
    },
    {
      from: 'a',
      to: 'c',
      kind: 'open',
      skill: 'skill.athletics',
      at: { x: 1, y: 1 },
      arrive: { x: 1, y: 2 },
    },
    { from: 'b', to: 'd', kind: 'oneWay', at: { x: 9, y: 4 }, arrive: { x: 1, y: 1 } },
    { from: 'd', to: 'a', kind: 'open', at: { x: 6, y: 1 }, arrive: { x: 5, y: 1 } },
    { from: 'c', to: 'a', kind: 'shortcut', at: { x: 10, y: 4 }, arrive: { x: 9, y: 4 } },
  ],
};
