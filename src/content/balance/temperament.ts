/** Temperament tunables (design/04, D20). Times are sim ticks (30 per second). */
export const TEMPERAMENT = {
  /** The shortest territorial warning at tier 1: one second, long enough to read and back off. */
  warnMinTicksTier1: 30,
  /** How long a skittish creature runs after it notices. */
  fleeTicks: 90,
  /**
   * A guard heals to full on its way home only if it has not been hit for this long (5 s). A
   * ranged fighter who keeps chipping at it from past its tether never lets it recover.
   */
  guardHealAfterTicks: 150,
  /** Feeding a creature (M4-05): how near the avatar must be, and how long a fed creature stays calm. */
  feed: { reachPx: 28, calmTicks: 1800 },
  /** A creature this many tiers above the avatar's proven tier steps one rung more aggressive. */
  tierGap: 2,
  /** Rank at which a Trial proves a tier: the first threshold in `balance/skills`, tier 1. */
  provenTrialThresholds: [15, 30, 50, 75, 100],
} as const;
