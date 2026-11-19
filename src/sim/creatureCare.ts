import { INTERACTIONS } from '../content/creatures/interactions';
import { CREATURES } from '../content/creatures';
import { ITEMS } from '../content/items';
import { nearestInArc } from './combat/fighter';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { dirStep } from './kernel/fixed';
import { removeItem } from './items';
import type { SimState } from './state';

/** How far in front of the avatar a hand reaches a creature, px. */
export const FEED_REACH = 30;

/** True while a creature is calm: fed or soothed, and not hit since. */
export function isCalm(state: SimState, id: EntityId): boolean {
  const until = getComp(state.entities, id, 'ai')?.calmUntil;
  return until !== undefined && state.worldTick < until;
}

/** Calms a creature for `ticks`. Anything it was chasing is let go by its brain on its next step. */
export function calm(state: SimState, id: EntityId, ticks: number): void {
  const ai = getComp(state.entities, id, 'ai');
  if (!ai || ticks <= 0) return;
  ai.calmUntil = Math.max(ai.calmUntil ?? 0, state.worldTick + ticks);
  // Whatever it held against the avatar is forgotten.
  ai.provoked = false;
}

/** The Lullaby (and any song like it) soothes a creature that data says it reaches. */
export function soothe(state: SimState, id: EntityId): void {
  const ai = getComp(state.entities, id, 'ai');
  const ticks = ai ? INTERACTIONS[ai.creature]?.soothe : undefined;
  if (ticks) calm(state, id, ticks);
}

/** True unless data says the bell and frights do not move this creature. */
export function scareable(creature: string): boolean {
  return INTERACTIONS[creature]?.scare !== false;
}

/**
 * Offers the item in bag slot `slot` to the creature in front of `who`. It is taken (one unit) if
 * that creature's data lists the item and it is not in a fight. Returns true if it was taken.
 */
export function feedCreature(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const a = getComp(state.entities, who, 'avatar');
  const stack = inv?.slots[slot];
  if (!inv || !a || !stack || !ITEMS[stack.item]) return false;
  const target = nearestInArc(state, who, dirStep(a.facing), FEED_REACH, 0);
  if (target === null) return false;
  const ai = getComp(state.entities, target, 'ai');
  const f = getComp(state.entities, target, 'fighter');
  const feed = ai ? INTERACTIONS[ai.creature]?.feed : undefined;
  if (!ai || !f || !feed || !CREATURES[ai.creature] || f.state === 'dead') return false;
  if (!feed.items.includes(stack.item) || ai.provoked) return false;
  if (!removeItem(inv, stack.item, 1)) return false;
  calm(state, target, feed.calmTicks);
  emit(state.events, { type: 'creatureFed', id: target, who, item: stack.item });
  return true;
}
