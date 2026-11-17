/**
 * Fixtures: the doors, plates, blocks, chests, tablets, portals and Waystones that map data places
 * by kind (`fixture.*` objects). Data only. The sim reads these and never hard-codes a puzzle.
 */

export type FixtureType =
  'portal' | 'arrival' | 'door' | 'gate' | 'plate' | 'block' | 'chest' | 'tablet' | 'waystone';

export interface FixtureDef {
  kind: string;
  type: FixtureType;
  /** Atlas sprite id drawn for it, with `closed` and `open` frames where it has two states. */
  sprite?: string;
  /** Body size in px for things that block. Portals and plates have none. */
  size?: number;
  /** Portal: the fixture kind it leads to. The avatar arrives at that fixture plus its `arrive` offset. */
  to?: string;
  /** Portal or arrival: where the avatar stands on arrival, px from the fixture's feet. */
  arrive?: readonly [number, number];
  /** Door: the item that opens it. The key is used up. */
  key?: string;
  /** Gate: the plate kind that opens it. A gate stays open once opened. */
  plate?: string;
  /** Block: the gate it is solving for, and the room that resets it. Open gate means solved. */
  gate?: string;
  room?: string;
  /** Chest: what is inside. `coin` is carried coin. */
  loot?: { items: readonly { item: string; qty: number }[]; coin?: number };
}

const LIST: readonly FixtureDef[] = [
  { kind: 'fixture.waystone', type: 'waystone', sprite: 'prop.waystone', size: 12 },

  // Cave graph: square - A - B - (C puzzle, D side room, E boss behind a locked door). E has a
  // one way shortcut back to A. Each portal sits in a room's wall; `arrive` is where someone
  // coming through from the other side stands, px from the portal, pointing into its room.
  {
    kind: 'fixture.portal_cave_mouth',
    type: 'portal',
    to: 'fixture.portal_a_entry',
    arrive: [0, 24],
  },
  {
    kind: 'fixture.portal_a_entry',
    type: 'portal',
    to: 'fixture.portal_cave_mouth',
    arrive: [0, -22],
  },
  { kind: 'fixture.portal_a_east', type: 'portal', to: 'fixture.portal_b_west', arrive: [-22, 0] },
  { kind: 'fixture.portal_b_west', type: 'portal', to: 'fixture.portal_a_east', arrive: [22, 0] },
  { kind: 'fixture.portal_b_north', type: 'portal', to: 'fixture.portal_c_south', arrive: [0, 22] },
  {
    kind: 'fixture.portal_c_south',
    type: 'portal',
    to: 'fixture.portal_b_north',
    arrive: [0, -22],
  },
  {
    kind: 'fixture.portal_b_south',
    type: 'portal',
    to: 'fixture.portal_d_north',
    arrive: [0, -22],
  },
  { kind: 'fixture.portal_d_north', type: 'portal', to: 'fixture.portal_b_south', arrive: [0, 22] },
  { kind: 'fixture.portal_b_east', type: 'portal', to: 'fixture.portal_e_west', arrive: [-22, 0] },
  { kind: 'fixture.portal_e_west', type: 'portal', to: 'fixture.portal_b_east', arrive: [22, 0] },
  {
    kind: 'fixture.portal_e_shortcut',
    type: 'portal',
    to: 'fixture.arrival_a_shortcut',
    arrive: [0, 22],
  },
  { kind: 'fixture.arrival_a_shortcut', type: 'arrival', arrive: [0, 22] },

  {
    kind: 'fixture.door_boss',
    type: 'door',
    sprite: 'prop.door_locked',
    size: 16,
    key: 'item.old_key',
  },
  {
    kind: 'fixture.gate_puzzle',
    type: 'gate',
    sprite: 'prop.gate',
    size: 16,
    plate: 'fixture.plate_puzzle',
  },
  { kind: 'fixture.plate_puzzle', type: 'plate', sprite: 'prop.plate' },
  {
    kind: 'fixture.block_puzzle',
    type: 'block',
    sprite: 'prop.block',
    size: 14,
    gate: 'fixture.gate_puzzle',
    room: 'room.c',
  },
  {
    kind: 'fixture.chest_key',
    type: 'chest',
    sprite: 'prop.chest',
    size: 12,
    loot: { items: [{ item: 'item.old_key', qty: 1 }] },
  },
  {
    kind: 'fixture.chest_side',
    type: 'chest',
    sprite: 'prop.chest',
    size: 12,
    loot: { items: [{ item: 'item.herbed_skewer', qty: 2 }], coin: 40 },
  },
  { kind: 'fixture.tablet', type: 'tablet', sprite: 'prop.tablet', size: 12 },
];

/** Every fixture kind. */
export const FIXTURES: Readonly<Record<string, FixtureDef>> = Object.fromEntries(
  LIST.map((f) => [f.kind, f]),
);

/** A named rectangle of the world, in tiles (x1 and y1 exclusive). The camera snaps to it. */
export interface RoomDef {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Glyphs the tablet shows. Each is a polyline set on a 5 by 7 grid. Not a language: a placeholder. */
export const TABLET_GLYPHS: readonly (readonly (readonly [number, number][])[])[] = [
  [
    [
      [2, 0],
      [2, 6],
    ],
    [
      [0, 2],
      [4, 2],
    ],
  ],
  [
    [
      [0, 0],
      [4, 0],
      [4, 6],
    ],
    [
      [0, 3],
      [3, 3],
    ],
  ],
  [
    [
      [0, 6],
      [2, 0],
      [4, 6],
    ],
    [
      [1, 4],
      [3, 4],
    ],
  ],
  [
    [
      [0, 0],
      [0, 6],
      [4, 6],
    ],
    [
      [2, 1],
      [2, 4],
    ],
  ],
  [
    [
      [0, 3],
      [2, 0],
      [4, 3],
      [2, 6],
      [0, 3],
    ],
  ],
  [
    [
      [0, 0],
      [4, 3],
      [0, 6],
    ],
    [
      [4, 0],
      [4, 6],
    ],
  ],
  [
    [
      [1, 0],
      [1, 6],
    ],
    [
      [3, 0],
      [3, 6],
    ],
    [
      [0, 3],
      [4, 3],
    ],
  ],
];
