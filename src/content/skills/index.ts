import type { SkillDef, TrialDef } from './types';

export type { SkillDef, TrialDef, XpSource, XpEvent, SkillFamily } from './types';

const damage = (tag: string): SkillDef['sources'] => [
  { on: 'damage', tag, base: 10, firstTime: 100 },
];

/**
 * All 36 skills (design/03, design/11), in table order: families in design/03 order, skills in
 * table order within a family. The sim never counts them: anything here, or added with
 * {@link registerSkill}, is a skill. Every skill gets points, a pool contribution by its family,
 * a place on the HUD and the Trial gate with no code change. A skill with no `sources` yet is
 * listed in {@link PENDING_SKILLS}.
 */
export const SKILLS: Record<string, SkillDef> = Object.fromEntries(
  (
    [
      // Arms.
      {
        id: 'skill.blades',
        name: 'Blades',
        family: 'arms',
        weapon: 'blades',
        sources: damage('blades'),
      },
      {
        id: 'skill.heavy_arms',
        name: 'Heavy Arms',
        family: 'arms',
        weapon: 'heavy',
        sources: damage('heavy'),
      },
      {
        id: 'skill.polearms',
        name: 'Polearms',
        family: 'arms',
        weapon: 'polearms',
        sources: damage('polearms'),
      },
      {
        id: 'skill.archery',
        name: 'Archery',
        family: 'arms',
        weapon: 'archery',
        sources: damage('archery'),
      },
      {
        id: 'skill.unarmed',
        name: 'Unarmed',
        family: 'arms',
        weapon: 'unarmed',
        sources: damage('unarmed'),
      },
      {
        id: 'skill.shieldcraft',
        name: 'Shieldcraft',
        family: 'arms',
        // A parry pays more than a block. Both scale with the tier of whoever swung.
        sources: [
          { on: 'block', base: 6 },
          { on: 'parry', base: 20 },
        ],
      },
      {
        id: 'skill.evasion',
        name: 'Evasion',
        family: 'arms',
        sources: [{ on: 'dodge', base: 12 }],
      },
      // Magic.
      { id: 'skill.ember', name: 'Ember', family: 'magic', sources: damage('ember') },
      { id: 'skill.tide', name: 'Tide', family: 'magic', sources: damage('tide') },
      { id: 'skill.gale', name: 'Gale', family: 'magic', sources: damage('gale') },
      { id: 'skill.stone', name: 'Stone', family: 'magic', sources: damage('stone') },
      {
        id: 'skill.mending',
        name: 'Mending',
        family: 'magic',
        // Health restored by a Mending technique pays.
        sources: [{ on: 'heal', base: 4, firstTime: 100, scaled: false }],
      },
      {
        id: 'skill.hexing',
        name: 'Hexing',
        family: 'magic',
        // Hexing something pays, and the first time pays a lump. Spells arrive in M3-13.
        sources: [
          { on: 'statusApplied', tag: 'hexed', base: 10, firstTime: 100 },
          ...damage('hexing'),
        ],
      },
      // Gathering.
      {
        id: 'skill.mining',
        name: 'Mining',
        family: 'gathering',
        sources: [{ on: 'gather', tag: 'mining', base: 20, firstTime: 100 }],
      },
      {
        id: 'skill.logging',
        name: 'Logging',
        family: 'gathering',
        sources: [{ on: 'gather', tag: 'logging', base: 20, firstTime: 100 }],
      },
      {
        id: 'skill.foraging',
        name: 'Foraging',
        family: 'gathering',
        sources: [{ on: 'gather', tag: 'foraging', base: 150, firstTime: 150 }],
      },
      {
        id: 'skill.fishing',
        name: 'Fishing',
        family: 'gathering',
        sources: [{ on: 'gather', tag: 'fishing', base: 20, firstTime: 100 }],
      },
      { id: 'skill.farming', name: 'Farming', family: 'gathering', sources: [] },
      { id: 'skill.husbandry', name: 'Husbandry', family: 'gathering', sources: [] },
      // Crafting.
      {
        id: 'skill.smithing',
        name: 'Smithing',
        family: 'crafting',
        sources: [
          { on: 'craft', tag: 'smithing', base: 25, firstTime: 100 },
          { on: 'repair', base: 12 },
        ],
      },
      {
        id: 'skill.woodworking',
        name: 'Woodworking',
        family: 'crafting',
        sources: [{ on: 'craft', tag: 'woodworking', base: 25, firstTime: 100 }],
      },
      {
        id: 'skill.tailoring',
        name: 'Tailoring',
        family: 'crafting',
        sources: [{ on: 'craft', tag: 'tailoring', base: 25, firstTime: 100 }],
      },
      {
        id: 'skill.cooking',
        name: 'Cooking',
        family: 'crafting',
        sources: [{ on: 'craft', tag: 'cooking', base: 170, firstTime: 150 }],
      },
      {
        id: 'skill.alchemy',
        name: 'Alchemy',
        family: 'crafting',
        sources: [{ on: 'craft', tag: 'alchemy', base: 25, firstTime: 100 }],
      },
      {
        id: 'skill.enchanting',
        name: 'Enchanting',
        family: 'crafting',
        sources: [{ on: 'craft', tag: 'enchanting', base: 25, firstTime: 100 }],
      },
      {
        id: 'skill.tinkering',
        name: 'Tinkering',
        family: 'crafting',
        sources: [{ on: 'craft', tag: 'tinkering', base: 25, firstTime: 100 }],
      },
      // Social.
      {
        id: 'skill.bartering',
        name: 'Bartering',
        family: 'social',
        // Winning a haggle pays most, and the first win at each shop a lump. Every sale pays a little.
        sources: [
          { on: 'haggle', base: 14, firstTime: 60, scaled: false },
          { on: 'sale', base: 3, scaled: false },
        ],
      },
      {
        id: 'skill.performance',
        name: 'Performance',
        family: 'social',
        // A finished song pays, and the first of each song a lump.
        sources: [{ on: 'perform', base: 12, firstTime: 80, scaled: false }],
      },
      { id: 'skill.leadership', name: 'Leadership', family: 'social', sources: [] },
      { id: 'skill.taming', name: 'Taming', family: 'social', sources: [] },
      {
        id: 'skill.stealth',
        name: 'Stealth',
        family: 'social',
        // Passing a creature unnoticed pays, and the first of each kind a lump.
        sources: [{ on: 'sneak', base: 8, firstTime: 60, scaled: false }],
      },
      // Exploration.
      { id: 'skill.cartography', name: 'Cartography', family: 'exploration', sources: [] },
      {
        id: 'skill.survival',
        name: 'Survival',
        family: 'exploration',
        sources: [
          { on: 'outdoorsNight', base: 30, scaled: false },
          { on: 'eatRaw', base: 8, scaled: false },
        ],
      },
      {
        id: 'skill.athletics',
        name: 'Athletics',
        family: 'exploration',
        sources: [{ on: 'sprint', base: 3, scaled: false }],
      },
      {
        id: 'skill.deciphering',
        name: 'Deciphering',
        family: 'exploration',
        // First reading of a tablet kind only. A tablet read again pays nothing.
        sources: [{ on: 'tabletRead', base: 0, scaled: false, firstTime: 100 }],
      },
      { id: 'skill.delving', name: 'Delving', family: 'exploration', sources: [] },
    ] satisfies SkillDef[]
  ).map((d) => [d.id, d]),
);

