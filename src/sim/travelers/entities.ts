import { WEAPONS } from '../../content/combat/attacks';
import {
  ABSTRACT_TICKS,
  ENTITY,
  TRAVEL_TILES_PER_MINUTE,
  TRAVELER_COUNT,
} from '../../content/balance/travelers';
import { PATH_LIST } from '../../content/paths';
import { PATH_STRINGS } from '../../content/strings/paths';
import { PLACES } from '../../content/people/places';
import type { DollSpec } from '../../content/dolls/parts';
import { startComboStep } from '../combat/commands';
import { newFighter, newPools } from '../combat/fighter';
import { destroy, getComp, query, setComp, spawn, type EntityId } from '../kernel/entities';
import { px, SUBPX } from '../kernel/fixed';
import type { SimState } from '../state';
import { nudge } from '../systems/movement';
import { chunkOfPx, inWindow } from '../world/window';
import { findAvatar } from '../../shared/summary';
import type { Crowd, Doing } from './crowd';
import { identitiesOf } from './generate';
import { TRAVELER_KIND, travelerSlotOf } from './kind';
import { PLACE_LIST, SKILL_LIST } from './lists';
import { findPath, type Tile } from './path';
import type { TravelerIdentity } from './types';

/**
 * Travelers near the player are real entities (POW-M5-04, tech/01 levels of detail). A Traveler
 * whose place is inside the active chunks is promoted: an entity is built from its life and
 * identity. One that leaves the window, logs out or falls is demoted: position, activity and
 * outcomes are written back. The entity layer only draws and moves what the abstract model already
 * decided, and the abstract minute keeps accounting outcomes, so moving between the two views never
 * creates or loses an item or a coin. Entity state is not saved: it is rebuilt from the life.
 */

export type EntMode = 'walk' | 'stand' | 'sit' | 'idle' | 'afk' | 'gather' | 'fight';

export interface TravelerEnt {
  slot: number;
  mode: EntMode;
  face: 0 | 2 | 4 | 6;
  /** Tile path to the goal and the index being walked to. */
  path: Tile[];
  pi: number;
  goalKey: string;
  /** Ticks without progress toward a goal, and ticks spent standing still. */
  stuck: number;
  still: number;
  /** Work animation while gathering, or ''. */
  work: string;
  lastX: number;
  lastY: number;
}

/** A login or logout shimmer, drawn where the Traveler stood. */
export interface Shimmer {
  slot: number;
  x: number;
  y: number;
  kind: 'in' | 'out';
  t: number;
  face: 0 | 2 | 4 | 6;
}

const TILE = 16;

// ---- Where a place is ----

/** Feet position in px of a Traveler standing at a place, or null if the place has no spot yet. */
export function standPx(slot: number, place: number): { x: number; y: number } | null {
  const spot = PLACES[PLACE_LIST[place] ?? '']?.spot;
  if (!spot) return null;
  const n = spot.slots.length;
  const tile =
    n > 0
      ? (spot.slots[(slot * 3) % n] as readonly [number, number])
      : ([spot.rect.x + (spot.rect.w >> 1), spot.rect.y + (spot.rect.h >> 1)] as const);
  // A few px apart, so a crowd on one slot is not one sprite.
  const ox = (((slot * 7) % 5) - 2) * 3;
  const oy = (((slot * 11) % 5) - 2) * 2;
  return { x: tile[0] * TILE + 8 + ox, y: tile[1] * TILE + 14 + oy };
}

/** Where a Traveler is expected to be now, from its life and what it is doing (px). */
export function expectedPx(
  state: SimState,
  crowd: Crowd,
  slot: number,
): { x: number; y: number } | null {
  const life = state.travelers[slot]!;
  const d = crowd.doing[slot];
  if (d && d.eta > 0 && d.total > 0) {
    const a = standPx(slot, d.from);
    const b = standPx(slot, d.place);
    if (a && b) {
      const f = Math.min(1, Math.max(0, 1 - d.eta / d.total));
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    }
  }
  return standPx(slot, d && d.eta === 0 ? d.place : life.place);
}

// ---- The window ----

interface Where {
  ax: number;
  ay: number;
  px: number;
  py: number;
}

function whereIsPlayer(state: SimState): Where | null {
  const who = findAvatar(state);
  const p = who === null ? undefined : getComp(state.entities, who, 'pos');
  if (!p) return null;
  const x = p.x / SUBPX;
  const y = p.y / SUBPX;
  const s = state.stream;
  return {
    ax: s && Number.isFinite(s.ax) ? s.ax : chunkOfPx(x),
    ay: s && Number.isFinite(s.ay) ? s.ay : chunkOfPx(y),
    px: x,
    py: y,
  };
}

