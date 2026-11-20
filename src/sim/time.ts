import {
  DAYS_PER_SEASON,
  SEASONS,
  TIME,
  type DayPhase,
  type Season,
  type Weather,
} from '../content/balance/time';
import { roomAt } from '../content/world/rooms';
import { weatherFor } from '../content/world/weather';
import type { SimState } from './state';

const CYCLE_MIN = TIME.phases.reduce((n, p) => n + p.minutes, 0);

/** Which part of the in-game day a tick falls in. Pure function of the tick count. */
export function dayPhase(tick: number): DayPhase {
  const cycleTicks = CYCLE_MIN * TIME.ticksPerMinute;
  const t = (tick + TIME.startMinute * TIME.ticksPerMinute) % cycleTicks;
  let end = 0;
  for (const p of TIME.phases) {
    end += p.minutes * TIME.ticksPerMinute;
    if (t < end) return p.phase;
  }
  return TIME.phases[0].phase;
}

/** The in-game day a tick falls in. A new day begins at dawn. Shops restock on it. */
export function dayIndex(tick: number): number {
  const cycleTicks = CYCLE_MIN * TIME.ticksPerMinute;
  return Math.floor((tick + TIME.startMinute * TIME.ticksPerMinute) / cycleTicks);
}

/** The season a tick falls in: seven in-game days each, four seasons a year. */
export function seasonOf(tick: number): Season {
  const cycleTicks = CYCLE_MIN * TIME.ticksPerMinute;
  const day = Math.floor((tick + TIME.startMinute * TIME.ticksPerMinute) / cycleTicks);
  return SEASONS[Math.floor(day / DAYS_PER_SEASON) % SEASONS.length] as Season;
}

/**
 * Where we are in the day: the phase, how far through it (0 to 1), and the phase before it.
 * Pure function of the tick, like `dayPhase`.
 */
export function phaseProgress(tick: number): { phase: DayPhase; t: number; prev: DayPhase } {
  const cycleTicks = CYCLE_MIN * TIME.ticksPerMinute;
  const t = (tick + TIME.startMinute * TIME.ticksPerMinute) % cycleTicks;
  let start = 0;
  for (let i = 0; i < TIME.phases.length; i++) {
    const p = TIME.phases[i] as (typeof TIME.phases)[number];
    const len = p.minutes * TIME.ticksPerMinute;
    if (t < start + len) {
      const prev = TIME.phases[(i + TIME.phases.length - 1) % TIME.phases.length] as typeof p;
      return { phase: p.phase, t: (t - start) / len, prev: prev.phase };
    }
    start += len;
  }
  return { phase: TIME.phases[0].phase, t: 0, prev: TIME.phases[3].phase };
}

/** The day of the season (1 to 7), the season, and the year (from 1) of a tick. */
export function calendarOf(tick: number): { day: number; season: Season; year: number } {
  const d = dayIndex(tick);
  const inYear = DAYS_PER_SEASON * SEASONS.length;
  return {
    day: (d % DAYS_PER_SEASON) + 1,
    season: SEASONS[Math.floor(d / DAYS_PER_SEASON) % SEASONS.length] as Season,
    year: Math.floor(d / inYear) + 1,
  };
}

/** The weather of the region on the day a tick falls in. */
export function weatherOn(state: SimState, tick: number): Weather {
  return state.weatherOverride ?? weatherFor(state.region ?? 'slice', state.seed, dayIndex(tick));
}

/** The weather in the region now. */
export function currentWeather(state: SimState): Weather {
  return weatherOn(state, state.worldTick);
}

/**
 * The weather a unit at a position feels (sub-pixel units): the region's, outdoors, and clear in
 * any room that is not under open sky (caves, dungeons, houses).
 */
export function weatherAt(state: SimState, x: number, y: number): Weather {
  const room = roomAt(
    Math.floor(x / 256 / 16),
    Math.floor((y / 256 - 1) / 16),
    state.region ?? 'slice',
  );
  return room && !room.outdoors ? 'clear' : currentWeather(state);
}

/**
 * The world tick for a trusted wall time: how many sim ticks of in-game time have passed since
 * `epochMs`. The platform passes `trustedNow` in, the sim never reads a clock. Before the epoch
 * (a save from the future of a corrected clock) it is 0.
 */
export function worldTickAt(trustedNowMs: number, epochMs: number): number {
  const ms = trustedNowMs - epochMs;
  return ms > 0 ? Math.floor((ms * TIME.ticksPerMinute) / 60_000) : 0;
}
