import type { NodeDef, RecipeDef } from './types';

type Ing = readonly [item: string, qty?: number];

const POT = 'camp_pot';
const ANVIL = 'fixture.anvil';
const BENCH = 'fixture.workbench';

/** Builds a recipe. The id is `recipe.<result without item.>`. */
function make(
  craft: RecipeDef['craft'],
  station: string,
  tier: number,
  result: string,
  ing: readonly Ing[],
  learn: RecipeDef['learn'] = 'experiment',
  qty = 1,
): RecipeDef {
  return {
    id: `recipe.${result.replace(/^item\./, '')}`,
    craft,
    tier,
    station,
    ingredients: ing.map(([item, n]) => ({ item, qty: n ?? 1 })),
    result,
    qty,
    learn,
  };
}

const LIST: readonly RecipeDef[] = [
  // Smithing, 16, at the anvil.
  make('smithing', ANVIL, 1, 'item.copper_ingot', [['item.copper_ore', 2], ['item.coal']], 'start'),
  make('smithing', ANVIL, 2, 'item.iron_ingot', [['item.iron_ore', 2], ['item.coal']], 'start'),
  make(
    'smithing',
    ANVIL,
    1,
    'item.pick_copper',
    [['item.copper_ingot', 2], ['item.oak_plank']],
    'start',
  ),
  make(
    'smithing',
    ANVIL,
    1,
    'item.axe_copper',
    [['item.copper_ingot', 2], ['item.oak_log']],
    'start',
  ),
  make('smithing', ANVIL, 2, 'item.pick_iron', [['item.iron_ingot', 2], ['item.ash_plank']]),
  make('smithing', ANVIL, 2, 'item.axe_iron', [['item.iron_ingot', 2], ['item.ash_log']]),
  make('smithing', ANVIL, 1, 'item.hammer_copper', [['item.copper_ingot', 3], ['item.oak_plank']]),
  make('smithing', ANVIL, 1, 'item.sword_bronze', [
    ['item.copper_ingot', 2],
    ['item.oak_plank'],
    ['item.leather_strip'],
  ]),
  make(
    'smithing',
    ANVIL,
    2,
    'item.sword_iron',
    [['item.iron_ingot', 2], ['item.oak_plank']],
    'buy',
  ),
  make('smithing', ANVIL, 2, 'item.sword_steel', [['item.iron_ingot', 3], ['item.ash_plank']]),
  make('smithing', ANVIL, 1, 'item.spear_hunter', [
    ['item.copper_ingot'],
    ['item.ash_plank'],
    ['item.leather_strip'],
  ]),
  make('smithing', ANVIL, 2, 'item.spear_iron', [
    ['item.iron_ingot'],
    ['item.ash_plank'],
    ['item.leather_strip'],
  ]),
  make('smithing', ANVIL, 1, 'item.hauberk_mail', [['item.copper_ingot', 3]]),
  make('smithing', ANVIL, 1, 'item.coif_mail', [['item.copper_ingot', 2]]),
  make('smithing', ANVIL, 2, 'item.helm_iron', [['item.iron_ingot', 2], ['item.leather_strip']]),
  make('smithing', ANVIL, 2, 'item.shield_iron', [['item.iron_ingot', 3], ['item.leather_strip']]),
  // Woodworking, 12, at the workbench.
  make('woodworking', BENCH, 1, 'item.oak_plank', [['item.oak_log', 2]], 'start', 2),
  make('woodworking', BENCH, 2, 'item.ash_plank', [['item.ash_log', 2]], 'start', 2),
  make(
    'woodworking',
    BENCH,
    1,
    'item.bow_short',
    [['item.oak_plank', 2], ['item.flax_fiber']],
    'start',
  ),
  make('woodworking', BENCH, 1, 'item.shield_wood', [['item.oak_plank', 3]], 'start'),
  make('woodworking', BENCH, 1, 'item.maul_oak', [['item.oak_plank', 3], ['item.copper_ingot']]),
  make('woodworking', BENCH, 1, 'item.spear_ash', [['item.ash_log', 2], ['item.copper_ingot']]),
  make('woodworking', BENCH, 1, 'item.shield_buckler', [
    ['item.oak_plank', 2],
    ['item.copper_ingot'],
  ]),
  make('woodworking', BENCH, 1, 'item.rod_ash', [['item.ash_plank'], ['item.thread_spool']]),
  make('woodworking', BENCH, 1, 'item.sickle_copper', [['item.copper_ingot'], ['item.oak_plank']]),
  make('woodworking', BENCH, 2, 'item.sickle_iron', [['item.iron_ingot'], ['item.ash_plank']]),
  make('woodworking', BENCH, 2, 'item.shield_tower', [
    ['item.ash_plank', 2],
    ['item.iron_ingot', 2],
  ]),
  make('woodworking', BENCH, 1, 'item.flute_reed', [['item.oak_plank'], ['item.flax_fiber']]),
  // Cooking, 14, at the camp pot. The first four are the slice recipes.
  make('cooking', POT, 1, 'item.herb_tea', [['item.sunwort'], ['item.dewmint']]),
  make('cooking', POT, 1, 'item.berry_compote', [['item.berry_red'], ['item.berry_blue']]),
  make('cooking', POT, 1, 'item.herbed_skewer', [['item.raw_meat'], ['item.dewmint']]),
  make('cooking', POT, 2, 'item.hearty_stew', [
    ['item.raw_meat'],
    ['item.sunwort'],
    ['item.berry_red'],
  ]),
  make('cooking', POT, 1, 'item.roast_meat', [['item.raw_meat'], ['item.salt']]),
  make('cooking', POT, 2, 'item.mushroom_soup', [
    ['item.glowcap'],
    ['item.dewmint'],
    ['item.salt'],
  ]),
  make('cooking', POT, 1, 'item.sunwort_porridge', [['item.sunwort'], ['item.berry_blue']]),
  make('cooking', POT, 1, 'item.trail_biscuit', [['item.flax_fiber'], ['item.salt']]),
  make('cooking', POT, 2, 'item.fish_baked', [['item.fish_river'], ['item.salt']]),
  make('cooking', POT, 1, 'item.spiced_cider', [['item.berry_red', 2], ['item.salt']]),
  make('cooking', POT, 1, 'item.apple_tart', [
    ['item.berry_red'],
    ['item.berry_blue'],
    ['item.flax_fiber'],
  ]),
  make('cooking', POT, 1, 'item.honey_cake', [
    ['item.flax_fiber'],
    ['item.sunwort'],
    ['item.dew_vial'],
  ]),
  make('cooking', POT, 1, 'item.dish_bread', [['item.flax_fiber', 2], ['item.salt']]),
  make('cooking', POT, 2, 'item.silver_chowder', [
    ['item.fish_silver'],
    ['item.salt'],
    ['item.dewmint'],
  ]),
];

