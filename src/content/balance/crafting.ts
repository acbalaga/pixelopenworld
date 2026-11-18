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
    /**
     * Trace (M3-14): drag along a drawn path in a 1000 by 1000 space. The step runs `window` ticks
     * from the craft's start. Every tick the pointer is down is one sample. The grade is
     * `grade * share inside the path width * coverage`, where coverage is how much of the path's
     * length the inside samples reached, and too few samples scale it down (`minSamples`).
     */
    trace: { window: 100, width: 60, minSamples: 40, minCoverage: 60 },
    /**
     * Hold: hold to raise heat (0 to 1000, `perTick` a tick), release inside the band. The grade is
     * full within `perfect` of the band center, falls to `goodPoints` of the grade at `good`, and
     * is 0 beyond. Never pressing ends the step after `window` ticks, and a heat held at the top
     * for `overGrace` ticks is released for you.
     */
    hold: {
      window: 100,
      perTick: 14,
      center: 700,
      perfect: 50,
      good: 160,
      goodPoints: 35,
      overGrace: 8,
    },
  },
  /** The paths of the trace step, by craft, as polylines in the 1000 by 1000 space. */
  paths: {
    tailoring: [
      [100, 500],
      [250, 280],
      [400, 720],
      [550, 280],
      [700, 720],
      [900, 500],
    ],
    enchanting: [
      [200, 820],
      [500, 180],
      [800, 820],
      [180, 420],
      [820, 420],
      [200, 820],
    ],
  } as Readonly<Record<string, readonly (readonly [number, number])[]>>,
  /** Enchanting: how many affixes a piece may carry for each Enchanting band reached (0, 15). */
  enchantSlots: { 0: 1, 15: 2 } as Readonly<Record<number, number>>,
  /** Affix strength by the quality of the enchant, percent of the affix's own mods. */
  affixStrengthPct: [100, 110, 125, 150] as readonly number[],
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
    tailoring: 'item.rags',
    alchemy: 'item.sludge',
    enchanting: 'item.rune_dust',
    tinkering: 'item.scrap',
  } as Readonly<Record<string, string>>,
} as const;
