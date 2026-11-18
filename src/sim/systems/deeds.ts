import { PATHS_BALANCE as B } from '../../content/balance/paths';
import { DEED_LIST, MEET, type DeedDef, type EventMatcher } from '../../content/paths/deeds';
import { PATH_LIST, PATHS, type PathDef } from '../../content/paths';
import { PATH_STRINGS } from '../../content/strings/paths';
import { centerPx } from '../combat/fighter';
import { len } from '../combat/geometry';
import { inFight } from '../fight';
import { getComp, query, type EntityId } from '../kernel/entities';
import { emit, type SimEvent } from '../kernel/events';
import { dayIndex } from '../time';
import type { Deeds, SimState } from '../state';

/** An empty record of deeds. */
export function newDeeds(): Deeds {
  return {
    counts: {},
    distinct: {},
    resetAt: {},
    fight: { live: false, kills: 0, hurt: false },
    near: [],
  };
}

/** The number a deed stands at: its count, or how many distinct names it holds. */
export function deedValue(d: Deeds, def: DeedDef | string): number {
  const id = typeof def === 'string' ? def : def.id;
  const kind = typeof def === 'string' ? DEED_LIST.find((x) => x.id === def)?.kind : def.kind;
  return kind === 'distinct' ? (d.distinct[id]?.length ?? 0) : (d.counts[id] ?? 0);
}

const matchers = (d: DeedDef): readonly EventMatcher[] =>
  Array.isArray(d.on) ? (d.on as readonly EventMatcher[]) : [d.on as EventMatcher];

/** Whether an event is the avatar's doing and has the field values the matcher asks for. */
function matches(m: EventMatcher, e: SimEvent, who: EntityId): boolean {
  if (e.type !== m.type) return false;
  // `self` is derived: a status the avatar put on itself does not count as one put on others.
  const view = {
    ...e,
    self: 'id' in e && 'src' in e ? e.id === e.src : false,
  } as unknown as Record<string, unknown>;
  if (view[m.by] !== who) return false;
  for (const [k, v] of Object.entries(m.is ?? {})) if (view[k] !== v) return false;
  return true;
}

/**
 * Counts deeds from this tick's events into each avatar's `deeds` component, and watches the two
 * things no event carries: a fight ending untouched, and a Mossling coming close. Runs last, so it
 * sees everything. Only the avatar's own doing counts.
 */
export function deedsSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'deeds')) {
    const d = getComp(state.entities, who, 'deeds');
    if (!d) continue;
    watchFight(state, who, d);
    watchMeetings(state, who, d);
    // The list grows while it is read: an untouched fight sent above is counted in this same pass.
    for (let i = 0; i < state.events.list.length; i++) {
      const e = state.events.list[i] as SimEvent;
      if (e.type === 'damageDealt' && e.dst === who && e.amount > 0) d.fight.hurt = true;
      if (e.type === 'killed' && e.src === who) d.fight.kills++;
      for (const def of DEED_LIST) {
        if (def.reset && matches(def.reset, e, who)) {
          d.counts[def.id] = 0;
          d.resetAt[def.id] = state.worldTick;
        }
        for (const m of matchers(def)) {
          if (!matches(m, e, who)) continue;
          if (def.kind === 'sum') {
            const n = (e as unknown as Record<string, unknown>)[def.field ?? ''];
            if (typeof n === 'number') d.counts[def.id] = (d.counts[def.id] ?? 0) + n;
          } else if (def.kind === 'distinct') {
            const v = String((e as unknown as Record<string, unknown>)[def.field ?? '']);
            const set = (d.distinct[def.id] ??= []);
            if (!set.includes(v)) set.push(v);
          } else d.counts[def.id] = (d.counts[def.id] ?? 0) + 1;
          break;
        }
      }
    }
  }
}

/** A fight that began, took nothing from the avatar and won something is an untouched fight. */
function watchFight(state: SimState, who: EntityId, d: Deeds): void {
  const on = inFight(state, who);
  if (on && !d.fight.live) d.fight = { live: true, kills: 0, hurt: false };
  else if (!on && d.fight.live) {
    if (d.fight.kills > 0 && !d.fight.hurt) emit(state.events, { type: 'untouchedFight', who });
    d.fight = { live: false, kills: 0, hurt: false };
  }
}

