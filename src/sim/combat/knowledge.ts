import { WEAPONS } from '../../content/combat/attacks';
import { TECHNIQUES, type TechniqueDef } from '../../content/combat/techniques';
import { getComp, type EntityId } from '../kernel/entities';
import { isAwake } from '../skills';
import type { SimState } from '../state';
import { hasShield } from './guard';

/** The flag the journal holds once a technique is learned (insight, taught or read). */
export const learnedFlag = (id: string): string => `learned.${id}`;

/**
 * True if the avatar knows the technique (design/03, Awakening and sources): its skill is awake,
 * the points reach its band, and its source is satisfied. `innate` needs the weapon or shield of
 * that family held. `insight`, `taught` and `manual` need the learned flag, which an insight
 * count writes when it is reached. `trial` is the rank itself: points never reach a band above 0
 * without its Trial passed.
 */
export function knows(state: SimState, who: EntityId, t: TechniqueDef): boolean {
  const s = getComp(state.entities, who, 'skills');
  if (!s || !isAwake(s, t.skill) || (s.points[t.skill] ?? 0) < t.band) return false;
  if (t.source === 'trial') return true;
  if (t.source === 'innate') {
    const cb = getComp(state.entities, who, 'combatant');
    if (t.requires?.main && WEAPONS[cb?.weapon ?? '']?.family !== t.requires.main) return false;
    if (t.requires?.off === 'shield' && !hasShield(state, who)) return false;
    return true;
  }
  return getComp(state.entities, who, 'journal')?.flags.includes(learnedFlag(t.id)) === true;
}

/** Slot 1 holds the technique of the weapon held, but only once it is known. */
export function syncSignature(state: SimState, who: EntityId): void {
  const f = getComp(state.entities, who, 'fighter');
  const cb = getComp(state.entities, who, 'combatant');
  if (!f || !cb) return;
  const sig = WEAPONS[cb.weapon]?.signature ?? null;
  const t = sig ? TECHNIQUES[sig] : undefined;
  f.slots[0] = t && knows(state, who, t) ? sig : null;
  const ld = getComp(state.entities, who, 'loadouts');
  if (ld) ld.sets[ld.active].slots = [...f.slots];
}
