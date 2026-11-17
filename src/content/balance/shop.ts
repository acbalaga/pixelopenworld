/** Shop and dialogue tunables. */
export const SHOP_BALANCE = {
  /** Buying costs this percent of an item's value, rounded, at least 1 coin. */
  buyPct: 150,
  /** Selling pays this percent of an item's value, rounded down. */
  sellPct: 50,
  /** A shopkeeper who holds less than their starting coin earns back this much every interval. */
  purseRegen: 5,
  /** Ticks between those top ups (30 per second): one every two minutes. */
  purseRegenEvery: 30 * 120,
  /** The avatar must be this close to the NPC (px) for dialogue and shopping to count. */
  talkRangePx: 56,
} as const;
