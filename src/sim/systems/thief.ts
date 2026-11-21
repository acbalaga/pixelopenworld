/**
 * Thieves (POW-M4-11, m6 Fox Hollow). A creature whose spawner has `steals` that lands a hit on an avatar takes
 * one unit from a bag slot and runs. The unit lives on the creature's brain (`ai.loot`) and is never
 * lost: it drops at the thief's feet when the thief falls or has run its course, and goes back to
 * the bag when the owner is gone. Nothing here creates value, so the ledger needs no entry: the
 * item left the bag and comes back as the same stack.
 */
import { TEMPERAMENT as TB } from '../../content/balance/temperament';
import { SPAWNERS } from '../../content/creatures';
import { ITEMS } from '../../content/items';
import { addStack, spawnPickup } from '../items';
import { getComp, isAlive, query, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { int } from '../kernel/rng';
import type { SimState } from '../state';
import { scare } from './ai';

const alive = (state: SimState, id: EntityId): boolean =>
  isAlive(state.entities, id) && getComp(state.entities, id, 'fighter')?.state !== 'dead';

/** Takes one unit from a random eligible bag slot of `who`. Returns it, or null if there is none. */
function take(state: SimState, who: EntityId) {
  const inv = getComp(state.entities, who, 'inventory');
  if (!inv) return null;
  const open: number[] = [];
  inv.slots.forEach((s, i) => {
    const cat = s ? ITEMS[s.item]?.category : undefined;
    if (s && cat && (TB.thief.categories as readonly string[]).includes(cat)) open.push(i);
  });
  if (open.length === 0) return null;
  const at = open[int(state.rng.world, 0, open.length - 1)] as number;
  const slot = inv.slots[at];
  if (!slot) return null;
  const stack = { ...slot, qty: 1, ...(slot.affixes ? { affixes: [...slot.affixes] } : {}) };
  slot.qty--;
  if (slot.qty <= 0) inv.slots[at] = null;
  return stack;
}

/** Puts the carried unit back: drops it at `thief`, or returns it to the owner's bag. */
function release(state: SimState, thief: EntityId, how: 'fell' | 'bag' | 'dropped'): void {
  const ai = getComp(state.entities, thief, 'ai');
  const loot = ai?.loot;
  if (!ai || !loot) return;
  delete ai.loot;
  const inv = getComp(state.entities, loot.owner, 'inventory');
  const bag = how === 'bag' && inv !== undefined && addStack(inv.slots, loot.stack) === 0;
  if (!bag) {
    const where = getComp(state.entities, how === 'bag' ? loot.owner : thief, 'pos');
    const p = where ?? getComp(state.entities, thief, 'pos');
    if (p) spawnPickup(state, loot.stack.item, 1, p.x, p.y, loot.stack);
  }
  emit(state.events, {
    type: 'itemReturned',
    who: loot.owner,
    item: loot.stack.item,
    how: bag || how !== 'bag' ? how : 'dropped',
  });
}

export function thiefSystem(state: SimState): void {
  for (const e of state.events.list.slice()) {
    if (e.type !== 'damageDealt') continue;
    const ai = getComp(state.entities, e.src, 'ai');
    const home = ai ? getComp(state.entities, ai.spawner, 'spawner') : undefined;
    if (!ai || !home || !SPAWNERS[home.kind]?.steals || ai.loot) continue;
    if (!getComp(state.entities, e.dst, 'avatar') || !alive(state, e.dst)) continue;
    const stack = take(state, e.dst);
    if (!stack) continue;
    ai.loot = { stack, owner: e.dst, t: 0 };
    emit(state.events, { type: 'itemStolen', who: e.dst, creature: e.src, item: stack.item });
    scare(state, e.src, e.dst);
  }
  for (const id of query(state.entities, 'ai')) {
    const loot = getComp(state.entities, id, 'ai')?.loot;
    if (!loot) continue;
    if (!alive(state, id)) release(state, id, 'fell');
    else if (!alive(state, loot.owner)) release(state, id, 'bag');
    else if (++loot.t >= TB.thief.runTicks) release(state, id, 'dropped');
  }
}
