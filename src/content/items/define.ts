import type { BagFilter, ItemDef } from './types';

/** Ticks in a minute, for Fed buffs. */
export const T = 30 * 60;

const BAG: Record<ItemDef['category'], BagFilter> = {
  weapon: 'gear',
  armor: 'gear',
  tool: 'tools',
  consumable: 'food',
  material: 'materials',
  currency: 'other',
  misc: 'other',
};

/**
 * Builds an item. Names and descriptions are keyed `<id>.name` and `<id>.desc` in
 * `content/strings/items.ts`, and the icon is `icon.<id without item.>`. Gear and tools never
 * stack. Everything lists under the Bag filter of its category unless `bag` says otherwise.
 */
export function item(
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
    stack: category === 'weapon' || category === 'armor' || category === 'tool' ? 1 : 20,
    tier: 1,
    bag: BAG[category],
    ...fields,
  };
}
