import type { PoiDef } from './types';

const poi = (
  id: string,
  kind: PoiDef['kind'],
  x: number,
  y: number,
  extra: Partial<PoiDef> = {},
): PoiDef => ({ id: `poi.${id}`, kind, region: 'dawnmeadow', x, y, estMinutes: 4, ...extra });

/**
 * Dawnmeadow's points of interest (regions/01-dawnmeadow section 12). Part 1 of POW-M4-11 placed
 * the eight places that hold a manual (where design/11's Sources table says each is). Part 3 adds
 * the other 21 bar Old Fen's well, which stands with the Hermit's Well (m9).
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
  // Shrines, vistas, wrecks, hermits and puzzles with a shape of their own (stamps/pois.ts).
  poi('roadside_idol', 'shrine', 134, 187, { stamp: { id: 'poi_idol', x: 133, y: 185 } }),
  poi('tree_shrine', 'shrine', 101, 134, { stamp: { id: 'poi_tree_shrine', x: 98, y: 129 } }),
  poi('windmill_hill', 'vista', 287, 71, { stamp: { id: 'poi_vista', x: 285, y: 69 } }),
  poi('sea_cliffs', 'vista', 100, 318, { stamp: { id: 'poi_vista', x: 98, y: 316 } }),
  poi('crane_top', 'vista', 200, 46, { stamp: { id: 'poi_vista', x: 198, y: 44 } }),
  poi('lark_spring', 'vista', 278, 45, { stamp: { id: 'poi_vista', x: 276, y: 43 } }),
  poi('delta_lookout', 'vista', 324, 237, { stamp: { id: 'poi_vista', x: 322, y: 235 } }),
  poi('cart_in_the_ditch', 'wreck', 258, 195, { stamp: { id: 'poi_cart', x: 257, y: 194 } }),
  poi('fallen_tower', 'wreck', 140, 140, { stamp: { id: 'poi_fallen_tower', x: 137, y: 138 } }),
  poi('beached_boat', 'wreck', 307, 263, { stamp: { id: 'poi_beached_boat', x: 305, y: 261 } }),
  poi('burnt_barn', 'wreck', 251, 100, { stamp: { id: 'poi_burnt_barn', x: 248, y: 98 } }),
  poi('painter_cliffs', 'hermit', 66, 38, { stamp: { id: 'poi_painter', x: 65, y: 37 } }),
  poi('beekeeper', 'hermit', 306, 140, { stamp: { id: 'poi_beekeeper', x: 302, y: 137 } }),
  poi('travelers_camp', 'hermit', 339, 140, {
    stamp: { id: 'poi_travelers_camp', x: 337, y: 138 },
  }),
  poi('stone_circle', 'puzzle', 149, 266, { stamp: { id: 'poi_stone_circle', x: 144, y: 261 } }),
  poi('lever_pond', 'puzzle', 224, 135, { stamp: { id: 'poi_lever_pond', x: 221, y: 129 } }),
  poi('sundial', 'puzzle', 201, 239, { stamp: { id: 'poi_sundial', x: 199, y: 237 } }),
  poi('hedge_maze', 'puzzle', 142, 128, { stamp: { id: 'poi_hedge_maze', x: 137, y: 123 } }),
  poi('bell_stone', 'puzzle', 107, 201, { stamp: { id: 'poi_bell_stone', x: 106, y: 199 } }),
  poi('scarecrow_line', 'puzzle', 301, 106, {
    stamp: { id: 'poi_scarecrow_line', x: 301, y: 105 },
  }),
  // The Cairnmoor ring stands already (a stamp of its own), so its vista is a point in it.
  poi('cairnmoor_ring', 'vista', 47, 49),
];

/** The chest fixture that holds a POI's manual. */
export const poiChest = (manual: string): string =>
  `fixture.chest_${manual.replace(/^item\./, '')}`;
