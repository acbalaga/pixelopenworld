import { MOVEMENT as M } from '../../content/balance/movement';
import { COMBAT } from '../../content/balance/combat';
import { Dir, dirStep, type Direction } from '../kernel/fixed';
import { getComp, query } from '../kernel/entities';
import type { SimState } from '../state';
import { moveBoxSolid, type Box } from './collision';
import { guardWalkPct } from '../combat/guard';

/** Target velocity for a direction at a cardinal speed. Diagonals use 1/sqrt(2), so they are not faster. */
export function targetVelocity(dir: Direction | null, speed: number): { x: number; y: number } {
  if (dir === null) return { x: 0, y: 0 };
  const s = dirStep(dir);
  const k = s.x !== 0 && s.y !== 0 ? Math.round((speed * M.diagonal256) / 256) : speed;
  return { x: s.x * k, y: s.y * k };
}

/** Moves `v` toward `target`. Speeding up uses `accel`, slowing down or stopping uses `decel`. */
function ramp(v: number, target: number, accel: number, decel: number): number {
  const step = Math.abs(target) < Math.abs(v) || Math.sign(target) !== Math.sign(v) ? decel : accel;
  if (Math.abs(target - v) <= step) return target;
  return v + Math.sign(target - v) * step;
}

/** Cardinal facing after the stick points `dir`. A diagonal keeps the current facing if it is one of its axes. */
export function facingFor(dir: Direction, current: Direction): Direction {
  if (dir % 2 === 0) return dir;
  const horizontal = dir <= Dir.SE ? Dir.E : Dir.W;
  const vertical = dir === Dir.NE || dir === Dir.NW ? Dir.N : Dir.S;
  return current === horizontal || current === vertical ? current : horizontal;
}

/** Solid bodies other than `self`, as boxes in sub-pixel units. */
function solidBoxes(state: SimState, self: number): Box[] {
  const out: Box[] = [];
  const { pos, body } = state.entities.comps;
  for (const id of query(state.entities, 'pos', 'body')) {
    const b = body[id];
    const p = pos[id];
    if (id === self || !b || !p || !b.solid) continue;
    out.push({ x: p.x - (b.w >> 1), y: p.y - b.h, w: b.w, h: b.h });
  }
  return out;
}

/**
 * Moves an entity's body by (dx, dy) sub-pixels with tile and solid-body collision. Returns the
 * distance actually moved. Used by walking, dodges, dashes, knockback and creature movement.
 */
export function nudge(
  state: SimState,
  id: number,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const p = getComp(state.entities, id, 'pos');
  const b = getComp(state.entities, id, 'body');
  if (!p || !b || (dx === 0 && dy === 0)) return { x: 0, y: 0 };
  const from: Box = { x: p.x - (b.w >> 1), y: p.y - b.h, w: b.w, h: b.h };
  const grid = state.world;
  const to = grid
    ? moveBoxSolid(grid, from, dx, dy, solidBoxes(state, id))
    : { ...from, x: from.x + dx, y: from.y + dy };
  p.x = to.x + (b.w >> 1);
  p.y = to.y + b.h;
  return { x: to.x - from.x, y: to.y - from.y };
}

/**
 * Avatar movement: sprint state, velocity ramps, collision against tiles and solid bodies,
 * facing. Runs after commands are applied, so a stick change moves the avatar the same tick.
 * The avatar's combat state shapes it: dodges and dashes override the velocity, swinging slows
 * it, being hurt or dead stops it, and a hit pause freezes it.
 */
export function movementSystem(state: SimState): void {
  const e = state.entities;
  for (const id of query(e, 'avatar', 'pos', 'vel', 'body', 'pools')) {
    const a = getComp(e, id, 'avatar');
    const v = getComp(e, id, 'vel');
    const pools = getComp(e, id, 'pools');
    const f = getComp(e, id, 'fighter');
    if (!a || !v || !pools) continue;
    if (f && f.hitstop > 0) continue;

    a.fullTicks = a.intent !== null && a.full ? a.fullTicks + 1 : 0;
    const sprint =
      a.fullTicks >= M.sprintHoldTicks && !a.winded && pools.sta > 0 && (!f || f.state === 'idle');
    if (sprint) {
      a.sprinting = true;
      pools.sta = Math.max(0, pools.sta - M.sprintDrain);
      pools.lastSpend = state.tick;
      if (pools.sta === 0) {
        a.winded = true;
        a.sprinting = false;
      }
    } else {
      a.sprinting = false;
      if (a.winded && pools.sta >= M.sprintResume) a.winded = false;
    }

    const state_ = f?.state ?? 'idle';
    const forced = state_ === 'dodge' || (state_ === 'attack' && (f?.dv.x !== 0 || f?.dv.y !== 0));
    if (forced && f) {
      v.x = f.dv.x;
      v.y = f.dv.y;
    } else {
      const frozen = state_ === 'hurt' || state_ === 'stagger' || state_ === 'dead';
      const swing = state_ === 'attack' ? COMBAT.attackMoveFactor : guardWalkPct(state, id);
      const base = a.sprinting ? Math.round((M.walkSpeed * M.sprintFactor256) / 256) : M.walkSpeed;
      const speed = Math.round((base * swing) / 100);
      const t = frozen ? { x: 0, y: 0 } : targetVelocity(a.intent, speed);
      const accel = Math.ceil(speed / M.accelTicks);
      const decel = Math.ceil(M.walkSpeed / M.decelTicks);
      // Both axes moving means a diagonal: scale the steps so the speed ramps no faster than a cardinal.
      const diag = (t.x !== 0 && t.y !== 0) || (v.x !== 0 && v.y !== 0);
      const k = (n: number): number => (diag ? Math.ceil((n * M.diagonal256) / 256) : n);
      v.x = ramp(v.x, t.x, k(accel), k(decel));
      v.y = ramp(v.y, t.y, k(accel), k(decel));
      if (a.intent !== null && !frozen && !f?.lock) a.facing = facingFor(a.intent, a.facing);
    }

    if (v.x === 0 && v.y === 0) continue;
    const moved = nudge(state, id, v.x, v.y);
    // A blocked axis loses its speed, so pushing into a wall does not store momentum.
    if (moved.x !== v.x) v.x = 0;
    if (moved.y !== v.y) v.y = 0;
  }
}
