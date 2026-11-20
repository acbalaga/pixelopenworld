/**
 * Dungeon rule tunables (POW-M4-11). Times are in-game minutes; a day is 48.
 */
export const TIDE = {
  /** The tide turns every this many minutes, so it is low twice a day. */
  periodMinutes: 24,
  /** It is low (the cave drains) for this many minutes at the start of each period. */
  lowMinutes: 10,
} as const;
