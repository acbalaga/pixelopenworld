/**
 * Spawn rosters (design/04): the creatures a zone's spawners draw from. A region spec's zones name
 * a roster by id. Dawnmeadow's tier 1 rosters (POW-M4-05, regions/01-dawnmeadow section 3) give a
 * day list, a night list, and the step (a, b, c) whose multipliers scale them. Data only.
 */
export type SpawnStep = 'a' | 'b' | 'c';

export interface RosterDef {
  id: string;
  /** Creature ids, as in `content/creatures`. They spawn by day (dawn and day). */
  creatures: readonly string[];
  /** Creature ids that spawn from dusk to dawn instead. Absent: the day list spawns at all hours. */
  night?: readonly string[];
  /**
   * Sub-step inside the tier (multipliers in `balance/world.ts` `SPAWNS`). The baker places
   * spawners only for a roster with a step; one without (the sample's) only marks the dev map.
   */
  step?: SpawnStep;
}

/*
 * Left out of the open zones until their places exist: the Grain Rat (barns only, the Inn Cellar),
 * the Thistle Wasp (near hives, Hive Hill), Barrow Bones (near barrows) and Hollowhorn (a daily
 * route, not a spawner).
 */

/** Every roster by id. */
export const ROSTERS: Readonly<Record<string, RosterDef>> = Object.fromEntries(
  (
    [
      // The edge of the woods in the baker's sample region: one of each early nature.
      {
        id: 'roster.wood_edge',
        creatures: ['creature.mossling', 'creature.bramble_boar', 'creature.thornling'],
      },
      {
        id: 'roster.dm_commons',
        step: 'a',
        creatures: ['creature.meadow_hare', 'creature.hedge_sparrow', 'creature.mossling'],
        night: ['creature.mossling', 'creature.moor_wisp'],
      },
      {
        id: 'roster.dm_millbrook_fields',
        step: 'a',
        creatures: ['creature.downs_ram', 'creature.fox'],
        night: ['creature.fox', 'creature.strawman'],
      },
      {
        id: 'roster.dm_hollow_downs',
        step: 'b',
        creatures: ['creature.bramble_boar', 'creature.burrow_mole'],
        night: ['creature.bramble_boar'],
      },
      {
        id: 'roster.dm_reedmouth',
        step: 'b',
        creatures: ['creature.reed_crab', 'creature.spitbloom', 'creature.marsh_leech'],
        night: ['creature.moor_wisp', 'creature.marsh_leech'],
      },
      {
        id: 'roster.dm_stonecrop',
        step: 'b',
        creatures: ['creature.rubblet', 'creature.crag_hawk'],
        night: ['creature.rubblet', 'creature.moorhound'],
      },
      {
        id: 'roster.dm_fernside',
        step: 'c',
        creatures: ['creature.thornling_scout', 'creature.spitbloom', 'creature.fox'],
        night: ['creature.moorhound'],
      },
      {
        id: 'roster.dm_cairnmoor',
        step: 'c',
        creatures: ['creature.moorhound', 'creature.crag_hawk'],
        night: ['creature.moorhound'],
      },
    ] satisfies RosterDef[]
  ).map((r) => [r.id, r]),
);
