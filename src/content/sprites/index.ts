import { charPlaceholderHumanoid } from './core/humanoid';
import { propRock, propTreeCanopy, propTreeTrunk } from './core/props';
import { CORE_TILES } from './core/tiles';
import { tileDirt, tileGrass0, tileGrass1, tileGrass2, tileWater } from './core/terrain';
import type { SpriteDef, TileDef } from './types';

/** Every sprite, in a fixed order. The bake sorts by id, so order here is for humans. */
export const SPRITES: readonly SpriteDef[] = [
  tileGrass0,
  tileGrass1,
  tileGrass2,
  tileDirt,
  tileWater,
  propRock,
  propTreeTrunk,
  propTreeCanopy,
  charPlaceholderHumanoid,
];

/** Every tile definition. */
export const TILES: readonly TileDef[] = CORE_TILES;
