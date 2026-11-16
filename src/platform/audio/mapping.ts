import type { SimEvent } from '../../sim/kernel/events';
import type { AudioEngine } from './engine';

/** Which effect plays for each sim event type. Systems never call audio directly. */
export const EVENT_SFX: { readonly [K in SimEvent['type']]?: string } = {
  bounce: 'sfx.hit_light',
};

/** Plays the mapped effects for this tick's events. */
export function playForEvents(engine: AudioEngine, events: readonly SimEvent[]): void {
  for (const e of events) {
    const id = EVENT_SFX[e.type];
    if (id) engine.playSfx(id);
  }
}
