/**
 * Chat tunables (POW-M5-05, design/12 4.4). Rates are per in-game minute, which is two real
 * seconds, so 0.3 lines a minute is about one line every seven seconds.
 */
export const CHAT = {
  /** Lines of budget a channel earns per online (or nearby) Traveler per in-game minute, at full hour. */
  tokensPerSpeaker: { world: 0.0075, local: 0.012 },
  /** The most unspent budget a channel keeps, so a quiet spell does not store up a flood. */
  tokenCap: 3,
  /** The share of the budget by real local hour. Quiet hours are quiet: 04:00 is a fifth of 21:00. */
  hour: [
    0.45, 0.35, 0.28, 0.22, 0.2, 0.25, 0.35, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.7, 0.65, 0.65, 0.7,
    0.75, 0.8, 0.9, 1, 1, 0.95, 0.7,
  ] as readonly number[],
  /** No template id repeats in a channel within this many lines. */
  windowLines: 40,
  /** A speaker says nothing again within this many ticks (20 seconds) unless it is a reply. */
  speakerGapTicks: 600,
  /** Chance per minute that a tied pair starts an exchange, before the hour share. */
  exchangeChance: 0.02,
  /** Minutes between the lines of an exchange or a reply, as a range. */
  replyGapMin: [1, 2] as readonly [number, number],
  /** Chance per minute of an unprompted line from someone idle, before the hour share. */
  idleChance: 1,
  /** Most lines one channel emits in one minute. */
  burst: 2,
  /** Chance a question gets an answer, and that an answer is the wrong rumor is in the rumor table. */
  answerChance: 0.8,
  /** Queued lines kept at most. */
  queueCap: 24,
  /**
   * A drop is bragged about only at or under this drop chance, in percent (POW-M6-23). The same as
   * the party's visible-roll line (`PARTY.rollShowPct`), so what is rolled in view is what is boasted.
   */
  bragDropPct: 30,
} as const;

/**
 * Small scenes (POW-M5-27): fountain wishes, inn dance-offs, camp ghost stories and arguments with
 * the training dummy. Each needs promoted Travelers, so the player can see it. `chance` is per
 * abstract minute while a candidate exists. `capPerHour` is per scene kind per real local hour.
 */
export const SCENES = {
  capPerHour: 3,
  chance: { wish: 0.06, wishCame: 0.5, dance: 0.3, ghost: 0.08, dummy: 0.08 },
  /** The same Traveler is not picked for the same scene again within this many minutes. */
  cooldownMin: 30,
  /** Ticks a wisher spends at the fountain, a dance-off lasts (range), and a dummy fight lasts. */
  wishTicks: 360,
  danceTicks: [600, 1200] as readonly [number, number],
  dummyTicks: 450,
  /** A wish can come true after this many minutes, and no later than this many. */
  cameAfterMin: 20,
  cameWithinMin: 240,
  /** Travelers under this top-skill rank argue with the dummy. */
  dummyRankUnder: 10,
  /** Minutes between the lines of a scene, a range. */
  lineGapMin: [1, 2] as readonly [number, number],
} as const;

/** Share of place answers that go to a rumor of the Pit trail when one can be told (POW-M5-29). */
export const PIT_RUMOR_BIAS = 0.5;
