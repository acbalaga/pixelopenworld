import type { ItemDef } from './types';
import { item } from './define';

/** 36 materials: ores, ingots, logs, planks, fibers, cloth, hides, leather, herbs, reagents, essences. */
const mat = (id: string, value: number, tier = 1, quality = true): ItemDef =>
  item(id, 'material', { value, tier, ...(quality ? { quality: true as const } : {}) });

export const MATERIAL_ITEMS: readonly ItemDef[] = [
  // Herbs and berries gathered from the meadow. Edible as found (Survival XP).
  item('item.sunwort', 'material', {
    value: 4,
    quality: true,
    food: { hp: 2, sta: 0, foc: 50, raw: true },
  }),
  item('item.dewmint', 'material', {
    value: 4,
    quality: true,
    food: { hp: 1, sta: 50, foc: 50, raw: true },
  }),
  item('item.berry_red', 'material', {
    value: 3,
    quality: true,
    food: { hp: 3, sta: 50, foc: 0, raw: true },
  }),
  item('item.berry_blue', 'material', {
    value: 3,
    quality: true,
    food: { hp: 3, sta: 0, foc: 50, raw: true },
  }),
  mat('item.nightshade', 8, 2),
  mat('item.glowcap', 10, 2),
  // From the water (fishing).
  mat('item.fish_river', 6),
  mat('item.fish_silver', 14, 2),
  // Meat, hides and what creatures leave.
  mat('item.raw_meat', 5),
  mat('item.moss_tuft', 2, 1, false),
  mat('item.seed_pod', 2, 1, false),
  mat('item.boar_hide', 8, 2),
  mat('item.hide_rough', 4),
  mat('item.leather_strip', 6),
  mat('item.leather', 14, 2),
  // Ores and metals.
  mat('item.copper_ore', 5),
  mat('item.iron_ore', 12, 2),
  mat('item.coal', 4),
  mat('item.copper_ingot', 14),
  mat('item.iron_ingot', 32, 2),
  mat('item.quartz', 18, 2),
  // Wood.
  mat('item.oak_log', 4),
  mat('item.ash_log', 9, 2),
  mat('item.oak_plank', 8),
  mat('item.ash_plank', 18, 2),
  // Fibers and cloth.
  mat('item.flax_fiber', 3),
  mat('item.wool_tuft', 4),
  mat('item.linen_cloth', 10),
  mat('item.wool_cloth', 12),
  mat('item.silk_cloth', 30, 2),
  // Reagents and essences.
  mat('item.clay', 3, 1, false),
  mat('item.salt', 4, 1, false),
  mat('item.spark_dust', 9, 1, false),
  mat('item.dew_vial', 7, 1, false),
  mat('item.essence_ember', 24, 2, false),
  mat('item.essence_tide', 24, 2, false),
  mat('item.essence_gale', 24, 2, false),
  mat('item.essence_stone', 24, 2, false),
];
