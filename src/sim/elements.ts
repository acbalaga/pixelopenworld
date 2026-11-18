import { STATUS_BALANCE as B } from '../content/balance/status';
import { REACTIONS, type ReactionDef } from '../content/combat/reactions';
import { ELEMENT_STATUS, isElement, type ElementId } from '../content/combat/statuses';
import { FIXTURES, type ElementAction } from '../content/world/fixtures';
import { centerPx } from './combat/fighter';
import { len } from './combat/geometry';
import { destroy, getComp, query, setComp, spawn, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { SUBPX, type Vec } from './kernel/fixed';
import { applyStatus, clearStatus, drain, hasStatus } from './statuses';
import type { SimState } from './state';

/**
 * Elements (M3-09): what a school's hit does to a unit that already carries a status (the
 * reaction table), and to the fixtures of the world (their `onElement` rules).
 */

/** Everyone alive on either team within `radius` px of `at`, in id order. */
function unitsNear(state: SimState, at: Vec, radius: number): EntityId[] {
  const out: EntityId[] = [];
  for (const id of query(state.entities, 'fighter', 'pos')) {
    if (getComp(state.entities, id, 'fighter')?.state === 'dead') continue;
    const c = centerPx(state, id);
    if (c && len({ x: c.x - at.x, y: c.y - at.y }) <= radius) out.push(id);
  }
  return out;
}

/** Runs one reaction on `dst`. */
function react(state: SimState, dst: EntityId, row: ReactionDef, src: number): void {
  for (const r of row.removes) clearStatus(state, dst, r);
  if (row.applies) applyStatus(state, dst, row.applies, src);
  const at = centerPx(state, dst);
  if (row.damage && row.id !== 'steam') drain(state, dst, row.damage, src, `reaction.${row.id}`);
  if (row.id === 'steam' && at && row.area) {
    // A cloud that stays: it hides and scalds whoever stands in it.
    const cloud = spawn(state.entities);
    setComp(state.entities, cloud, 'pos', {
      x: Math.round(at.x * SUBPX),
      y: Math.round(at.y * SUBPX),
    });
    setComp(state.entities, cloud, 'cloud', {
      kind: 'steam',
      until: state.tick + (row.area.ticks ?? 0),
      radius: row.area.radius,
      src,
    });
  }
  if (row.spreads && at && row.area) {
    for (const id of unitsNear(state, at, row.area.radius))
      if (id !== dst) applyStatus(state, id, row.spreads, src);
  }
  emit(state.events, { type: 'reaction', id: dst, reaction: row.id, src });
}

/**
 * An element hit unit `dst`. If the unit carries a status the element reacts with, the reaction
 * runs and the hit's own status is spent on it. Otherwise, when `applies`, the element's paired
 * status goes on.
 */
export function elementHitsUnit(
  state: SimState,
  dst: EntityId,
  element: string,
  src: number,
  applies: boolean,
): void {
  if (!isElement(element)) return;
  const row = REACTIONS.find((r) => r.b === element && hasStatus(state, dst, r.a));
  if (row) return react(state, dst, row, src);
  const status = ELEMENT_STATUS[element];
  if (applies && status) applyStatus(state, dst, status, src);
}

/** Applies a world action to a fixture. Returns false if nothing changed. */
function act(state: SimState, id: EntityId, action: ElementAction, element: ElementId): boolean {
  const f = getComp(state.entities, id, 'fixture');
  const def = f ? FIXTURES[f.kind] : undefined;
  if (!f || !def) return false;
  const body = getComp(state.entities, id, 'body');
  const setOpen = (open: boolean): void => {
    f.open = open;
    if (body) body.solid = !open;
  };
  switch (action) {
    case 'open':
    case 'raise':
    case 'grow':
      if (f.open) return false;
      setOpen(true);
      break;
    case 'close':
      if (!f.open) return false;
      setOpen(false);
      break;
    case 'toggle':
      setOpen(!f.open);
      break;
    case 'reveal':
      // The niche shows and can be opened like a chest: its loot is a chest source.
      if (f.revealed) return false;
      f.revealed = true;
      setComp(state.entities, id, 'interactable', { kind: f.kind });
      break;
  }
  if (def.regrows && f.open) f.until = state.worldTick + B.brushRegrowTicks;
  emit(state.events, { type: 'elementWorld', id, element, action });
  return true;
}

/**
 * An element hit the world at `at` (px). Every element fixture within `worldHitRadius` of it
 * that has a rule for the element does what the rule says. Returns how many changed.
 */
export function elementHitsWorld(state: SimState, element: string, at: Vec): number {
  if (!isElement(element)) return 0;
  let n = 0;
  for (const id of query(state.entities, 'fixture', 'pos')) {
    const f = getComp(state.entities, id, 'fixture');
    const def = f ? FIXTURES[f.kind] : undefined;
    const rule = def?.onElement?.[element];
    const p = getComp(state.entities, id, 'pos');
    if (!rule || !p) continue;
    // Fixture positions are feet; the hit lands on the body, half a tile up.
    const c = { x: p.x / SUBPX, y: p.y / SUBPX - 8 };
    if (len({ x: c.x - at.x, y: c.y - at.y }) > B.worldHitRadius + (def?.size ?? 16) / 2) continue;
    if (act(state, id, rule, element)) n++;
  }
  return n;
}

/** True if a steam cloud covers the point (px). */
export function inSteam(state: SimState, at: Vec): boolean {
  for (const id of query(state.entities, 'cloud', 'pos')) {
    const c = getComp(state.entities, id, 'cloud');
    const p = getComp(state.entities, id, 'pos');
    if (c && p && len({ x: p.x / SUBPX - at.x, y: p.y / SUBPX - at.y }) <= c.radius) return true;
  }
  return false;
}

/** True if steam stands between two points or on either (distance from a cloud to the segment). */
export function sightBlocked(state: SimState, a: Vec, b: Vec): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  for (const id of query(state.entities, 'cloud', 'pos')) {
    const c = getComp(state.entities, id, 'cloud');
    const p = getComp(state.entities, id, 'pos');
    if (!c || !p) continue;
    const cx = p.x / SUBPX;
    const cy = p.y / SUBPX;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / l2));
    if (len({ x: a.x + dx * t - cx, y: a.y + dy * t - cy }) <= c.radius) return true;
  }
  return false;
}