function inside(state: SimState, w: Where, x: number, y: number, radius: number): boolean {
  if (state.stream) return inWindow(chunkOfPx(x), chunkOfPx(y), w.ax, w.ay, radius);
  return (
    Math.hypot(x - w.px, y - w.py) <= ENTITY.flatRangePx * (radius > ENTITY.promoteRadius ? 1.5 : 1)
  );
}

// ---- Entities ----

const WEAPON_FOR: Record<string, string> = {
  none: 'fists',
  sword: 'sword',
  dagger: 'sword',
  staff: 'fists',
  spear: 'spear',
  maul: 'maul',
  bow: 'bow',
  wraps: 'wraps',
};
const FAMILY_SKILL: Record<string, string> = {
  blades: 'skill.blades',
  polearms: 'skill.polearms',
  heavy: 'skill.heavy_arms',
  archery: 'skill.archery',
  unarmed: 'skill.unarmed',
};

const topPoints = (state: SimState, slot: number): number => {
  let top = 0;
  for (const [, p] of state.travelers[slot]!.build) top = Math.max(top, p);
  return top;
};

function pointsIn(state: SimState, slot: number, skill: string): number {
  const i = SKILL_LIST.indexOf(skill);
  return state.travelers[slot]!.build.find(([s]) => s === i)?.[1] ?? 0;
}

export function newEnt(slot: number): TravelerEnt {
  return {
    slot,
    mode: 'stand',
    face: 4,
    path: [],
    pi: 0,
    goalKey: '',
    stuck: 0,
    still: 0,
    work: '',
    lastX: 0,
    lastY: 0,
  };
}

function spawnEntity(
  state: SimState,
  crowd: Crowd,
  t: TravelerIdentity,
  at: { x: number; y: number },
): EntityId {
  const e = spawn(state.entities);
  const C = state.entities;
  setComp(C, e, 'pos', { x: px(at.x), y: px(at.y) });
  setComp(C, e, 'vel', { x: 0, y: 0 });
  // Not solid: a Traveler never traps the player in a crowded square.
  setComp(C, e, 'body', { w: px(10), h: px(8), solid: false });
  setComp(C, e, 'interactable', { kind: `${TRAVELER_KIND}${t.slot}` });
  const top = topPoints(state, t.slot);
  const pools = newPools(state.tick);
  pools.hpMax = Math.round(ENTITY.hpBase + ENTITY.hpPerPoint * top);
  pools.hp = pools.hpMax;
  setComp(C, e, 'pools', pools);
  const fighter = newFighter(0, [null]);
  fighter.scheme = 'classic';
  setComp(C, e, 'fighter', fighter);
  const weapon = WEAPON_FOR[t.look.mainHand] ?? 'fists';
  const def = WEAPONS[weapon]!;
  setComp(C, e, 'combatant', {
    weapon,
    power: def.power,
    defense: Math.floor(top / ENTITY.defensePerPoints),
    skillRank: pointsIn(state, t.slot, FAMILY_SKILL[def.family] ?? ''),
    name: t.handle,
    kind: 'traveler',
    tier: 0,
  });
  crowd.ents.set(e, newEnt(t.slot));
  crowd.entOf[t.slot] = e;
  crowd.promoted[t.slot] = 1;
  const ent = crowd.ents.get(e)!;
  ent.lastX = at.x;
  ent.lastY = at.y;
  return e;
}

/** Writes an entity's state back into the life and the abstract doing, and removes it. */
export function demote(
  state: SimState,
  crowd: Crowd,
  id: EntityId,
  why: 'range' | 'logout' | 'gone',
): void {
  const ent = crowd.ents.get(id);
  if (!ent) return;
  const slot = ent.slot;
  const life = state.travelers[slot]!;
  const d = crowd.doing[slot];
  const pos = state.entities.comps.pos[id];
  if (d) {
    if (d.eta > 0 && why === 'range' && pos) {
      // Still on the road: the abstract trip picks up with the minutes left from here.
      const dest = standPx(slot, d.place);
      if (dest) {
        const tiles = (Math.abs(dest.x - pos.x / SUBPX) + Math.abs(dest.y - pos.y / SUBPX)) / TILE;
        d.eta = Math.max(1, Math.ceil(tiles / TRAVEL_TILES_PER_MINUTE));
      }
    } else if (d.eta === 0) life.place = d.place;
  }
  if (state.entities.alive[id]) destroy(state.entities, id);
  crowd.ents.delete(id);
  crowd.entOf[slot] = -1;
  crowd.promoted[slot] = 0;
}

