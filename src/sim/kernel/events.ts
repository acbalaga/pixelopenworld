/** Per-tick event queue. Render, audio, UI and chat read events. They never poll state. */

/** All sim events. Extend this union as systems appear. */
export type SimEvent =
  | { type: 'bounce'; id: number; axis: 'x' | 'y' }
  | { type: 'attackStarted'; id: number; attack: string }
  | {
      type: 'damageDealt';
      src: number;
      dst: number;
      amount: number;
      crit: boolean;
      /** The target was already staggered, so bonus damage applied. */
      bonus: boolean;
      heavy: boolean;
    }
  | { type: 'dodgeStarted'; id: number }
  /** An attack found the target inside its invulnerable frames. */
  | { type: 'dodged'; src: number; dst: number }
  | { type: 'perfectDodge'; id: number; src: number }
  | { type: 'staggerBreak'; id: number }
  | { type: 'denied'; id: number; reason: 'stamina' | 'focus' | 'cooldown' }
  | { type: 'died'; id: number; team: 0 | 1 }
  | { type: 'respawned'; id: number }
  | { type: 'echoDropped'; id: number; coin: number }
  | { type: 'echoLost'; id: number }
  | { type: 'echoRecovered'; id: number; coin: number }
  | { type: 'projectileLaunched'; id: number; owner: number }
  | { type: 'lockChanged'; id: number; target: number | null };

/** Transient queue. Cleared at the start of every tick. Not saved or hashed. */
export interface EventQueue {
  list: SimEvent[];
}

/** Creates an empty queue. */
export function createEventQueue(): EventQueue {
  return { list: [] };
}

/** Appends an event. */
export function emit(q: EventQueue, e: SimEvent): void {
  q.list.push(e);
}

/** Empties the queue. */
export function clearEvents(q: EventQueue): void {
  q.list.length = 0;
}
