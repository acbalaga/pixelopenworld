import { COMBAT as C } from '../content/balance/combat';
import { getComp, type EntityId } from './kernel/entities';
import type { SimState } from './state';

/**
 * Fights (M3-03). A fight starts when the avatar deals or takes damage after `pools.lastCombat`
 * has been quiet for `hpRegenDelay` ticks, and ends after `hpRegenDelay` quiet ticks. Trials
 * (`inOneFight`, `untouched`) and, in M3-08, deeds read it. The record lives on the skills
 * component so it survives a save.
 */

/** The value of `skills.fight.last` before any fight: far enough back that the first hit starts one. */
export const NO_FIGHT = -1_000_000_000;

/** Call once a tick, after the tick's combat. Starts a new fight when combat resumes after a quiet spell. */
export function trackFight(state: SimState, who: EntityId): void {
  const s = getComp(state.entities, who, 'skills');
  const p = getComp(state.entities, who, 'pools');
  if (!s || !p || p.lastCombat !== state.tick) return;
  if (state.tick - s.fight.last >= C.pools.hpRegenDelay) s.fight.id++;
  s.fight.last = state.tick;
}

/** The number of the current or latest fight. 0 before the first. */
export function fightId(state: SimState, who: EntityId): number {
  return getComp(state.entities, who, 'skills')?.fight.id ?? 0;
}

/** True while a fight is on: combat within the last `hpRegenDelay` ticks. */
export function inFight(state: SimState, who: EntityId): boolean {
  const s = getComp(state.entities, who, 'skills');
  return s !== undefined && s !== null && state.tick - s.fight.last < C.pools.hpRegenDelay;
}
