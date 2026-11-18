import { TECHNIQUES } from '../../src/content/combat/techniques';
import { recomputeGear } from '../../src/sim/items';
import { learnTechnique } from '../../src/sim/combat/techniques';
import type { SimState } from '../../src/sim/state';

/**
 * Teaches techniques outright: awakens their skills, writes the learned flags and slots them,
 * as a lesson would. Most tests do not care how a technique was earned (that has its own tests).
 */
export function know(s: SimState, me: number, ...ids: string[]): void {
  for (const id of ids) learnTechnique(s, me, id, 'taught');
}

/** The band 0 techniques each weapon family carries in slot 1. */
export const SIGNATURES = [
  'technique.blades_lunge',
  'technique.heavy_overhead',
  'technique.polearms_lunge',
  'technique.archery_aimed',
  'technique.unarmed_palm',
] as const;

/**
 * Marks techniques learned and their skills awake without slotting anything, so a test that
 * wants the old "weapon techniques are known" start can have it and keep its slot expectations.
 */
export function knowQuiet(s: SimState, me: number, ids: readonly string[] = SIGNATURES): void {
  const j = s.entities.comps.journal[me]!;
  const sk = s.entities.comps.skills[me]!;
  for (const id of ids) {
    const t = TECHNIQUES[id]!;
    if (!j.flags.includes(`learned.${id}`)) j.flags.push(`learned.${id}`);
    if (!sk.awake.includes(t.skill)) sk.awake.push(t.skill);
  }
  recomputeGear(s, me);
}
