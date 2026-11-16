import type { BushKind, FlowerColor, TreeSpecies } from '../sprites/gen/nature';

/** A weighted choice list. */
export type Weighted<T> = readonly (readonly [T, number])[];

/** What grows where. Density is per 100x100 px of world. Placement picks variants by seed. */
export interface Biome {
  id: string;
  trees: Weighted<TreeSpecies>;
  bushes: Weighted<BushKind>;
  flowers: Weighted<FlowerColor>;
  treeDensity: number;
  bushDensity: number;
  flowerDensity: number;
}

/** Biomes by theme. The first set is the demo's; regions pick from these later. */
export const BIOMES = {
  temperate: {
    id: 'temperate',
    trees: [
      ['oak', 6],
      ['birch', 3],
      ['autumn', 0.3],
    ],
    bushes: [
      ['green', 5],
      ['berry', 1.5],
    ],
    flowers: [
      ['white', 3],
      ['ochre', 2],
      ['rose', 1],
      ['violet', 1],
    ],
    treeDensity: 0.35,
    bushDensity: 0.5,
    flowerDensity: 1.2,
  },
  pine_forest: {
    id: 'pine_forest',
    trees: [
      ['pine', 8],
      ['birch', 1],
      ['dead', 0.4],
    ],
    bushes: [
      ['green', 3],
      ['dry', 1],
    ],
    flowers: [
      ['violet', 2],
      ['white', 1],
    ],
    treeDensity: 0.7,
    bushDensity: 0.25,
    flowerDensity: 0.3,
  },
  autumn_grove: {
    id: 'autumn_grove',
    trees: [
      ['autumn', 7],
      ['oak', 2],
      ['birch', 1.5],
    ],
    bushes: [
      ['autumn', 4],
      ['berry', 1],
      ['dry', 1],
    ],
    flowers: [
      ['ochre', 3],
      ['rose', 0.5],
    ],
    treeDensity: 0.45,
    bushDensity: 0.55,
    flowerDensity: 0.6,
  },
  blossom_grove: {
    id: 'blossom_grove',
    trees: [
      ['blossom', 7],
      ['birch', 2],
    ],
    bushes: [
      ['blossom', 4],
      ['green', 2],
    ],
    flowers: [
      ['rose', 4],
      ['white', 3],
      ['violet', 1],
    ],
    treeDensity: 0.4,
    bushDensity: 0.45,
    flowerDensity: 1.6,
  },
  wasteland: {
    id: 'wasteland',
    trees: [
      ['dead', 6],
      ['pine', 0.5],
    ],
    bushes: [['dry', 6]],
    flowers: [],
    treeDensity: 0.2,
    bushDensity: 0.4,
    flowerDensity: 0,
  },
} as const satisfies Record<string, Biome>;
