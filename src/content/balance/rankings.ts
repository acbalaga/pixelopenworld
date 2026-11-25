import type { Archetype } from '../travelers/types';

/**
 * Rankings tunables (POW-M5-09, design/07 Rankings, design/12 3.4). Every Traveler's value on a
 * board is a function of their life and identity, so a board is derived and costs no save space.
 * Skill boards read the build as it is, and the plateau (M5-03) is what lets a player pass the top.
 */
export const RANKINGS = {
  /** The player passing a Traveler who stands in the top this many of a board raises `playerPassed`. */
  passTop: 20,
  /** Rows a board shows in the top list. The player's row and its neighbours are added. */
  topRows: 10,
  /** Travelers never reach more than this share of a capped board (bestiary, map), so a player can top it. */
  travelerCap: 0.9,
  /** Entries in the Bestiary a Traveler has per skill point in total, by archetype. */
  bestiaryPerPoint: {
    Grinder: 0.2,
    Explorer: 0.3,
    Socializer: 0.1,
    Crafter: 0.1,
    Trader: 0.1,
    Roleplayer: 0.1,
    Completionist: 0.35,
    Casual: 0.08,
    Newbie: 0.08,
    Veteran: 0.22,
  } satisfies Record<Archetype, number>,
  /** Percent of the map a Traveler has uncovered per skill point in total, by archetype. */
  mapPerPoint: {
    Grinder: 0.25,
    Explorer: 0.55,
    Socializer: 0.2,
    Crafter: 0.15,
    Trader: 0.3,
    Roleplayer: 0.2,
    Completionist: 0.6,
    Casual: 0.12,
    Newbie: 0.1,
    Veteran: 0.3,
  } satisfies Record<Archetype, number>,
  /** Fish landed per point of Fishing, in total. The player's count is the fish in the ledger. */
  fishPerPoint: 8,
  /** The Renown board adds skill points (divided), Bestiary entries and a step for every this much coin. */
  renown: { pointsPer: 10, coinPer: 1000 },
  /**
   * How much of a bot's rate a person lands, by play hour: they start slow and learn. The scenario
   * tests scale the bot's hours by the integral of this. It is a test yardstick, never read by the sim.
   */
  humanEfficiency: { start: 0.25, end: 0.6, learnHours: 15 },
} as const;
