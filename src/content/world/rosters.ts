/**
 * Spawn rosters (design/04): the creatures a zone's spawners draw from. A region spec's zones name
 * a roster by id. Tier 1 rosters arrive with POW-M4-05, which fills this table. Data only.
 */
export interface RosterDef {
  id: string;
  /** Creature ids, as in `content/creatures`. */
  creatures: readonly string[];
}

/** Every roster by id. */
export const ROSTERS: Readonly<Record<string, RosterDef>> = Object.fromEntries(
  (
    [
      // The edge of the woods in the baker's sample region: one of each early nature.
      {
        id: 'roster.wood_edge',
        creatures: ['creature.mossling', 'creature.bramble_boar', 'creature.thornling'],
      },
    ] satisfies RosterDef[]
  ).map((r) => [r.id, r]),
);
