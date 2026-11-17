import type { DayPhase } from '../balance/time';

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
  | 'craft'
  | 'repair'
  | 'haggle'
  | 'sale'
  | 'perform'
  | 'sneak'
  | 'sprint'
  | 'outdoorsNight'
  | 'eatRaw'
  | 'tabletRead';

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
   * gather the item, craft the recipe, tabletRead the tablet kind, perform the technique, sneak
   * the creature kind, haggle the shop. Other events have none. Fires once ever per subject.
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

/** A Trial: a short authored test, given by a person, that opens the next rank of a skill. */
export interface TrialDef {
  id: string;
  skill: string;
  /** The skill point it lets the player reach. */
  threshold: number;
  /** Who gives it. An id from the people content (M1-08). */
  giver: string;
  /** What passes it: this item, gathered during one of these phases of the day. */
  gather: { item: string; phases: readonly DayPhase[] };
}
