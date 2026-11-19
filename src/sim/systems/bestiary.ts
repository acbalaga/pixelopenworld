import { getComp, query } from '../kernel/entities';
import type { BestiaryEntry, SimState } from '../state';

const entryOf = (bestiary: Record<string, BestiaryEntry>, kind: string): BestiaryEntry =>
  (bestiary[kind] ??= { temperaments: [] });

/**
 * Fills each avatar's Bestiary from this tick's events (M4-05). A kind is listed on the first
 * kill or the first time it takes food from the avatar's hand. The natures it is seen acting on
 * are kept, so the entry shows a temperament only once the avatar has seen it. Runs last.
 */
export function bestiarySystem(state: SimState): void {
  for (const who of query(state.entities, 'avatar', 'journal')) {
    const j = getComp(state.entities, who, 'journal');
    if (!j) continue;
    for (const e of state.events.list) {
      if (e.type === 'killed' && e.src === who) {
        if (e.kind === 'creature.training_dummy') continue;
        entryOf(j.bestiary, e.kind).slain = true;
      } else if (e.type === 'creatureFed' && e.who === who) {
        const kind = getComp(state.entities, e.id, 'ai')?.creature;
        if (kind) entryOf(j.bestiary, kind).befriended = true;
      } else if (e.type === 'temperamentSeen' && e.target === who) {
        if (e.kind === 'creature.training_dummy') continue;
        const t = entryOf(j.bestiary, e.kind).temperaments;
        if (!t.includes(e.temperament)) t.push(e.temperament);
      }
    }
  }
}
