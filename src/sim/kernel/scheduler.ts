import { clearEvents, type EventQueue } from './events';
import { dispatch, type CommandHandler } from './commands';

/** A system runs once per tick, in list order. */
export type System<S> = (state: S) => void;

/** State the scheduler needs: a tick counter and an event queue. */
export interface Tickable {
  tick: number;
  /** Transient. The tick the world clock reads, from trusted time. See {@link TickInput}. */
  worldTick?: number;
  events: EventQueue;
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
  clearEvents(state.events);
  const rejected = dispatch(state, input.commands, handle);
  for (const system of systems) system(state);
  return rejected;
}