/** Demotes every Traveler entity, for a save or a region change. */
export function demoteAll(state: SimState): void {
  const crowd = state.crowd;
  if (!crowd) return;
  for (const id of [...crowd.ents.keys()]) demote(state, crowd, id, 'range');
}

/** Drops a logged-out Traveler's entity with a shimmer. */
export function logoutEntity(state: SimState, crowd: Crowd, slot: number): void {
  const id = crowd.entOf[slot] ?? -1;
  if (id < 0) return;
  const pos = state.entities.comps.pos[id];
  const ent = crowd.ents.get(id);
  if (pos && ent)
    crowd.fx.push({ slot, x: pos.x / SUBPX, y: pos.y / SUBPX, kind: 'out', t: 0, face: ent.face });
  demote(state, crowd, id, 'logout');
}

/** Checks who should be promoted or demoted. Called every {@link ENTITY.checkTicks} ticks. */
export function promoteSystem(state: SimState, crowd: Crowd): void {
  const w = whereIsPlayer(state);
  if (!w) return;
  // Demote: gone, out of the loaded ring, or logged out without the system noticing.
  for (const [id, ent] of [...crowd.ents]) {
    if (!state.entities.alive[id]) {
      demote(state, crowd, id, 'gone');
      continue;
    }
    const p = state.entities.comps.pos[id];
    if (
      !crowd.online[ent.slot] ||
      !p ||
      !inside(state, w, p.x / SUBPX, p.y / SUBPX, ENTITY.demoteRadius)
    )
      demote(state, crowd, id, crowd.online[ent.slot] ? 'range' : 'logout');
  }
  const ids = identitiesOf(crowd.seed);
  const near: { slot: number; d: number; at: { x: number; y: number } }[] = [];
  for (const t of ids) {
    if (!crowd.online[t.slot]) continue;
    let at: { x: number; y: number } | null;
    const existing = crowd.entOf[t.slot] ?? -1;
    if (existing >= 0) {
      const p = state.entities.comps.pos[existing]!;
      at = { x: p.x / SUBPX, y: p.y / SUBPX };
    } else at = expectedPx(state, crowd, t.slot);
    if (!at) continue;
    if (existing < 0 && !inside(state, w, at.x, at.y, ENTITY.promoteRadius)) continue;
    near.push({ slot: t.slot, d: Math.hypot(at.x - w.px, at.y - w.py), at });
  }
  near.sort((a, b) => a.d - b.d || a.slot - b.slot);
  const keep = new Set(near.slice(0, ENTITY.cap).map((n) => n.slot));
  // Over the cap: the farthest promoted give way to nearer ones.
  for (const [id, ent] of [...crowd.ents])
    if (!keep.has(ent.slot)) demote(state, crowd, id, 'range');
  for (const n of near) {
    if (!keep.has(n.slot) || (crowd.entOf[n.slot] ?? -1) >= 0) continue;
    const t = ids[n.slot]!;
    const id = spawnEntity(state, crowd, t, n.at);
    if (crowd.justIn.delete(n.slot))
      crowd.fx.push({
        slot: n.slot,
        x: n.at.x,
        y: n.at.y,
        kind: 'in',
        t: 0,
        face: crowd.ents.get(id)!.face,
      });
  }
}

// ---- Behavior ----

const cardinal = (dx: number, dy: number, keep: 0 | 2 | 4 | 6): 0 | 2 | 4 | 6 =>
  dx === 0 && dy === 0 ? keep : Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 6) : dy > 0 ? 4 : 0;

/** The nearest live creature within `range` px of a point, or null. */
function nearestFoe(state: SimState, x: number, y: number, range: number): EntityId | null {
  let best: EntityId | null = null;
  let bestD = range;
  for (const id of query(state.entities, 'fighter', 'pos')) {
    const f = state.entities.comps.fighter[id]!;
    if (f.team !== 1 || f.state === 'dead') continue;
    const p = state.entities.comps.pos[id]!;
    const d = Math.hypot(p.x / SUBPX - x, p.y / SUBPX - y);
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  }
  return best;
}

/** The nearest gathering node that matches what the Traveler is working, or null. */
function nodeFor(
  state: SimState,
  x: number,
  y: number,
  kind: string,
): { x: number; y: number; anim: string } | null {
  let best: { x: number; y: number; anim: string } | null = null;
  let bestD = 14 * TILE;
  for (const id of query(state.entities, 'node', 'pos')) {
    const n = state.entities.comps.node[id]!;
    if (n.kind !== kind) continue;
    const p = state.entities.comps.pos[id]!;
    const d = Math.hypot(p.x / SUBPX - x, p.y / SUBPX - y);
    if (d < bestD) {
      best = { x: p.x / SUBPX, y: p.y / SUBPX + 10, anim: '' };
      bestD = d;
    }
  }
  return best;
}

