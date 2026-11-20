/**
 * Where a person is (POW-M4-12). A pure function of the schedule data, the phase of the day and
 * the weather: nothing here reads the clock or the world, so offline settlement and the tests can
 * ask the same question the game does.
 */
import type { DayPhase, Weather } from '../content/balance/time';
import { PEOPLE, type PersonDef } from '../content/people';

/** The place id a person is at in this phase and weather. Falls back to their home. */
export function placeOf(person: PersonDef, phase: DayPhase, weather: Weather): string {
  for (const slot of person.schedule) {
    if (!slot.phases.includes(phase)) continue;
    if (slot.weather && !slot.weather.includes(weather)) continue;
    return slot.place;
  }
  return person.home;
}

/** The place id for an NPC id, or null if the NPC has no schedule. */
export function whereIs(npc: string, phase: DayPhase, weather: Weather): string | null {
  const p = PEOPLE[npc];
  return p ? placeOf(p, phase, weather) : null;
}
