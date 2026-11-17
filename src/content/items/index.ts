import type { ItemDef } from './types';

export * from './types';

const T = 30 * 60;

function item(
  id: string,
  category: ItemDef['category'],
  fields: Partial<ItemDef> & Pick<ItemDef, 'value'>,
): ItemDef {
  const key = id.replace(/^item\./, '');
  return {
    id,
    nameKey: `${id}.name`,
    descKey: `${id}.desc`,
    icon: `icon.${key}`,
    category,
    stack: category === 'weapon' || category === 'armor' ? 1 : 20,
    tier: 1,
    ...fields,
  };
}

/** The slice items. About 30. Quality tiers, durability and affixes come with crafting (M3). */
const LIST: readonly ItemDef[] = [
  // Weapons. The rusty sword matches the base sword, so a new avatar fights as before.
  item('item.sword_rusty', 'weapon', {
    value: 6,
    equip: { slot: 'main', weapon: 'sword', power: 10, doll: { mainHand: 'sword' } },
  }),
  item('item.sword_iron', 'weapon', {
    value: 60,
    tier: 2,
    equip: { slot: 'main', weapon: 'sword', power: 14, doll: { mainHand: 'sword' } },
  }),
  item('item.spear_ash', 'weapon', {
    value: 40,
    equip: { slot: 'main', weapon: 'spear', power: 11, doll: { mainHand: 'spear' } },
  }),
  item('item.shield_wood', 'armor', {
    value: 25,
    equip: { slot: 'off', defense: 3, doll: { offHand: 'shield' } },
  }),
  // Outfits.
  item('item.outfit_wayfarer', 'armor', {
    value: 30,
    equip: { slot: 'body', defense: 2, doll: { top: 'tunic', topColor: 'blue' } },
  }),
  item('item.outfit_leather', 'armor', {
    value: 55,
    tier: 2,
    equip: { slot: 'body', defense: 5, doll: { top: 'vest', topColor: 'brown' } },
  }),
  item('item.outfit_scholar', 'armor', {
    value: 45,
    equip: { slot: 'body', defense: 1, doll: { top: 'robe', topColor: 'violet' } },
  }),
  item('item.cap_wool', 'armor', { value: 12, equip: { slot: 'head', defense: 1 } }),
  item('item.ring_copper', 'armor', { value: 20, equip: { slot: 'accessory', defense: 1 } }),
  // Materials.
  item('item.sunwort', 'material', {
    value: 4,
    food: { hp: 2, sta: 0, foc: 50, raw: true },
  }),
  item('item.dewmint', 'material', {
    value: 4,
    food: { hp: 1, sta: 50, foc: 50, raw: true },
  }),
  item('item.berry_red', 'material', {
    value: 3,
    food: { hp: 3, sta: 50, foc: 0, raw: true },
  }),
  item('item.berry_blue', 'material', {
    value: 3,
    food: { hp: 3, sta: 0, foc: 50, raw: true },
  }),
  item('item.raw_meat', 'material', { value: 5 }),
  item('item.moss_tuft', 'material', { value: 2 }),
  item('item.seed_pod', 'material', { value: 2 }),
  item('item.boar_hide', 'material', { value: 8, tier: 2 }),
  // Dishes. The first four come from recipes. Bread and cake are bought.
  item('item.herb_tea', 'consumable', {
    value: 10,
    food: { hp: 5, sta: 250, foc: 150, fed: { ticks: 3 * T, hpMax: 0, staMax: 100, focMax: 100 } },
  }),
  item('item.berry_compote', 'consumable', {
    value: 12,
    food: { hp: 12, sta: 100, foc: 0, fed: { ticks: 3 * T, hpMax: 10, staMax: 0, focMax: 0 } },
  }),
  item('item.herbed_skewer', 'consumable', {
    value: 16,
    food: { hp: 20, sta: 150, foc: 0, fed: { ticks: 4 * T, hpMax: 10, staMax: 100, focMax: 0 } },
  }),
  item('item.hearty_stew', 'consumable', {
    value: 28,
    tier: 2,
    food: { hp: 35, sta: 250, foc: 100, fed: { ticks: 5 * T, hpMax: 20, staMax: 150, focMax: 50 } },
  }),
  item('item.dish_bread', 'consumable', { value: 6, food: { hp: 8, sta: 100, foc: 0 } }),
  item('item.honey_cake', 'consumable', {
    value: 14,
    food: { hp: 10, sta: 0, foc: 250, fed: { ticks: 2 * T, hpMax: 0, staMax: 0, focMax: 150 } },
  }),
  // Money and odds and ends. Coin is held as a number, not in a slot.
  item('item.coin', 'currency', { value: 1, stack: 9999 }),
  // Still edible, just poor: it restores a little and gives no buff.
  item('item.burnt_mess', 'consumable', { value: 0, food: { hp: 3, sta: 0, foc: 0 } }),
  item('item.old_key', 'misc', { value: 0, stack: 1 }),
  item('item.river_pebble', 'misc', { value: 1 }),
  item('item.crow_feather', 'misc', { value: 2 }),
  item('item.bone_shard', 'misc', { value: 2 }),
  item('item.lantern_oil', 'misc', { value: 5 }),
  item('item.worn_map', 'misc', { value: 0, stack: 1 }),
];

/** Every item by id. */
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(LIST.map((d) => [d.id, d]));
