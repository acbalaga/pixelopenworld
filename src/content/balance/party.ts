/**
 * Parties (POW-M5-07, design/07 Parties, design/04 Companions in combat). Every number is data.
 * Competence runs from `low` at rank 0 to `high` at `rankFull` and above, in a straight line, so a
 * rank 5 Striker reacts late, dodges little and wanders off its spot, and a rank 40 one does not.
 */
export const PARTY = {
  /** Travelers who can join the player: a party of four. */
  max: 3,
  /** A posted listing gets answers for this many in-game minutes, then closes if nobody came. */
  listingMinutes: 12,
  /** Each in-game minute, a suited Traveler answers a listing with this chance, times regard. */
  answerChance: 0.035,
  /** Regard tier 0 to 3 multiplies the answer chance by these. */
  regardFactor: [1, 1.3, 1.8, 2.4] as readonly number[],
  /** Tier of each dungeon, for who is suited. A dungeon not listed is tier 1. */
  dungeonTier: { 'dungeon.thornwall': 2 } as Readonly<Record<string, number>>,
  /** A Traveler whose tier is more than this under the activity's does not answer. */
  tierSlack: 1,
  /** Real minutes a Traveler's session must still have left for them to answer or post. */
  sessionLeftMin: 15,
  /** Activities that keep a Traveler from answering: they are busy with something of their own. */
  busy: ['craft', 'trade', 'dungeon', 'party'] as readonly string[],
  /** A Traveler with a listing of their own: the chance each real hour that an lfg-minded one has one. */
  listingChance: 0.35,
  /** The most Traveler listings the board shows at once. */
  boardMax: 8,
  /** In-game minutes of notice a member gives before their session ends. */
  departWarnMinutes: 10,
  /** Followers keep this far from the player when nothing is to be fought, px. */
  followPx: 22,
  /** A member farther than this from the player (a portal, a Waystone) catches up at once, px. */
  catchUpPx: 220,
  /** A creature this close to the player, or after one of the party, means a fight is on, px. */
  fightPx: 120,
  /** Ticks of no fight before downed members get up, and the Health share they get up with. */
  reviveTicks: 90,
  revivePct: 50,
  /** Members within this many px of a creature that dies get a share of its drops rolled. */
  lootPx: 260,
  /** Drops at or under this drop chance (percent) are rolled where everyone can see. */
  rollShowPct: 30,
  /** Rolls run 1 to this. */
  rollMax: 100,
  /** A member says "brb" now and then while nothing is fought: chance per in-game minute, and how long. */
  brbChance: 0.02,
  brbTicks: 60 * 2,
  /** Rank where competence is full. Below it, competence is a straight line from `low`. */
  rankFull: 50,
  competence: {
    /** Ticks between a creature's wind-up starting and the member noticing it. */
    reactionTicks: { low: 18, high: 3 },
    /** Chance a member who notices a wind-up in time dodges out of it. */
    dodge: { low: 0.08, high: 0.8 },
    /** Chance a member does not read a wind-up at all and stands in it. */
    standIn: { low: 0.65, high: 0.03 },
    /** How far a member stands off its spot, px. */
    positionPx: { low: 16, high: 2 },
    /** Ticks a member waits after a swing before the next one. */
    swingGapTicks: { low: 26, high: 4 },
  },
  /** Formation spots around the player by role, px (x to the side, y behind). */
  formation: {
    vanguard: { x: 0, y: -18 },
    striker: { x: 18, y: 6 },
    support: { x: -16, y: 18 },
  } as Record<'vanguard' | 'striker' | 'support', { x: number; y: number }>,
  /** Support: ticks between mends, and the Health share of the most hurt ally it restores. */
  support: {
    healTicks: { low: 240, high: 120 },
    healPct: { low: 6, high: 18 },
    /** A Support keeps this far from the fight, px. */
    standOffPx: 46,
    /** An ally under this Health share is mended. */
    belowPct: 80,
  },
  /** A Vanguard steps between the player and the target; a Striker comes from the side. */
  flankPx: 10,
} as const;
