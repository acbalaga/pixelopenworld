import { FONT_SPRITES } from '../fonts';
import { propRock } from './core/props';
import { CORE_TILES } from './core/tiles';
import { tileDirt, tileGrass0, tileGrass1, tileGrass2, tileWater } from './core/terrain';
import { autotileSprite } from './gen/autotile';
import { creatureSprites } from './gen/creatures';
import { dollLayers } from './gen/dolls';
import { ITEM_ICONS } from './gen/items';
import { natureSprites } from './gen/nature';
import { dawnmeadowSprites } from './gen/dawnmeadow';
import { worldSprites } from './gen/world';
import { UI_ICONS } from './ui/icons';
import { MARK_SPRITES } from './ui/marks';
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
  autotileSprite({ id: 'auto.dirt', source: tileDirt, frames: ['base'], rim: 4 }),
  autotileSprite({ id: 'auto.water', source: tileWater, frames: ['flow_0', 'flow_1'], rim: 12 }),
  ...natureSprites(),
  ...worldSprites(),
  ...dawnmeadowSprites(),
  ...dollLayers(),
  ...creatureSprites(),
  uiPanel,
  ...UI_ICONS,
  ...MARK_SPRITES,
  ...ITEM_ICONS,
  ...FONT_SPRITES,
];

/** Every tile definition. */
export const TILES: readonly TileDef[] = CORE_TILES;
