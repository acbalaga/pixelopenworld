import { COMBAT } from '../balance/combat';

/** Milliseconds per sim tick (30 Hz). */
const MS_PER_TICK = 1000 / 30;

/** The shortest telegraph in ms allowed at a tier: 350 at tier 1, tightening to 200 at tier 8. */
export function minTelegraphMs(tier: number): number {
  const t = Math.min(8, Math.max(1, tier));
  const { tier1, tier8 } = COMBAT.telegraphMs;
  return Math.round(tier1 + ((tier8 - tier1) * (t - 1)) / 7);
}

/** The same minimum in whole ticks, rounded up so the real time is never under it. */
export function minTelegraphTicks(tier: number): number {
  return Math.ceil(minTelegraphMs(tier) / MS_PER_TICK - 1e-9);
}
