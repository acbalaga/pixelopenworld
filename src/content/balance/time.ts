/**
 * The in-game day (design/02): 48 real minutes, made of day 30, dusk 4, night 10 and dawn 4.
 * The sim clock is the tick counter, 30 ticks a second.
 */
export const TIME = {
  ticksPerMinute: 1800,
  /** Phases in order through the cycle, with their length in minutes. */
  phases: [
    { phase: 'dawn', minutes: 4 },
    { phase: 'day', minutes: 30 },
    { phase: 'dusk', minutes: 4 },
    { phase: 'night', minutes: 10 },
  ],
  /** Minutes into the cycle at tick 0. 4 is the start of full day. */
  startMinute: 4,
  /** In-game hour: the 48 minute cycle is 24 hours, so an hour is two real minutes. */
  hourTicks: 3600,
  /**
   * Offline accrual cap at base, in ms (design/06): 8 hours. At most this much accrues in total
   * between two successful time syncs (tech/02), so a week offline pays one cap period.
   */
  offlineCapBaseMs: 8 * 60 * 60 * 1000,
} as const;

export type DayPhase = (typeof TIME.phases)[number]['phase'];

/** Seven days to a season, four seasons to a year (design/02). */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];
export const DAYS_PER_SEASON = 7;

/** Weather per region (design/02). Nothing but `clear` is produced until M4-09. */
export const WEATHER = ['clear', 'rain', 'storm', 'fog', 'snow', 'heat', 'sandstorm'] as const;
export type Weather = (typeof WEATHER)[number];
