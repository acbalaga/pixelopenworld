import { STATUS_BALANCE as B } from '../content/balance/status';
import { STATUS_PRIORITY, STATUSES, type StatusId } from '../content/combat/statuses';
import { kill } from './combat/fighter';
import { getComp, query, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import type { SimState, StatusEntry } from './state';
import { hasStatus, statusesOf } from './mods';
import { recomputePools } from './skills';

/**
 * Statuses (M3-09). One set of rules for every unit, avatar or creature: a `statuses` list of
 * `{ id, until, src }`, applied and cleared here, with their effects read through `mods.ts`.
 */

export { hasStatus, statusesOf };

function alive(state: SimState, who: EntityId): boolean {
  if (!state.entities.alive[who]) return false;
  const f = getComp(state.entities, who, 'fighter');
  return f ? f.state !== 'dead' : getComp(state.entities, who, 'pools') !== undefined;
}

/**
 * Puts a status on a unit. `src` is the entity that caused it, or -1. A Hexed unit takes longer
 * statuses by `hexedExtendPct`. Applying one it already has refreshes the timer, or does nothing
 * for a status that does not stack. Returns false when nothing changed.
 */
export function applyStatus(
  state: SimState,
  who: EntityId,
  id: StatusId,
  src: number = -1,
  opts: { ticks?: number; item?: string } = {},
): boolean {
  const def = STATUSES[id];
  if (!def || !alive(state, who)) return false;
  let ticks = opts.ticks ?? def.ticks;
  if (id !== 'hexed' && hasStatus(state, who, 'hexed'))
    ticks = Math.floor((ticks * (100 + B.hexedExtendPct)) / 100);
  let list = getComp(state.entities, who, 'statuses');
  if (!list) {
    list = [];
    state.entities.comps.statuses[who] = list;
  }
  const have = list.find((s) => s.id === id);
  if (have) {
    if (def.stacks === 'none') return false;
    have.until = state.tick + ticks;
    have.src = src;
    if (opts.item !== undefined) have.item = opts.item;
  } else {
    const entry: StatusEntry = { id, until: state.tick + ticks, src };
    if (opts.item !== undefined) entry.item = opts.item;
    list.push(entry);
  }
  emit(state.events, {
    type: 'statusApplied',
    id: who,
    status: id,
    src,
    refreshed: have !== undefined,
  });
  recomputePools(state, who);
  return true;
}

/** Removes a status. Returns false if the unit did not have it. */
export function clearStatus(
  state: SimState,
  who: EntityId,
  id: StatusId,
  how: 'expired' | 'cleared' = 'cleared',
): boolean {
  const list = getComp(state.entities, who, 'statuses');
  const i = list ? list.findIndex((s) => s.id === id) : -1;
  if (!list || i < 0) return false;
  list.splice(i, 1);
  if (list.length === 0) state.entities.comps.statuses[who] = null;
  emit(state.events, { type: 'statusEnded', id: who, status: id, how });
  recomputePools(state, who);
  return true;
}

/** The statuses to draw: at most `maxShown`, in the fixed priority order. */
export function visibleStatuses(list: readonly StatusEntry[]): StatusEntry[] {
  const rank = (id: string): number => {
    const i = STATUS_PRIORITY.indexOf(id as StatusId);
    return i < 0 ? STATUS_PRIORITY.length : i;
  };
  return [...list].sort((a, b) => rank(a.id) - rank(b.id)).slice(0, B.maxShown);
}

/** Health lost to a status, a cloud or a reaction. No knockback and no stagger. May kill. */
export function drain(
  state: SimState,
  dst: EntityId,
  amount: number,
  src: number,
  tag: string,
): void {
  const pools = getComp(state.entities, dst, 'pools');
  if (!pools || !alive(state, dst) || amount <= 0) return;
  pools.hp = Math.max(0, pools.hp - amount);
  pools.lastCombat = state.tick;
  emit(state.events, {
    type: 'damageDealt',
    src,
    dst,
    amount,
    crit: false,
    bonus: false,
    heavy: false,
    tag,
  });
  if (pools.hp === 0) kill(state, dst);
}

/** Expiry, damage over time, and the Staggered mirror of a broken stagger bar. Once per tick. */
export function statusSystem(state: SimState): void {
  // A stagger break shows as the Staggered status for as long as the unit is helpless.
  for (const e of state.events.list) {
    if (e.type === 'staggerBreak')
      applyStatus(state, e.id, 'staggered', -1, { ticks: B.staggered.ticks });
  }
  for (const who of query(state.entities, 'statuses')) {
    const list = getComp(state.entities, who, 'statuses');
    if (!list) continue;
    const dead = getComp(state.entities, who, 'fighter')?.state === 'dead';
    for (const st of [...list]) {
      const def = STATUSES[st.id as StatusId];
      if (dead && st.id !== 'fed' && st.id !== 'rested') {
        clearStatus(state, who, st.id as StatusId);
        continue;
      }
      if (!def) {
        // An id the build does not know: drop it rather than carry it.
        clearStatus(state, who, st.id as StatusId);
        continue;
      }
      if (state.tick >= st.until) {
        clearStatus(state, who, def.id, 'expired');
        if (def.id === 'fed')
          emit(state.events, { type: 'fedEnded', id: who, item: st.item ?? '' });
        continue;
      }
      const te = def.tickEffect;
      if (te && state.tick % te.every === 0) {
        if (te.damage) drain(state, who, te.damage, st.src, `status.${def.id}`);
        if (te.heal) {
          const pools = getComp(state.entities, who, 'pools');
          if (pools) pools.hp = Math.min(pools.hpMax, pools.hp + te.heal);
        }
      }
    }
  }
}

/** True if the unit cannot walk (Rooted). */
export function isRooted(state: SimState, who: EntityId): boolean {
  return hasStatus(state, who, 'rooted');
}

/** True if the unit cannot start an attack or technique (Dazed). */
export function isDazed(state: SimState, who: EntityId): boolean {
  return hasStatus(state, who, 'dazed');
}
