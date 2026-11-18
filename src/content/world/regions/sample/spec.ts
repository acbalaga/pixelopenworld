import type { RegionSpec } from '../types';

/**
 * The 2 x 2 chunk fixture the baker is tested on. It is not part of the game. It uses every
 * feature of the format once: two biomes, a plateau with a cliff, a road, a river with a bridge
 * where the road crosses, a stamp with a door to an interior, an object placement, a spawn zone.
 */
export const SAMPLE_REGION: RegionSpec = {
  id: 'sample',
  seed: 4242,
  chunks: { w: 2, h: 2 },
  biomeLegend: { m: 'meadow', w: 'woodland', p: 'pinewood', s: 'scrub' },
  // 8 x 8 cells of 8 tiles.
  biomes: [
    'mmmmwwww',
    'mmmmwwww',
    'mmmmwwpp',
    'mmmmmmpp',
    'ssmmmmmm',
    'ssmmmmmm',
    'mmmmmmmm',
    'mmmmmmmm',
  ],
  elevation: [
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00000000',
    '00001111',
    '00001111',
    '00000000',
  ],
  roads: {
    nodes: { west: { x: 2, y: 30 }, hub: { x: 30, y: 30 }, east: { x: 61, y: 24 } },
    edges: [
      { a: 'west', b: 'hub', width: 2, surface: 'dirt' },
      { a: 'hub', b: 'east', width: 3, surface: 'cobble' },
    ],
  },
  rivers: [
    {
      id: 'brook',
      width: 3,
      points: [
        { x: 44, y: 0 },
        { x: 46, y: 20 },
        { x: 42, y: 40 },
        { x: 44, y: 63 },
      ],
    },
  ],
  placements: [
    { kind: 'house', stamp: 'sample_house', x: 24, y: 20 },
    { kind: 'node.oak_tree', x: 10, y: 12 },
    { kind: 'fixture.waystone', x: 28, y: 33 },
  ],
  zones: [
    {
      id: 'wood_edge',
      roster: 'roster.wood_edge',
      polygon: [
        { x: 34, y: 2 },
        { x: 62, y: 2 },
        { x: 62, y: 18 },
        { x: 34, y: 18 },
      ],
    },
  ],
  interiors: [{ id: 'cellar', stamp: 'sample_cellar' }],
  landmarks: [{ id: 'old_oak', x: 10, y: 12 }],
  wakePoints: [{ id: 'sample_wake', x: 20, y: 34 }],
  waystones: [{ id: 'sample_stone', x: 28, y: 33 }],
};
