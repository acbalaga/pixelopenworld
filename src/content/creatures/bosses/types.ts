/**
 * Boss data (M4-08, design/04 Bosses): up to three phases, each adding one mechanic, scripted
 * attack patterns, marked-tile hazards with telegraphs, health gates, and an alternate objective
 * graph that ends the encounter without a fight.
 */

/** What starts a phase: Health falling to a percent, or a named event (a fixture kind switching on). */
export type PhaseTrigger = { hpPct: number } | { event: string };

/** One step of an attack pattern: start `attack`, then wait `wait` ticks before the next step. */
export interface PatternStep {
  attack: string;
  wait: number;
}

/**
 * Marked tiles (offsets in tiles from the boss's home) that the arena threatens. They show a
 * telegraph for `telegraph` ticks, hurt for `active` ticks, and repeat every `period` ticks.
 */
export interface Hazard {
  tiles: readonly (readonly [number, number])[];
  telegraph: number;
  active: number;
  period: number;
  /** Health lost by the avatar standing on one while it is active. */
  damage: number;
}

/** Holds Health at this percent until `until` happens, so a boss cannot be burst past its mechanic. */
export interface HealthGate {
  holdHpPct: number;
  until: string;
}

/** Creatures a phase calls when it begins: `count` of `creature`, in a ring `radius` tiles from the boss. */
export interface Summon {
  creature: string;
  count: number;
  radius: number;
}

export interface BossPhase {
  enter: PhaseTrigger;
  /** Called once, on entering the phase. */
  summon?: Summon;
  /** The pattern of this phase, repeated. Empty leaves the creature's own attacks in charge. */
  pattern: readonly PatternStep[];
  hazards?: readonly Hazard[];
  gate?: HealthGate;
}

/** What shows a step of an objective graph is done: a world fact the player made happen. */
export type ObjectiveDone =
  { fixtureOpen: string } | { flag: string } | { item: string; qty: number };

export interface ObjectiveStep {
  id: string;
  /** Steps that must be done first. */
  requires: readonly string[];
  done: ObjectiveDone;
}

/**
 * A second way to end the encounter, made of world actions. When every step is done the boss
 * resolves with the same reward table, and the title line is `title` instead of the fight's.
 */
export interface ObjectiveGraph {
  steps: readonly ObjectiveStep[];
  /** String key of the title line shown on a resolution this way. */
  title: string;
}

export interface BossDef {
  id: string;
  /** The creature the fight uses (stats, drops, sprite). */
  creature: string;
  /** String key of the title line shown when the boss is defeated. */
  title: string;
  /** One to three phases. The first enters at the start (`hpPct` 100). */
  phases: readonly BossPhase[];
  objective?: ObjectiveGraph;
  /** The dungeon this boss clears, if any. */
  dungeon?: string;
}
