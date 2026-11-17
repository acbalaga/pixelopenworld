import type { ItemDef } from './types';
import { ARMOR_ITEMS } from './armor';
import { FOOD_ITEMS } from './food';
import { MATERIAL_ITEMS } from './materials';
import { MISC_ITEMS } from './misc';
import { POTION_ITEMS } from './potions';
import { TOOL_ITEMS } from './tools';
import { WEAPON_ITEMS } from './weapons';

export * from './types';

/**
 * Every item, tier 1 and 2. Split by kind in this folder. Quality tiers, durability, affixes and
 * tools are described in `types.ts`. Items with no source yet are fine: reachability is checked
 * by the balance harness (M3-12).
 */
const LIST: readonly ItemDef[] = [
  ...WEAPON_ITEMS,
  ...ARMOR_ITEMS,
  ...TOOL_ITEMS,
  ...MATERIAL_ITEMS,
  ...FOOD_ITEMS,
  ...POTION_ITEMS,
  ...MISC_ITEMS,
];

/** Every item by id. */
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));
