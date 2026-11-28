import type { DayPhase } from '../balance/time';
import type { Quality } from '../items/types';

export type SkillFamily = 'arms' | 'magic' | 'gathering' | 'crafting' | 'social' | 'exploration';

/** The sim happenings that can pay skill XP. */
export type XpEvent =
  | 'damage'
  | 'dodge'
  | 'block'
  | 'parry'
  | 'heal'
  | 'statusApplied'
  | 'gather'
  /** A crop harvested from a plot (M6-02). The first-time subject is the crop. */
  | 'harvest'
  | 'craft'
  | 'repair'
  | 'haggle'
  | 'sale'
  | 'perform'
  | 'sneak'
  | 'sprint'
  | 'outdoorsNight'
  | 'camp'
  | 'sleepOutdoors'
  | 'eatRaw'
  | 'tabletRead'
  | 'manualRead'
  | 'delveRoom'
  | 'delveBlock'
  | 'delveClear'
  | 'reveal';

/** What an insight count can follow: any XP event, or a perfect dodge (which pays no XP of its own). */
export type InsightEvent = XpEvent | 'perfectDodge';

/**
 * One row of the XP mapping table: when `on` happens, and its `tag` matches, the skill earns
 * `base` XP, scaled by the challenge of the target unless `scaled` is false.
 */
export interface XpSource {
  on: XpEvent;
  /**
   * Narrows the event. For `damage` it is the weapon family or spell element that dealt it. For
   * `gather` and `craft` it is the tag the gathering or crafting system gave the event.
   */
  tag?: string;
  base: number;
  /** Default true. Sprint and other flat sources set false. */
  scaled?: boolean;
  /**
   * Lump of XP the first time. The subject per event: damage the creature kind at the kill,
   * gather the item, craft the recipe, tabletRead the tablet's kind, place and the reader's band (`kind@x,y#band`), manualRead the manual item, perform the technique, sneak
   * the creature kind, haggle the shop, delveRoom the room, delveBlock the plate, delveClear the dungeon. `reveal` is one block of map uncovered for the first time. Other events have none. Fires once ever per subject.
   */
  firstTime?: number;
}

export interface SkillDef {
  id: string;
  name: string;
  family: SkillFamily;
  sources: XpSource[];
  /** Weapon family whose damage rank this skill supplies (Blades supplies `blades`). */
  weapon?: string;
}

/**
 * What a Trial asks for. Every kind counts manual play only (M3 rule 9): an event from an
 * automated source never advances one.
 */
export type TrialObjective =
  | {
      kind: 'defeat';
      /** A creature kind. Absent means any. */
      creature?: string;
      count: number;
      /** The count resets when the avatar takes damage or dies. */
      inARow?: boolean;
      /** Only kills where every hit on the creature was by this weapon family or element. */
      only?: { weapon?: string; element?: string };
      /** The count resets when the avatar takes damage. */
      untouched?: boolean;
      /** The whole count must fall inside this many ticks from the first kill. */
      withinTicks?: number;
      /** Only kills made in these phases of the day (a night watch). */
      phases?: DayPhase[];
    }
  | { kind: 'gather'; item?: string; tag?: string; count: number; phases?: DayPhase[] }
  | {
      kind: 'perform';
      /** `haggle` is a better price won at a counter, `sleepOutdoors` a night under the sky, `readManual` a technique read from a book. */
      action: 'perfectDodge' | 'parry' | 'technique' | 'haggle' | 'sleepOutdoors' | 'readManual';
      technique?: string;
      count: number;
      /** All within one fight (see `src/sim/fight.ts`). */
      inOneFight?: boolean;
    }
  | { kind: 'craft'; recipe: string; minQuality: Quality }
  /** Uncover this many 4 by 4 tile blocks of the map (Cartography). */
  | { kind: 'explore'; blocks: number }
  /** Feed creatures by hand (M4-05 feeding). A creature kind, or any. */
  | { kind: 'feed'; creature?: string; count: number }
  | { kind: 'deliver'; item: string; qty: number; minQuality?: Quality; to: string }
  | { kind: 'reach'; room: string; from: string; withinTicks: number }
  /** Sell this many crafted goods (any item a recipe makes) to a shop. */
  | { kind: 'sell'; count: number }
  /** Stand at a named place holding the item, in these phases of the day: the item is handed over. */
  | { kind: 'carry'; item: string; place: string; phases?: DayPhase[] }
  /** Harvest `distinct` different crops, at least one of them at `minQuality` or better (M6-02). */
  | { kind: 'harvest'; distinct: number; minQuality: Quality }
  /** Read `count` different tablets from this list (copying what they say). */
  | { kind: 'read'; fixtures: string[]; count: number };

/** A Trial: a short authored test, given by a person or place, that opens the next rank of a skill. */
export interface TrialDef {
  /** `trial.<skill>.<threshold>`, for example `trial.blades.15`. */
  id: string;
  skill: string;
  /** The skill point it lets the player reach. */
  threshold: 15 | 30 | 50 | 75 | 100;
  /** Who gives it: an NPC id, or a fixture kind (offered on interact). */
  giver: { npc: string } | { fixture: string };
  /** String key: what the giver says when offering. */
  intro: string;
  /** String key: the Skills tab line. Names the giver and a clue. */
  hint: string;
  objective: TrialObjective;
  /** Minutes it takes, for the pacing ledger (M4-12). */
  estMinutes: number;
}
