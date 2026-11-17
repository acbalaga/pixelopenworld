import type { SkillDef, TrialDef } from './types';

export type { SkillDef, TrialDef, XpSource, XpEvent, SkillFamily } from './types';

/**
 * The skills built so far. The sim never counts them: anything here, or added with
 * {@link registerSkill}, is a skill. Every skill gets points, a pool contribution by its family,
 * a place on the HUD and the Trial gate with no code change.
 */
export const SKILLS: Record<string, SkillDef> = {
  'skill.blades': {
    id: 'skill.blades',
    name: 'Blades',
    family: 'arms',
    weapon: 'blades',
    sources: [{ on: 'damage', tag: 'blades', base: 10, firstTime: 100 }],
  },
  'skill.polearms': {
    id: 'skill.polearms',
    name: 'Polearms',
    family: 'arms',
    weapon: 'polearms',
    sources: [{ on: 'damage', tag: 'polearms', base: 10, firstTime: 100 }],
  },
  'skill.ember': {
    id: 'skill.ember',
    name: 'Ember',
    family: 'magic',
    sources: [{ on: 'damage', tag: 'ember', base: 10, firstTime: 100 }],
  },
  'skill.evasion': {
    id: 'skill.evasion',
    name: 'Evasion',
    family: 'arms',
    sources: [{ on: 'dodge', base: 12 }],
  },
  'skill.foraging': {
    id: 'skill.foraging',
    name: 'Foraging',
    family: 'gathering',
    sources: [{ on: 'gather', tag: 'foraging', base: 20, firstTime: 100 }],
  },
  'skill.cooking': {
    id: 'skill.cooking',
    name: 'Cooking',
    family: 'crafting',
    sources: [{ on: 'cook', tag: 'cooking', base: 25, firstTime: 100 }],
  },
  'skill.athletics': {
    id: 'skill.athletics',
    name: 'Athletics',
    family: 'exploration',
    sources: [{ on: 'sprint', base: 3, scaled: false }],
  },
};

/**
 * Trials. One is built to prove the mechanism: the Foraging Trial at 15, given by the cook.
 * `item.sunwort` is the herb. Its item definition arrives with the items ticket (M1-05).
 */
export const TRIALS: Record<string, TrialDef> = {
  'trial.foraging.15': {
    id: 'trial.foraging.15',
    skill: 'skill.foraging',
    threshold: 15,
    giver: 'npc.cook',
    gather: { item: 'item.sunwort', phases: ['dawn', 'dusk'] },
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