/**
 * Skills with no XP source yet. The six late skills wait for their milestone. The rest wait for
 * the M3 ticket that adds their system, and that ticket removes them from this list. Never wire
 * XP to a skill listed here. A test checks that every skill not listed earns XP.
 */
export const PENDING_SKILLS: string[] = [
  // Late skills, M4 to M6.
  'skill.farming',
  'skill.husbandry',
  'skill.leadership',
  'skill.taming',
  'skill.cartography',
  'skill.delving',
];

/**
 * Trials (design/03). Six rank 15 Trials are authored on the slice map. The rest of rank 15 and
 * rank 30 come with Hearthford in M4-12. Text is in `content/strings/skills.ts`.
 */
export const TRIALS: Record<string, TrialDef> = {
  'trial.blades.15': {
    id: 'trial.blades.15',
    skill: 'skill.blades',
    threshold: 15,
    giver: { npc: 'npc.guard' },
    intro: 'trial.blades.15.intro',
    hint: 'trial.blades.15.hint',
    objective: {
      kind: 'defeat',
      creature: 'creature.mossling',
      count: 3,
      inARow: true,
      untouched: true,
      only: { weapon: 'blades' },
    },
    estMinutes: 4,
  },
  'trial.polearms.15': {
    id: 'trial.polearms.15',
    skill: 'skill.polearms',
    threshold: 15,
    giver: { npc: 'npc.guard' },
    intro: 'trial.polearms.15.intro',
    hint: 'trial.polearms.15.hint',
    objective: {
      kind: 'defeat',
      creature: 'creature.bramble_boar',
      count: 2,
      only: { weapon: 'polearms' },
    },
    estMinutes: 6,
  },
  'trial.evasion.15': {
    id: 'trial.evasion.15',
    skill: 'skill.evasion',
    threshold: 15,
    giver: { npc: 'npc.guard' },
    intro: 'trial.evasion.15.intro',
    hint: 'trial.evasion.15.hint',
    objective: { kind: 'perform', action: 'perfectDodge', count: 5, inOneFight: true },
    estMinutes: 5,
  },
  'trial.ember.15': {
    id: 'trial.ember.15',
    skill: 'skill.ember',
    threshold: 15,
    giver: { npc: 'npc.scholar' },
    intro: 'trial.ember.15.intro',
    hint: 'trial.ember.15.hint',
    objective: {
      kind: 'defeat',
      creature: 'creature.spitbloom',
      count: 3,
      only: { element: 'ember' },
    },
    estMinutes: 5,
  },
  'trial.athletics.15': {
    id: 'trial.athletics.15',
    skill: 'skill.athletics',
    threshold: 15,
    giver: { npc: 'npc.pilgrim' },
    intro: 'trial.athletics.15.intro',
    hint: 'trial.athletics.15.hint',
    objective: { kind: 'reach', room: 'room.a', from: 'fixture.waystone', withinTicks: 40 * 30 },
    estMinutes: 2,
  },
  'trial.smithing.15': {
    id: 'trial.smithing.15',
    skill: 'skill.smithing',
    threshold: 15,
    giver: { npc: 'npc.shopkeeper' },
    intro: 'trial.smithing.15.intro',
    hint: 'trial.smithing.15.hint',
    objective: { kind: 'craft', recipe: 'recipe.sword_iron', minQuality: 1 },
    estMinutes: 8,
  },
  'trial.cooking.15': {
    id: 'trial.cooking.15',
    skill: 'skill.cooking',
    threshold: 15,
    giver: { npc: 'npc.cook' },
    intro: 'trial.cooking.15.intro',
    hint: 'trial.cooking.15.hint',
    objective: { kind: 'deliver', item: 'item.hearty_stew', qty: 1, minQuality: 1, to: 'npc.cook' },
    estMinutes: 6,
  },
  'trial.foraging.15': {
    id: 'trial.foraging.15',
    skill: 'skill.foraging',
    threshold: 15,
    giver: { npc: 'npc.cook' },
    intro: 'trial.foraging.15.intro',
    hint: 'trial.foraging.15.hint',
    objective: { kind: 'gather', item: 'item.sunwort', count: 1, phases: ['dawn', 'dusk'] },
    estMinutes: 3,
  },
};

/** Adds or replaces a skill. For content that loads later, and for tests. */
export function registerSkill(def: SkillDef): void {
  SKILLS[def.id] = def;
}

/** Removes a skill. For tests. */
export function unregisterSkill(id: string): void {
  delete SKILLS[id];
}

/** Adds or replaces a Trial. */
export function registerTrial(def: TrialDef): void {
  TRIALS[def.id] = def;
}

/** Removes a Trial. For tests. */
export function unregisterTrial(id: string): void {
  delete TRIALS[id];
}

/** Key of the flag that records a passed Trial for a skill and threshold. */
export function trialKey(skill: string, threshold: number): string {
  return `${skill}@${threshold}`;
}

/** How many steps a Trial's objective counts. */
export function trialCount(o: TrialDef['objective']): number {
  return o.kind === 'defeat' || o.kind === 'gather' || o.kind === 'perform'
    ? o.count
    : o.kind === 'deliver'
      ? o.qty
      : 1;
}
