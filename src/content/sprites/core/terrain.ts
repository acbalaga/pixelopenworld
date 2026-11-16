import type { SpriteDef } from '../types';

/** Terrain tile grass_0. No outline, light from the top left. */
export const tileGrass0: SpriteDef = {
  id: 'tile.grass_0',
  group: 'core',
  size: [16, 16],
  origin: [0, 0],
  key: { '.': null, h: 8, i: 9, j: 10, l: 11 },
  frames: {
    base: [
      'jiiiiiihijiiijih',
      'iiiiiiiiiiiiiiih',
      'iiiijiiiiiiiiiii',
      'iiiiiijijiiiijii',
      'iiiiiiiiiiiiijii',
      'iiihihiiiiiiihii',
      'iiiiiiiiiiiijlii',
      'iiiijiiijiijiiij',
      'iiiihiiiiiiiiiii',
      'iiiiijiiijiiiiii',
      'iiijiiiiihiiiiii',
      'iiiiiiiiiiihhiii',
      'iiiiiiilihiiiiil',
      'iiiiiiiiiiiijiii',
      'jihiiiijiiiiiiij',
      'iliiiiiiiiiiiiii',
    ],
  },
};

/** Terrain tile grass_1. No outline, light from the top left. */
export const tileGrass1: SpriteDef = {
  id: 'tile.grass_1',
  group: 'core',
  size: [16, 16],
  origin: [0, 0],
  key: { '.': null, h: 8, i: 9, j: 10, l: 11 },
  frames: {
    base: [
      'iiiiiiiiiiiiiiii',
      'iiihiiiijiiiiiii',
      'ijiiiiiiiiiiiiii',
      'iiiiiiihiiiiiiii',
      'iiiijiiiiiiiiiii',
      'jjijhjiiiijiiiji',
      'hiihiiiijhiiiiii',
      'iiiiiiijiiiiiiii',
      'ihiiiliiiiiiiiii',
      'iiiiijiiiiiiijih',
      'iihiiiiliiiiihji',
      'jijijiiiiiijijlh',
      'iiiiiiiiiiiiijii',
      'iiiiiiiiihiijiii',
      'iiiiijiiiiiljiii',
      'iiiiiiijliiiiili',
    ],
  },
};

/** Terrain tile grass_2. No outline, light from the top left. */
export const tileGrass2: SpriteDef = {
  id: 'tile.grass_2',
  group: 'core',
  size: [16, 16],
  origin: [0, 0],
  key: { '.': null, h: 8, i: 9, j: 10, l: 11 },
  frames: {
    base: [
      'iijiiiiiiilijiii',
      'iiihijihiiiiiiii',
      'iijiihiiiiihiiih',
      'iihiiiiiilljiiii',
      'ijiiiiijiiiijhji',
      'iijiiiiiliiiiiii',
      'iiiiiiijiiiiiiij',
      'iiiiiiiiiiiiijii',
      'jiiiiiliiihiiiij',
      'hjiiiiiiiijiiiii',
      'iiiiiiiiiihiiiii',
      'iiiiiiiiiiiijiii',
      'ihiiiiiiiiiiijij',
      'iiiiiiiijjiiihii',
      'iiiiiiiiiiiiiiii',
      'iiliiiiiiiijiiij',
    ],
  },
};

/** Terrain tile dirt. No outline, light from the top left. */
export const tileDirt: SpriteDef = {
  id: 'tile.dirt',
  group: 'core',
  size: [16, 16],
  origin: [0, 0],
  key: { '.': null, d: 4, e: 5, f: 6, g: 7 },
  frames: {
    base: [
      'feeeeegeeeeeeeee',
      'dfeeeeeeeeeeeeee',
      'feeefeeeeedefdee',
      'eeeeefedeeeegeee',
      'eeedeeeeeeeeeeee',
      'eeeeeeeeeeeeeefe',
      'eeeeedfeeeeeeede',
      'eeeeeefeeeeeeeee',
      'eeeeeedeeeeeeefe',
      'eeefeeefgeeeeefe',
      'eeeeeeeefdeeeeee',
      'eeeeeeeeeeeeeeee',
      'efefeeeeeeeedeee',
      'deeedeeeeeeegeee',
      'feeeeeeeeefeeefe',
      'edeeefeeefeeeede',
    ],
  },
};

/** Water, two frames on the global timer. */
export const tileWater: SpriteDef = {
  id: 'tile.water',
  group: 'core',
  size: [16, 16],
  origin: [0, 0],
  key: { '.': null, m: 12, n: 13, o: 14, p: 15 },
  frames: {
    flow_0: [
      'nnmnnnnnnnnnmnnn',
      'nnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnooo',
      'nnooonnnnnnnnnnn',
      'nnnnnnnmnnnnmnnn',
      'nnmnnnpnnnnnnnnn',
      'nnnnnnnmnooonnnn',
      'nnnnnnnnnnnnnnnn',
      'mnnnnnnnnnnnnnnm',
      'nmnnnnnnnnnnnnnn',
      'nnnnnnnnnnnpnnnn',
      'nnnnooonnnnnnnnn',
      'nnnnnnnnnnnnnmnm',
      'nnnnnnnnnnnnooon',
      'nnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnmnnnm',
    ],
    flow_1: [
      'nnmnnnnnnnnnmnnn',
      'nnnnnnnnnnnnnnnn',
      'nnooonnnnnnnnnnn',
      'nnnnnooonnnnnnnn',
      'nnnnnnnmnnnnmnnn',
      'nnmnnnnnnpnnnnnn',
      'nnnnnnnmnnnnooon',
      'nnnnnnnnnnnnnnnn',
      'mnnnnnnnnnnnnnnm',
      'nmnnnnnnnnnnnnnn',
      'nnnnnnnnnnnnnnpn',
      'nnnnnnnooonnnnnn',
      'nnnnnnnnnnnnnmnm',
      'nooonnnnnnnnnnnn',
      'nnnnnnnnnnnnnnnn',
      'nnnnnnnnnnnmnnnm',
    ],
  },
  anims: {
    flow: { frames: ['flow_0', 'flow_1'], fps: 2 },
  },
};
