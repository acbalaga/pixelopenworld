/**
 * Crafting tunables (POW-M3-07). Times are sim ticks (30 per second). Starting values: M3-12
 * tunes them.
 */
export const CRAFTING = {
  /** Most ingredients in one experiment, counting each unit. */
  maxIngredients: 4,
  /**
   * Quality score: `clamp(skillPts - parRank[tier], -parClamp, parClamp) * perPoint +
   * materialAvg * perMaterial + grade + roll(0..rollMax)`.
   */
  score: { parClamp: 15, perPoint: 2, perMaterial: 10, rollMax: 39 },
  /** Score needed for each quality. Masterwork is a manual craft only. */
  thresholds: { masterwork: 90, superior: 65, fine: 40 },
  /**
   * The manual step. Taps are ticks since the craft began. Each target is a tick; a tap within
   * `perfect` ticks of it is perfect, within `good` is good, else a miss. The k-th tap is graded
   * against the k-th target. The grade sums the points and scales to 0..grade.
   */
  step: {
    grade: 30,
    timing: { targets: [20, 50, 80], perfect: 2, good: 5, points: { perfect: 10, good: 5 } },
    rhythm: { targets: [15, 30, 45, 60], perfect: 2, good: 4, points: { perfect: 8, good: 4 } },
    /** Ticks past the last target before the step ends on its own. */
    endGrace: 8,
  },
  /** Anvil repair restores this percent of an item's maximum durability. */
  repairPct: 40,
  /** The material one repair costs, by item tier. */
  repairMaterial: { 1: 'item.copper_ingot', 2: 'item.iron_ingot' } as Readonly<
    Record<number, string>
  >,
  /** What a failed craft leaves, by craft. */
  failItem: {
    cooking: 'item.burnt_mess',
    smithing: 'item.slag',
    woodworking: 'item.wood_scraps',
  } as Readonly<Record<string, string>>,
} as const;
