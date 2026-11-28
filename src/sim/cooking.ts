import { COOKING as C } from '../content/balance/cooking';
import { ITEMS } from '../content/items';
import { RECIPES } from '../content/items/recipes';
import { countItem, give, removeItem } from './items';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { SUBPX } from './kernel/fixed';
import { spendCoin } from './ledger';
import type { SimState } from './state';
import { applyStatus, clearStatus } from './statuses';
import { dayIndexOf, localMinute } from './travelers/schedule';
import { remember } from './travelers/social';

/**
 * Cooking in full (POW-M6-04, design/05 Cooking): the social side of the craft. Aldo's mill, the
 * camp meal that feeds a party, and sharing a dish with a Traveler. The recipes themselves are
 * ordinary crafting (`crafting.ts`), at the camp pot and the inn's oven. Pure.
 */

/** True if the item is a cooked dish: food a cooking recipe makes. A gift people value (M6-09). */
export function isDish(item: string): boolean {
  return !!ITEMS[item]?.food && DISH_RESULTS.has(item);
}

const DISH_RESULTS: ReadonlySet<string> = new Set(
  Object.values(RECIPES)
    .filter((r) => r.craft === 'cooking')
    .map((r) => r.result),
);

/** Aldo mills `mill.wheat` wheat into one flour for `mill.fee` coin. */
export function mill(state: SimState, who: EntityId): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const a = getComp(state.entities, who, 'avatar');
  if (!inv || !a || a.coin < C.mill.fee || countItem(inv, 'item.wheat') < C.mill.wheat)
    return false;
  removeItem(inv, 'item.wheat', C.mill.wheat);
  spendCoin(state, who, C.mill.fee, 'mill');
  give(state, who, 'item.flour', 1, 'mill');
  emit(state.events, { type: 'milled', who });
  return true;
}

/**
 * A camp meal: a dish cooked at the camp pot while in a party feeds every member standing within
 * `campPx` of the cook. Each gets the dish's Fed buff, as if they had eaten it. Members out of
 * range, and members not in the world (not promoted), get nothing.
 */
export function campMeal(state: SimState, who: EntityId, item: string): number[] {
  const fed = ITEMS[item]?.food?.fed;
  const party = state.party;
  const crowd = state.crowd;
  const me = getComp(state.entities, who, 'pos');
  if (!fed || !party || !crowd || !me || party.members.length === 0) return [];
  const out: number[] = [];
  for (const m of party.members) {
    const ent = crowd.entOf[m.slot] ?? -1;
    const p = ent >= 0 ? getComp(state.entities, ent, 'pos') : undefined;
    if (!p) continue;
    if (Math.hypot((p.x - me.x) / SUBPX, (p.y - me.y) / SUBPX) > C.campPx) continue;
    // One Fed at a time, as when eating: the meal replaces any other.
    clearStatus(state, ent, 'fed');
    applyStatus(state, ent, 'fed', who, { ticks: fed.ticks, item });
    out.push(m.slot);
  }
  if (out.length > 0) emit(state.events, { type: 'campMeal', who, item, slots: out });
  return out;
}

/**
 * Shares a dish from the Bag with a Traveler who is here (the "Share food" chip on their card). It
 * is a gift: the Traveler remembers it, which raises regard once per real day.
 */
export function shareFood(state: SimState, who: EntityId, slot: number): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const life = state.travelers[slot];
  const ent = state.crowd?.entOf[slot] ?? -1;
  if (!inv || !life || ent < 0 || !state.clock) return false;
  const k = inv.slots.findIndex((s) => !!s && isDish(s.item));
  const stack = k >= 0 ? inv.slots[k] : null;
  if (!stack) return false;
  const item = stack.item;
  stack.qty--;
  if (stack.qty === 0) inv.slots[k] = null;
  const whole = localMinute(state.clock.nowMs, state.clock.tzOffsetMin);
  remember(life, 'gifted', 0, dayIndexOf(whole), whole);
  emit(state.events, { type: 'foodShared', who, slot, item });
  return true;
}
