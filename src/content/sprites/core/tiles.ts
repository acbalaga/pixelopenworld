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

const baseTile = (id: string): TileDef => ({ ...ground, id, sprite: id, frame: 'base' });
const solidTile = (id: string, extra: Partial<TileDef> = {}): TileDef => ({
  id,
  sprite: id,
  frame: 'base',
  layer: 'object',
  collision: 'full',
  tags: [],
  ...extra,
});

/** Paving, bridge, cave rock, buildings, fences and props for the slice map. */
const slice: TileDef[] = [
  baseTile('tile.cobble_0'),
  baseTile('tile.cobble_1'),
  baseTile('tile.planks_0'),
  baseTile('tile.cave_floor_0'),
  baseTile('tile.cave_floor_1'),
  solidTile('tile.cave_wall_top'),
  solidTile('tile.cave_wall_face'),
  solidTile('tile.torch', { frame: 'flame', animated: true }),
  solidTile('tile.cave_arch', { collision: 'none' }),
  ...(['red', 'slate'] as const).flatMap((c) =>
    ([0, 1] as const).flatMap((row) =>
      (['l', 'm', 'r'] as const).map((col) => solidTile(`tile.roof_${c}_${row}${col}`)),
    ),
  ),
  ...['plaster', 'window', 'door', 'shop'].map((k) => solidTile(`tile.wall_${k}`)),
  ...['h', 'v', 'post'].map((k) => solidTile(`tile.fence_${k}`)),
  solidTile('tile.crate', { tags: ['flammable'] }),
  solidTile('tile.barrel', { tags: ['flammable'] }),
  solidTile('tile.sign_post', { tags: ['flammable'] }),
  solidTile('tile.board', { tags: ['flammable'] }),
];

/** Dawnmeadow's own tiles (M4-04): thatch and timber, the town wall, barley, hay and reeds. */
const dawnmeadow: TileDef[] = [
  ...([0, 1] as const).flatMap((row) =>
    (['l', 'm', 'r'] as const).map((col) => solidTile(`tile.roof_thatch_${row}${col}`)),
  ),
  ...['', '_window', '_door'].map((k) => solidTile(`tile.wall_timber${k}`)),
  ...['h', 'v', 'post'].map((k) => solidTile(`tile.wall_stone_${k}`)),
  ...[0, 1].map((v): TileDef => ({
    id: `tile.crop_barley_${v}`,
    sprite: `tile.crop_barley_${v}`,
    frame: 'base',
    layer: 'detail',
    collision: 'none',
    tags: ['flammable'],
  })),
  solidTile('tile.hay_bale', { tags: ['flammable'] }),
  ...[0, 1].map((v) => solidTile(`tile.reeds_${v}`, { collision: 'none', tags: ['flammable'] })),
];

/** Terrain, props and generated nature tiles for the core group. */
export const CORE_TILES: readonly TileDef[] = [...terrain, ...generated, ...slice, ...dawnmeadow];
