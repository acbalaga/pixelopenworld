/**
 * Singulars (POW-M4-20). Rare hidden questlines whose triggers and steps are data
 * (`content/singulars`). The system reads the tick's events, and only the ones a Singular's step
 * names: it never scans the world. Nothing here tells the player anything before a trigger fires.
 * After it, each step sends `singularStep` (a banner), and the last sends `singularDone` and
 * `worldFirst`.
 */
import { SKILLS } from '../../content/skills';
import { SINGULARS } from '../../content/singulars';
import type {
  SingularDef,
  SingularEffect,
  SingularEvent,
  SingularPred,
  SingularStep,
} from '../../content/singulars/types';
import { ITEMS } from '../../content/items';
import { inArea } from '../../content/world/areas';
import { WAKE_TABLES } from '../../content/world/wake';
import { destroy, getComp, query, type EntityId } from '../kernel/entities';
import { emit, type SimEvent } from '../kernel/events';
import { SUBPX } from '../kernel/fixed';
import { countItem, give, learnRecipe } from '../items';
import { pointsOf } from '../skills';
import { dayPhase, dayIndex, weatherOn } from '../time';
import type { SimState, SingularProgress } from '../state';

const TILE = 16;
/** The scarecrow's reach: the same as the Crow's Due asks for (`content/singulars`). */
const SCARECROW = { fixture: 'fixture.scarecrow', px: 48 } as const;
/** How near a wake point (tiles) counts as being at it. */
export const WAKE_RADIUS_TILES = 12;

/** What an event says, in the terms a step asks for. */
interface Seen {
  kind: SingularEvent;
  subject: string | null;
  item: string | null;
  place: string | null;
}

function seen(state: SimState, who: EntityId, e: SimEvent): Seen | null {
  switch (e.type) {
    case 'itemDropped':
      return e.who === who
        ? { kind: 'itemDropped', subject: e.item, item: e.item, place: null }
        : null;
    case 'sleptOutdoors':
      return e.who === who ? { kind: 'slept', subject: null, item: null, place: e.wake } : null;
    case 'stationOpened': {
      return e.who === who
        ? { kind: 'stationUsed', subject: e.station, item: null, place: null }
        : null;
    }
    case 'fixtureUsed':
      return e.who === who
        ? { kind: 'fixtureUsed', subject: e.kind, item: null, place: null }
        : null;
    case 'itemGained':
      return e.who === who
        ? { kind: 'itemGained', subject: e.item, item: e.item, place: null }
        : null;
    case 'flagSet':
      return e.who === who ? { kind: 'flagSet', subject: e.flag, item: null, place: null } : null;
    case 'manualRead':
      return e.who === who
        ? { kind: 'manualRead', subject: e.item, item: e.item, place: null }
        : null;
    default:
      return null;
  }
}

/** The wake point the avatar is at, if any, from the region's wake table. */
export function wakePointAt(state: SimState, who: EntityId): string | null {
  const p = getComp(state.entities, who, 'pos');
  const table = WAKE_TABLES[state.region ?? 'slice'];
  if (!p || !table) return null;
  const tx = p.x / SUBPX / TILE;
  const ty = p.y / SUBPX / TILE;
  let best: string | null = null;
  let d = WAKE_RADIUS_TILES;
  for (const [id, w] of Object.entries(table.points)) {
    const dist = Math.hypot(tx - w.x, ty - w.y);
    if (dist <= d) {
      d = dist;
      best = id;
    }
  }
  return best;
}

/** Whether one condition holds for the avatar now, given what the event said. */
function holds(state: SimState, who: EntityId, p: SingularPred, s: Seen): boolean {
  const pos = getComp(state.entities, who, 'pos');
  if (!pos) return false;
  const tx = Math.floor(pos.x / SUBPX / TILE);
  const ty = Math.floor((pos.y / SUBPX - 1) / TILE);
  if ('phase' in p) return p.phase.includes(dayPhase(state.worldTick));
  if ('weather' in p) return p.weather.includes(weatherOn(state, state.worldTick));
  if ('near' in p) {
    for (const id of query(state.entities, 'fixture', 'pos')) {
      if (getComp(state.entities, id, 'fixture')?.kind !== p.near.fixture) continue;
      const q = getComp(state.entities, id, 'pos');
      if (q && Math.hypot(q.x - pos.x, q.y - pos.y) / SUBPX <= p.near.px) return true;
    }
    return false;
  }
  if ('area' in p) return inArea(p.area, state.region ?? 'slice', tx, ty);
  if ('wake' in p) return s.place !== null;
  if ('skill' in p)
    return pointsOf(state, who, p.skill.id) >= p.skill.atLeast && !!SKILLS[p.skill.id];
  if ('itemTag' in p) return !!s.item && ITEMS[s.item]?.shiny === true;
  const j = getComp(state.entities, who, 'journal');
  const has = !!j?.flags.includes(p.flag);
  return p.not ? !has : has;
}

