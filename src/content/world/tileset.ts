import type { TileCollision } from '../sprites/types';

/** Terrain ids stored in the chunk ground layer. 0 means nothing. */
export const Terrain = { None: 0, Grass: 1, Dirt: 2, Water: 3 } as const;

/** How each terrain is drawn. Overlays are autotiled on top of the base grass. */
export interface TerrainInfo {
  id: number;
  key: string;
  collision: TileCollision;
  /** Overlay terrains draw a blob autotile sprite over the base. */
  overlay?: { sprite: string; phases: number };
}

export const TERRAINS: readonly TerrainInfo[] = [
  { id: Terrain.Grass, key: 'grass', collision: 'none' },
  { id: Terrain.Dirt, key: 'dirt', collision: 'none', overlay: { sprite: 'auto.dirt', phases: 1 } },
  {
    id: Terrain.Water,
    key: 'water',
    collision: 'water',
    overlay: { sprite: 'auto.water', phases: 2 },
  },
];

/** Sprite ids of the three grass variants, picked per tile by a hash. */
export const GRASS_VARIANTS: readonly string[] = ['tile.grass_0', 'tile.grass_1', 'tile.grass_2'];

/**
 * Tile ids for the detail, object and overhead layers. Id is index + 1 (0 is empty). Append only:
 * baked chunks store these numbers, so reordering would break them.
 */
export const TILESET: readonly string[] = [
  'tile.rock',
  'tile.tree_oak_0_trunk',
  'tile.tree_oak_0_canopy',
  'tile.tree_oak_1_trunk',
  'tile.tree_oak_1_canopy',
  'tile.tree_pine_0_trunk',
  'tile.tree_pine_0_canopy',
  'tile.tree_pine_1_trunk',
  'tile.tree_pine_1_canopy',
  'tile.tree_autumn_0_trunk',
  'tile.tree_autumn_0_canopy',
  'tile.tree_birch_0_trunk',
  'tile.tree_birch_0_canopy',
  'tile.tree_blossom_0_trunk',
  'tile.tree_blossom_0_canopy',
  'tile.tree_dead_0_trunk',
  'tile.tree_dead_0_canopy',
  'tile.bush_green_0',
  'tile.bush_berry_0',
  'tile.bush_dry_0',
  'tile.flower_white_0',
  'tile.flower_rose_0',
  'tile.flower_ochre_0',
  'tile.flower_violet_0',
];

/** Tile id for a tile definition id. Throws for unknown ids. */
export function tilesetId(defId: string): number {
  const i = TILESET.indexOf(defId);
  if (i < 0) throw new Error(`tile ${defId} is not in the tileset`);
  return i + 1;
}
