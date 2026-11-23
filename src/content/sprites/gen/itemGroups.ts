/**
 * Tier lines of one tool or weapon (POW-M4-22F). Members may share a silhouette, so the
 * look-alike check asks less of them: they must differ in 10% of their pixels and in the ramp
 * (metal or wood color) of what differs. Everything else must differ in 20%.
 */
export const ICON_VARIANT_GROUPS: readonly (readonly string[])[] = [
  ['icon.sword_rusty', 'icon.sword_bronze', 'icon.sword_iron', 'icon.sword_steel'],
  ['icon.spear_ash', 'icon.spear_hunter', 'icon.spear_iron', 'icon.spear_steel'],
  ['icon.pick_copper', 'icon.pick_iron'],
  ['icon.axe_copper', 'icon.axe_iron'],
  ['icon.sickle_copper', 'icon.sickle_iron'],
  ['icon.hammer_copper', 'icon.hammer_iron'],
  ['icon.maul_oak', 'icon.maul_iron'],
  ['icon.rod_ash', 'icon.rod_yew'],
];
