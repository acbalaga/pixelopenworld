import type { Season } from '../balance/time';

/**
 * The 30 crops of design/13 section 2 (POW-M6-02). Data only: the sim reads it, the items and the
 * art are made from it. Ids are final once shipped, since saves name them.
 */

export type CropFamily = 'root' | 'leaf' | 'fruit' | 'grain' | 'herb';

/** Where a crop's seed comes from (design/13 section 2). A shop id, or the Market. */
export type SeedSource =
  | { shop: string }
  /** Sold by a person once friendship reaches `hearts` (POW-M6-09). On the Market until then. */
  | { person: string; hearts: number }
  | { market: true };

export interface CropDef {
  /** `crop.<name>`. */
  id: string;
  tier: 1 | 2 | 3 | 4;
  family: CropFamily;
  /** When it can be planted and when it grows. A crop out of season waits and never dies. */
  seasons: readonly Season[];
  /** In-game days from planting to ripe at full rate. */
  days: number;
  /** In-game days to fruit again after a harvest, or absent if a harvest clears the plot. */
  regrowDays?: number;
  /** The item a harvest gives. */
  result: string;
  /** The seed item that plants it. */
  seed: string;
  /** Four ripe plants in a square at soil 3 can merge into a giant (13 section 2.2). */
  giant?: true;
  /** Grows only in a shaded plot (the glowcap bed). */
  shade?: true;
  /** Farming points needed to plant it, when more than its tier asks (`FARMING.tierPoints`). */
  minPoints?: number;
  seedFrom: SeedSource;
  /** Coin value of one unit of the crop, and of one seed. Absent: the result item exists already. */
  value?: number;
  seedValue: number;
}

const ALL: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const NOT_WINTER: readonly Season[] = ['spring', 'summer', 'autumn'];

type Row = [
  name: string,
  tier: CropDef['tier'],
  family: CropFamily,
  seasons: readonly Season[],
  days: number,
  regrow: number | null,
  result: string | null,
  seedFrom: SeedSource,
  value: number | null,
  seedValue: number,
  extra?: Partial<CropDef>,
];

const shop = (id: string): SeedSource => ({ shop: id });
const MARKET: SeedSource = { market: true };

/** `result` null means `item.<name>`. `value` null means the item exists and keeps its value. */
const ROWS: readonly Row[] = [
  ['turnip', 1, 'root', ['spring', 'autumn'], 1, null, null, shop('shop.brin'), 5, 2],
  ['radish', 1, 'root', ['spring'], 1, null, null, shop('shop.brin'), 5, 2],
  ['potato', 1, 'root', ['spring', 'autumn'], 2, null, null, shop('shop.brin'), 7, 3],
  ['pea', 1, 'fruit', ['spring'], 2, 1, 'item.pea_pod', shop('shop.brin'), 4, 3],
  ['leek', 1, 'leaf', ['spring', 'autumn'], 2, null, null, shop('shop.brin'), 7, 3],
  [
    'flax',
    1,
    'grain',
    ['spring', 'summer'],
    2,
    null,
    'item.flax_fiber',
    shop('shop.brin'),
    null,
    2,
  ],
  ['sunwort', 1, 'herb', NOT_WINTER, 1, null, 'item.sunwort', shop('shop.ilse'), null, 2],
  ['dewmint', 1, 'herb', ['spring', 'summer'], 1, null, 'item.dewmint', shop('shop.ilse'), null, 2],
  ['wheat', 2, 'grain', ['summer', 'autumn'], 3, null, null, shop('shop.aldo'), 9, 4],
  ['barley', 2, 'grain', ['summer'], 3, null, null, shop('shop.aldo'), 9, 4],
  ['onion', 2, 'root', ['summer'], 2, null, null, shop('shop.brin'), 8, 4],
  ['carrot', 2, 'root', ['spring', 'autumn'], 2, null, null, shop('shop.brin'), 8, 4],
  ['cabbage', 2, 'leaf', ['autumn'], 3, null, null, shop('shop.tamsin'), 11, 5],
  ['tomato', 2, 'fruit', ['summer'], 3, 1, null, shop('shop.tamsin'), 7, 6],
  ['runner_bean', 2, 'fruit', ['summer'], 2, 1, 'item.bean', shop('shop.tamsin'), 6, 5],
  ['strawberry', 2, 'fruit', ['spring'], 3, 1, null, shop('shop.tamsin'), 8, 6],
  ['corn', 3, 'grain', ['summer'], 4, null, null, MARKET, 16, 8],
  [
    'pumpkin',
    3,
    'fruit',
    ['autumn'],
    4,
    null,
    null,
    { person: 'npc.farmer', hearts: 3 },
    20,
    9,
    { giant: true },
  ],
  ['pepper', 3, 'fruit', ['summer'], 3, 1, null, MARKET, 10, 9],
  ['garlic', 3, 'root', ['spring'], 3, null, null, shop('shop.hesper'), 14, 7],
  ['beet', 3, 'root', ['autumn'], 3, null, null, MARKET, 14, 7],
  ['hops', 3, 'herb', ['summer'], 4, 2, null, { person: 'npc.cook', hearts: 2 }, 12, 10],
  [
    'glowcap',
    3,
    'herb',
    ALL,
    3,
    null,
    'item.glowcap',
    { person: 'npc.herbalist', hearts: 2 },
    null,
    8,
    { shade: true },
  ],
  ['woad', 3, 'leaf', ['summer'], 3, null, 'item.woad_leaf', shop('shop.mara'), 14, 7],
  ['melon', 4, 'fruit', ['summer'], 5, null, null, MARKET, 34, 16, { giant: true }],
  ['saffron', 4, 'herb', ['autumn'], 5, null, null, MARKET, 40, 18],
  [
    'frost_kale',
    4,
    'leaf',
    ['winter'],
    4,
    null,
    'item.kale',
    { person: 'npc.farmer', hearts: 4 },
    24,
    14,
  ],
  ['frostroot', 4, 'root', ['winter'], 5, null, null, shop('shop.fen'), 28, 15],
  ['artichoke', 4, 'leaf', ['spring'], 5, null, null, MARKET, 30, 16],
  ['honeyvine', 4, 'fruit', ['autumn'], 6, 2, 'item.honeygrape', MARKET, 22, 20, { minPoints: 40 }],
];

