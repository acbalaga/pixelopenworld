import type { SimState } from '../state';

/** The prefix of the `interactable` kind that marks a promoted Traveler entity (POW-M5-04). */
export const TRAVELER_KIND = 'traveler:';

/** The slot of a promoted Traveler entity, or -1 if the entity is something else. */
export function travelerSlotOf(state: SimState, id: number): number {
  const k = state.entities.comps.interactable[id]?.kind;
  return k !== undefined && state.entities.alive[id] && k.startsWith(TRAVELER_KIND)
    ? Number(k.slice(TRAVELER_KIND.length))
    : -1;
}

/** True if the entity is a promoted Traveler. Combat uses it so Traveler kills pay nothing. */
export const isTravelerEntity = (state: SimState, id: number): boolean =>
  travelerSlotOf(state, id) >= 0;
