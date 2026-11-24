import { getComp, type EntityId } from '../kernel/entities';
import { emit } from '../kernel/events';
import type { SimState } from '../state';
import { contextTarget } from '../systems/interact';
import { travelerSlotOf } from './kind';

/** The context button on a promoted Traveler: the UI opens its profile card (M5-04). */
export function interactTraveler(state: SimState, who: EntityId): void {
  if (getComp(state.entities, who, 'fighter')?.state !== 'idle') return;
  const t = contextTarget(state, who);
  if (t === null) return;
  const slot = travelerSlotOf(state, t);
  if (slot >= 0) emit(state.events, { type: 'travelerInspect', slot });
}
