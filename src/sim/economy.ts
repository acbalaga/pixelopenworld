import { SHOP_BALANCE as B } from '../content/balance/shop';
import { ITEMS } from '../content/items';
import type { Quality } from '../content/items/types';

/**
 * Prices and haggle odds (M3-10). Pure: numbers in, numbers out, no state, no clock, no random.
 * The sim rolls the dice and calls these for what a roll means.
 */

const regionPct = (region: string): number => B.regionPct[region] ?? 100;
const qualityPct = (q: Quality): number => B.qualityPct[q] ?? 100;

/** Price to buy one at the opening price: `value * buyPct * regionPct * qualityPct`, rounded, at least 1. */
export function buyPrice(item: string, q: Quality = 0, region = 'dawnmeadow'): number {
  const v = ITEMS[item]?.value ?? 0;
  return Math.max(1, Math.round((v * B.buyPct * regionPct(region) * qualityPct(q)) / 1_000_000));
}

/** What the shop pays for one at the opening price, rounded down. */
export function sellPrice(item: string, q: Quality = 0, region = 'dawnmeadow'): number {
  const v = ITEMS[item]?.value ?? 0;
  return Math.floor((v * B.sellPct * regionPct(region) * qualityPct(q)) / 1_000_000);
}

/** The price `pct` percent of the way to the best the player can win. Rounds toward the shop. */
export function movedPrice(dir: 'buy' | 'sell', open: number, pctOfMax: number): number {
  const move = (B.haggleMaxPct * pctOfMax) / 100;
  return dir === 'buy'
    ? Math.max(1, Math.ceil((open * (100 - move)) / 100))
    : Math.floor((open * (100 + move)) / 100);
}

/** The most a haggle can win: the best price in the player's favor. */
export function bestPrice(dir: 'buy' | 'sell', open: number): number {
  return movedPrice(dir, open, 100);
}

/** Exchanges allowed in one haggle. Read the Room (Bartering 15) gives one more. */
export function haggleRounds(barteringPoints: number): number {
  return B.haggleRounds + (barteringPoints >= B.readTheRoomPoints ? 1 : 0);
}

/** The price an offer asks for. `low` asks for the best; `fair` asks for `fairShare` of it. */
export function offerPrice(dir: 'buy' | 'sell', open: number, kind: 'low' | 'fair'): number {
  return movedPrice(dir, open, kind === 'low' ? 100 : B.fairShare);
}

/** Percent chance the shopkeeper takes an offer outright. Bartering helps, firmness hurts. */
export function acceptChance(
  kind: 'low' | 'fair',
  barteringPoints: number,
  firmness: number,
): number {
  const raw = B.accept[kind] + barteringPoints * B.accept.perPoint - firmness;
  return Math.round(Math.min(B.accept.ceil, Math.max(B.accept.floor, raw)));
}

/** The shopkeeper's answer to a roll of 0 to 99: take it, counter, or end the haggle. */
export function answer(roll: number, accept: number): 'accept' | 'counter' | 'refuse' {
  if (roll < accept) return 'accept';
  return roll < accept + B.counterPct ? 'counter' : 'refuse';
}

/** A counter: halfway between the standing price and the offer, rounded toward the shop. */
export function counterPrice(dir: 'buy' | 'sell', cur: number, offer: number): number {
  return dir === 'buy' ? Math.max(1, Math.ceil((cur + offer) / 2)) : Math.floor((cur + offer) / 2);
}

/** What repairing `item` at durability `dur` costs. At least 1 coin if anything is worn. */
export function repairCost(item: string, dur: number, max: number): number {
  const v = ITEMS[item]?.value ?? 0;
  if (max <= 0 || dur >= max) return 0;
  return Math.max(1, Math.round((v * (1 - dur / max) * B.repairPct) / 100));
}

/** The lowest price anyone can ever buy for: a full haggle and the Haggler Path on the opening price. */
export function lowestBuy(item: string, q: Quality = 0, region = 'dawnmeadow'): number {
  const after = Math.max(
    1,
    Math.ceil((bestPrice('buy', buyPrice(item, q, region)) * (100 - B.hagglerPathPct)) / 100),
  );
  return after;
}

/** The highest price anyone can ever sell for: a full haggle on the opening price. */
export function highestSell(item: string, q: Quality = 0, region = 'dawnmeadow'): number {
  return bestPrice('sell', sellPrice(item, q, region));
}
