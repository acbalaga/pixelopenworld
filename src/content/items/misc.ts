import type { ItemDef } from './types';
import { item } from './define';

/** Money, keys, keepsakes and the few things that are none of the other kinds. */
export const MISC_ITEMS: readonly ItemDef[] = [
  // Money and odds and ends. Coin is held as a number, not in a slot.
  item('item.coin', 'currency', { value: 1, stack: 9999 }),
  item('item.old_key', 'misc', { value: 0, stack: 1 }),
  // The Rootway's key (M4-21): a knot of dried root, found behind the stump gates. Borrowed icon.
  item('item.root_key', 'misc', { value: 0, stack: 1, icon: 'icon.old_key' }),
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
  // Gadgets (M3-14): the Use button does their one thing. Tinkering makes them.
  ...(
    [
      ['item.spark_flint', 'spark', 18],
      ['item.water_flask', 'flask', 14],
      ['item.smoke_pellet', 'smoke', 22],
      ['item.bell_charm', 'bell', 26],
      ['item.repair_kit', 'repair', 40],
      ['item.snare', 'snare', 24],
      ['item.grit_pouch', 'grit', 12],
    ] as const
  ).map(([id, gadget, value]) =>
    item(id, 'misc', { value, stack: 10, gadget, bag: 'tools', tier: 1 }),
  ),
  // The lantern is worn in the off hand and lights dark rooms.
  item('item.lantern', 'misc', {
    value: 45,
    quality: true,
    durability: 60,
    stack: 1,
    bag: 'gear',
    gadget: 'lantern',
    equip: { slot: 'off' },
  }),
  // Singular rewards and parts (M4-20). Icons are borrowed until art for them is drawn.
  item('item.crow_feather_charm', 'misc', {
    value: 0,
    stack: 1,
    bag: 'gear',
    icon: 'icon.crow_feather',
    equip: { slot: 'accessory' },
    noWear: true,
  }),
  item('item.wayfarers_cloak', 'misc', {
    value: 0,
    stack: 1,
    bag: 'gear',
    icon: 'icon.belt_leather',
    equip: { slot: 'accessory' },
    noWear: true,
  }),
  item('item.bakers_peel', 'misc', { value: 0, stack: 1, icon: 'icon.whetstone' }),
  item('item.firebrick', 'misc', { value: 0, stack: 4, icon: 'icon.clay' }),
  item('item.thread_spool', 'misc', { value: 5 }),
  item('item.chalk_stub', 'misc', { value: 2 }),
];
