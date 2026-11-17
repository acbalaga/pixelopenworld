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
