/**
 * Feeding a creature (POW-M4-05). What each kind accepts is data (`content/creatures/interactions`);
 * how long the calm lasts and how near the hand must be is balance (`TEMPERAMENT.feed`). Calm itself
 * lives on the creature's brain (`ai.calmUntil`) and is read where a creature would notice someone.
 */
import { TEMPERAMENT as TB } from '../content/balance/temperament';
import { FEEDS } from '../content/creatures/interactions';
import { ITEMS } from '../content/items';
import { centerPx, nearestInArc } from './combat/fighter';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { dirStep } from './kernel/fixed';
import type { SimState } from './state';

/** cos 60 degrees, times 256: a creature must be roughly in front of the hand that feeds it. */
const FRONT_COS256 = 128;

/** The creature in front of `who` that would take `item`, or null. */
export function feedTarget(state: SimState, who: EntityId, item: string): EntityId | null {
  const a = getComp(state.entities, who, 'avatar');
  const f = getComp(state.entities, who, 'fighter');
  if (!a || !f || f.state !== 'idle' || !centerPx(state, who)) return null;
  const id = nearestInArc(state, who, dirStep(a.facing), TB.feed.reachPx, FRONT_COS256);
  if (id === null) return null;
  const ai = getComp(state.entities, id, 'ai');
  const theirs = getComp(state.entities, id, 'fighter');
  // It must be on its feet and still: a creature mid-strike or running is not taking food.
  if (!ai || !theirs || theirs.state !== 'idle' || ai.state === 'flee') return null;
  return FEEDS[ai.creature]?.items.includes(item) ? id : null;
}

/** Feeds the item in bag slot `slot` to the creature in front. False, using nothing, if none will take it. */
export function feedCreature(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  if (!inv || !stack || !ITEMS[stack.item]) return false;
  const id = feedTarget(state, who, stack.item);
  const ai = id === null ? undefined : getComp(state.entities, id, 'ai');
  if (id === null || !ai) return false;
  const item = stack.item;
  stack.qty--;
  if (stack.qty === 0) inv.slots[slot] = null;
  // The avatar lets go of a creature it has just befriended, so nothing swings at it.
  const mine = getComp(state.entities, who, 'fighter');
  if (mine?.lock === id) {
    mine.lock = null;
    emit(state.events, { type: 'lockChanged', id: who, target: null });
  }
  ai.calmUntil = state.worldTick + TB.feed.calmTicks;
  ai.provoked = false;
  ai.target = null;
  ai.state = 'idle';
  ai.t = 0;
  emit(state.events, { type: 'creatureFed', who, id, kind: ai.creature, item });
  emit(state.events, { type: 'befriended', who, id, kind: ai.creature });
  return true;
}
