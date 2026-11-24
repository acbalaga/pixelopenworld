export { identitiesOf, identityOf, initialLife, initialLives, normalizeHandle } from './generate';
export { decodeLives, encodeLives, livesFromText, livesToText } from './codec';
export { PLACE_LIST, SKILL_LIST, placeIdx, skillIdx } from './lists';
export { MEMORY_RING } from './types';
export type { MemoryEntry, TravelerIdentity, TravelerLife } from './types';

import type { TravelerLife } from './types';

/** Sums used by the integrity summary: points across every build, and coin across every purse. */
export function travelerTotals(lives: readonly TravelerLife[]): { points: number; coin: number } {
  let points = 0;
  let coin = 0;
  for (const l of lives) {
    for (const [, p] of l.build) points += p;
    coin += l.coin;
  }
  return { points, coin };
}
