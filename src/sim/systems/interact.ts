import { MOVEMENT as M } from '../../content/balance/movement';
import { dirStep, SUBPX } from '../kernel/fixed';
import { getComp, query, type EntityId } from '../kernel/entities';
import type { SimState } from '../state';
import { isTravelerEntity } from '../travelers/kind';

/**
 * The entity the context button would act on for `who`, or null. It must be in front of the
 * avatar (inside the facing cone) and within reach. Two tiers: anything that is not a promoted
 * Traveler first, then Travelers (POW-M5-32), so a Traveler standing in front of a Waystone, node,
 * door or person never takes the press meant for it. Within a tier the nearest wins, ties go to
 * the lowest id.
 * The HUD shows the context button exactly when this returns something.
 */
export function contextTarget(state: SimState, who: EntityId): EntityId | null {
  const a = getComp(state.entities, who, 'avatar');
  const p = getComp(state.entities, who, 'pos');
  if (!a || !p) return null;
  const f = dirStep(a.facing);
  const reach = M.interactReach * SUBPX;
  const half = M.interactHalfWidth * SUBPX;
  let best: EntityId | null = null;
  let bestTraveler = false;
  let bestAhead = Infinity;
  for (const id of query(state.entities, 'interactable', 'pos')) {
    if (id === who) continue;
    const q = getComp(state.entities, id, 'pos');
    if (!q) continue;
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const ahead = dx * f.x + dy * f.y;
    const side = Math.abs(dx * f.y - dy * f.x);
    if (ahead < 0 || ahead > reach || side > half) continue;
    const traveler = isTravelerEntity(state, id);
    // Fixtures outrank Travelers; within a tier the nearest wins (ids ascend, so ties keep the first).
    if (
      best === null ||
      (bestTraveler && !traveler) ||
      (traveler === bestTraveler && ahead < bestAhead)
    ) {
      best = id;
      bestTraveler = traveler;
      bestAhead = ahead;
    }
  }
  return best;
}
