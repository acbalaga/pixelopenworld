import { WEATHER_BALANCE as B } from '../content/balance/weather';
import type { SimState } from './state';
import { weatherAt } from './time';

/** Percent strength of an element's hit for a hit landing at a position (sub-pixel units). */
export function elementPct(state: SimState, element: string, x: number, y: number): number {
  return B.elementPct[weatherAt(state, x, y)]?.[element] ?? 100;
}

/** Percent of its usual range a creature at a position notices at. */
export function noticePct(state: SimState, x: number, y: number): number {
  return B.noticePct[weatherAt(state, x, y)] ?? 100;
}

/**
 * Ticks a spawner at a position counts this tick: 1 at the usual rate, with the extra or missing
 * ticks spread evenly across the clock so the average is the weather's share and no random
 * number is spent.
 */
export function spawnTicks(state: SimState, x: number, y: number): number {
  const pct = B.spawnPct[weatherAt(state, x, y)] ?? 100;
  return Math.floor(((state.tick + 1) * pct) / 100) - Math.floor((state.tick * pct) / 100);
}
