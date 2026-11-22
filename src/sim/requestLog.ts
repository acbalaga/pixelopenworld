import { CREATURES } from '../content/creatures';
import { NPCS } from '../content/dialogue';
import { REQUESTS } from '../content/requests';
import type { RequestDef, RequestObjective } from '../content/requests/types';
import { ITEM_STRINGS } from '../content/strings/items';
import { REQUEST_STRINGS as T } from '../content/strings/requests';
import { fill } from '../content/strings/skills';
import { TECHNIQUE_STRINGS } from '../content/strings/techniques';
import { getComp, type EntityId } from './kernel/entities';
import { carriedFor } from './systems/trials';
import type { Inventory, RequestRecord, SimState } from './state';

/**
 * What the interface may know about requests (M3-11): words and nothing else. The log, the board
 * and the HUD read this module and never the engine, so no position, no target and no objective
 * arrow can leave the sim (design/02, secrets and discovery). Every value here is a string or a
 * boolean, and `tests/sim/requests.test.ts` checks it.
 */

export interface StepView {
  text: string;
  /** `Done`, a count such as `2 of 4`, or empty when it has not begun. */
  status: string;
}

export interface WayView {
  label: string;
  steps: StepView[];
}

export interface RequestView {
  id: string;
  title: string;
  /** The asker's own words. */
  ask: string;
  state: 'active' | 'ready' | 'done';
  pinned: boolean;
  /** The board that gave it, or empty when a person did. An id, not a place. */
  board: string;
  ways: WayView[];
  reward: string;
}

export interface PostedView {
  id: string;
  title: string;
  ask: string;
  ways: WayView[];
  reward: string;
}

/** Names of the places a step may send the player to, in words (no position). */
const PLACE_NAMES: Record<string, string> = {
  'wayside.chapel': 'the wayside chapel',
};

const itemName = (id: string): string => ITEM_STRINGS[`${id}.name`] ?? id;

/** One step in plain words. A flag step names no place. */
export function objectiveText(o: RequestObjective): string {
  switch (o.kind) {
    case 'defeat': {
      const what = o.creature ? (CREATURES[o.creature]?.name ?? o.creature) : 'creatures';
      return o.count === 1
        ? fill(T['request.step.defeat.one'] as string, { what })
        : fill(T['request.step.defeat'] as string, { n: o.count, what: `${what}s` });
    }
    case 'feed': {
      const what = o.creature ? (CREATURES[o.creature]?.name ?? o.creature) : 'creatures';
      return o.count === 1
        ? fill(T['request.step.feed.one'] as string, { what })
        : fill(T['request.step.feed'] as string, { n: o.count, what: `${what}s` });
    }
    case 'gather':
      return fill(T['request.step.gather'] as string, {
        n: o.count,
        what: o.item ? itemName(o.item) : (o.tag ?? ''),
      });
    case 'deliver':
      if (o.to.startsWith('board.'))
        return fill(T['request.step.deliver.board'] as string, {
          n: o.qty,
          what: itemName(o.item),
        });
      return fill(T['request.step.deliver'] as string, {
        n: o.qty,
        what: itemName(o.item),
        who: NPCS[o.to]?.name ?? '',
      });
    case 'craft':
      return fill(T['request.step.craft'] as string, { what: o.recipe });
    case 'perform': {
      const what = o.technique ? (TECHNIQUE_STRINGS[`${o.technique}.name`] ?? '') : '';
      return o.count === 1
        ? fill(T['request.step.perform'] as string, { what })
        : fill(T['request.step.perform.n'] as string, { what, n: o.count });
    }
    case 'sell':
      return fill(T['request.step.sell'] as string, { n: o.count });
    case 'carry':
      return fill(
        T[
          o.phases?.includes('night') ? 'request.step.carry.night' : 'request.step.carry'
        ] as string,
        { what: itemName(o.item), place: PLACE_NAMES[o.place] ?? '' },
      );
    case 'read':
      return fill(T['request.step.read'] as string, { n: o.count });
    case 'talk':
      return fill(T['request.step.talk'] as string, { who: NPCS[o.npc]?.name ?? '' });
    case 'flag':
      return T[`${o.flag}.step`] ?? (T['request.step.other'] as string);
    default:
      return T['request.step.other'] as string;
  }
}

function rewardText(def: RequestDef): string {
  const parts: string[] = [];
  if (def.reward.coin > 0)
    parts.push(fill(T['request.reward.coin'] as string, { n: def.reward.coin }));
  for (const i of def.reward.items)
    parts.push(i.qty > 1 ? `${itemName(i.item)} x${i.qty}` : itemName(i.item));
  for (const t of def.reward.techniques ?? []) parts.push(TECHNIQUE_STRINGS[`${t}.name`] ?? '');
  if (def.reward.renown > 0)
    parts.push(fill(T['request.reward.renown'] as string, { n: def.reward.renown }));
  return fill(T['request.reward'] as string, { what: parts.join(', ') });
}

