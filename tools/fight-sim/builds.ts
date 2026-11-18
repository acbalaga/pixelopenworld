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
    weapon: { 1: 'item.maul_oak', 2: 'item.maul_oak' },
  },
  {
    id: 'archery',
    label: 'Archery (short bow)',
    skill: 'skill.archery',
    kind: 'weapon',
    weapon: { 1: 'item.bow_short', 2: 'item.bow_short' },
  },
  {
    id: 'unarmed',
    label: 'Unarmed (cloth wraps)',
    skill: 'skill.unarmed',
    kind: 'weapon',
    weapon: { 1: 'item.wraps_cloth', 2: 'item.wraps_cloth' },
  },
  {
    id: 'ember',
    label: 'Ember (fire)',
    skill: 'skill.ember',
    kind: 'magic',
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
    spells: { 1: ['technique.stone_fist'], 2: ['technique.stone_fist'] },
  },
];
