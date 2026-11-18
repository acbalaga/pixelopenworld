import type { ItemDef } from './types';
import { item, T } from './define';

/** Cooked dishes. Health in points, Stamina and Focus in tenths. */
export const FOOD_ITEMS: readonly ItemDef[] = [
  item('item.herb_tea', 'consumable', {
    value: 10,
    quality: true,
    food: { hp: 5, sta: 250, foc: 150, fed: { ticks: 3 * T, hpMax: 0, staMax: 100, focMax: 100 } },
  }),
  item('item.berry_compote', 'consumable', {
    value: 12,
    quality: true,
    food: { hp: 12, sta: 100, foc: 0, fed: { ticks: 3 * T, hpMax: 10, staMax: 0, focMax: 0 } },
  }),
  item('item.herbed_skewer', 'consumable', {
    value: 16,
    quality: true,
    food: { hp: 20, sta: 150, foc: 0, fed: { ticks: 4 * T, hpMax: 10, staMax: 100, focMax: 0 } },
  }),
  item('item.hearty_stew', 'consumable', {
    value: 28,
    tier: 2,
    quality: true,
    food: { hp: 35, sta: 250, foc: 100, fed: { ticks: 5 * T, hpMax: 20, staMax: 150, focMax: 50 } },
  }),
  item('item.dish_bread', 'consumable', {
    value: 6,
    quality: true,
    food: { hp: 8, sta: 100, foc: 0 },
  }),
  item('item.honey_cake', 'consumable', {
    value: 14,
    quality: true,
    food: { hp: 10, sta: 0, foc: 250, fed: { ticks: 2 * T, hpMax: 0, staMax: 0, focMax: 150 } },
  }),
  // Still edible, just poor: it restores a little and gives no buff.
  item('item.burnt_mess', 'consumable', { value: 0, food: { hp: 3, sta: 0, foc: 0 } }),
  item('item.roast_meat', 'consumable', {
    value: 18,
    quality: true,
    food: { hp: 28, sta: 100, foc: 0, fed: { ticks: 3 * T, hpMax: 15, staMax: 0, focMax: 0 } },
  }),
  item('item.mushroom_soup', 'consumable', {
    value: 20,
    tier: 2,
    quality: true,
    food: { hp: 22, sta: 50, foc: 200, fed: { ticks: 4 * T, hpMax: 0, staMax: 0, focMax: 120 } },
  }),
  item('item.sunwort_porridge', 'consumable', {
    value: 11,
    quality: true,
    food: { hp: 14, sta: 200, foc: 0, fed: { ticks: 3 * T, hpMax: 0, staMax: 120, focMax: 0 } },
  }),
  item('item.trail_biscuit', 'consumable', {
    value: 7,
    quality: true,
    food: { hp: 10, sta: 150, foc: 0 },
  }),
  item('item.silver_chowder', 'consumable', {
    value: 30,
    tier: 2,
    quality: true,
    food: { hp: 36, sta: 100, foc: 120, fed: { ticks: 4 * T, hpMax: 20, staMax: 60, focMax: 80 } },
  }),
  item('item.fish_baked', 'consumable', {
    value: 24,
    tier: 2,
    quality: true,
    food: { hp: 30, sta: 120, foc: 80, fed: { ticks: 4 * T, hpMax: 15, staMax: 60, focMax: 60 } },
  }),
  item('item.spiced_cider', 'consumable', {
    value: 16,
    quality: true,
    food: { hp: 6, sta: 100, foc: 120, fed: { ticks: 3 * T, hpMax: 0, staMax: 60, focMax: 60 } },
  }),
  item('item.apple_tart', 'consumable', {
    value: 15,
    quality: true,
    food: { hp: 16, sta: 80, foc: 80 },
  }),
];