function waysOf(def: RequestDef, rec: RequestRecord | undefined, inv?: Inventory): WayView[] {
  const text = (k: string): string => fill(T[k] ?? k, def.vars ?? {});
  return def.solutions.map((sol) => ({
    label: text(sol.labelKey),
    steps: sol.steps.map((o, i) => {
      const pr = rec?.prog[sol.id];
      const done = rec
        ? (pr ? i < pr.step : false) || (rec.state !== 'active' && rec.solution === sol.id)
        : false;
      let status = '';
      if (done) status = T['request.step.done'] as string;
      else if (
        rec &&
        pr &&
        i === pr.step &&
        (o.kind === 'defeat' ||
          o.kind === 'gather' ||
          o.kind === 'perform' ||
          o.kind === 'sell' ||
          o.kind === 'read') &&
        pr.p.n > 0
      )
        status = fill(T['request.step.progress'] as string, {
          n: Math.min(pr.p.n, o.count),
          max: o.count,
        });
      // A delivery in hand says how much of it the bag holds now (words only).
      else if (rec && pr && inv && rec.state === 'active' && i === pr.step && o.kind === 'deliver')
        status = fill(T['request.step.inBag'] as string, {
          n: Math.min(carriedFor(inv, o), o.qty),
          max: o.qty,
        });
      return { text: objectiveText(o), status };
    }),
  }));
}

/** Every request the avatar has taken: the pinned one first, then ready, active, and finished last. */
export function requestLog(state: SimState, who: EntityId): RequestView[] {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return [];
  const out: RequestView[] = [];
  for (const [id, rec] of Object.entries(j.requests)) {
    const def = REQUESTS[id] ?? rec.gen;
    if (!def) continue;
    const vars = def.vars ?? {};
    out.push({
      id,
      title: fill(T[def.titleKey] ?? def.titleKey, vars),
      ask: fill(T[def.askKey] ?? def.askKey, vars),
      state: rec.state,
      pinned: j.pinned === id,
      board: 'board' in def.giver ? def.giver.board : '',
      ways: waysOf(def, rec, getComp(state.entities, who, 'inventory') ?? undefined),
      reward: rewardText(def),
    });
  }
  const rank = (r: RequestView): number =>
    r.pinned ? 0 : r.state === 'ready' ? 1 : r.state === 'active' ? 2 : 3;
  return out.sort((a, b) => rank(a) - rank(b));
}

/** The jobs posted at a board, as words. Empty when there is no such board. */
export function boardPosted(state: SimState, boardId: string): PostedView[] {
  for (const b of state.entities.comps.board) {
    if (b?.id !== boardId) continue;
    return b.posted.map((def) => ({
      id: def.id,
      title: fill(T[def.titleKey] ?? def.titleKey, def.vars ?? {}),
      ask: fill(T[def.askKey] ?? def.askKey, def.vars ?? {}),
      ways: waysOf(def, undefined),
      reward: rewardText(def),
    }));
  }
  return [];
}

/** The ids of requests that a board gave and the avatar can hand in now. */
export function boardReady(state: SimState, who: EntityId, boardId: string): string[] {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return [];
  return Object.entries(j.requests)
    .filter(([id, r]) => {
      const def = REQUESTS[id] ?? r.gen;
      if (!def || !('board' in def.giver) || def.giver.board !== boardId) return false;
      if (r.state === 'ready') return true;
      // A job that is a delivery to this board and the bag can satisfy now.
      const inv = getComp(state.entities, who, 'inventory');
      return (
        r.state === 'active' &&
        inv !== undefined &&
        def.solutions.some((sol) => {
          const o = sol.steps[r.prog[sol.id]?.step ?? -1];
          return o?.kind === 'deliver' && o.to === boardId && carriedFor(inv, o) >= o.qty;
        })
      );
    })
    .map(([id]) => id);
}

/**
 * The line the HUD shows: the asker's own words for the pinned request, or for the first one
 * under way when none is pinned. Null when nothing is under way. Never a place or a direction.
 */
export function pinnedLine(
  state: SimState,
  who: EntityId,
): { text: string; ready: boolean } | null {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return null;
  const open = Object.entries(j.requests).filter(([, r]) => r.state !== 'done');
  const pick = open.find(([id]) => id === j.pinned) ?? open[0];
  if (!pick) return null;
  const [id, rec] = pick;
  const def = REQUESTS[id] ?? rec.gen;
  if (!def) return null;
  const vars = def.vars ?? {};
  return { text: fill(T[def.askKey] ?? def.askKey, vars), ready: rec.state === 'ready' };
}
