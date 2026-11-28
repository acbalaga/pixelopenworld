import { FISH, type Water } from '../fishing/fish';
import { PIECES } from '../furniture/pieces';
import { DISH_RECIPES } from './dishes';
import type { NodeDef, RecipeDef } from './types';

type Ing = readonly [item: string, qty?: number];

const POT = 'camp_pot';
const ANVIL = 'fixture.anvil';
const BENCH = 'fixture.workbench';
const LOOM = 'fixture.loom';
const ALCH = 'fixture.alchemy_table';
const RUNE = 'fixture.rune_stone';
const TINK = 'fixture.tinker_bench';

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

/** An enchant: these materials, plus a chosen piece, put `affix` on it. The recipe makes no item. */
function enchant(
  affix: string,
  tier: number,
  ing: readonly Ing[],
  learn: RecipeDef['learn'] = 'experiment',
): RecipeDef {
  return {
    id: `recipe.enchant_${affix.replace(/^affix\./, '')}`,
    craft: 'enchanting',
    tier,
    station: RUNE,
    ingredients: ing.map(([item, n]) => ({ item, qty: n ?? 1 })),
    result: '',
    qty: 0,
    learn,
    enchant: affix,
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
  make(
    'woodworking',
    BENCH,
    1,
    'item.cart_wheel',
    [['item.oak_plank', 2], ['item.leather_strip']],
    'start',
  ),
  make('woodworking', BENCH, 1, 'item.dagger_wood', [['item.oak_plank', 2]], 'start'),
  make('woodworking', BENCH, 1, 'item.shield_wood', [['item.oak_plank', 3]], 'start'),
  // Farming tools and compost (POW-M6-02).
  make('woodworking', BENCH, 1, 'item.hoe', [['item.ash_log'], ['item.copper_ingot']]),
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
  make(
    'cooking',
    POT,
    2,
    'item.bakers_loaf',
    [['item.flax_fiber', 2], ['item.salt'], ['item.dewmint']],
    'find',
  ),
  make('cooking', POT, 1, 'item.dish_bread', [['item.flax_fiber', 2], ['item.salt']]),
  // Cooking in full (M6-04): 85 dishes from the dish table, at the pot and the oven.
  ...DISH_RECIPES,
  // Furniture (M6-07): wood at the workbench, cloth at the loom. Known from the start.
  ...PIECES.filter((p) => p.made).map((p) =>
    p.layer === 'rug'
      ? make('tailoring', LOOM, 1, p.item, p.made ?? [], 'start')
      : make('woodworking', BENCH, 1, p.item, p.made ?? [], 'start'),
  ),
  make('cooking', POT, 2, 'item.silver_chowder', [
    ['item.fish_silver'],
    ['item.salt'],
    ['item.dewmint'],
  ]),
  // ---- Crafting II (M3-14) ----
  // Tailoring, 12, at the loom: cloth and leather for head, body and legs at two tiers.
  make(
    'tailoring',
    LOOM,
    1,
    'item.fishing_net',
    [['item.wool_cloth'], ['item.flax_fiber']],
    'start',
  ),
  make('tailoring', LOOM, 1, 'item.cap_wool', [['item.wool_cloth']], 'start'),
  make('tailoring', LOOM, 1, 'item.trousers_wool', [['item.wool_cloth', 2]], 'start'),
  make('tailoring', LOOM, 1, 'item.outfit_wayfarer', [
    ['item.linen_cloth', 2],
    ['item.thread_spool'],
  ]),
  // Bags: use one to grow the Bag (26 slots, then 34).
  make(
    'tailoring',
    LOOM,
    1,
    'item.satchel',
    [['item.leather_strip', 3], ['item.wool_cloth']],
    'start',
  ),
  make(
    'tailoring',
    LOOM,
    2,
    'item.pack',
    [
      ['item.leather', 2],
      ['item.wool_cloth', 2],
    ],
    'start',
  ),
  make('tailoring', LOOM, 1, 'item.cap_leather', [['item.leather_strip', 2]], 'start'),
  make('tailoring', LOOM, 1, 'item.chaps_leather', [['item.leather_strip', 3]]),
  make('tailoring', LOOM, 1, 'item.jerkin_leather', [
    ['item.leather_strip', 3],
    ['item.thread_spool'],
  ]),
  make('tailoring', LOOM, 2, 'item.hood_silk', [['item.silk_cloth'], ['item.thread_spool']]),
  make('tailoring', LOOM, 2, 'item.skirt_silk', [['item.silk_cloth', 2]]),
  make('tailoring', LOOM, 2, 'item.robe_silk', [['item.silk_cloth', 3], ['item.thread_spool']]),
  make('tailoring', LOOM, 2, 'item.hood_hide', [['item.leather'], ['item.leather_strip']]),
  make('tailoring', LOOM, 2, 'item.chaps_hide', [['item.leather', 2]]),
  make('tailoring', LOOM, 2, 'item.outfit_leather', [['item.leather', 3], ['item.thread_spool']]),
  // Alchemy, 10, at the table: tonics at two tiers and four remedies.
  make('alchemy', ALCH, 1, 'item.potion_health_s', [['item.sunwort'], ['item.dew_vial']], 'start'),
  make('alchemy', ALCH, 1, 'item.potion_stamina', [['item.dewmint'], ['item.dew_vial']], 'start'),
  make('alchemy', ALCH, 1, 'item.potion_focus', [['item.berry_blue'], ['item.dew_vial']], 'start'),
  make('alchemy', ALCH, 2, 'item.potion_health_m', [
    ['item.sunwort'],
    ['item.nightshade'],
    ['item.dew_vial'],
  ]),
  make('alchemy', ALCH, 2, 'item.potion_stamina_m', [
    ['item.dewmint'],
    ['item.glowcap'],
    ['item.dew_vial'],
  ]),
  make('alchemy', ALCH, 2, 'item.potion_focus_m', [
    ['item.berry_blue'],
    ['item.glowcap'],
    ['item.dew_vial'],
  ]),
  make('alchemy', ALCH, 1, 'item.compost', [['item.wood_scraps'], ['item.moss_tuft', 2]]),
  make('alchemy', ALCH, 1, 'item.antidote', [['item.sunwort'], ['item.salt'], ['item.dew_vial']]),
  make('alchemy', ALCH, 1, 'item.warming_draught', [
    ['item.spark_dust'],
    ['item.dewmint'],
    ['item.dew_vial'],
  ]),
  make('alchemy', ALCH, 2, 'item.fire_salve', [
    ['item.essence_tide'],
    ['item.clay'],
    ['item.salt'],
  ]),
  make('alchemy', ALCH, 2, 'item.oil_keenness', [
    ['item.essence_ember'],
    ['item.lantern_oil'],
    ['item.salt'],
  ]),
  // Enchanting, 8, at the rune stone: one for each affix of M3-05, and two stronger ones.
  enchant('affix.power_1', 1, [['item.essence_ember'], ['item.spark_dust']], 'start'),
  enchant('affix.defense_1', 1, [['item.essence_tide'], ['item.clay']], 'start'),
  enchant('affix.stamina_1', 1, [['item.dew_vial'], ['item.salt']]),
  enchant('affix.focus_1', 1, [['item.dew_vial'], ['item.quartz']]),
  enchant('affix.crit_1', 1, [['item.spark_dust'], ['item.quartz']]),
  enchant('affix.gather_1', 1, [['item.clay'], ['item.salt']]),
  enchant('affix.power_2', 2, [['item.essence_ember', 2], ['item.quartz']]),
  enchant('affix.defense_2', 2, [['item.essence_tide', 2], ['item.quartz']]),
  // Tinkering, 8 gadgets, at the tinker bench.
  make(
    'tinkering',
    TINK,
    1,
    'item.spark_flint',
    [['item.copper_ingot'], ['item.spark_dust']],
    'start',
  ),
  make('tinkering', TINK, 1, 'item.water_flask', [['item.clay'], ['item.dew_vial']], 'start'),
  make('tinkering', TINK, 1, 'item.watering_can', [['item.copper_ingot', 2], ['item.clay']]),
  make('tinkering', TINK, 1, 'item.smoke_pellet', [['item.coal'], ['item.clay'], ['item.salt']]),
  make(
    'tinkering',
    TINK,
    1,
    'item.bell_charm',
    [['item.copper_ingot'], ['item.thread_spool']],
    'start',
  ),
  make('tinkering', TINK, 2, 'item.lantern', [
    ['item.copper_ingot'],
    ['item.lantern_oil'],
    ['item.quartz'],
  ]),
  make('tinkering', TINK, 1, 'item.repair_kit', [
    ['item.leather_strip'],
    ['item.thread_spool'],
    ['item.whetstone'],
  ]),
  make('tinkering', TINK, 1, 'item.snare', [['item.thread_spool', 2], ['item.oak_plank']]),
  make('tinkering', TINK, 1, 'item.grit_pouch', [
    ['item.leather_strip'],
    ['item.salt'],
    ['item.spark_dust'],
  ]),

  // ---- Supply recipes (M3-12). The intermediates and the gear that nothing made before. ----
  // Cloth and leather stock, at the loom: spun from what Whisperwood grows and sheds.
  make('tailoring', LOOM, 1, 'item.linen_cloth', [['item.flax_fiber', 2]]),
  make('tailoring', LOOM, 1, 'item.wool_cloth', [['item.wool_tuft', 2]]),
  make('tailoring', LOOM, 1, 'item.leather', [['item.hide_rough'], ['item.salt']]),
  make('tailoring', LOOM, 1, 'item.leather_strip', [['item.leather']], 'experiment', 2),
  make('tailoring', LOOM, 1, 'item.outfit_scholar', [
    ['item.linen_cloth'],
    ['item.wool_cloth'],
    ['item.thread_spool'],
  ]),
  // Smithing and woodworking gear that had no recipe.
  make('smithing', ANVIL, 1, 'item.greaves_mail', [
    ['item.copper_ingot', 2],
    ['item.leather_strip'],
  ]),
  make('smithing', ANVIL, 2, 'item.spear_steel', [
    ['item.iron_ingot', 2],
    ['item.ash_plank'],
    ['item.leather_strip'],
  ]),
  make('smithing', ANVIL, 2, 'item.cuirass_iron', [
    ['item.iron_ingot', 2],
    ['item.leather', 2],
  ]),
  make('smithing', ANVIL, 2, 'item.greaves_iron', [['item.iron_ingot', 3]]),
  make('smithing', ANVIL, 2, 'item.band_iron', [['item.iron_ingot', 2]]),
  make('smithing', ANVIL, 2, 'item.hammer_iron', [['item.iron_ingot', 3], ['item.oak_plank']]),
  make('smithing', ANVIL, 2, 'item.maul_iron', [
    ['item.iron_ingot', 2],
    ['item.ash_plank', 2],
  ]),
  make('woodworking', BENCH, 2, 'item.bow_long', [['item.ash_plank', 2], ['item.linen_cloth']]),
  make('tailoring', LOOM, 2, 'item.wraps_leather', [['item.leather', 2], ['item.linen_cloth']]),
  make('woodworking', BENCH, 2, 'item.rod_yew', [['item.ash_plank', 2], ['item.thread_spool']]),
  // Four remedies of the second tier, made from the essences the forest creatures carry.
  make('alchemy', ALCH, 2, 'item.potion_swift', [
    ['item.essence_gale'],
    ['item.dewmint'],
    ['item.dew_vial'],
  ]),
  make('alchemy', ALCH, 2, 'item.potion_ward', [
    ['item.essence_stone'],
    ['item.glowcap'],
    ['item.salt'],
  ]),
  make('alchemy', ALCH, 2, 'item.potion_clarity', [
    ['item.essence_tide'],
    ['item.glowcap'],
    ['item.dew_vial'],
  ]),
  make('alchemy', ALCH, 2, 'item.potion_vigor', [
    ['item.essence_ember'],
    ['item.sunwort'],
    ['item.berry_red'],
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

/** A fishing spot on `water`: its yields are the fish that live there. */
function fishingNode(id: string, water: Water): NodeDef {
  return {
    id,
    tag: 'fishing',
    workAnim: 'work_cast',
    tier: 1,
    tool: 'rod',
    water,
    yields: FISH.filter((f) => f.water.includes(water) && !f.legend).map((f) => ({
      item: f.item,
      weight: f.weight,
      ...(f.phases ? { phases: f.phases } : {}),
      ...(f.seasons ? { seasons: f.seasons } : {}),
      ...(f.weather ? { weather: f.weather } : {}),
    })),
    respawn: 3 * MIN,
    fishing: true,
    sweep: { baseMin: 1, baseMax: 1, sweetBonus: 1 },
    sprite: { ready: 'icon.node_fish', spent: 'icon.node_fish_spent' },
  };
}

/** Gathering nodes. Common ones come back in minutes (design/05). */
export const NODES: Record<string, NodeDef> = {
  'node.herb_patch': {
    id: 'node.herb_patch',
    tag: 'foraging',
    workAnim: 'work_reach',
    tier: 1,
    yields: [
      { item: 'item.sunwort', weight: 3 },
      { item: 'item.dewmint', weight: 2 },
    ],
    respawn: 3 * MIN,
    sprite: { ready: 'node.herb_patch', spent: 'node.herb_patch_spent' },
  },
  'node.berry_bush': {
    id: 'node.berry_bush',
    tag: 'foraging',
    workAnim: 'work_reach',
    tier: 1,
    yields: [
      { item: 'item.berry_red', weight: 3 },
      { item: 'item.berry_blue', weight: 2 },
    ],
    respawn: 4 * MIN,
    sprite: { ready: 'node.berry_bush', spent: 'node.berry_bush_spent' },
  },
  // Mining: one sweep, a narrow window and a big bonus. The pick sets the pace.
  'node.copper_vein': {
    id: 'node.copper_vein',
    tag: 'mining',
    workAnim: 'work_swing',
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
    workAnim: 'work_swing',
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
    workAnim: 'work_swing',
    tier: 1,
    tool: 'axe',
    yields: [{ item: 'item.oak_log', weight: 1 }],
    respawn: 4 * MIN,
    sweep: { swings: 3, baseMin: 1, baseMax: 2 },
    sprite: { ready: 'icon.node_oak_tall', spent: 'icon.node_stump_oak' },
  },
  'node.ash_tree': {
    id: 'node.ash_tree',
    tag: 'logging',
    workAnim: 'work_swing',
    tier: 2,
    tool: 'axe',
    yields: [{ item: 'item.ash_log', weight: 1 }],
    respawn: 8 * MIN,
    sweep: { swings: 3, baseMin: 1, baseMax: 2 },
    sprite: { ready: 'icon.node_ash_tall', spent: 'icon.node_stump_ash' },
  },
  // Fishing (M6-05): one node kind per water. The yields are the species table, so the ledger
  // and the bounds see every fish; the fight itself is `sim/fishing.ts`.
  'node.fishing_spot': fishingNode('node.fishing_spot', 'river'),
  'node.fishing_pond': fishingNode('node.fishing_pond', 'pond'),
  'node.fishing_marsh': fishingNode('node.fishing_marsh', 'marsh'),
  'node.fishing_estuary': fishingNode('node.fishing_estuary', 'estuary'),
  // ---- Whisperwood supply (M3-12): tier 2 materials, placed by that region's map, not the first one. ----
  'node.flax_patch': {
    id: 'node.flax_patch',
    tag: 'foraging',
    workAnim: 'work_reach',
    tier: 2,
    yields: [{ item: 'item.flax_fiber', weight: 1 }],
    respawn: 4 * MIN,
    sprite: { ready: 'node.flax_patch', spent: 'node.flax_patch_spent' },
  },
  'node.briar_tuft': {
    id: 'node.briar_tuft',
    tag: 'foraging',
    workAnim: 'work_reach',
    tier: 2,
    yields: [{ item: 'item.wool_tuft', weight: 1 }],
    respawn: 4 * MIN,
    sprite: { ready: 'node.briar_tuft', spent: 'node.briar_tuft_spent' },
  },
  'node.glowcap_cluster': {
    id: 'node.glowcap_cluster',
    tag: 'foraging',
    workAnim: 'work_reach',
    tier: 2,
    yields: [{ item: 'item.glowcap', weight: 1 }],
    respawn: 5 * MIN,
    sprite: { ready: 'node.glowcap_cluster', spent: 'node.glowcap_cluster_spent' },
  },
  'node.nightshade_bush': {
    id: 'node.nightshade_bush',
    tag: 'foraging',
    workAnim: 'work_reach',
    tier: 2,
    yields: [{ item: 'item.nightshade', weight: 1 }],
    respawn: 5 * MIN,
    sprite: { ready: 'node.nightshade_bush', spent: 'node.nightshade_bush_spent' },
  },
  'node.river_bank': {
    id: 'node.river_bank',
    tag: 'foraging',
    workAnim: 'work_reach',
    tier: 2,
    yields: [
      { item: 'item.clay', weight: 3 },
      { item: 'item.river_pebble', weight: 2 },
    ],
    respawn: 4 * MIN,
    sprite: { ready: 'node.river_bank', spent: 'node.river_bank_spent' },
  },
  'node.silk_web': {
    id: 'node.silk_web',
    tag: 'foraging',
    workAnim: 'work_reach',
    tier: 2,
    yields: [{ item: 'item.silk_cloth', weight: 1 }],
    respawn: 8 * MIN,
    sprite: { ready: 'node.silk_web', spent: 'node.silk_web_spent' },
  },
};
