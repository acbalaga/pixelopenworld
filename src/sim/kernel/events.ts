/** Per-tick event queue. Render, audio, UI and chat read events. They never poll state. */

/** All sim events. Extend this union as systems appear. */
export type SimEvent = { type: 'bounce'; id: number; axis: 'x' | 'y' };

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
