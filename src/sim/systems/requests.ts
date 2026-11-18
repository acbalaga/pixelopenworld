import { REQUEST_BALANCE as RB } from '../../content/balance/requests';
import { REQUESTS } from '../../content/requests';
import type { RequestDef, RequestObjective } from '../../content/requests/types';
import type { TrialObjective } from '../../content/skills/types';
import { learnTechnique } from '../combat/techniques';
import { give } from '../items';
import { holds } from '../journal';
import { getComp, query, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import { earnCoin } from '../ledger';
import { addRenown } from '../renown';
import type { Journal, RequestRecord, SimState } from '../state';
import { dayIndex } from '../time';
import { advanceTracked, deliverTracked, reachTracked, type Tracked } from './trials';

/**
 * The requests engine (M3-11). A request has one or more solutions, each a list of steps that run
 * in order, and any one finished solution finishes the request. Steps that are Trial objectives
 * are tracked by the same code as Trials (`advanceTracked`), so a rule is written once.
 *
 * Only manual play advances a request (M3 rule 9). The engine knows where things are, so nothing
 * outside the sim imports it: the log, the board and the HUD read `sim/requestLog.ts`, which
 * returns words and never positions.
 */

/** How close the avatar must be to a board to use it, px. */
const BOARD_PX = 28;

/** A request's definition: an authored one from the tables, or the standing one it carries. */
export function requestDefOf(rec: RequestRecord | undefined, id: string): RequestDef | undefined {
  return REQUESTS[id] ?? rec?.gen;
}

const isTracked = (o: RequestObjective): o is TrialObjective =>
  o.kind !== 'talk' && o.kind !== 'flag';

/** How much of a count a step stands for in the progress number. */
export function stepWeight(o: RequestObjective): number {
  return o.kind === 'defeat' || o.kind === 'gather' || o.kind === 'perform' ? o.count : 1;
}

/** The progress number of a whole solution. */
export function solutionMax(def: RequestDef, solutionId: string): number {
  const sol = def.solutions.find((s) => s.id === solutionId);
  return sol ? sol.steps.reduce((n, o) => n + stepWeight(o), 0) : 0;
}

function freshProg(def: RequestDef): RequestRecord['prog'] {
  const out: RequestRecord['prog'] = {};
  for (const s of def.solutions) out[s.id] = { step: 0, p: { n: 0, t0: 0 } };
  return out;
}

const activeCount = (j: Journal): number =>
  Object.values(j.requests).filter((r) => r.state !== 'done').length;

/**
 * Takes a request. Refused when it is already taken (a finished one that repeats can be taken
 * again once its cooldown has passed), when its requirements do not hold, or when too many are
 * under way. Returns whether it was taken.
 */
export function startRequest(state: SimState, who: EntityId, def: RequestDef): boolean {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return false;
  const cur = j.requests[def.id];
  if (cur) {
    const again =
      cur.state === 'done' &&
      def.repeat !== undefined &&
      cur.doneDay !== undefined &&
      dayIndex(state.worldTick) - cur.doneDay >= def.repeat.cooldownDays;
    if (!again) return false;
  }
  if (!holds(state, who, def.requires)) return false;
  if (activeCount(j) >= RB.maxActive) return false;
  j.requests[def.id] = {
    state: 'active',
    solution: null,
    prog: freshProg(def),
    progress: 0,
    ...(def.kind === 'standing' ? { gen: structuredClone(def) } : {}),
  };
  emit(state.events, { type: 'requestStarted', who, request: def.id });
  settle(state, who);
  return true;
}

/** Moves a request on when one step of one solution is met. */
function completeStep(
  state: SimState,
  who: EntityId,
  rid: string,
  solutionId: string,
  step: number,
): void {
  const j = getComp(state.entities, who, 'journal');
  const rec = j?.requests[rid];
  const def = rec && requestDefOf(rec, rid);
  const pr = rec?.prog[solutionId];
  const sol = def?.solutions.find((s) => s.id === solutionId);
  if (!rec || !def || !pr || !sol || rec.state !== 'active' || pr.step !== step) return;
  pr.step++;
  pr.p = { n: 0, t0: 0 };
  if (pr.step >= sol.steps.length) {
    rec.state = 'ready';
    rec.solution = solutionId;
    rec.progress = solutionMax(def, solutionId);
    emit(state.events, { type: 'requestProgress', who, request: rid, progress: rec.progress });
    emit(state.events, { type: 'requestReady', who, request: rid });
  }
}

/** The trackers for the step in hand of each solution of one request. */
function trackersOf(state: SimState, who: EntityId, rid: string, rec: RequestRecord): Tracked[] {
  const def = requestDefOf(rec, rid);
  if (!def || rec.state !== 'active') return [];
  const out: Tracked[] = [];
  for (const sol of def.solutions) {
    const pr = rec.prog[sol.id];
    const o = pr && sol.steps[pr.step];
    if (!pr || !o || !isTracked(o)) continue;
    const step = pr.step;
    out.push({
      o,
      p: pr.p,
      done: () => completeStep(state, who, rid, sol.id, step),
      live: () => rec.state === 'active' && rec.prog[sol.id]?.step === step,
    });
  }
  return out;
}

/** Flag steps are met as soon as the flag is set, which can be the moment the step begins. */
function settle(state: SimState, who: EntityId): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return;
  for (const [rid, rec] of Object.entries(j.requests)) {
    const def = requestDefOf(rec, rid);
    if (!def) continue;
    for (const sol of def.solutions) {
      for (;;) {
        const pr = rec.prog[sol.id];
        const o = pr && sol.steps[pr.step];
        if (rec.state !== 'active' || !pr || !o || o.kind !== 'flag' || !j.flags.includes(o.flag))
          break;
        completeStep(state, who, rid, sol.id, pr.step);
      }
    }
  }
}

