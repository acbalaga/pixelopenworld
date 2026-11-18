import type { StampV2 } from '../../../sim/world/stamp';
import { Terrain, tilesetId } from '../tileset';

/** A small house with a door onto a cellar. The anchor is the door tile. */
export const SAMPLE_HOUSE: StampV2 = {
  version: 2,
  id: 'sample_house',
  legend: {
    c: { ground: Terrain.Cobble },
    W: { ground: Terrain.Cobble, object: tilesetId('tile.wall_plaster') },
    N: { ground: Terrain.Cobble, object: tilesetId('tile.wall_window') },
    D: { ground: Terrain.Cobble, object: tilesetId('tile.wall_door') },
    r: { ground: Terrain.Cobble, overhead: tilesetId('tile.roof_red_0m') },
  },
  layers: {
    ground: ['cccccccc', 'cccccccc', 'cccccccc', 'cccccccc', 'cccccccc'],
    object: ['WWNWWNWW', 'WWWWWWWW', 'WWWWWWWW', 'WWWDWWWW', '        '],
    overhead: ['rrrrrrrr', 'rrrrrrrr', '        ', '        ', '        '],
    detail: ['        ', '        ', '        ', '   @    ', '        '],
  },
  variants: {
    plain: { overhead: ['        ', '        ', '        ', '        ', '        '] },
  },
  rotate: 'mirror',
  doors: [{ x: 3, y: 3, interior: 'cellar' }],
};

/** A cellar: a small cave room reached from the house. */
export const SAMPLE_CELLAR: StampV2 = {
  version: 2,
  id: 'sample_cellar',
  legend: {
    f: { ground: Terrain.Cave },
    '#': { ground: Terrain.Cave, object: tilesetId('tile.cave_wall_top') },
  },
  layers: {
    ground: ['ffffffff', 'ffffffff', 'ffffffff', 'ffffffff', 'ffffffff', 'ffffffff'],
    object: ['########', '#      #', '#      #', '#      #', '#      #', '###  ###'],
  },
};
