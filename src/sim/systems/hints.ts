import { HINT_BY_ID, HINTS, type HintDef } from '../../content/hints';
import { NODES } from '../../content/items/recipes';
import { len } from '../combat/geometry';
import { getComp, query, type EntityId } from '../kernel/entities';
import { emit, type SimEvent } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import type { SimState } from '../state';
import { contextTarget } from './interact';

/** How close a creature's attack must start to count as aimed at the avatar, px. */
const THREAT_PX = 140;

function opportune(
  state: SimState,
  who: EntityId,
  def: HintDef,
  events: readonly SimEvent[],
): boolean {
  const w = def.when;
  switch (w.kind) {
    case 'start':
      return state.tick >= w.afterTicks;
    case 'playTime':
      return state.tick >= w.ticks;
    case 'foeNoticed':
      return events.some((e) => e.type === 'noticed' && e.target === who);
    case 'foeAttacking': {
      const me = getComp(state.entities, who, 'pos');
      return (
        !!me &&
        events.some((e) => {
          if (e.type !== 'attackStarted') return false;
          if (getComp(state.entities, e.id, 'fighter')?.team !== 1) return false;
          const p = getComp(state.entities, e.id, 'pos');
          return !!p && len({ x: (p.x - me.x) / SUBPX, y: (p.y - me.y) / SUBPX }) <= THREAT_PX;
        })
      );
    }
    case 'nodeInReach': {
      const t = contextTarget(state, who);
      const n = t === null ? undefined : getComp(state.entities, t, 'node');
      return !!n && !!NODES[n.kind] && state.worldTick >= n.readyAt;
    }
    case 'potInReach': {
      const t = contextTarget(state, who);
      return t !== null && getComp(state.entities, t, 'interactable')?.kind === 'camp_pot';
    }
  }
}

function finished(
  state: SimState,
  who: EntityId,
  def: HintDef,
  at: { x: number; y: number },
  events: readonly SimEvent[],
): boolean {
  const d = def.done;
  if (d.kind === 'ui') return false;
  if (d.kind === 'moved') {
    const p = getComp(state.entities, who, 'pos');
    return !!p && len({ x: (p.x - at.x) / SUBPX, y: (p.y - at.y) / SUBPX }) >= d.px;
  }
  return events.some((e) => {
    switch (d.type) {
      case 'lockChanged':
        return e.type === 'lockChanged' && e.id === who && e.target !== null;
      case 'dodgeStarted':
        return e.type === 'dodgeStarted' && e.id === who;
      case 'techniqueUsed':
        return e.type === 'attackStarted' && e.id === who && e.attack.startsWith('technique.');
      case 'gatherStarted':
        return e.type === 'gatherStarted' && e.id === who;
      case 'cooked':
        return e.type === 'cooked' && e.id === who;
    }
  });
}

/** Ends the hint on screen, for any reason. It is then never shown again. */
function end(state: SimState, who: EntityId, how: 'done' | 'expired'): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j?.hint) return;
  const id = j.hint.id;
  if (!j.hints.includes(id)) j.hints.push(id);
  j.hint = null;
  emit(state.events, { type: 'hintEnded', who, hint: id, how });
}

/**
 * Shows one hint at a time. A hint appears the first time its opportunity comes, ends when the
 * player does the thing (or after its time), and is then recorded in the journal, which is saved.
 */
export function hintsSystem(state: SimState): void {
  const events = state.events.list;
  for (const who of query(state.entities, 'avatar', 'journal', 'pos')) {
    const j = getComp(state.entities, who, 'journal');
    const pos = getComp(state.entities, who, 'pos');
    if (!j || !pos || getComp(state.entities, who, 'fighter')?.state === 'dead') continue;
    if (j.hint) {
      const def = HINT_BY_ID[j.hint.id];
      if (!def) end(state, who, 'expired');
      else if (finished(state, who, def, j.hint, events)) end(state, who, 'done');
      else if (state.tick - j.hint.at >= def.expire) end(state, who, 'expired');
      continue;
    }
    for (const def of HINTS) {
      if (j.hints.includes(def.id) || !opportune(state, who, def, events)) continue;
      j.hint = { id: def.id, at: state.tick, x: pos.x, y: pos.y };
      emit(state.events, { type: 'hintShown', who, hint: def.id });
      break;
    }
  }
}

/** The interface says a hint's action happened (the Menu opened). Ends it if it waits on that. */
export function hintSeen(state: SimState, who: EntityId, id: string): void {
  const j = getComp(state.entities, who, 'journal');
  if (j?.hint?.id === id && HINT_BY_ID[id]?.done.kind === 'ui') end(state, who, 'done');
}
