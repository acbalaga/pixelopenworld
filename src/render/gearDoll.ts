import type { DollSpec } from '../content/dolls/parts';
import { ITEMS } from '../content/items';
import { EQUIP_SLOTS, type EquipSlot } from '../content/items/types';

/** The look of a character wearing `equipment` over its `base` look. Pure. */
export function dollWithGear(
  base: DollSpec,
  equipment: Readonly<Record<EquipSlot, { item: string } | null>>,
): DollSpec {
  const out: DollSpec = { ...base, mainHand: 'none', offHand: 'none' };
  for (const slot of EQUIP_SLOTS) {
    const d = ITEMS[equipment[slot]?.item ?? '']?.equip?.doll;
    if (!d) continue;
    if (d.top) out.top = d.top;
    if (d.topColor) out.topColor = d.topColor;
    if (d.bottom) out.bottom = d.bottom;
    if (d.bottomColor) out.bottomColor = d.bottomColor;
    if (d.mainHand) out.mainHand = d.mainHand;
    if (d.offHand) out.offHand = d.offHand;
  }
  return out;
}
