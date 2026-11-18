/**
 * Status, reaction and world element tunables (M3-09). Times are sim ticks (30 per second),
 * distances are px, percentages are whole numbers. Starting values for M3-12 to tune.
 */
export const STATUS_BALANCE = {
  /** Hexed: statuses applied to a hexed unit last this much longer, percent. */
  hexedExtendPct: 50,
  /** Rested: skill XP bonus while it lasts, percent, and how long a night's sleep keeps it. */
  restedXpPct: 25,
  restedTicks: 9000,
  /** Burning and Poisoned: damage dealt every `every` ticks. */
  burning: { ticks: 150, every: 15, damage: 1 },
  poisoned: { ticks: 300, every: 30, damage: 1 },
  wet: { ticks: 300 },
  chilled: { ticks: 150, slowPct: -35 },
  staggered: { ticks: 45 },
  /** Hexed and Warded change defense by a flat amount, so they matter at a base of zero too. */
  hexed: { ticks: 300, defense: -10 },
  rooted: { ticks: 60 },
  dazed: { ticks: 60 },
  warded: { ticks: 300, defense: 20 },
  /** Defense never falls below this, so Hexed armor cannot make damage run away. */
  defenseFloor: -50,
  /** The default for a Fed status with no item (a meal sets its own length). */
  fedTicks: 9000,
  /** The most statuses drawn on one unit. */
  maxShown: 4,
  /** Steam: how long the cloud stays, its radius, and how often it hurts what stands in it. */
  steam: { ticks: 90, radius: 20, every: 15, damage: 1 },
  /** Chill burst from Wet meeting Gale. A shatter does `shatterDamage` once. */
  shatterDamage: 8,
  /** Burning spreads to every unit within this radius when Gale blows on a burning unit. */
  spreadRadius: 28,
  /** World ticks a burnt brush wall stays ash before it grows back. */
  brushRegrowTicks: 900,
  /** How far an element hit reaches fixtures: a bolt's contact radius and a melee reach point. */
  worldHitRadius: 10,
} as const;
