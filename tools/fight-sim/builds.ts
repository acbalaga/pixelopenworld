/**
 * Fight simulator builds (POW-M3-12). A build is data: the skill it trains, the gear it wears at
 * each par rank, and for magic the spells it casts. One per weapon family, and three magic builds.
 *
 * Each build is run at the par ranks of tier 1 and tier 2 (`parRank` in `balance/skills.ts`: 0
 * and 15), wearing the best gear of that tier the content has. A family that has no tier 2 weapon
 * yet wears its tier 1 one at both ranks.
 */
export interface Build {
  id: string;
  label: string;
  /** The skill whose rank the build is run at. */
  skill: string;
  kind: 'weapon' | 'magic';
  /** Main-hand weapon by tier (1, 2). Missing means bare hands. */
  weapon?: { 1?: string; 2?: string };
  /** What the character carries besides bread, by tier: mages carry Focus potions. */
  potion?: { 1: string; 2: string };
  /** Spells to learn and slot, best first, by tier. The harness casts the first affordable one. */
  spells?: { 1: string[]; 2: string[] };
}

export const BUILDS: readonly Build[] = [
  {
    id: 'blades',
    label: 'Blades (sword)',
    skill: 'skill.blades',
    kind: 'weapon',
    weapon: { 1: 'item.sword_rusty', 2: 'item.sword_iron' },
  },
  {
    id: 'polearms',
    label: 'Polearms (spear)',
    skill: 'skill.polearms',
    kind: 'weapon',
    weapon: { 1: 'item.spear_ash', 2: 'item.spear_iron' },
  },
  {
    id: 'heavy',
    label: 'Heavy Arms (maul)',
    skill: 'skill.heavy',
    kind: 'weapon',
    weapon: { 1: 'item.maul_oak', 2: 'item.maul_iron' },
  },
  {
    id: 'archery',
    label: 'Archery (bow)',
    skill: 'skill.archery',
    kind: 'weapon',
    weapon: { 1: 'item.bow_short', 2: 'item.bow_long' },
  },
  {
    id: 'unarmed',
    label: 'Unarmed (cloth wraps)',
    skill: 'skill.unarmed',
    kind: 'weapon',
    weapon: { 1: 'item.wraps_cloth', 2: 'item.wraps_leather' },
  },
  {
    id: 'ember',
    label: 'Ember (fire)',
    skill: 'skill.ember',
    kind: 'magic',
    // Spell power follows the weapon in hand (no focus orb exists yet), so a mage carries a blade.
    weapon: { 1: 'item.sword_rusty', 2: 'item.sword_iron' },
    potion: { 1: 'item.potion_focus', 2: 'item.potion_focus_m' },
    spells: {
      1: ['technique.ember_bolt'],
      2: ['technique.ember_flame_ring', 'technique.ember_bolt'],
    },
  },
  {
    id: 'tide',
    label: 'Tide (water)',
    skill: 'skill.tide',
    kind: 'magic',
    // Spell power follows the weapon in hand (no focus orb exists yet), so a mage carries a blade.
    weapon: { 1: 'item.sword_rusty', 2: 'item.sword_iron' },
    potion: { 1: 'item.potion_focus', 2: 'item.potion_focus_m' },
    spells: {
      1: ['technique.tide_splash'],
      2: ['technique.tide_undertow', 'technique.tide_splash'],
    },
  },
  {
    id: 'stone',
    label: 'Stone (earth)',
    skill: 'skill.stone',
    kind: 'magic',
    // Spell power follows the weapon in hand (no focus orb exists yet), so a mage carries a blade.
    weapon: { 1: 'item.sword_rusty', 2: 'item.sword_iron' },
    potion: { 1: 'item.potion_focus', 2: 'item.potion_focus_m' },
    spells: { 1: ['technique.stone_fist'], 2: ['technique.stone_fist'] },
  },
];

/**
 * What every build wears: nothing at tier 1 (a new character has no armor), and head, body and
 * legs of iron at tier 2, which is what the first map is meant to lead to.
 */
export const ARMOR: Record<1 | 2, string[]> = {
  1: [],
  2: ['item.helm_iron', 'item.cuirass_iron', 'item.greaves_iron'],
};
