/**
 * Roamers (POW-M4-05). A roamer keeps to a schedule (`content/creatures/roamers`): the creature's
 * home is where the schedule says it should be at this minute of the day, and it drifts after it.
 * Pure of everything but the clock, so the route is the same every day and a test can ask where
 * it is at any minute.
 */
import { ROAMERS, type RoamerDef } from '../../content/creatures/roamers';
import { getComp, query } from '../kernel/entities';
import { px } from '../kernel/fixed';
import type { SimState } from '../state';
import { DAY_MINUTES, minuteOfDay } from '../time';

/** A creature farther than this many px from its route spot, and not in a fight, is put back on it. */
export const SNAP_PX = 480;

/** Where a roamer is at `minute` of the day, in tiles. */
export function routeAt(def: RoamerDef, minute: number): { x: number; y: number } {
  const n = def.stops.length;
  const m = ((minute % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  for (let i = 0; i < n; i++) {
    const a = def.stops[i]!;
    const b = def.stops[(i + 1) % n]!;
    // Time of the next arrival, in the same turn of the clock as this stop.
    const next = i + 1 < n ? b.arrive : b.arrive + DAY_MINUTES;
    // This minute, or the same minute a day on, since the last leg wraps past the end of the day.
    for (const t of [m, m + DAY_MINUTES]) {
      if (t >= a.arrive && t < a.leave) return { x: a.x, y: a.y };
      if (t >= a.leave && t < next) {
        const k = (t - a.leave) / (next - a.leave);
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
  }
  const last = def.stops[n - 1]!;
  return { x: last.x, y: last.y };
}

/** Moves the home of every roamer that is not in a fight to its place on the route. */
export function roamSystem(state: SimState): void {
  const minute = minuteOfDay(state.worldTick);
  // A creature made this tick starts where the schedule says it is, not at its spawner.
  const made = new Set<number>();
  for (const e of state.events.list) if (e.type === 'spawned') made.add(e.id);
  for (const id of query(state.entities, 'ai', 'pos')) {
    const ai = getComp(state.entities, id, 'ai');
    const def = ai ? ROAMERS[ai.creature] : undefined;
    if (!ai || !def || def.region !== (state.region ?? 'slice')) continue;
    const pos = getComp(state.entities, id, 'pos');
    if (!pos) continue;
    // In a fight, or on its way back from one, it stays where it was.
    if (ai.target !== null || (ai.state !== 'idle' && ai.state !== 'wander')) continue;
    const at = routeAt(def, minute);
    ai.home = { x: px(at.x * 16 + 8), y: px(at.y * 16 + 14) };
    const dx = (pos.x - ai.home.x) / 256;
    const dy = (pos.y - ai.home.y) / 256;
    // Just made, or put down far from where it should be: it is where the schedule says.
    if (made.has(id) || Math.hypot(dx, dy) > SNAP_PX) {
      pos.x = ai.home.x;
      pos.y = ai.home.y;
    }
  }
}
