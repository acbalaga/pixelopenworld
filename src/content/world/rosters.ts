import { ZONES } from '../creatures/rosters';

/**
 * Spawn rosters (design/04): the creatures a zone's spawners draw from. A region spec's zones name
 * a roster by id. Dawnmeadow's come from its zones in `creatures/rosters` (POW-M4-05). Data only.
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
      // Dawnmeadow: every creature a zone's slots put out, by day or night.
      ...ZONES.map((z): RosterDef => ({
        id: `roster.${z.id}`,
        creatures: [
          ...new Set(z.slots.flatMap((s) => [s.day, s.night]).filter((c): c is string => !!c)),
        ],
      })),
    ] satisfies RosterDef[]
  ).map((r) => [r.id, r]),
);
