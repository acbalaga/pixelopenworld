import type { DollGear, EquipSlot, ItemDef } from './types';
import { item } from './define';

/** Shields, cloth, leather and mail for head, body and legs at two tiers, and accessories. */
const piece = (
  id: string,
  slot: EquipSlot,
  tier: number,
  defense: number,
  value: number,
  dur: number,
  doll?: DollGear,
): ItemDef =>
  item(id, 'armor', {
    value,
    tier,
    quality: true,
    durability: dur,
    affixSlots: slot === 'body' || slot === 'off' ? 2 : 1,
    equip: { slot, defense, ...(doll ? { doll } : {}) },
  });

export const ARMOR_ITEMS: readonly ItemDef[] = [
  // Shields.
  piece('item.shield_wood', 'off', 1, 3, 25, 70, { offHand: 'shield' }),
  piece('item.shield_buckler', 'off', 1, 2, 18, 60, { offHand: 'shield' }),
  piece('item.shield_iron', 'off', 2, 6, 85, 100, { offHand: 'shield' }),
  piece('item.shield_tower', 'off', 2, 8, 120, 110, { offHand: 'shield' }),
  // Cloth, tier 1 and 2.
  piece('item.cap_wool', 'head', 1, 1, 12, 40),
  piece('item.outfit_wayfarer', 'body', 1, 2, 30, 50, { top: 'tunic', topColor: 'blue' }),
  piece('item.outfit_scholar', 'body', 1, 1, 45, 50, { top: 'robe', topColor: 'violet' }),
  piece('item.trousers_wool', 'legs', 1, 1, 14, 40, { bottom: 'trousers', bottomColor: 'brown' }),
  piece('item.hood_silk', 'head', 2, 2, 40, 60),
  piece('item.robe_silk', 'body', 2, 3, 90, 70, { top: 'robe', topColor: 'rose' }),
  piece('item.skirt_silk', 'legs', 2, 2, 42, 60, { bottom: 'skirt', bottomColor: 'rose' }),
  // Leather.
  piece('item.cap_leather', 'head', 1, 2, 22, 50),
  piece('item.jerkin_leather', 'body', 1, 3, 40, 60, { top: 'vest', topColor: 'ochre' }),
  piece('item.chaps_leather', 'legs', 1, 2, 24, 50, { bottom: 'trousers', bottomColor: 'ochre' }),
  piece('item.hood_hide', 'head', 2, 3, 48, 70),
  piece('item.outfit_leather', 'body', 2, 5, 55, 80, { top: 'vest', topColor: 'brown' }),
  piece('item.chaps_hide', 'legs', 2, 4, 50, 70, { bottom: 'trousers', bottomColor: 'brown' }),
  // Mail: copper rings at tier 1, iron at tier 2.
  piece('item.coif_mail', 'head', 1, 3, 35, 60),
  piece('item.hauberk_mail', 'body', 1, 5, 80, 80, { top: 'tunic', topColor: 'slate' }),
  piece('item.greaves_mail', 'legs', 1, 3, 40, 60, { bottom: 'trousers', bottomColor: 'slate' }),
  piece('item.helm_iron', 'head', 2, 4, 75, 90),
  piece('item.cuirass_iron', 'body', 2, 7, 140, 110, { top: 'tunic', topColor: 'slate' }),
  piece('item.greaves_iron', 'legs', 2, 5, 80, 90, { bottom: 'trousers', bottomColor: 'slate' }),
  // Accessories.
  piece('item.ring_copper', 'accessory', 1, 1, 20, 30),
  piece('item.ring_silver', 'accessory', 2, 2, 70, 50),
  piece('item.amulet_bone', 'accessory', 1, 1, 26, 30),
  piece('item.charm_sun', 'accessory', 2, 2, 90, 50),
  piece('item.belt_leather', 'accessory', 1, 1, 22, 40),
  piece('item.band_iron', 'accessory', 2, 3, 80, 60),
];
