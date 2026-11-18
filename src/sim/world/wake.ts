import { WAKE_IDS, WAKE_LANDMARKS, WAKE_POINTS, type WakeId } from '../../content/world/wake';
import { Dir } from '../kernel/fixed';
import { int } from '../kernel/rng';
import type { SimState } from '../state';

/** Where a new character wakes: the point, in tiles, and the way it faces. */
export interface Wake {
  id: WakeId;
  x: number;
  y: number;
  facing: number;
}

/** The cardinal direction from a point toward the nearest landmark. */
export function facingTown(x: number, y: number): number {
  let best = WAKE_LANDMARKS[0] as (typeof WAKE_LANDMARKS)[number];
  for (const l of WAKE_LANDMARKS)
    if (Math.hypot(l.x - x, l.y - y) < Math.hypot(best.x - x, best.y - y)) best = l;
  const dx = best.x - x;
  const dy = best.y - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Dir.E : Dir.W) : dy > 0 ? Dir.S : Dir.N;
}

/**
 * Picks one of the allowed wake points with the `start` stream, so no other stream shifts. The
 * origin filter (POW-M4-19) narrows `allowed`. It defaults to all eight.
 */
export function chooseWake(state: SimState, allowed: readonly WakeId[] = WAKE_IDS): Wake {
  if (allowed.length === 0) throw new Error('no wake point allowed');
  const id = allowed[int(state.rng.start, 0, allowed.length - 1)] as WakeId;
  const p = WAKE_POINTS[id];
  return { id, x: p.x, y: p.y, facing: facingTown(p.x, p.y) };
}
