import { REQUEST_BALANCE as RB } from '../content/balance/requests';
import { getComp, type EntityId } from './kernel/entities';
import type { SimState } from './state';

/**
 * What `who` holds in a region (design/03). Requests, Trials and dialogue add to `journal.renown`.
 * Trade adds the running net of sales: every `renownTradeCoin` of it is 1. It is a running net
 * (a buyback takes its coin off) so selling something and buying it straight back earns nothing.
 */
export function renownIn(state: SimState, who: EntityId, region: string): number {
  const j = getComp(state.entities, who, 'journal');
  if (!j) return 0;
  const trade = Math.floor((j.tradeCoin[region] ?? 0) / RB.renown.tradeCoin);
  return Math.min(RB.renown.max, (j.renown[region] ?? 0) + trade);
}

/** Raises a region's Renown, up to the cap. Renown is never taken away. */
export function addRenown(state: SimState, who: EntityId, region: string, amount: number): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j || amount <= 0) return;
  j.renown[region] = Math.min(RB.renown.max, (j.renown[region] ?? 0) + Math.floor(amount));
}

/** Counts coin of sales in a region. */
export function noteSale(state: SimState, who: EntityId, region: string, coin: number): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j || coin <= 0) return;
  j.tradeCoin[region] = (j.tradeCoin[region] ?? 0) + coin;
}

/** Takes a buyback's coin off the running net of sales, never below 0. */
export function noteBuyback(state: SimState, who: EntityId, region: string, coin: number): void {
  const j = getComp(state.entities, who, 'journal');
  if (!j || coin <= 0) return;
  j.tradeCoin[region] = Math.max(0, (j.tradeCoin[region] ?? 0) - coin);
}
