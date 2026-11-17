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
};
