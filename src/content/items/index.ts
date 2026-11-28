import type { ItemDef } from './types';
import { ARMOR_ITEMS } from './armor';
import { FARMING_ITEMS } from './farming';
import { FOOD_ITEMS } from './food';
import { MANUAL_ITEMS } from './manuals';
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
  ...MANUAL_ITEMS,
  ...FARMING_ITEMS,
];

/** Things a crow likes (M4-20). Tagged here so the item tables stay as they were. */
const SHINY = new Set([
  'item.ring_copper',
  'item.ring_silver',
  'item.charm_sun',
  'item.copper_ingot',
  'item.iron_ingot',
  'item.quartz',
  'item.river_pebble',
  'item.bell_charm',
]);

/** Every item by id. */
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  LIST.map((d) => [d.id, SHINY.has(d.id) ? { ...d, shiny: true as const } : d]),
);
