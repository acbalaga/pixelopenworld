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
} as const;

export type DayPhase = (typeof TIME.phases)[number]['phase'];