/** Every recipe by id. Ingredient order never matters. */
export const RECIPES: Record<string, RecipeDef> = Object.fromEntries(LIST.map((r) => [r.id, r]));

/** Every unit of a recipe's ingredients, one entry each. */
export function expand(ing: readonly { item: string; qty: number }[]): string[] {
  return ing.flatMap((i) => Array.from({ length: i.qty }, () => i.item));
}

/** Key of an ingredient set: every unit, sorted and joined. */
export function ingredientKey(units: readonly string[]): string {
  return [...units].sort().join(',');
}

/** The recipe made at `station` by exactly these ingredient units, if there is one. */
export function recipeFor(station: string, units: readonly string[]): RecipeDef | undefined {
  const k = ingredientKey(units);
  return Object.values(RECIPES).find(
    (r) => r.station === station && ingredientKey(expand(r.ingredients)) === k,
  );
}

const MIN = 30 * 60;

/** Gathering nodes. Common ones come back in minutes (design/05). */
export const NODES: Record<string, NodeDef> = {
  'node.herb_patch': {
    id: 'node.herb_patch',
    tag: 'foraging',
    tier: 1,
    yields: [
      { item: 'item.sunwort', weight: 3 },
      { item: 'item.dewmint', weight: 2 },
    ],
    respawn: 3 * MIN,
    sprite: { ready: 'icon.sunwort', spent: 'icon.moss_tuft' },
  },
  'node.berry_bush': {
    id: 'node.berry_bush',
    tag: 'foraging',
    tier: 1,
    yields: [
      { item: 'item.berry_red', weight: 3 },
      { item: 'item.berry_blue', weight: 2 },
    ],
    respawn: 4 * MIN,
    sprite: { ready: 'icon.berry_red', spent: 'icon.moss_tuft' },
  },
  // Mining: one sweep, a narrow window and a big bonus. The pick sets the pace.
  'node.copper_vein': {
    id: 'node.copper_vein',
    tag: 'mining',
    tier: 1,
    tool: 'pick',
    yields: [
      { item: 'item.copper_ore', weight: 5 },
      { item: 'item.coal', weight: 2 },
    ],
    respawn: 5 * MIN,
    sweep: { sweetFrom: 15, sweetTo: 17, sweetBonus: 2 },
    sprite: { ready: 'icon.node_vein_copper', spent: 'icon.node_vein_spent' },
  },
  'node.iron_vein': {
    id: 'node.iron_vein',
    tag: 'mining',
    tier: 2,
    tool: 'pick',
    yields: [
      { item: 'item.iron_ore', weight: 5 },
      { item: 'item.coal', weight: 2 },
      { item: 'item.quartz', weight: 1 },
    ],
    respawn: 8 * MIN,
    sweep: { sweetFrom: 15, sweetTo: 17, sweetBonus: 2 },
    sprite: { ready: 'icon.node_vein_iron', spent: 'icon.node_vein_spent' },
  },
  // Logging: three swings to a tree, and each sweet hit adds a log.
  'node.oak_tree': {
    id: 'node.oak_tree',
    tag: 'logging',
    tier: 1,
    tool: 'axe',
    yields: [{ item: 'item.oak_log', weight: 1 }],
    respawn: 4 * MIN,
    sweep: { swings: 3, baseMin: 1, baseMax: 2 },
    sprite: { ready: 'icon.node_oak', spent: 'icon.node_stump' },
  },
  'node.ash_tree': {
    id: 'node.ash_tree',
    tag: 'logging',
    tier: 2,
    tool: 'axe',
    yields: [{ item: 'item.ash_log', weight: 1 }],
    respawn: 8 * MIN,
    sweep: { swings: 3, baseMin: 1, baseMax: 2 },
    sprite: { ready: 'icon.node_ash', spent: 'icon.node_stump' },
  },
  // Fishing placeholder until M6-05: cast, wait, tap on the bite. A miss still lands the catch.
  'node.fishing_spot': {
    id: 'node.fishing_spot',
    tag: 'fishing',
    tier: 1,
    tool: 'rod',
    yields: [
      { item: 'item.fish_river', weight: 5 },
      // The silver ones rise at the edges of the day.
      { item: 'item.fish_silver', weight: 2, phases: ['dawn', 'dusk'] },
    ],
    respawn: 3 * MIN,
    fishing: true,
    sweep: { baseMin: 1, baseMax: 1, sweetBonus: 1 },
    sprite: { ready: 'icon.node_fish', spent: 'icon.node_fish_spent' },
  },
};