function walkTo(state: SimState, id: EntityId, ent: TravelerEnt, gx: number, gy: number): boolean {
  const p = state.entities.comps.pos[id]!;
  const x = p.x / SUBPX;
  const y = p.y / SUBPX;
  const key = `${Math.round(gx)},${Math.round(gy)}`;
  const grid = state.world;
  if (ent.goalKey !== key && ent.goalKey !== `x${key}`) {
    ent.goalKey = key;
    ent.stuck = 0;
    ent.pi = 0;
    ent.path = [];
    if (grid) {
      const path = findPath(
        grid,
        { x: Math.floor(x / TILE), y: Math.floor((y - 1) / TILE) },
        { x: Math.floor(gx / TILE), y: Math.floor((gy - 1) / TILE) },
      );
      if (path) ent.path = path;
      else ent.goalKey = `x${key}`;
    }
  }
  if (ent.goalKey.startsWith('x')) return false;
  // The next point: the center of the next path tile, then the goal itself.
  let tx = gx;
  let ty = gy;
  while (ent.pi < ent.path.length) {
    const t = ent.path[ent.pi]!;
    const cx = t.x * TILE + 8;
    const cy = t.y * TILE + 14;
    if (Math.hypot(cx - x, cy - y) <= ENTITY.arrivePx) ent.pi++;
    else {
      tx = cx;
      ty = cy;
      break;
    }
  }
  const dx = tx - x;
  const dy = ty - y;
  const dist = Math.hypot(dx, dy);
  if (dist <= ENTITY.arrivePx && ent.pi >= ent.path.length) return true;
  const step = Math.min(ENTITY.speedSubPx, dist * SUBPX);
  nudge(state, id, Math.round((dx / dist) * step), Math.round((dy / dist) * step));
  ent.face = cardinal(dx, dy, ent.face);
  const q = state.entities.comps.pos[id]!;
  if (Math.hypot(q.x / SUBPX - ent.lastX, q.y / SUBPX - ent.lastY) < 0.4) ent.stuck++;
  else ent.stuck = 0;
  ent.lastX = q.x / SUBPX;
  ent.lastY = q.y / SUBPX;
  if (ent.stuck >= ENTITY.stuckTicks) {
    ent.goalKey = `x${key}`;
    return false;
  }
  return false;
}

function idleMode(d: Doing | null, ent: TravelerEnt): EntMode {
  if (!d) return 'stand';
  if (d.kind === 'afk') return ent.still >= ENTITY.afkTicks ? 'afk' : 'idle';
  if (d.kind === 'social')
    return d.place === PLACE_LIST.indexOf('hearthford.inn') ? 'sit' : 'stand';
  return 'idle';
}

/** One tick of every promoted Traveler: walk, stand, work, fight. */
export function entityTick(state: SimState, crowd: Crowd): void {
  for (const [id, ent] of crowd.ents) {
    const f = state.entities.comps.fighter[id];
    const p = state.entities.comps.pos[id];
    if (!f || !p || !state.entities.alive[id]) continue;
    const d = crowd.doing[ent.slot] ?? null;
    if (f.state !== 'idle') {
      ent.mode = f.state === 'attack' ? 'fight' : 'idle';
      continue;
    }
    const x = p.x / SUBPX;
    const y = p.y / SUBPX;
    ent.work = '';
    if (!d) {
      ent.mode = 'stand';
      ent.still++;
      continue;
    }
    if (d.kind === 'fight' && d.eta === 0) {
      const foe = nearestFoe(state, x, y, ENTITY.seekPx);
      if (foe !== null) {
        const fp = state.entities.comps.pos[foe]!;
        const reach = (WEAPONS[state.entities.comps.combatant[id]!.weapon]?.reach ?? 20) - 4;
        const dist = Math.hypot(fp.x / SUBPX - x, fp.y / SUBPX - y);
        ent.face = cardinal(fp.x / SUBPX - x, fp.y / SUBPX - y, ent.face);
        if (dist > reach) {
          walkTo(state, id, ent, fp.x / SUBPX, fp.y / SUBPX);
          ent.mode = 'walk';
        } else {
          f.aim = { x: fp.x / SUBPX - x || 0, y: fp.y / SUBPX - y || 1 };
          startComboStep(state, id);
          ent.mode = 'fight';
        }
        ent.still = 0;
        continue;
      }
    }
    // The goal: the trip's end, or where the work is.
    const dest = standPx(ent.slot, d.place);
    let goal = dest;
    let work = '';
    if (d.eta === 0 && d.kind === 'gather') {
      const n = nodeFor(state, dest?.x ?? x, dest?.y ?? y, d.thing);
      if (n) {
        goal = n;
        work = 'work_reach';
      }
    }
    if (!goal) {
      ent.mode = 'stand';
      ent.still++;
      continue;
    }
    const arrived = walkTo(state, id, ent, goal.x, goal.y);
    const moving = !arrived && !ent.goalKey.startsWith('x');
    if (moving) {
      ent.mode = 'walk';
      ent.still = 0;
    } else {
      ent.still++;
      if (work) {
        ent.mode = 'gather';
        ent.work = work;
      } else ent.mode = idleMode(d, ent);
    }
  }
  // Shimmers age out.
  for (let i = crowd.fx.length - 1; i >= 0; i--) {
    const s = crowd.fx[i]!;
    if (++s.t >= ENTITY.shimmerTicks) crowd.fx.splice(i, 1);
  }
}

