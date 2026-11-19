import type { RegionSpec } from '../types';

const CELLS = 24; // 6 x 6 chunks of 32 tiles, in cells of 8 tiles
const biomes = Array.from({ length: CELLS }, (_r, y) =>
  Array.from({ length: CELLS }, (_c, x) =>
    (x + y) % 7 < 2 ? 'w' : (x * 3 + y) % 11 < 2 ? 'p' : 'm',
  ).join(''),
);

/**
 * Dev only (ids starting `dev_` are served by the dev server and left out of the production
 * build). A 6 x 6 chunk region with mixed biomes, a road and a river, big enough that crossing
 * it streams chunks in and out. The streaming frame-rate and offline checks run on it.
 */
export const DEV_STRESS_REGION: RegionSpec = {
  id: 'dev_stress',
  seed: 9001,
  chunks: { w: 6, h: 6 },
  biomeLegend: { m: 'meadow', w: 'woodland', p: 'pinewood' },
  biomes,
  elevation: Array.from({ length: CELLS }, () => '0'.repeat(CELLS)),
  roads: {
    nodes: { west: { x: 4, y: 96 }, east: { x: 187, y: 96 } },
    edges: [{ a: 'west', b: 'east', width: 3, surface: 'dirt' }],
  },
  rivers: [
    {
      id: 'brook',
      width: 3,
      points: [
        { x: 90, y: 0 },
        { x: 96, y: 60 },
        { x: 88, y: 130 },
        { x: 94, y: 191 },
      ],
    },
  ],
  placements: [{ kind: 'node.oak_tree', x: 10, y: 12 }],
  zones: [],
  interiors: [],
  landmarks: [],
  wakePoints: [{ id: 'stress_wake', x: 8, y: 90 }],
  waystones: [],
};
