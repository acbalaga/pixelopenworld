import { FONT_SPRITES } from '../fonts';
import { propRock } from './core/props';
import { CORE_TILES } from './core/tiles';
import { tileDirt, tileGrass0, tileGrass1, tileGrass2, tileWater } from './core/terrain';
import { dollLayers } from './gen/dolls';
import { natureSprites } from './gen/nature';
import { uiPanel } from './ui/panel';
import type { SpriteDef, TileDef } from './types';

/** Every sprite. Hand-authored text grids plus seeded generators. The bake sorts by id. */
export const SPRITES: readonly SpriteDef[] = [
  tileGrass0,
  tileGrass1,
  tileGrass2,
  tileDirt,
  tileWater,
  propRock,
  ...natureSprites(),
  ...dollLayers(),
  uiPanel,
  ...FONT_SPRITES,
];

/** Every tile definition. */
export const TILES: readonly TileDef[] = CORE_TILES;
