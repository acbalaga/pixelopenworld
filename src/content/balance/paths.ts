/** Path requirements and gifts (M3-08, design/11 "Paths authored in M3"). Starting values for M3-12 to tune. */
export const PATHS_BALANCE = {
  /** Most Paths worn at once. */
  maxWorn: 3,
  duelist: { skill: 15, kills: 60, untouched: 10, critPct: 5 },
  bulwark: { skill: 15, parries: 40, blockStaPct: -30 },
  emberhand: { skill: 15, damage: 3000, emberFocPct: -15 },
  tidecaller: { skill: 15, wet: 150, wetTicksPct: 50 },
  forager: { skill: 15, gathered: 300, yield: 1 },
  prospector: { skill: 15, gathered: 200, durabilityLossPct: -50 },
  anvilHand: { skill: 15, crafted: 25, repairs: 20 },
  quickNeedle: { skill: 15, crafted: 25, dodgeRecoverTicks: 2 },
  hearthCook: { skill: 15, dishes: 40, recipes: 10, fedTicksPct: 25 },
  wildEater: { skill: 15, raw: 40, rawFoodPct: 100 },
  haggler: { skill: 15, won: 30, buyPct: -5 },
  fairDealer: { sales: 60, purseRegenPct: 100 },
  busker: { skill: 15, songs: 30, songTicksPct: 50 },
  shadow: { skill: 15, sneaks: 60, hideSpeedPct: 20 },
  /** Mossfriend: meetings counted since the last Mossling kill, over this many in-game days with none. */
  mossfriend: { meets: 30, days: 3, radiusPx: 48, leavePx: 72 },
  pestward: { kills: 200, tierDamagePct: 20 },
} as const;
