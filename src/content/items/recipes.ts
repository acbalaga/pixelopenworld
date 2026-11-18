import type { NodeDef, RecipeDef } from './types';

/** The four slice recipes, cooked at a camp pot. Ingredient order never matters. */
export const RECIPES: Record<string, RecipeDef> = {
  'recipe.herb_tea': {
    id: 'recipe.herb_tea',
    ingredients: ['item.sunwort', 'item.dewmint'],
    result: 'item.herb_tea',
    tier: 1,
  },
  'recipe.berry_compote': {
    id: 'recipe.berry_compote',
    ingredients: ['item.berry_red', 'item.berry_blue'],
    result: 'item.berry_compote',
    tier: 1,
  },
  'recipe.herbed_skewer': {
    id: 'recipe.herbed_skewer',
    ingredients: ['item.raw_meat', 'item.dewmint'],
    result: 'item.herbed_skewer',
    tier: 1,
  },
  'recipe.hearty_stew': {
    id: 'recipe.hearty_stew',
    ingredients: ['item.raw_meat', 'item.sunwort', 'item.berry_red'],
    result: 'item.hearty_stew',
    tier: 2,
  },
};

/** Key of an ingredient set: sorted ids joined. */
export function ingredientKey(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

/** The recipe made by exactly these ingredients, if there is one. */
export function recipeFor(ids: readonly string[]): RecipeDef | undefined {
  const k = ingredientKey(ids);
  return Object.values(RECIPES).find((r) => ingredientKey(r.ingredients) === k);
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
