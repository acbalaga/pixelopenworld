/**
 * Skill tunables (design/03). XP is whole numbers. Percentages are whole numbers (100 is 1.0).
 * The curve and the per-event XP are provisional. They are set so the shape is right (smooth,
 * growing) and are tuned against the pacing ledger once there is a measured play rate.
 */
export const SKILLS_BALANCE = {
  /** Skill points run 0 to this. */
  maxPoints: 100,
  /**
   * Reaching one of these points needs a passed Trial. XP earned while a Trial is pending is
   * banked and applied when it is passed.
   */
  thresholds: [15, 30, 50, 75, 100],
  /** Mastery rank reached at each threshold, with the points that grant it. */
  mastery: [
    { points: 0, name: 'Novice' },
    { points: 15, name: 'Apprentice' },
    { points: 30, name: 'Journeyman' },
    { points: 50, name: 'Expert' },
    { points: 75, name: 'Master' },
    { points: 100, name: 'Grandmaster' },
  ],
  /** XP to go from `p` to `p + 1` is `base + perPoint * p + p * p * quadPermille / 1000`. */
  curve: { base: 150, perPoint: 18, quadPermille: 240 },
  /**
   * Challenge (design/03). `parRank[tier]` is the skill points at which a target of that tier is
   * a fair fight. Far below pays `floorPct`. At par pays 100. Above par pays more, capped.
   */
  challenge: {
    parRank: [0, 0, 15, 22, 30, 40, 50, 75, 85],
    /** Points below par at which the floor is reached. Pay falls in a straight line to it. */
    farBelowPoints: 15,
    floorPct: 10,
    ceilPct: 150,
    /** Extra pay for each point of skill the target is above par. */
    abovePctPerPoint: 5,
  },
  /** Sprint pays once for every this many px run. */
  sprintPx: 32,
  /** A feet move longer than this in one tick is a teleport or respawn and pays no sprint XP. */
  sprintMaxStepPx: 8,
  /** Attribute pools grow from skill points (design/03). Stamina and Focus are in tenths. */
  attributes: {
    hp: {
      perPoint: 1,
      families: ['arms'],
      skills: ['skill.survival', 'skill.athletics', 'skill.husbandry'],
    },
    sta: {
      perPoint: 5,
      families: ['arms', 'gathering'],
      skills: ['skill.athletics'],
    },
    foc: {
      perPoint: 5,
      families: ['magic', 'crafting', 'social'],
      skills: ['skill.deciphering'],
    },
  },
} as const;
