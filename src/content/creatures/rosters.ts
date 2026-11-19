import type { SpawnStep } from '../balance/world';
import type { SpawnerDef } from './types';

/**
 * Dawnmeadow's spawn zones (POW-M4-05, regions/01-dawnmeadow section 3). A zone is the set of
 * chunks of one kind on the map sketch. Its roster is a list of slots, and each slot is one kind
 * of spawner: who stands there by day and who by night. The bake places each slot's spawners
 * across the zone's chunks, on open ground and away from wake points, roads and walls where the
 * creature starts fights (`tools/bake-world/fill/spawners.ts`).
 *
 * Spawner kinds are `spawner.<zone>_<slot>`. Step multipliers are in `balance/world.ts`.
 */
export interface Slot {
  day: string | null;
  night: string | null;
  /** Creatures kept alive near one spawner. */
  cap: number;
  /** Ticks between respawns. */
  respawn: number;
  /** Spawn radius, px. */
  radius: number;
  /** Spawners placed in each chunk of the zone. */
  perChunk: number;
}

export interface ZoneRoster {
  id: string;
  name: string;
  step: SpawnStep;
  /** The sketch letters whose chunks make up the zone. */
  letters: string;
  slots: readonly Slot[];
}

const c = (id: string | null): string | null => (id === null ? null : `creature.${id}`);
const slot = (
  day: string | null,
  night: string | null,
  cap: number,
  perChunk: number,
  respawn = 900,
  radius = 56,
): Slot => ({ day: c(day), night: c(night), cap, respawn, radius, perChunk });

export const ZONES: readonly ZoneRoster[] = [
  {
    id: 'commons',
    name: 'Commons',
    step: 'a',
    letters: 'h',
    slots: [
      slot('meadow_hare', 'moor_wisp', 2, 2),
      slot('hedge_sparrow', null, 3, 2),
      slot('mossling', 'mossling', 2, 2),
    ],
  },
  {
    id: 'millbrook',
    name: 'Millbrook fields',
    step: 'a',
    letters: 'mM',
    slots: [slot('downs_ram', null, 3, 2), slot('fox', 'fox', 1, 1)],
  },
  {
    id: 'hollow',
    name: 'Hollow Downs',
    step: 'b',
    letters: 'd',
    slots: [
      slot('bramble_boar', 'bramble_boar', 1, 2),
      slot('burrow_mole', null, 2, 1),
      slot('thistle_wasp', null, 2, 1),
      slot(null, 'barrow_bones', 2, 1),
    ],
  },
  {
    id: 'marsh',
    name: 'Reedmouth marsh',
    step: 'b',
    letters: 'R',
    slots: [
      slot('reed_crab', null, 2, 2),
      slot('spitbloom', 'spitbloom', 1, 1),
      slot('marsh_leech', 'marsh_leech', 2, 2),
      slot(null, 'moor_wisp', 2, 1),
    ],
  },
  {
    id: 'rise',
    name: 'Stonecrop Rise',
    step: 'b',
    letters: 'sS',
    slots: [
      slot('rubblet', 'rubblet', 1, 2),
      slot('crag_hawk', null, 1, 1),
      slot(null, 'moorhound', 3, 1),
    ],
  },
  {
    id: 'fernside',
    name: 'Fernside Edge',
    step: 'c',
    letters: 'F',
    slots: [
      slot('thornling_scout', null, 1, 1),
      slot('spitbloom', 'spitbloom', 1, 1),
      slot('fox', 'fox', 1, 1),
      slot(null, 'moorhound', 3, 1),
      slot(null, 'barrow_bones', 2, 1),
    ],
  },
  {
    id: 'cairnmoor',
    name: 'Cairnmoor',
    step: 'c',
    letters: 'Cc',
    slots: [
      slot('moorhound', 'moorhound', 3, 2),
      slot('crag_hawk', null, 1, 1),
      slot(null, 'barrow_bones', 2, 1),
    ],
  },
];

/** The spawner kind of a zone's slot. */
export const slotKind = (zone: string, i: number): string => `spawner.${zone}_${i}`;

/**
 * Spawners that are placed by hand, because their place is the point: pests in the barn, scarecrows
 * in the fields, the field boss on its route. Positions are in the region spec's placements.
 */
export const SPECIAL_SPAWNERS: Readonly<Record<string, SpawnerDef>> = {
  'spawner.barn_rats': {
    kind: 'spawner.barn_rats',
    creature: 'creature.grain_rat',
    cap: 4,
    respawn: 600,
    radius: 24,
    step: 'a',
  },
  'spawner.field_strawman': {
    kind: 'spawner.field_strawman',
    creature: 'creature.strawman',
    cap: 1,
    respawn: 900,
    radius: 16,
    phases: { day: null, night: 'creature.strawman' },
    step: 'a',
  },
  'spawner.hollowhorn': {
    kind: 'spawner.hollowhorn',
    creature: 'creature.hollowhorn',
    cap: 1,
    respawn: 900,
    radius: 16,
    daily: true,
    step: 'c',
    // Six days, six places (regions/01 Cairnmoor): the north tors, the east ridge, the central
    // hollow, the far south west moor, the southern edge above the Fernside climb, and the western
    // slope over the cairn ring. Its home moves to the next each in-game day, so the beast a player
    // met on the ridge is somewhere else tomorrow. None is near the Waystone (the bake checks).
    route: [
      { x: 14, y: 40 },
      { x: 60, y: 70 },
      { x: 30, y: 70 },
      { x: 10, y: 78 },
      { x: 52, y: 88 },
      { x: 24, y: 52 },
    ],
  },
};

/** Every spawner the zones and the special list define, by kind. */
export const ROSTER_SPAWNERS: Readonly<Record<string, SpawnerDef>> = {
  ...Object.fromEntries(
    ZONES.flatMap((z) =>
      z.slots.map((s, i): [string, SpawnerDef] => {
        const kind = slotKind(z.id, i);
        const creature = (s.day ?? s.night) as string;
        const mixed = s.day !== s.night;
        return [
          kind,
          {
            kind,
            creature,
            cap: s.cap,
            respawn: s.respawn,
            radius: s.radius,
            step: z.step,
            ...(mixed ? { phases: { day: s.day, night: s.night } } : {}),
          },
        ];
      }),
    ),
  ),
  ...SPECIAL_SPAWNERS,
};
