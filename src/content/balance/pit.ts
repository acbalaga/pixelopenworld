/**
 * The Pit's duels (POW-M5-30). Bouts between Travelers, the "Next" board, and the player's honor.
 * Every number is data. The honor is cosmetic: it grants nothing, so it has no ledger entry.
 */
export const PIT_DUELS = {
  /** Chance each in-game minute that two waiting duelists start a bout, when none is on. */
  boutChance: 0.35,
  /** Ticks of the count before the first blow, and the most a bout lasts before it is called. */
  countTicks: 45,
  maxTicks: 30 * 40,
  /** Ticks between swings, and the share of the loser's starting Health a winner's blow takes. */
  swingTicks: [24, 40] as readonly [number, number],
  winnerHitPct: [6, 10] as readonly [number, number],
  /** A blow from the one who loses takes this share of the winner's Health. Kept small, so it never ends it. */
  loserHitPct: [3, 6] as readonly [number, number],
  /** The winner's loss is held under this share, so the 30% rule always ends it on the loser. */
  winnerCapPct: 22,
  /** The ring: two spots this many px either side of the Pit's middle. */
  ringHalfPx: 18,
  /** A Traveler rests this many in-game minutes between bouts. */
  restMinutes: 8,
  /** Player wins in the Pit for each honor tier: Pit regular, Pit champion. */
  honor: [5, 20] as readonly number[],
  /** Spectators cheer every this many ticks during a bout, one at a time. */
  cheerTicks: 50,
} as const;

/** The honor tier for a number of Pit wins: 0 none, 1 Pit regular, 2 Pit champion. */
export const honorFor = (wins: number): number =>
  PIT_DUELS.honor.reduce((tier, at, i) => (wins >= at ? i + 1 : tier), 0);