/**
 * Once per tick: applies the elements of this tick's hits to units, scalds what stands in steam,
 * ends clouds, and grows burnt and raised pieces back when their time comes.
 */
export function elementsSystem(state: SimState): void {
  const count = state.events.list.length;
  for (let i = 0; i < count; i++) {
    const e = state.events.list[i];
    if (e?.type !== 'damageDealt' || !e.elem) continue;
    if (getComp(state.entities, e.dst, 'fighter')?.state === 'dead') continue;
    elementHitsUnit(state, e.dst, e.elem, e.src, e.applies === true);
  }
  for (const id of query(state.entities, 'cloud', 'pos')) {
    const c = getComp(state.entities, id, 'cloud');
    const p = getComp(state.entities, id, 'pos');
    if (!c || !p) continue;
    if (state.tick >= c.until) {
      destroy(state.entities, id);
      continue;
    }
    if (state.tick % B.steam.every === 0)
      for (const u of unitsNear(state, { x: p.x / SUBPX, y: p.y / SUBPX }, c.radius))
        drain(state, u, B.steam.damage, c.src, 'reaction.steam');
  }
  for (const id of query(state.entities, 'fixture')) {
    const f = getComp(state.entities, id, 'fixture');
    if (f?.until === undefined || state.worldTick < f.until) continue;
    // A fixture raised by a technique simply goes when its time is up.
    if (f.temp) {
      destroy(state.entities, id);
      continue;
    }
    const body = getComp(state.entities, id, 'body');
    // Nothing grows back on top of someone: wait a little and try again.
    if (body && standsOn(state, id)) {
      f.until = state.worldTick + 30;
      continue;
    }
    f.open = false;
    delete f.until;
    if (body) body.solid = true;
    emit(state.events, { type: 'elementWorld', id, element: 'regrow', action: 'close' });
  }
}

function standsOn(state: SimState, id: EntityId): boolean {
  const p = getComp(state.entities, id, 'pos');
  const b = getComp(state.entities, id, 'body');
  if (!p || !b) return false;
  const half = b.w / 2;
  for (const u of query(state.entities, 'fighter', 'pos')) {
    const q = getComp(state.entities, u, 'pos');
    if (q && Math.abs(q.x - p.x) < half + 2560 && q.y > p.y - b.h - 2560 && q.y < p.y + 2560)
      return true;
  }
  return false;
}
