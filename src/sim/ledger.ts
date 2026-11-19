import { getComp, type EntityId } from './kernel/entities';
import type { SimState } from './state';

/** A tally by name. Only ever grows. */
export type Tally = Record<string, number>;

/**
 * Lifetime totals that only grow, updated by the sim as things happen (tech/02). The integrity
 * validator (M2-02) reconciles current state against them: coin held equals earned minus spent.
 * Every system that creates or removes value reports here. A new income source adds its entry in
 * the same ticket that adds the source.
 */
export interface Ledger {
  /** Coin that entered the purse, by source. Echo is coin picked back up. */
  coinEarned: Tally;
  /** Coin that left the purse, by sink. Echo is coin left behind on death. */
  coinSpent: Tally;
  /** XP earned, by skill id. */
  xpEarned: Tally;
  /** Items created from nothing: source, then item id, then quantity. */
  itemsMade: Record<string, Tally>;
  /** Creatures killed, by creature id. */
  kills: Tally;
  /** Successful crafts, by recipe id. */
  crafts: Tally;
  /** Masterwork items made by crafting, by item id (filled by M3-07). */
  masterworks: Tally;
  /** Items crafted by the avatar and so carrying its maker's mark, by item id (M3-07). */
  marked: Tally;
  /** Items sold to shops, by item id (M3-10). Buyback can only return what was sold. */
  itemsSold: Tally;
  /**
   * What standing requests (generated, so not in the content tables) have paid (M3-11): `n` the
   * number finished, `coin`, and each item id by quantity. The validator bounds it by the board.
   */
  requestRewards: Tally;
  /**
   * The starter kit this character began with (M4-14): 1 for every save made before the bare kit,
   * 2 for new characters. The integrity check reads the kit it names.
   */
  startKit: 1 | 2;
}

/** Sources of coin and items. Named so the validator can refer to them. */
export type CoinSource = 'loot' | 'chest' | 'request' | 'sale' | 'echo' | 'seed';
export type CoinSink = 'purchase' | 'echo' | 'repair' | 'buyback' | 'recipe';
export type ItemSource =
  | 'start'
  | 'loot'
  | 'gather'
  | 'cook'
  | 'craft'
  | 'chest'
  | 'request'
  | 'dialogue'
  | 'shop'
  | 'buyback'
  | 'singular'
  | 'seed';

/** An empty ledger. */
export function newLedger(): Ledger {
  return {
    coinEarned: {},
    coinSpent: {},
    xpEarned: {},
    itemsMade: {},
    kills: {},
    crafts: {},
    masterworks: {},
    marked: {},
    itemsSold: {},
    requestRewards: {},
    startKit: 2,
  };
}

const bump = (t: Tally, key: string, n: number): void => {
  t[key] = (t[key] ?? 0) + n;
};

/** Pays coin into the avatar's purse and records where it came from. */
export function earnCoin(state: SimState, who: EntityId, amount: number, source: CoinSource): void {
  const a = getComp(state.entities, who, 'avatar');
  if (!a || amount <= 0) return;
  a.coin += amount;
  bump(state.ledger.coinEarned, source, amount);
}

/** Takes coin out of the purse and records where it went. The caller has checked the balance. */
export function spendCoin(state: SimState, who: EntityId, amount: number, sink: CoinSink): void {
  const a = getComp(state.entities, who, 'avatar');
  if (!a || amount <= 0) return;
  a.coin -= amount;
  bump(state.ledger.coinSpent, sink, amount);
}

/** Records items that came into being, wherever they ended up (bag or ground). */
export function madeItems(state: SimState, source: ItemSource, item: string, qty: number): void {
  if (qty <= 0) return;
  const by = (state.ledger.itemsMade[source] ??= {});
  bump(by, item, qty);
}

/** Records XP earned in a skill. */
export function earnedXp(state: SimState, skill: string, amount: number): void {
  if (amount > 0) bump(state.ledger.xpEarned, skill, amount);
}

/** Records items sold to a shop. */
export function soldItems(state: SimState, item: string, qty: number): void {
  if (qty > 0) bump(state.ledger.itemsSold, item, qty);
}

/** Records a creature killed. */
export function recordKill(state: SimState, creature: string): void {
  bump(state.ledger.kills, creature, 1);
}

/** Records a successful craft. */
export function recordCraft(state: SimState, recipe: string): void {
  bump(state.ledger.crafts, recipe, 1);
}
