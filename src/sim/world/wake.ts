import { WAKE_IDS, WAKE_TABLES, type WakeId } from '../../content/world/wake';
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

/** The table a region wakes from. Throws for a region with none, which is a caller bug. */
function tableOf(region: string): (typeof WAKE_TABLES)[string] {
  const t = WAKE_TABLES[region];
  if (!t) throw new Error(`region ${region} has no wake points`);
  return t;
}

/** The cardinal direction from a point toward the nearest landmark of the region. */
export function facingTown(x: number, y: number, region = 'dawnmeadow'): number {
  const marks = tableOf(region).landmarks;
  let best = marks[0] as (typeof marks)[number];
  for (const l of marks)
    if (Math.hypot(l.x - x, l.y - y) < Math.hypot(best.x - x, best.y - y)) best = l;
  const dx = best.x - x;
  const dy = best.y - y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Dir.E : Dir.W) : dy > 0 ? Dir.S : Dir.N;
}

/**
 * Picks one of the allowed wake points with the `start` stream, so no other stream shifts. The
 * origin filter (POW-M4-19) narrows `allowed`. It defaults to all eight.
 */
export function chooseWake(
  state: SimState,
  allowed: readonly WakeId[] = WAKE_IDS,
  region = 'dawnmeadow',
): Wake {
  if (allowed.length === 0) throw new Error('no wake point allowed');
  const id = allowed[int(state.rng.start, 0, allowed.length - 1)] as WakeId;
  const p = tableOf(region).points[id];
  return { id, x: p.x, y: p.y, facing: facingTown(p.x, p.y, region) };
}
