/**
 * Recipe words shared by the crafting station and the Chronicle (POW-M4-22B): what a recipe is
 * called and its ingredient line. Words only.
 */
import { ITEMS } from '../../content/items';
import { AFFIXES } from '../../content/items/affixes';
import { RECIPES } from '../../content/items/recipes';
import { ITEM_STRINGS } from '../../content/strings/items';
import { fill } from '../../content/strings/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';

/** The display name of an item id. */
export const itemName = (id: string): string => ITEM_STRINGS[ITEMS[id]?.nameKey ?? ''] ?? id;

/** What a recipe is called: the item it makes, or for an enchant the affix it applies. */
export const recipeName = (r: { result: string; enchant?: string }): string =>
  r.enchant
    ? fill(S.craft.enchant, { name: ITEM_STRINGS[AFFIXES[r.enchant]?.nameKey ?? ''] ?? r.enchant })
    : itemName(r.result);

/** "2 Sunwort, 1 Dewmint". */
export const ingredientLine = (r: {
  ingredients: readonly { item: string; qty: number }[];
}): string => r.ingredients.map((i) => `${i.qty} ${itemName(i.item)}`).join(', ');

/**
 * Every item named by any recipe, computed once from data. It says nothing about which station
 * a recipe is for, so the crafting Bag list gives nothing away (POW-M4-22C).
 */
export const INGREDIENT_ITEMS: ReadonlySet<string> = new Set(
  Object.values(RECIPES).flatMap((r) => r.ingredients.map((i) => i.item)),
);

/** Whether the crafting Bag list shows an item: a material or consumable, or any recipe ingredient. */
export function canBeIngredient(id: string): boolean {
  const c = ITEMS[id]?.category;
  return c === 'material' || c === 'consumable' || INGREDIENT_ITEMS.has(id);
}
