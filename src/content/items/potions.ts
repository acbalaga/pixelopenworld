import type { ItemDef } from './types';
import { item, T } from './define';

/**
 * Potions are consumables like food and use the same rules (`food`): they restore pools and some
 * give a short Fed-style buff. They list under the Food filter of the Bag.
 */
const potion = (id: string, value: number, tier: number, food: ItemDef['food']): ItemDef =>
  item(id, 'consumable', { value, tier, quality: true, stack: 10, ...(food ? { food } : {}) });

export const POTION_ITEMS: readonly ItemDef[] = [
  potion('item.potion_health_s', 18, 1, { hp: 30, sta: 0, foc: 0 }),
  potion('item.potion_health_m', 45, 2, { hp: 70, sta: 0, foc: 0 }),
  potion('item.potion_stamina', 22, 1, { hp: 0, sta: 400, foc: 0 }),
  potion('item.potion_focus', 22, 1, { hp: 0, sta: 0, foc: 400 }),
  potion('item.potion_swift', 40, 2, {
    hp: 0,
    sta: 200,
    foc: 0,
    fed: { ticks: 2 * T, hpMax: 0, staMax: 200, focMax: 0 },
  }),
  potion('item.potion_ward', 40, 2, {
    hp: 10,
    sta: 0,
    foc: 0,
    fed: { ticks: 2 * T, hpMax: 30, staMax: 0, focMax: 0 },
  }),
  potion('item.potion_clarity', 40, 2, {
    hp: 0,
    sta: 0,
    foc: 250,
    fed: { ticks: 2 * T, hpMax: 0, staMax: 0, focMax: 200 },
  }),
  potion('item.potion_vigor', 60, 2, {
    hp: 40,
    sta: 200,
    foc: 100,
    fed: { ticks: 3 * T, hpMax: 15, staMax: 100, focMax: 50 },
  }),
];
