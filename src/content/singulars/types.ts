/**
 * Singulars (POW-M4-20, design/03): rare hidden questlines that start from odd actions. A trigger
 * and each step are predicates over sim state and events, written from this small vocabulary, so
 * no step is code. Nothing here is shown to the player. Text lives in `content/strings/singulars`
 * and is read only by `singularText`, which gives nothing until the trigger has fired.
 */
import type { DayPhase, Weather } from '../balance/time';

/** The sim happenings a step can listen to. The sim checks a step only when its event arrives. */
export type SingularEvent =
  /** An item left the bag onto the ground. The subject is the item id. */
  | 'itemDropped'
  /** The avatar bedded down outdoors. The subject is absent. The place is the wake point it was at. */
  | 'slept'
  /** The avatar opened a crafting station. The subject is the station kind. */
  | 'stationUsed'
  /** The avatar used a world fixture. The subject is the fixture kind. */
  | 'fixtureUsed'
  /** An item came into the bag from the world (a chest, loot, a pickup). The subject is the item id. */
  | 'itemGained'
  /** A dialogue set a flag. The subject is the flag. */
  | 'flagSet'
  /** A manual was read. The subject is the item id. */
  | 'manualRead';

/** A condition on where, when and with what the avatar stands. All of a step's conditions must hold. */
export type SingularPred =
  | { phase: readonly DayPhase[] }
  | { weather: readonly Weather[] }
  /** Within `px` of a fixture of this kind. */
  | { near: { fixture: string; px: number } }
  /** Inside a named area (`content/world/areas`). */
  | { area: string }
  /** At a wake point of the region (the event's place). */
  | { wake: true }
  | { skill: { id: string; atLeast: number } }
  /** The event's item carries this tag (`shiny`). */
  | { itemTag: 'shiny' }
  | { flag: string; not?: boolean };

/** What a step or a reward does to the avatar. */
export type SingularEffect =
  { setFlag: string } | { give: string; qty: number } | { learnRecipe: string };

/** What the step counts. `by` names the thing that must differ between counts. */
export interface SingularCount {
  n: number;
  /** `day`: one count per in-game day. `item`: one per item id. `place`: one per wake point. `none`: every event. */
  by: 'day' | 'item' | 'place' | 'none';
  /** Also at most one count for each in-game day, whatever `by` is. */
  oncePerDay?: boolean;
}

export interface SingularStep {
  id: string;
  on: SingularEvent;
  /** The item, fixture kind, station kind, flag or manual the event must name. Absent: any. */
  subject?: string;
  when?: readonly SingularPred[];
  count?: SingularCount;
  /** Starts with the counts the trigger gathered, so what it saw is not asked for twice. */
  inherit?: true;
  /** Done when the step completes. */
  then?: readonly SingularEffect[];
}

export interface SingularDef {
  id: string;
  region: string;
  /** Fires the Singular when it completes. Until then the player is told nothing. */
  trigger: SingularStep;
  steps: readonly SingularStep[];
  /** Given when the last step completes. */
  reward: readonly SingularEffect[];
  /** Minutes it takes a player who finds it, for the pacing ledger (M4-12). */
  estMinutes: number;
}
