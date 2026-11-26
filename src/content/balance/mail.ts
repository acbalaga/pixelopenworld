/**
 * Mail and duels (POW-M5-12). Every number is data. A gift's coin and items come from the sending
 * Traveler's own purse and stock; the player's side is bounded by the ledger entry `mailGift`.
 */
export const MAIL = {
  /** The most letters the mailbox holds. A new one pushes out the oldest that is read and claimed. */
  cap: 40,
  /** Gifts that can arrive in one real day, in all. */
  giftCapPerDay: 2,
  /** What one gift carries: coin from the Traveler's purse, or items from their stock. */
  giftCoin: [8, 30] as readonly [number, number],
  giftQty: [1, 3] as readonly [number, number],
  /** Chance a friend who logs in sends a letter, and that the letter has a gift. */
  letterChance: 0.3,
  giftChance: 0.35,
  /** A Traveler writes to the player no more than once in this many real days. */
  gapDays: 2,
  /** A Traveler keeps this much coin back, and only gives a stack of an item they hold at least this many of. */
  coinKeep: 20,
  itemKeep: 2,
  /** The most letters of a kind the same Traveler sends before the earlier ones are read. */
  perSenderUnread: 2,
} as const;

/** Duels: rules, acceptance by temper and regard, and what a win is worth on the board. */
export const DUELS = {
  /** First to lose this share of their health loses. */
  loseShare: 0.3,
  /** Regard points needed to accept, by temper: a bold Traveler takes any challenge. */
  acceptAt: { bold: 0, steady: 20, shy: 60 } as Record<'bold' | 'steady' | 'shy', number>,
  /** A challenge is only taken by a Traveler within this many px of the player. */
  nearPx: 260,
  /** Seconds of sim time before a duel nobody finishes is called a draw. */
  maxTicks: 30 * 90,
  /** A Traveler's duel record on the Duels board is points times this, by temper. Shy ones do not duel. */
  boardPerPoint: { bold: 0.06, steady: 0.025, shy: 0 } as Record<'bold' | 'steady' | 'shy', number>,
  /** Repeated close competition makes a Rival: duels count this much, passing on a board once. */
  rivalDuelPoints: 2,
  rivalPassPoints: 1,
  rivalAt: 5,
  /** Within the last 7 real days, a Rival shows up at the dungeon the player entered most. */
  rivalWindowDays: 7,
  /** Chance a Rival shows up on a dungeon entry. High, so one appears within a few visits. */
  rivalShowChance: 0.6,
  /** Chance a Rival lends a hand when the player is downed in a dungeon they are in. */
  rivalHelpChance: 0.4,
} as const;
