/** Shop and dialogue tunables. */
export const SHOP_BALANCE = {
  /** Buying costs this percent of an item's value, rounded, at least 1 coin. */
  buyPct: 150,
  /** Selling pays this percent of an item's value, rounded down. */
  sellPct: 50,
  /** The avatar must be this close to the NPC (px) for dialogue and shopping to count. */
  talkRangePx: 56,
} as const;
