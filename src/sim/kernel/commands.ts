import { isDirection, type Direction } from './fixed';

/** Commands are the only way the outside changes the sim. */
export type Command =
  | {
      type: 'move';
      dir: Direction | null;
      /** Stick held at full extent. Sprint starts after it has been held long enough. */
      full?: boolean;
    }
  /** Classic: one press of the attack button. */
  | { type: 'attack' }
  /** Dodge toward `dir`, or toward the held direction (or facing) when null. */
  | { type: 'dodge'; dir: Direction | null }
  /** Tap in the world at (x, y) px: lock the enemy there, or clear the lock on empty ground. */
  | { type: 'lock'; x: number; y: number }
  /**
   * Technique slot 0 to 3. `press` fires now. `aim` starts holding to aim (aimed techniques) or
   * fires now (others). `release` fires an aimed technique along `aim`.
   */
  | { type: 'technique'; slot: number; phase: 'press' | 'aim' | 'release'; aim: Direction | null }
  | { type: 'scheme'; scheme: 'flow' | 'classic' };

/** Result of validating a raw command. */
export type Validated = { ok: true; command: Command } | { ok: false; reason: string };

/** A world coordinate in px: an integer within a generous bound. */
function isCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && Math.abs(n) <= 1_000_000;
}

/** Validates untrusted input into a Command. */
export function validateCommand(raw: unknown): Validated {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'not an object' };
  const r = raw as Record<string, unknown>;
  switch (r.type) {
    case 'move':
      if (r.full !== undefined && typeof r.full !== 'boolean')
        return { ok: false, reason: 'bad full flag' };
      if (r.dir === null) return { ok: true, command: { type: 'move', dir: null } };
      if (isDirection(r.dir))
        return {
          ok: true,
          command:
            r.full === true
              ? { type: 'move', dir: r.dir, full: true }
              : { type: 'move', dir: r.dir },
        };
      return { ok: false, reason: 'bad direction' };
    case 'attack':
      return { ok: true, command: { type: 'attack' } };
    case 'dodge':
      if (r.dir === null || isDirection(r.dir))
        return { ok: true, command: { type: 'dodge', dir: r.dir } };
      return { ok: false, reason: 'bad direction' };
    case 'lock':
      if (isCoord(r.x) && isCoord(r.y))
        return { ok: true, command: { type: 'lock', x: r.x, y: r.y } };
      return { ok: false, reason: 'bad position' };
    case 'technique':
      if (!Number.isInteger(r.slot) || (r.slot as number) < 0 || (r.slot as number) > 3)
        return { ok: false, reason: 'bad slot' };
      if (r.phase !== 'press' && r.phase !== 'aim' && r.phase !== 'release')
        return { ok: false, reason: 'bad phase' };
      if (r.aim !== null && !isDirection(r.aim)) return { ok: false, reason: 'bad direction' };
      return {
        ok: true,
        command: { type: 'technique', slot: r.slot as number, phase: r.phase, aim: r.aim },
      };
    case 'scheme':
      if (r.scheme === 'flow' || r.scheme === 'classic')
        return { ok: true, command: { type: 'scheme', scheme: r.scheme } };
      return { ok: false, reason: 'bad scheme' };
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
