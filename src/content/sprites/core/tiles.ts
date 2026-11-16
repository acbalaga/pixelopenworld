import type { TileDef } from '../types';
import { BUSH_KINDS, FLOWER_COLORS, TREE_SPECIES, VARIANTS } from '../gen/nature';

const ground = { layer: 'ground', collision: 'none', tags: [] } as const;

const terrain: TileDef[] = [
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
];

const generated: TileDef[] = [];
for (const sp of TREE_SPECIES) {
  const tags = sp === 'dead' ? (['flammable'] as const) : (['flammable'] as const);
  for (let v = 0; v < VARIANTS; v++) {
    generated.push({
      id: `tile.tree_${sp}_${v}_trunk`,
      sprite: `prop.tree_${sp}_${v}_trunk`,
      frame: 'base',
      layer: 'object',
      collision: 'full',
      tags,
    });
    generated.push({
      id: `tile.tree_${sp}_${v}_canopy`,
      sprite: `prop.tree_${sp}_${v}_canopy`,
      frame: 'base',
      layer: 'overhead',
      offset: [0, -8],
      collision: 'none',
      tags,
    });
  }
}
for (const k of BUSH_KINDS) {
  for (let v = 0; v < VARIANTS; v++) {
    generated.push({
      id: `tile.bush_${k}_${v}`,
      sprite: `prop.bush_${k}_${v}`,
      frame: 'base',
      layer: 'object',
      collision: 'half_bottom',
      tags: ['flammable'],
    });
  }
}
for (const c of FLOWER_COLORS) {
  for (let v = 0; v < 2; v++) {
    generated.push({
      id: `tile.flower_${c}_${v}`,
      sprite: `prop.flower_${c}_${v}`,
      frame: 'base',
      layer: 'detail',
      collision: 'none',
      tags: ['flammable'],
    });
  }
}

/** Terrain, props and generated nature tiles for the core group. */
export const CORE_TILES: readonly TileDef[] = [...terrain, ...generated];
