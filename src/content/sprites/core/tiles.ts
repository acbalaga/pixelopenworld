import type { TileDef } from '../types';

const ground = { layer: 'ground', collision: 'none', tags: [] } as const;

/** Terrain and prop tiles for the core group. */
export const CORE_TILES: readonly TileDef[] = [
  {
    ...ground,
    id: 'tile.grass_0',
    sprite: 'tile.grass_0',
    frame: 'base',
    tags: ['diggable', 'flammable'],
  },
  {
    ...ground,
    id: 'tile.grass_1',
    sprite: 'tile.grass_1',
    frame: 'base',
    tags: ['diggable', 'flammable'],
  },
  {
    ...ground,
    id: 'tile.grass_2',
    sprite: 'tile.grass_2',
    frame: 'base',
    tags: ['diggable', 'flammable'],
  },
  { ...ground, id: 'tile.dirt', sprite: 'tile.dirt', frame: 'base', tags: ['diggable'] },
  {
    ...ground,
    id: 'tile.water',
    sprite: 'tile.water',
    frame: 'flow',
    animated: true,
    collision: 'water',
  },
  {
    id: 'tile.rock',
    sprite: 'prop.rock',
    frame: 'base',
    layer: 'object',
    collision: 'full',
    tags: [],
  },
  {
    id: 'tile.tree_trunk',
    sprite: 'prop.tree_trunk',
    frame: 'base',
    layer: 'object',
    collision: 'full',
    tags: ['flammable'],
  },
  {
    id: 'tile.tree_canopy',
    sprite: 'prop.tree_canopy',
    frame: 'base',
    layer: 'overhead',
    collision: 'none',
    tags: ['flammable'],
  },
];
