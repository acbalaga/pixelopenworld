/** Shop, trade and dialogue tunables. Starting values for M3-12 to tune. */
export const SHOP_BALANCE = {
  /** Buying costs this percent of an item's value, rounded, at least 1 coin. */
  buyPct: 150,
  /** Selling pays this percent of an item's value, rounded down. */
  sellPct: 50,
  /** Percent of the price by region. Prices differ a little between hubs. */
  regionPct: { dawnmeadow: 100 } as Readonly<Record<string, number>>,
  /** Percent of the price by item quality (Common, Fine, Superior, Masterwork). Buy and sell alike. */
  qualityPct: [100, 125, 160, 250] as readonly number[],
  /** A shopkeeper who holds less than their starting coin earns back this much every interval. */
  purseRegen: 5,
  /** Ticks between those top ups (30 per second): one every two minutes. */
  purseRegenEvery: 30 * 120,
  /** The avatar must be this close to the NPC (px) for dialogue and shopping to count. */
  talkRangePx: 56,

  /** Haggling. Exchanges a shopkeeper takes, and one more once Bartering reaches `readTheRoomPoints`. */
  haggleRounds: 2,
  readTheRoomPoints: 15,
  /** The price moves at most this percent from the opening price, in the player's favor. */
  haggleMaxPct: 10,
  /** Offer fair asks for this share of the most, offer low asks for all of it. Percent. */
  fairShare: 50,
  /**
   * The chance, percent, that the shopkeeper takes an offer: `base + points * perPoint - firmness`,
   * kept between `floor` and `ceil`. A counter comes from the next `counterPct` of the roll.
   */
  accept: { low: 30, fair: 60, perPoint: 0.4, floor: 5, ceil: 90 },
  counterPct: 35,
  /** The Haggler Path (M3-08) lowers shop buy prices by this percent. Reserved here for the bound. */
  hagglerPathPct: 5,

  /** Buyback keeps this many of the last sold stacks until the next restock. */
  buybackSlots: 10,
  /** Repair costs `value * (1 - dur / max) * repairPct / 100`, at least 1 coin. */
  repairPct: 60,
} as const;

/*
 * The bound (checked for every item and quality in tests/sim/economy.test.ts): the lowest buy
 * price reachable (opening price, a full haggle, the Haggler Path) is above the highest sell
 * price reachable (opening price, a full haggle). With 150 and 50, that is 150 * 0.90 * 0.95 =
 * 128 against 50 * 1.10 = 55 for each 100 of value, so no loop of buy and sell makes coin.
 */