/** A creature coming within a few tiles is met once; it must go well away before it is met again. */
function watchMeetings(state: SimState, who: EntityId, d: Deeds): void {
  const me = centerPx(state, who);
  if (!me) return;
  const still: number[] = [];
  for (const id of query(state.entities, 'fighter', 'combatant', 'pos')) {
    const f = getComp(state.entities, id, 'fighter');
    const cb = getComp(state.entities, id, 'combatant');
    const c = centerPx(state, id);
    if (!f || !cb || !c || f.team !== 1 || f.state === 'dead') continue;
    const dist = len({ x: c.x - me.x, y: c.y - me.y });
    const was = d.near.includes(id);
    if (dist <= MEET.radiusPx && !was) emit(state.events, { type: 'met', who, id, kind: cb.kind });
    if (dist <= (was ? MEET.leavePx : MEET.radiusPx)) still.push(id);
  }
  d.near = still;
}

/** True if one requirement of the Path is met (for the hint that points at it). */
export function anyRequirementMet(state: SimState, who: EntityId, p: PathDef): boolean {
  const d = getComp(state.entities, who, 'deeds');
  const sk = getComp(state.entities, who, 'skills');
  if (!d) return false;
  for (const [s, n] of Object.entries(p.requires.skills ?? {}))
    if ((sk?.points[s] ?? 0) >= n) return true;
  for (const [id, n] of Object.entries(p.requires.deeds ?? {}))
    if (deedValue(d, id) >= n) return true;
  return false;
}

/** True if every requirement of the Path holds. `days` turns on the days-since-reset check. */
export function requirementsMet(state: SimState, who: EntityId, p: PathDef, days = true): boolean {
  const d = getComp(state.entities, who, 'deeds');
  const sk = getComp(state.entities, who, 'skills');
  if (!d) return false;
  for (const [s, n] of Object.entries(p.requires.skills ?? {}))
    if ((sk?.points[s] ?? 0) < n) return false;
  for (const [id, n] of Object.entries(p.requires.deeds ?? {}))
    if (deedValue(d, id) < n) return false;
  if (days)
    for (const [id, n] of Object.entries(p.requires.daysSinceReset ?? {}))
      if (dayIndex(state.worldTick) - dayIndex(d.resetAt[id] ?? 0) < n) return false;
  return true;
}

/** Earns every Path whose requirements now hold. A Path is worn at once if there is a free place. */
export function pathsSystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'paths', 'deeds')) {
    const paths = getComp(state.entities, who, 'paths');
    if (!paths) continue;
    for (const p of PATH_LIST) {
      if (paths.earned.includes(p.id) || !requirementsMet(state, who, p)) continue;
      paths.earned.push(p.id);
      emit(state.events, { type: 'pathEarned', who, path: p.id });
      if (paths.worn.length < B.maxWorn) {
        paths.worn.push(p.id);
        if (paths.shown === null) paths.shown = p.id;
      }
    }
  }
}

/** Puts a Path on or takes it off, at a bed. At most three are worn. Returns false if it cannot be done. */
export function wearPath(state: SimState, who: EntityId, id: string, on: boolean): boolean {
  const paths = getComp(state.entities, who, 'paths');
  if (!paths || !PATHS[id] || !paths.earned.includes(id)) return false;
  if (on) {
    if (paths.worn.includes(id) || paths.worn.length >= B.maxWorn) return false;
    paths.worn.push(id);
  } else {
    if (!paths.worn.includes(id)) return false;
    paths.worn = paths.worn.filter((p) => p !== id);
    if (paths.shown === id) paths.shown = paths.worn[0] ?? null;
  }
  emit(state.events, { type: 'pathWorn', who, path: id, on });
  return true;
}

/** Chooses the worn Path whose title shows over the avatar, or none. */
export function showPath(state: SimState, who: EntityId, id: string | null): boolean {
  const paths = getComp(state.entities, who, 'paths');
  if (!paths || (id !== null && !paths.worn.includes(id))) return false;
  paths.shown = id;
  return true;
}

/** How people address the avatar in a line: the shown Path's form, else the handle. */
export function addressOf(state: SimState, who: EntityId): string {
  const shown = getComp(state.entities, who, 'paths')?.shown;
  const path = shown ? PATHS[shown] : undefined;
  if (path) return PATH_STRINGS[path.addressKey] ?? path.id;
  return getComp(state.entities, who, 'avatar')?.handle ?? '';
}