/** Recomputes the count of the leading solution and says so when it grew. */
function progressOf(state: SimState, who: EntityId): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return;
  for (const [rid, rec] of Object.entries(j.requests)) {
    if (rec.state !== 'active') continue;
    const def = requestDefOf(rec, rid);
    if (!def) continue;
    let best = 0;
    for (const sol of def.solutions) {
      const pr = rec.prog[sol.id];
      if (!pr) continue;
      let n = 0;
      for (let i = 0; i < pr.step; i++) n += stepWeight(sol.steps[i] as RequestObjective);
      const cur = sol.steps[pr.step];
      if (cur && isTracked(cur)) n += Math.min(pr.p.n, stepWeight(cur));
      best = Math.max(best, n);
    }
    if (best !== rec.progress) {
      rec.progress = best;
      emit(state.events, { type: 'requestProgress', who, request: rid, progress: best });
    }
  }
}

/**
 * A talk with `npc` has started: deliveries to them are handed over, and a step that is just to
 * speak with them is met. Called by the talk, before the first line shows.
 */
export function onTalk(state: SimState, who: EntityId, npc: string): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return;
  for (const [rid, rec] of Object.entries(j.requests)) {
    deliverTracked(state, who, npc, trackersOf(state, who, rid, rec));
    const def = requestDefOf(rec, rid);
    if (!def) continue;
    for (const sol of def.solutions) {
      const pr = rec.prog[sol.id];
      const o = pr && sol.steps[pr.step];
      if (rec.state === 'active' && pr && o?.kind === 'talk' && o.npc === npc)
        completeStep(state, who, rid, sol.id, pr.step);
    }
  }
  settle(state, who);
  progressOf(state, who);
}

/** Counts what happened this tick toward every request under way. Runs after combat. */
export function requestsSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'journal')) {
    const j = getComp(state.entities, who, 'journal');
    if (!j) continue;
    const events = [...state.events.list];
    for (const [rid, rec] of Object.entries(j.requests)) {
      if (rec.state !== 'active') continue;
      for (const e of events) advanceTracked(state, who, e, trackersOf(state, who, rid, rec));
      reachTracked(state, who, events, trackersOf(state, who, rid, rec));
    }
    settle(state, who);
    progressOf(state, who);
  }
}

/** Drops the oldest finished standing requests past the keep limit. Their rewards are in the ledger. */
function pruneStanding(j: Journal): void {
  const done = Object.entries(j.requests).filter(([, r]) => r.state === 'done' && r.gen);
  for (const [id] of done.slice(0, Math.max(0, done.length - RB.keepDoneStanding)))
    delete j.requests[id];
}

/** Pays a finished request, once. Returns whether it paid. */
export function turnIn(state: SimState, who: EntityId, rid: string): boolean {
  const j = getComp(state.entities, who, 'journal');
  const a = getComp(state.entities, who, 'avatar');
  const rec = j?.requests[rid];
  const def = rec && requestDefOf(rec, rid);
  if (!j || !a || !rec || !def || rec.state !== 'ready') return false;
  rec.state = 'done';
  rec.doneDay = dayIndex(state.worldTick);
  earnCoin(state, who, def.reward.coin, 'request');
  for (const r of def.reward.items) give(state, who, r.item, r.qty, 'request');
  for (const t of def.reward.techniques ?? []) learnTechnique(state, who, t, 'request');
  addRenown(state, who, def.region, def.reward.renown);
  if (def.kind === 'standing') {
    const t = state.ledger.requestRewards;
    t.n = (t.n ?? 0) + 1;
    t.coin = (t.coin ?? 0) + def.reward.coin;
    for (const r of def.reward.items) t[r.item] = (t[r.item] ?? 0) + r.qty;
  }
  if (j.pinned === rid) j.pinned = null;
  pruneStanding(j);
  emit(state.events, { type: 'requestCompleted', who, request: rid });
  return true;
}

/** The board entity the avatar stands at, or null. */
function boardAt(state: SimState, who: EntityId, boardId: string): EntityId | null {
  const pos = getComp(state.entities, who, 'pos');
  if (!pos) return null;
  for (const id of query(state.entities, 'board', 'pos')) {
    if (getComp(state.entities, id, 'board')?.id !== boardId) continue;
    const p = getComp(state.entities, id, 'pos');
    if (p && Math.hypot(p.x - pos.x, p.y - pos.y) / SUBPX <= BOARD_PX) return id;
  }
  return null;
}

/** Takes a request posted on the board in front of the avatar. */
export function takeFromBoard(
  state: SimState,
  who: EntityId,
  c: { board: string; id: string },
): boolean {
  const b = boardAt(state, who, c.board);
  const board = b === null ? undefined : getComp(state.entities, b, 'board');
  const def = board?.posted.find((d) => d.id === c.id);
  if (!board || !def || !startRequest(state, who, def)) return false;
  board.posted = board.posted.filter((d) => d.id !== c.id);
  return true;
}

/** Turns in a finished request that a board gave, at that board. */
export function turnInAtBoard(state: SimState, who: EntityId, rid: string): boolean {
  const j = getComp(state.entities, who, 'journal');
  const rec = j?.requests[rid];
  const def = rec && requestDefOf(rec, rid);
  if (!def || !('board' in def.giver) || boardAt(state, who, def.giver.board) === null)
    return false;
  return turnIn(state, who, rid);
}

/** Pins a request to the HUD, or clears the pin. Only one that is under way can be pinned. */
export function pinRequest(state: SimState, who: EntityId, rid: string | null): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return;
  if (rid === null) j.pinned = null;
  else if (j.requests[rid] && j.requests[rid]?.state !== 'done') j.pinned = rid;
}
