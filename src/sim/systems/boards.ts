import { generateStanding, regionFacts } from '../requestGen';
import { query } from '../kernel/entities';
import type { SimState } from '../state';
import { dayIndex } from '../time';

/**
 * Posts new jobs at each board at dawn (M3-11), when the in-game day turns over. What was posted
 * and not taken is replaced. A board that has never been posted on posts as soon as it exists.
 */
export function boardsSystem(state: SimState): void {
  const day = dayIndex(state.worldTick);
  let facts: ReturnType<typeof regionFacts> | null = null;
  for (const id of query(state.entities, 'board')) {
    const b = state.entities.comps.board[id];
    if (!b || b.day === day) continue;
    facts ??= regionFacts(state);
    b.day = day;
    b.posted = generateStanding(facts, state.rng.requests, b.id, day);
  }
}
