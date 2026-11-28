/**
 * Fishing (POW-M6-05, design/05 Fishing, design/13 section 4). Every number the minigame, the bite
 * and the records read. The track is 0 to 1000 and every rate is per sim tick (30 to the second), so
 * the whole fight is integer arithmetic on the world stream and replays the same.
 *
 * The fight, in one paragraph: a bite comes, a tap hooks it, then the marker rides a track. Holding
 * reels it up, letting go lets it sink, and the fish pulls it one way or the other in bursts. While
 * the marker is inside the band the catch bar fills, outside it drains slower. Full is landed, empty
 * or out of time is a fish lost. A fish lost costs the bait and nothing else.
 */
export const FISHING = {
  /** The track the marker and the band live on. */
  track: 1000,
  /** Ticks a bite waits for the tap before the fish lets go. The old placeholder used 15. */
  biteTicks: 24,
  /** Where the marker and the band start. The band is centred here and stays. */
  center: 500,
  /** The catch bar: where it starts, where it lands, per tick in the band, per tick out of it. */
  fill: { start: 300, full: 1000, rise: 9, fall: 5 },
  /** Ticks a fight can last before the fish wins by waiting. 20 seconds. */
  maxReelTicks: 600,
  /** Marker physics, per tick. Holding adds `up`, letting go adds `down`, and `drag` of 256 is lost. */
  marker: { up: 4, down: 3, drag: 40, maxSpeed: 40 },
  /**
   * Band width by difficulty 1 to 5 (of 1000), and what a fish of each pulls. A pull is a shove
   * added every tick for `pullTicks`, in a direction rolled on the world stream, then a rest.
   */
  band: { byDifficulty: [460, 420, 380, 340, 300], perRodTier: 40, noRod: -60, min: 120 },
  pull: { byDifficulty: [2, 2, 3, 3, 4], ticksMin: 18, ticksMax: 40, restMin: 6, restMax: 30 },
  /** Patient Line (Fishing 15): the band is this much wider, in percent. design/11. */
  patientLine: { at: 15, pct: 115 },
  /** A minnow on the hook: the wait for a bite is this much shorter, in percent of the usual. */
  bait: { item: 'item.fish_minnow', waitPct: 55 },
  /** The wait for a bite is `ITEMS_BALANCE.gather.fishWaitMin` to `fishWaitMax` ticks (2 to 6 seconds). */
  /** Old Gnarl: the chance a qualifying bite is her, in percent, and the skill it asks for. */
  legend: { pct: 25, skill: 25 },
  /** A fight landed within this many ticks of the fewest it can take may lift the catch to Fine. */
  cleanSlack: 20,
  /** A catch rolls its size from two draws, averaged, so the middle is common and the ends are rare. */
  sizeDraws: 2,
  /**
   * What a scripted player lands, in percent, for fights of each difficulty. A `lag` is how many
   * ticks behind the marker the player reacts. The catch tests run the bot at these three levels
   * and check each lands inside its range, so a retune that breaks the feel fails a test. A real
   * thumb is rougher than the bot, so the bot's rate is a ceiling and play is calmer than it reads.
   */
  bot: { lead: 5 },
  levels: [
    { name: 'steady', lag: 3 },
    { name: 'average', lag: 7 },
    { name: 'slow', lag: 12 },
  ],
  targets: {
    // difficulty: [steady, average, slow], each [min, max] percent, measured with a rod of tier 1.
    1: [
      [97, 100],
      [97, 100],
      [95, 100],
    ],
    2: [
      [97, 100],
      [97, 100],
      [95, 100],
    ],
    3: [
      [97, 100],
      [95, 100],
      [60, 85],
    ],
    4: [
      [95, 100],
      [90, 100],
      [40, 70],
    ],
    5: [
      [75, 95],
      [15, 45],
      [0, 12],
    ],
  } as Readonly<Record<number, readonly (readonly [number, number])[]>>,
} as const;
