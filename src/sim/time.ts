import { TIME, type DayPhase } from '../content/balance/time';

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

/**
 * The world tick for a trusted wall time: how many sim ticks of in-game time have passed since
 * `epochMs`. The platform passes `trustedNow` in, the sim never reads a clock. Before the epoch
 * (a save from the future of a corrected clock) it is 0.
 */
export function worldTickAt(trustedNowMs: number, epochMs: number): number {
  const ms = trustedNowMs - epochMs;
  return ms > 0 ? Math.floor((ms * TIME.ticksPerMinute) / 60_000) : 0;
}