export const CROP_LIST: readonly CropDef[] = ROWS.map(
  ([name, tier, family, seasons, days, regrow, result, seedFrom, value, seedValue, extra]) => ({
    id: `crop.${name}`,
    tier,
    family,
    seasons,
    days,
    ...(regrow !== null ? { regrowDays: regrow } : {}),
    result: result ?? `item.${name}`,
    seed: `item.seed_${name}`,
    seedFrom,
    ...(value !== null ? { value } : {}),
    seedValue,
    ...extra,
  }),
);

export const CROPS: Readonly<Record<string, CropDef>> = Object.fromEntries(
  CROP_LIST.map((c) => [c.id, c]),
);

/** The crop a seed item plants. */
export const CROP_BY_SEED: Readonly<Record<string, CropDef>> = Object.fromEntries(
  CROP_LIST.map((c) => [c.seed, c]),
);

/** The crop an item is the harvest of. */
export const CROP_BY_RESULT: Readonly<Record<string, CropDef>> = Object.fromEntries(
  CROP_LIST.map((c) => [c.result, c]),
);

/** Display names of the crops, for strings and art. */
export const CROP_NAMES: Readonly<Record<string, { crop: string; seed: string }>> = {
  'crop.turnip': { crop: 'Turnip', seed: 'Turnip Seeds' },
  'crop.radish': { crop: 'Radish', seed: 'Radish Seeds' },
  'crop.potato': { crop: 'Potato', seed: 'Seed Potatoes' },
  'crop.pea': { crop: 'Pea Pod', seed: 'Pea Seeds' },
  'crop.leek': { crop: 'Leek', seed: 'Leek Seeds' },
  'crop.flax': { crop: 'Flax Fiber', seed: 'Flax Seeds' },
  'crop.sunwort': { crop: 'Sunwort', seed: 'Sunwort Seeds' },
  'crop.dewmint': { crop: 'Dewmint', seed: 'Dewmint Seeds' },
  'crop.wheat': { crop: 'Wheat', seed: 'Wheat Seeds' },
  'crop.barley': { crop: 'Barley', seed: 'Barley Seeds' },
  'crop.onion': { crop: 'Onion', seed: 'Onion Sets' },
  'crop.carrot': { crop: 'Carrot', seed: 'Carrot Seeds' },
  'crop.cabbage': { crop: 'Cabbage', seed: 'Cabbage Seeds' },
  'crop.tomato': { crop: 'Tomato', seed: 'Tomato Seeds' },
  'crop.runner_bean': { crop: 'Runner Bean', seed: 'Runner Bean Seeds' },
  'crop.strawberry': { crop: 'Strawberry', seed: 'Strawberry Runners' },
  'crop.corn': { crop: 'Corn', seed: 'Seed Corn' },
  'crop.pumpkin': { crop: 'Pumpkin', seed: 'Pumpkin Seeds' },
  'crop.pepper': { crop: 'Pepper', seed: 'Pepper Seeds' },
  'crop.garlic': { crop: 'Garlic', seed: 'Garlic Cloves' },
  'crop.beet': { crop: 'Beet', seed: 'Beet Seeds' },
  'crop.hops': { crop: 'Hops', seed: 'Hop Cuttings' },
  'crop.glowcap': { crop: 'Glowcap', seed: 'Glowcap Spawn' },
  'crop.woad': { crop: 'Woad Leaf', seed: 'Woad Seeds' },
  'crop.melon': { crop: 'Sweet Melon', seed: 'Melon Seeds' },
  'crop.saffron': { crop: 'Saffron', seed: 'Saffron Corms' },
  'crop.frost_kale': { crop: 'Frost Kale', seed: 'Frost Kale Seeds' },
  'crop.frostroot': { crop: 'Frostroot', seed: 'Frostroot Seeds' },
  'crop.artichoke': { crop: 'Artichoke', seed: 'Artichoke Seeds' },
  'crop.honeyvine': { crop: 'Honeygrape', seed: 'Honeyvine Cuttings' },
};
