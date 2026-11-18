import { Terrain, tilesetId } from './tileset';

/**
 * Fill tables (POW-M4-02): what a biome looks like where no stamp, road or river says otherwise.
 * Rates are the chance per tile, from a seeded hash, so a bake is repeatable. Tile ids are tile
 * definition ids. Content, so it is data here and not in the systems that read it.
 */
export interface ScatterEntry {
  /** Object layer tile (a trunk, a bush, a rock). */
  object?: string;
  /** Overhead layer tile (a canopy), drawn over the avatar. */
  overhead?: string;
  /** Detail layer tile (a flower). */
  detail?: string;
  weight: number;
}

export interface FillBiome {
  id: string;
  ground: number;
  /** Chance a tile gets a detail (flowers). */
  detailRate: number;
  details: readonly ScatterEntry[];
  /** Chance a tile gets an object (trees, bushes, rocks). */
  objectRate: number;
  objects: readonly ScatterEntry[];
}

const tree = (name: string, weight: number): ScatterEntry => ({
  object: `tile.tree_${name}_trunk`,
  overhead: `tile.tree_${name}_canopy`,
  weight,
});
const flower = (name: string, weight: number): ScatterEntry => ({
  detail: `tile.flower_${name}_0`,
  weight,
});

export const FILL_BIOMES: Readonly<Record<string, FillBiome>> = {
  meadow: {
    id: 'meadow',
    ground: Terrain.Grass,
    detailRate: 0.06,
    details: [flower('white', 3), flower('rose', 2), flower('ochre', 2), flower('violet', 1)],
    objectRate: 0.025,
    objects: [
      tree('oak_0', 3),
      tree('oak_1', 3),
      tree('birch_0', 1),
      { object: 'tile.bush_green_0', weight: 3 },
      { object: 'tile.bush_berry_0', weight: 1 },
      { object: 'tile.rock', weight: 1 },
    ],
  },
  woodland: {
    id: 'woodland',
    ground: Terrain.Grass,
    detailRate: 0.02,
    details: [flower('white', 2), flower('violet', 1)],
    objectRate: 0.16,
    objects: [
      tree('oak_0', 4),
      tree('oak_1', 4),
      tree('birch_0', 2),
      tree('autumn_0', 1),
      { object: 'tile.bush_green_0', weight: 2 },
    ],
  },
  pinewood: {
    id: 'pinewood',
    ground: Terrain.Grass,
    detailRate: 0.01,
    details: [flower('violet', 1)],
    objectRate: 0.14,
    objects: [tree('pine_0', 4), tree('pine_1', 4), { object: 'tile.rock', weight: 1 }],
  },
  scrub: {
    id: 'scrub',
    ground: Terrain.Dirt,
    detailRate: 0.01,
    details: [flower('ochre', 1)],
    objectRate: 0.05,
    objects: [
      { object: 'tile.bush_dry_0', weight: 4 },
      tree('dead_0', 1),
      { object: 'tile.rock', weight: 2 },
    ],
  },
};

/** Tiles a drop in elevation turns into. The face is the wall you see from the south. */
export const CLIFF_TILES = { face: 'tile.cave_wall_face', top: 'tile.cave_wall_top' } as const;

/** Resolved tileset ids, so the baker does not look names up per tile. */
export function scatterIds(e: ScatterEntry): { object: number; overhead: number; detail: number } {
  return {
    object: e.object ? tilesetId(e.object) : 0,
    overhead: e.overhead ? tilesetId(e.overhead) : 0,
    detail: e.detail ? tilesetId(e.detail) : 0,
  };
}
