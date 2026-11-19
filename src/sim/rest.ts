import { STATUS_BALANCE as B } from '../content/balance/status';
import { WORLD_TUNABLES } from '../content/balance/world';
import { getComp, type EntityId } from './kernel/entities';
import { SUBPX } from './kernel/fixed';
import { applyStatus } from './statuses';
import type { SimState } from './state';

/**
 * Rested banked for time spent logged out in a bed (M4 rest). Called once when a save loads, with
 * the world ticks that passed since it was written. The avatar must still stand where it slept.
 * Returns the Rested ticks granted, 0 for none. Time of day is not touched: the clock is real.
 */
export function bankOfflineRest(state: SimState, who: EntityId, awayTicks: number): number {
  const a = getComp(state.entities, who, 'avatar');
  const p = getComp(state.entities, who, 'pos');
  if (!a || !p || !a.bedAt) return 0;
  const near = Math.hypot(p.x - a.bedAt.x, p.y - a.bedAt.y) <= WORLD_TUNABLES.bedReachPx * SUBPX;
  delete a.bedAt;
  if (!near || awayTicks < B.restedOfflineMinAway) return 0;
  const ticks = Math.min(B.restedOfflineCap, Math.floor((awayTicks * B.restedOfflinePct) / 100));
  const have = getComp(state.entities, who, 'statuses')?.find((s) => s.id === 'rested');
  const left = have ? have.until - state.tick : 0;
  if (ticks <= left) return 0;
  applyStatus(state, who, 'rested', -1, { ticks });
  return ticks;
}
