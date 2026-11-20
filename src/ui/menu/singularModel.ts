/**
 * What the player sees of Singulars (POW-M4-20): a banner per step and a Chronicle line once one
 * is done. Nothing else. Each function checks the avatar's own progress, so text for a Singular
 * that has not fired is never returned, whatever id is asked for.
 */
import { SINGULARS } from '../../content/singulars';
import { SINGULAR_TEXT, WORLD_FIRST_LINE } from '../../content/strings/singulars';
import { getComp, type EntityId } from '../../sim/kernel/entities';
import type { SimEvent } from '../../sim/kernel/events';
import type { SimState } from '../../sim/state';

/** The banner an event calls for, or null. */
export function singularBanner(state: SimState, who: EntityId, e: SimEvent): string | null {
  const j = getComp(state.entities, who, 'journal');
  if (e.type === 'singularStep' && e.who === who) {
    const p = j?.singulars?.[e.id];
    // The step must really have been reached, not only named by an event.
    if (!p || p.step < e.step) return null;
    return SINGULAR_TEXT[e.id]?.steps[e.step] ?? null;
  }
  if (e.type === 'worldFirst' && e.who === who) {
    if (!j?.singulars?.[e.id]?.done) return null;
    const t = SINGULAR_TEXT[e.id];
    return t ? `${t.done} ${WORLD_FIRST_LINE}` : null;
  }
  return null;
}

/** Chronicle lines: one for each Singular the avatar has finished, in the order the data lists them. */
export function chronicleLines(state: SimState, who: EntityId): string[] {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return [];
  return Object.keys(SINGULARS)
    .filter((id) => j.singulars?.[id]?.done)
    .map((id) => SINGULAR_TEXT[id]?.chronicle ?? '')
    .filter((t) => t !== '');
}
