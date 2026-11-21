import type { Cond } from '../dialogue/types';
import type { TrialObjective } from '../skills/types';

/** One thing a solution asks for. The Trial objectives are reused as they are (M3-03). */
export type RequestObjective =
  TrialObjective | { kind: 'talk'; npc: string } | { kind: 'flag'; flag: string };

/** One way to finish a request. Its steps run in order. Any one solution completes the request. */
export interface RequestSolution {
  id: string;
  /** String key: the way, in plain words, for the log. */
  labelKey: string;
  steps: RequestObjective[];
}

/** A job. Authored ones are written by hand. Standing ones are made by the generator (M3-11). */
export interface RequestDef {
  id: string;
  /** Who gives it: a person (taken by talking) or a board (taken at the board). */
  giver: { npc: string } | { board: string };
  kind: 'authored' | 'standing';
  /** The region whose Renown it raises. */
  region: string;
  /** String key of the title, at most 24 characters once filled. */
  titleKey: string;
  /** String key of the asker's own words, shown in the log. */
  askKey: string;
  /** Fills `{slots}` in the two keys. Standing requests use it. */
  vars?: Record<string, string | number>;
  solutions: RequestSolution[];
  reward: {
    coin: number;
    items: { item: string; qty: number }[];
    /** Techniques taught on turn-in. */
    techniques?: string[];
    renown: number;
  };
  requires?: Cond[];
  /** Items handed over when the request is taken (a letter to carry). */
  give?: { item: string; qty: number }[];
  /** The Thread this request is a stage of (M4-12). A stage is not counted as a request by the ledger. */
  thread?: string;
  /** A finished request can be taken again after this many in-game days. */
  repeat?: { cooldownDays: number };
  /** Minutes it takes, for the pacing ledger (M4-12). */
  estMinutes: number;
}