/** Applies a step's gifts and flags. Gifts are the ledger source `singular`. */
function applyEffects(
  state: SimState,
  who: EntityId,
  effects: readonly SingularEffect[] | undefined,
): void {
  const j = getComp(state.entities, who, 'journal');
  for (const e of effects ?? []) {
    if ('give' in e) give(state, who, e.give, e.qty, 'singular');
    else if ('learnRecipe' in e) learnRecipe(state, who, e.learnRecipe);
    else if (j && !j.flags.includes(e.setFlag)) {
      j.flags.push(e.setFlag);
      emit(state.events, { type: 'flagSet', who, flag: e.setFlag });
    }
  }
}

/**
 * A crow on a scarecrow takes a shiny thing left on the ground beside it, whether or not any
 * Singular is under way. The thing is gone, so it cannot be picked up and left again.
 */
function crowTakes(state: SimState, who: EntityId, item: string, pickup: EntityId): void {
  if (ITEMS[item]?.shiny !== true || !getComp(state.entities, pickup, 'pickup')) return;
  if (
    !holds(
      state,
      who,
      { near: SCARECROW },
      { kind: 'itemDropped', subject: item, item, place: null },
    )
  )
    return;
  destroy(state.entities, pickup);
}

/** The step of a Singular in hand: the trigger before it fires, then each step in turn. */
function stepOf(def: SingularDef, p: SingularProgress | undefined): SingularStep | null {
  const i = p?.step ?? -1;
  if (i < 0) return def.trigger;
  return def.steps[i] ?? null;
}

/** Counts an event toward a step. Returns true once the step has all it asks for. */
function counts(state: SimState, step: SingularStep, p: SingularProgress, s: Seen): boolean {
  const c = step.count;
  if (!c) return true;
  const day = dayIndex(state.worldTick);
  const list = (p.counters[step.id] ??= []);
  if (c.oncePerDay) {
    const days = (p.counters[`${step.id}#day`] ??= []);
    if (days.includes(String(day))) return list.length >= c.n;
    days.push(String(day));
  }
  const key =
    c.by === 'day'
      ? String(day)
      : c.by === 'item'
        ? s.item
        : c.by === 'place'
          ? s.place
          : `${state.tick}:${list.length}`;
  if (key === null || list.includes(key)) {
    // A count that was refused must not use up the day.
    if (c.oncePerDay) (p.counters[`${step.id}#day`] ??= []).pop();
    return list.length >= c.n;
  }
  list.push(key);
  return list.length >= c.n;
}

/** Whether a step that waits for a thing the avatar may already have is met by what it holds. */
function alreadyMet(state: SimState, who: EntityId, step: SingularStep): boolean {
  const j = getComp(state.entities, who, 'journal');
  const inv = getComp(state.entities, who, 'inventory');
  if (step.on === 'flagSet' && step.subject) return !!j?.flags.includes(step.subject);
  if (step.on === 'itemGained' && step.subject && inv) return countItem(inv, step.subject) > 0;
  return false;
}

/** Moves a Singular on one stage: the trigger fires, a step is done, or the last one finishes. */
function advance(state: SimState, who: EntityId, def: SingularDef, p: SingularProgress): void {
  const was = stepOf(def, p);
  applyEffects(state, who, was?.then);
  const carried = p.step < 0 ? { ...p.counters } : null;
  p.step++;
  p.counters = {};
  if (p.step >= def.steps.length) {
    p.done = true;
    p.doneDay = dayIndex(state.worldTick);
    applyEffects(state, who, def.reward);
    emit(state.events, { type: 'singularDone', who, id: def.id });
    emit(state.events, { type: 'worldFirst', who, id: def.id });
    return;
  }
  const next = def.steps[p.step] as SingularStep;
  if (carried && next.inherit) p.counters[next.id] = [...(carried['trigger'] ?? [])];
  emit(state.events, { type: 'singularStep', who, id: def.id, step: p.step });
  // What the avatar already has can finish the step it has just reached: a firebrick found before.
  if (alreadyMet(state, who, next)) advance(state, who, def, p);
}

/**
 * Feeds this tick's events to every Singular of the region. Runs late, so it sees what the other
 * systems sent this tick.
 */
export function singularsSystem(state: SimState): void {
  const region = state.region ?? 'slice';
  const defs = Object.values(SINGULARS).filter((d) => d.region === region);
  if (defs.length === 0) return;
  const count = state.events.list.length;
  for (const who of query(state.entities, 'avatar', 'journal')) {
    const j = getComp(state.entities, who, 'journal');
    if (!j) continue;
    // A state loaded from before schema 26 has none until the migration runs.
    j.singulars ??= {};
    for (let i = 0; i < count; i++) {
      const e = state.events.list[i];
      if (!e) continue;
      const raw = seen(state, who, e);
      if (!raw) continue;
      if (e.type === 'itemDropped') crowTakes(state, who, e.item, e.pickup);
      const s = raw;
      for (const def of defs) {
        let p = j.singulars[def.id];
        if (p?.done) continue;
        const step = stepOf(def, p);
        if (!step || step.on !== s.kind) continue;
        if (step.subject !== undefined && step.subject !== s.subject) continue;
        if (!(step.when ?? []).every((c) => holds(state, who, c, s))) continue;
        p ??= j.singulars[def.id] = {
          step: -1,
          counters: {},
          startedDay: dayIndex(state.worldTick),
          done: false,
        };
        if (counts(state, step, p, s)) advance(state, who, def, p);
      }
    }
  }
}
