import type { ItemDef } from './types';
import { item } from './define';

/** Money, keys, keepsakes and the few things that are none of the other kinds. */
export const MISC_ITEMS: readonly ItemDef[] = [
  // Money and odds and ends. Coin is held as a number, not in a slot.
  item('item.coin', 'currency', { value: 1, stack: 9999 }),
  item('item.old_key', 'misc', { value: 0, stack: 1 }),
  item('item.river_pebble', 'misc', { value: 1 }),
  item('item.crow_feather', 'misc', { value: 2 }),
  item('item.bone_shard', 'misc', { value: 2 }),
  item('item.lantern_oil', 'misc', { value: 5 }),
  item('item.worn_map', 'misc', { value: 0, stack: 1 }),
  // A tier 1 instrument for the off hand. Performance (M3-13) needs one for the Lullaby.
  item('item.flute_reed', 'misc', {
    value: 20,
    quality: true,
    durability: 40,
    stack: 1,
    bag: 'gear',
    equip: { slot: 'off' },
  }),
  // A recipe scroll: read it to learn the recipe (M3-10). Sold by Brin.
  item('item.scroll_sword_iron', 'misc', {
    value: 40,
    stack: 1,
    teaches: 'recipe.sword_iron',
    icon: 'icon.scroll_recipe',
  }),
  item('item.whetstone', 'misc', { value: 8 }),
  item('item.thread_spool', 'misc', { value: 5 }),
  item('item.chalk_stub', 'misc', { value: 2 }),
];
