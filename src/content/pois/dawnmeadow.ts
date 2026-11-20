import type { PoiDef } from './types';

const poi = (
  id: string,
  kind: PoiDef['kind'],
  x: number,
  y: number,
  extra: Partial<PoiDef> = {},
): PoiDef => ({ id: `poi.${id}`, kind, region: 'dawnmeadow', x, y, estMinutes: 4, ...extra });

/**
 * Dawnmeadow's points of interest (regions/01-dawnmeadow section 12). Part 1 of POW-M4-11 places
 * the eight places that hold a manual, which M4-15 left as stand-in chests outside the square.
 * Each is where design/11's Sources table says its manual is.
 *
 * Coordinates are region tiles. The Hearthford ones are inside the town's stamp (origin 164, 164).
 */
export const DAWNMEADOW_POIS: readonly PoiDef[] = [
  // Shrines.
  poi('river_shrine', 'shrine', 235, 205, { manual: 'item.manual_splash' }),
  poi('wayside_chapel', 'shrine', 177, 268, { manual: 'item.manual_mend' }),
  poi('windmill_hill_cairn', 'shrine', 276, 80, { manual: 'item.manual_gust' }),
  poi('quarry_altar', 'shrine', 182, 52, { manual: 'item.manual_stone_fist' }),
  // Oddities.
  poi('burnt_shed', 'oddity', 230, 235, { manual: 'item.manual_kindling' }),
  poi('mill_loft', 'oddity', 282, 112, { manual: 'item.manual_light_feet' }),
  // The inn cellar is mini-dungeon m1 (a later part of M4-11). Until it stands, the songsheet is
  // in a chest at the back of the inn yard, by the cellar door's place.
  poi('inn_songsheet', 'oddity', 168, 216, { manual: 'item.manual_road_songs' }),
  poi('guardhouse_notes', 'oddity', 176, 200, { manual: 'item.manual_lunge' }),
];

/** The chest fixture that holds a POI's manual. */
export const poiChest = (manual: string): string =>
  `fixture.chest_${manual.replace(/^item\./, '')}`;
