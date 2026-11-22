/** Requests, boards and Renown. Starting values for M3-12 to tune. */
export const REQUEST_BALANCE = {
  /** The region of the slice. Its Renown is what requests, Trials and trade raise here. */
  homeRegion: 'dawnmeadow',
  /** Home Renown at which the far or weighty authored jobs are offered (G4 playtest). */
  knownTownRenown: 2,
  /** The board in the square. */
  squareBoard: 'board.square',
  /** Requests posted at each board at dawn. */
  boardSize: 3,
  /** The most a player can hold at once from standing requests. Taking a fourth is refused. */
  maxActive: 8,
  /** Finished standing requests kept in the journal. Older ones are dropped. */
  keepDoneStanding: 10,
  /** Pixel length limit of a filled title (design/09). */
  titleMax: 24,

  renown: {
    /** Each Trial passed raises the region's Renown by this. */
    perTrial: 1,
    /** Every this many coin of sales in a region gives 1 Renown there. */
    tradeCoin: 200,
    /** Renown a standing request gives. */
    standing: 1,
    /** No region's Renown goes past this. */
    max: 1000,
  },

  /** Standing request templates. Quantities are inclusive ranges. Rewards are a share of value. */
  standing: {
    gather: { qty: [4, 8], maxQty: 12, coinPct: 160, minCoin: 8 },
    deliver: { qty: [2, 4], maxQty: 6, coinPct: 190, minCoin: 10 },
    defeat: { qty: [3, 6], maxQty: 8, coinPerTier: [0, 12, 24, 40, 60] },
    /** A board rerolls a job naming an item or creature already posted that day, this many times. */
    dedupeTries: 6,
  },
  /** The dearest item a standing request will ask for, by value, so a request stays a small job. */
  maxAskValue: 60,
} as const;
