import { isDirection, type Direction } from './fixed';

/** Commands are the only way the outside changes the sim. */
export type Command = { type: 'move'; dir: Direction | null };

/** Result of validating a raw command. */
export type Validated = { ok: true; command: Command } | { ok: false; reason: string };

/** Validates untrusted input into a Command. */
export function validateCommand(raw: unknown): Validated {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'not an object' };
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case 'move':
      if (r.dir === null) return { ok: true, command: { type: 'move', dir: null } };
      if (isDirection(r.dir)) return { ok: true, command: { type: 'move', dir: r.dir } };
      return { ok: false, reason: 'bad direction' };
    default:
      return { ok: false, reason: 'unknown command type' };
  }
}

/** Handler applied to each validated command. */
export type CommandHandler<S> = (state: S, command: Command) => void;

/**
 * The validated dispatch point. Invalid commands are dropped and counted, never thrown,
 * so a bad input cannot crash a tick. Returns the number rejected.
 */
export function dispatch<S>(state: S, raws: readonly unknown[], handle: CommandHandler<S>): number {
  let rejected = 0;
  for (const raw of raws) {
    const v = validateCommand(raw);
    if (v.ok) handle(state, v.command);
    else rejected++;
  }
  return rejected;
}