// ---- What the renderer and the UI read ----

/** The title shown under a Traveler's name, or ''. The first Path it has earned. */
export function titleOf(state: SimState, slot: number): string {
  const bits = state.travelers[slot]!.paths;
  for (let i = 0; i < PATH_LIST.length && i < 32; i++) {
    if ((bits >>> i) & 1) {
      const def = PATH_LIST[i]!;
      return PATH_STRINGS[`${def.id}.title`] ?? '';
    }
  }
  return '';
}

export interface TravelerView {
  id: EntityId;
  slot: number;
  x: number;
  y: number;
  face: 0 | 2 | 4 | 6;
  anim: string;
  handle: string;
  title: string;
  afk: boolean;
  look: DollSpec;
}

/** Every promoted Traveler, in draw order (by y), for the renderer. */
export function travelerViews(state: SimState): TravelerView[] {
  const crowd = state.crowd;
  if (!crowd) return [];
  const ids = identitiesOf(crowd.seed);
  const out: TravelerView[] = [];
  for (const [id, ent] of crowd.ents) {
    const p = state.entities.comps.pos[id];
    const f = state.entities.comps.fighter[id];
    if (!p || !f) continue;
    const t = ids[ent.slot]!;
    const anim =
      f.state === 'attack'
        ? 'attack'
        : f.state === 'hurt' || f.state === 'stagger'
          ? 'hurt'
          : f.state === 'dead'
            ? 'hurt'
            : ent.mode === 'walk'
              ? 'walk'
              : ent.mode === 'gather'
                ? ent.work
                : 'idle';
    out.push({
      id,
      slot: ent.slot,
      x: p.x / SUBPX,
      y: p.y / SUBPX,
      face: ent.face,
      anim,
      handle: t.handle,
      title: titleOf(state, ent.slot),
      afk: ent.mode === 'afk',
      look: t.look,
    });
  }
  return out.sort((a, b) => a.y - b.y || a.slot - b.slot);
}

export { ABSTRACT_TICKS, TRAVELER_COUNT, travelerSlotOf };

/** What a profile card shows (POW-M5-04): the doll, the handle, the title, the guild, three top skills by band. */
export interface ProfileCard {
  slot: number;
  handle: string;
  title: string;
  guild: number;
  look: DollSpec;
  /** Up to three skill ids with a rank band, never exact points. */
  skills: { skill: string; band: number }[];
  met: boolean;
}

/** Rank bands of 25 points: 0 Novice, 1 Practiced, 2 Skilled, 3 Expert, 4 Master. */
export const bandOf = (points: number): number => Math.min(4, Math.floor(points / 25));

export function profileOf(state: SimState, slot: number): ProfileCard {
  const t = identitiesOf(state.seed)[slot]!;
  const life = state.travelers[slot]!;
  const skills = [...life.build]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 3)
    .map(([i, pts]) => ({ skill: SKILL_LIST[i] as string, band: bandOf(pts) }));
  return {
    slot,
    handle: t.handle,
    title: titleOf(state, slot),
    guild: life.guild,
    look: t.look,
    skills,
    // Bit 5 of the flags is "met" (design/12 section 1). M5-06 owns the rest of the bits.
    met: ((life.flags >>> 5) & 1) === 1,
  };
}

/** Entities the player can see right now, for the dev overlay. */
export const promotedCount = (crowd: Crowd): number => crowd.ents.size;
