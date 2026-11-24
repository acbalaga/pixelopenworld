import { clearEvents, type EventQueue } from './events';
import { dispatch, type CommandHandler } from './commands';

/** A system runs once per tick, in list order. */
export type System<S> = (state: S) => void;

/** State the scheduler needs: a tick counter and an event queue. */
export interface Tickable {
  tick: number;
  /** Transient. The tick the world clock reads, from trusted time. See {@link TickInput}. */
  worldTick?: number;
  /** Transient. Real time for the crowd (M5-03). See {@link TickInput.clock}. */
  clock?: ClockInput;
  events: EventQueue;
}

/**
 * Real time as the platform gives it (M5-03): trusted ms, the save's epoch in trusted ms, and the
 * device's offset from UTC in minutes. The sim never reads a clock, so this is how Travelers know
 * the hour. It is never saved.
 */
export interface ClockInput {
  nowMs: number;
  epochMs: number;
  tzOffsetMin: number;
}

/** Input for one tick. */
export interface TickInput {
  commands: readonly unknown[];
  /**
   * Ticks of in-game time since the save's epoch, derived from trusted time by the platform
   * (tech/02). Drives the time of day. Defaults to the sim tick, so tests and demos need not
   * pass it. It is never saved.
   */
  worldTick?: number;
  /** Real time for the crowd. Absent in tests and demos, and then the crowd sleeps. */
  clock?: ClockInput;
}

/**
 * Advances one tick: bump the counter, clear events, apply commands, run systems in order.
 * Returns the number of rejected commands.
 */
export function tick<S extends Tickable>(
  state: S,
  systems: readonly System<S>[],
  input: TickInput,
  handle: CommandHandler<S>,
): number {
  state.tick++;
  state.worldTick = input.worldTick ?? state.tick;
  if (input.clock) state.clock = input.clock;
  clearEvents(state.events);
  const rejected = dispatch(state, input.commands, handle);
  for (const system of systems) system(state);
  return rejected;
}
