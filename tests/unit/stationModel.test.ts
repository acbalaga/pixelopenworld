import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/content/items';
import { RECIPES } from '../../src/content/items/recipes';
import { INGREDIENT_ITEMS, canBeIngredient } from '../../src/ui/menu/recipeModel';

const ITEM_IDS: Record<string, string> = Object.fromEntries(
  Object.values(ITEMS).map((i) => [i.id, i.category]),
);

describe('the crafting Bag list (POW-M4-22C)', () => {
  it('the ingredient-item set includes every item named in any recipe', () => {
    for (const r of Object.values(RECIPES))
      for (const i of r.ingredients) expect(INGREDIENT_ITEMS.has(i.item), i.item).toBe(true);
  });
  it('shows materials and recipe ingredients, and not a weapon, a tool or a key', () => {
    expect(canBeIngredient('item.sunwort')).toBe(true);
    expect(canBeIngredient('item.copper_ore')).toBe(true);
    const out = (cat: string): string => {
      const id = Object.keys(ITEM_IDS).find((k) => ITEM_IDS[k] === cat && !INGREDIENT_ITEMS.has(k));
      return id ?? '';
    };
    for (const cat of ['weapon', 'tool']) {
      const id = out(cat);
      expect(id, cat).not.toBe('');
      expect(canBeIngredient(id), id).toBe(false);
    }
    const key = Object.keys(ITEM_IDS).find((k) => /key/.test(k));
    expect(key).toBeTruthy();
    expect(canBeIngredient(key!)).toBe(false);
  });
});
