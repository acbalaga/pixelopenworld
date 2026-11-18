import type { ItemDef } from './types';
import { item } from './define';

/**
 * Main-hand weapons for the families that have combat data today: Blades (`sword`) and Polearms
 * (`spear`). Weapons for the other families are authored with their rules: Heavy Arms, Archery
 * and Unarmed in M3-04, the orb in M3-13. Durability is by tier: 60 at tier 1, 100 at tier 2.
 */
const blade = (
  id: string,
  value: number,
  tier: number,
  power: number,
  weapon: 'sword' | 'spear',
): ItemDef =>
  item(id, 'weapon', {
    value,
    tier,
    quality: true,
    durability: tier === 1 ? 60 : 100,
    affixSlots: 2,
    equip: { slot: 'main', weapon, power, doll: { mainHand: weapon } },
  });

/** A tier 1 weapon of a family with its own rules (M3-04). */
const family = (
  id: string,
  value: number,
  power: number,
  weapon: 'maul' | 'bow' | 'wraps',
): ItemDef =>
  item(id, 'weapon', {
    value,
    tier: 1,
    quality: true,
    durability: 60,
    affixSlots: 2,
    equip: { slot: 'main', weapon, power, doll: { mainHand: weapon } },
  });

/** A tier 2 weapon of a family that had only tier 1 (M3-12): iron, longer, or leather. */
const family2 = (
  id: string,
  value: number,
  power: number,
  weapon: 'maul' | 'bow' | 'wraps',
): ItemDef =>
  item(id, 'weapon', {
    value,
    tier: 2,
    quality: true,
    durability: 100,
    affixSlots: 2,
    equip: { slot: 'main', weapon, power, doll: { mainHand: weapon } },
  });

/**
 * The wooden dagger a new character wakes with (M4-14, playtest F4): Blades, the lowest power in
 * the game, and less durability than any tier 1 blade. It can be made again at the workbench.
 */
const DAGGER_WOOD: ItemDef = item('item.dagger_wood', 'weapon', {
  value: 1,
  tier: 1,
  quality: true,
  durability: 40,
  affixSlots: 1,
  equip: { slot: 'main', weapon: 'sword', power: 5, doll: { mainHand: 'dagger' } },
});

export const WEAPON_ITEMS: readonly ItemDef[] = [
  DAGGER_WOOD,
  family2('item.maul_iron', 80, 15, 'maul'),
  family2('item.bow_long', 85, 15, 'bow'),
  family2('item.wraps_leather', 40, 12, 'wraps'),
  family('item.maul_oak', 35, 12, 'maul'),
  family('item.bow_short', 38, 10, 'bow'),
  family('item.wraps_cloth', 15, 7, 'wraps'),
  // The rusty sword matches the base sword, so a new avatar fights as before.
  blade('item.sword_rusty', 6, 1, 10, 'sword'),
  blade('item.sword_bronze', 28, 1, 11, 'sword'),
  blade('item.sword_iron', 60, 2, 14, 'sword'),
  blade('item.sword_steel', 110, 2, 16, 'sword'),
  blade('item.spear_ash', 40, 1, 10, 'spear'),
  blade('item.spear_hunter', 55, 1, 12, 'spear'),
  blade('item.spear_iron', 90, 2, 15, 'spear'),
  blade('item.spear_steel', 130, 2, 17, 'spear'),
];
