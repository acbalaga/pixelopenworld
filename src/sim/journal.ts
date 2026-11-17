import { DIALOGUES, REQUESTS } from '../content/dialogue';
import type { Cond } from '../content/dialogue/types';
import { countItem } from './items';
import { getComp, type EntityId } from './kernel/entities';
import type { Journal, SimState } from './state';

/** A fresh journal. */
export function newJournal(): Journal {
  return { flags: [], requests: {} };
}

/** State of a request for the avatar: `none` if never taken. */
export function requestState(j: Journal, id: string): 'none' | 'active' | 'ready' | 'done' {
  return j.requests[id]?.state ?? 'none';
}

/** True if every condition holds for `who`. */
export function holds(state: SimState, who: EntityId, conds: readonly Cond[] | undefined): boolean {
  if (!conds) return true;
  const j = getComp(state.entities, who, 'journal');
  const inv = getComp(state.entities, who, 'inventory');
  const sk = getComp(state.entities, who, 'skills');
  if (!j) return false;
  return conds.every((c) => {
    if ('flag' in c) return j.flags.includes(c.flag) !== (c.not === true);
    if ('item' in c) return (inv ? countItem(inv, c.item) : 0) >= c.atLeast;
    if ('skill' in c) return (sk?.points[c.skill] ?? 0) >= c.atLeast;
    return requestState(j, c.request) === c.is;
  });
}

/** Progress text pieces for the HUD: the title key, the log key, and counts. Null if none is active. */
export function pinnedRequest(
  j: Journal,
): { title: string; log: string; n: number; max: number; ready: boolean } | null {
  for (const [id, r] of Object.entries(j.requests)) {
    const def = REQUESTS[id];
    if (!def || r.state === 'done') continue;
    return {
      title: def.title,
      log: def.log,
      n: r.progress,
      max: def.goal.count,
      ready: r.state === 'ready',
    };
  }
  return null;
}

/** The node a talk with `npc` starts at for `who`: the first entry whose conditions hold. */
export function startNode(state: SimState, who: EntityId, npc: string): string | null {
  const d = DIALOGUES[npc];
  if (!d) return null;
  return d.entries.find((e) => holds(state, who, e.if))?.node ?? null;
}
