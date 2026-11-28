/**
 * Furniture (POW-M6-07, design/13 section 6). The first twelve pieces of the sixty. A piece has a
 * footprint in tiles (before rotation), a layer, and sometimes a function. Pieces are items, so they
 * sit in the Bag's "other" filter until placed. M6-13 adds the rest.
 *
 * Layers: `floor` pieces stand on the floor and block it, `rug` pieces lie under them, `wall` pieces
 * hang on the wall row above the floor.
 */
export type PieceLayer = 'floor' | 'rug' | 'wall';
/** What a piece does. `bed` gives Rested like the inn bed, `storage` is a chest, `mirror` changes your look. */
export type PieceFunction = 'bed' | 'storage' | 'mirror';

export interface PieceDef {
  id: string;
  /** The item it is in the Bag: `item.furn_<id>`. */
  item: string;
  /** Tiles across and down at rotation 0. */
  w: number;
  h: number;
  layer: PieceLayer;
  fn?: PieceFunction;
  /** Coin value. Buying costs 150 percent (`SHOP_BALANCE.buyPct`). */
  value: number;
  /** What the carpentry makes it from: the woodworking recipe's ingredients. Absent: bought only. */
  made?: readonly (readonly [item: string, qty?: number])[];
}

const piece = (
  id: string,
  w: number,
  h: number,
  layer: PieceLayer,
  value: number,
  more: Partial<PieceDef> = {},
): PieceDef => ({ id, item: `item.furn_${id}`, w, h, layer, value, ...more });

export const PIECES: readonly PieceDef[] = [
  piece('straw_bed', 1, 2, 'floor', 12, {
    fn: 'bed',
    made: [
      ['item.oak_plank', 2],
      ['item.flax_fiber', 2],
    ],
  }),
  piece('small_chest', 1, 1, 'floor', 14, {
    fn: 'storage',
    made: [
      ['item.oak_plank', 2],
      ['item.copper_ingot', 2],
    ],
  }),
  piece('stool', 1, 1, 'floor', 5, { made: [['item.oak_plank']] }),
  piece('small_table', 2, 1, 'floor', 10, { made: [['item.oak_plank', 2], ['item.oak_log']] }),
  piece('candle', 1, 1, 'floor', 3),
  piece('lantern', 1, 1, 'floor', 9, { made: [['item.copper_ingot']] }),
  piece('rug_red', 2, 2, 'rug', 12, { made: [['item.wool_cloth', 2], ['item.berry_red']] }),
  piece('rug_blue', 2, 2, 'rug', 12, { made: [['item.wool_cloth', 2], ['item.berry_blue']] }),
  piece('potted_fern', 1, 1, 'floor', 6),
  piece('mirror', 1, 1, 'wall', 16, { fn: 'mirror' }),
  piece('clock', 1, 1, 'wall', 18),
  piece('wardrobe', 1, 2, 'floor', 24, {
    fn: 'storage',
    made: [['item.oak_plank', 3], ['item.thread_spool']],
  }),
];

export const PIECE_BY_ID: Readonly<Record<string, PieceDef>> = Object.fromEntries(
  PIECES.map((p) => [p.id, p]),
);
export const PIECE_BY_ITEM: Readonly<Record<string, PieceDef>> = Object.fromEntries(
  PIECES.map((p) => [p.item, p]),
);

/** The room's own bed and chest: placed from the start, and counted as made by the integrity rules. */
export const STARTER_PIECES: readonly string[] = ['straw_bed', 'small_chest'];

/**
 * All twelve pieces in the inn room at once: for the screenshot and a test that the layout follows
 * the rules. Each is `[piece, x, y, rot]` on the 4 by 4 floor, wall pieces at y -1.
 */
export const FULL_INN_LAYOUT: readonly (readonly [string, number, number, number])[] = [
  ['rug_blue', 0, 0, 0],
  ['rug_red', 2, 2, 0],
  ['wardrobe', 0, 0, 0],
  ['small_chest', 2, 0, 0],
  ['straw_bed', 3, 0, 0],
  ['stool', 0, 2, 0],
  ['potted_fern', 0, 3, 0],
  ['small_table', 2, 2, 0],
  ['candle', 2, 3, 0],
  ['lantern', 3, 3, 0],
  ['mirror', 0, -1, 0],
  ['clock', 2, -1, 0],
];
