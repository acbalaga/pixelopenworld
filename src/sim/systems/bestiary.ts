/**
 * The Bestiary (POW-M4-05). It remembers which temperaments the avatar has seen each kind act on,
 * and which kinds it has befriended. Kills are not kept here: the ledger counts them. The system
 * only reads events the avatar was in front of, so a creature fighting some other player's
 * avatar teaches this one nothing.
 */
import { CREATURES } from '../../content/creatures';
import { getComp, query } from '../kernel/entities';
import type { SimState } from '../state';

/** Records what this tick's events taught each avatar. */
export function bestiarySystem(state: SimState): void {
  const count = state.events.list.length;
  if (count === 0) return;
  for (const who of query(state.entities, 'avatar', 'journal')) {
    const j = getComp(state.entities, who, 'journal');
    if (!j) continue;
    // A state loaded from before schema 27 has none until the migration runs.
    j.bestiary ??= {};
    for (let i = 0; i < count; i++) {
      const e = state.events.list[i];
      if (!e) continue;
      if (e.type === 'temperamentSeen' && e.target === who && CREATURES[e.kind]) {
        const entry = (j.bestiary[e.kind] ??= { temperaments: [] });
        if (!entry.temperaments.includes(e.temperament)) entry.temperaments.push(e.temperament);
      } else if (e.type === 'befriended' && e.who === who && CREATURES[e.kind]) {
        (j.bestiary[e.kind] ??= { temperaments: [] }).befriended = true;
      }
    }
  }
}
