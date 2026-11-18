/**
 * Fixtures: the doors, plates, blocks, chests, tablets, portals and Waystones that map data places
 * by kind (`fixture.*` objects). Data only. The sim reads these and never hard-codes a puzzle.
 */

import type { ElementId } from '../combat/statuses';

/** What an element hit does to a fixture (M3-09). */
export type ElementAction = 'open' | 'close' | 'toggle' | 'reveal' | 'grow' | 'raise';

/** Flags a tile or fixture can carry for element rules. */
export type TileFlag = 'flammable' | 'water' | 'frozen';

export type FixtureType =
  | 'portal'
  | 'arrival'
  | 'door'
  | 'gate'
  | 'plate'
  | 'block'
  | 'chest'
  | 'tablet'
  | 'waystone'
  | 'storage'
  | 'station'
  | 'bed'
  | 'element'
  | 'wall';

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
  /** Portal: hidden behind a solid wall slab (its `sprite`) until a creature of this kind is defeated, then the slab goes and the portal works. */
  unlockedBy?: string;
  /** Element rules: what a hit of each school does to this fixture. */
  onElement?: Partial<Record<ElementId, ElementAction>>;
  /** Element flags. `flammable` pieces burn to ash and, with `regrows`, grow back. */
  flags?: readonly TileFlag[];
  /** An opened piece returns to how it was after `brushRegrowTicks` world ticks. */
  regrows?: boolean;
  /** Not drawn and not solid until revealed. */
  hidden?: boolean;
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
    // A slab of plain wall face stands over the arch, solid, until the boss is down.
    sprite: 'tile.cave_wall_face',
    size: 16,
    unlockedBy: 'creature.old_bramblehide',
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
  // The storage chest by the square Waystone: 40 slots held on the avatar (M3-05).
  { kind: 'fixture.storage', type: 'storage', sprite: 'prop.chest', size: 12 },
  // Crafting stations in the square (M3-07). The camp pot is a prop with its own kind.
  { kind: 'fixture.anvil', type: 'station', sprite: 'prop.anvil', size: 12 },
  { kind: 'fixture.workbench', type: 'station', sprite: 'prop.workbench', size: 14 },
  // A bedroll by the square Waystone. Sleeping on it applies Rested (M3-09).
  { kind: 'fixture.bed', type: 'bed', sprite: 'prop.bedroll', size: 14 },
  // Raised by the Earth Wall technique (M3-13). It blocks bodies and bolts and does not last.
  { kind: 'fixture.earth_wall', type: 'wall', sprite: 'prop.earth_wall', size: 16 },
  // Element set pieces (M3-09). One for each school, none on a route the slice needs.
  // A wall of dry brush: Ember burns it to ash, and it grows back.
  {
    kind: 'fixture.brush_wall',
    type: 'element',
    sprite: 'prop.brush_wall',
    size: 16,
    onElement: { ember: 'open' },
    flags: ['flammable'],
    regrows: true,
  },
  // A fire that bars the way: Tide douses it.
  {
    kind: 'fixture.fire_barrier',
    type: 'element',
    sprite: 'prop.fire_barrier',
    size: 16,
    onElement: { tide: 'open' },
  },
  // A windmill gate: Gale spins it open.
  {
    kind: 'fixture.windmill_gate',
    type: 'element',
    sprite: 'prop.windmill_gate',
    size: 16,
    onElement: { gale: 'open' },
  },
  // A gap in the path: a Stone hit raises a step across it.
  {
    kind: 'fixture.stone_gap',
    type: 'element',
    sprite: 'prop.stone_gap',
    size: 16,
    onElement: { stone: 'raise' },
  },
  // A withered vine: Mending grows it into a ladder.
  {
    kind: 'fixture.withered_vine',
    type: 'element',
    sprite: 'prop.withered_vine',
    size: 16,
    onElement: { mending: 'grow' },
  },
  // A hidden niche: Hexing reveals it, and what it held.
  {
    kind: 'fixture.hidden_niche',
    type: 'element',
    sprite: 'prop.hidden_niche',
    onElement: { hexing: 'reveal' },
    hidden: true,
    loot: { items: [{ item: 'item.herbed_skewer', qty: 1 }], coin: 25 },
  },
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
  /** Open sky. Night spent here pays Survival XP. */
  outdoors?: true;
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
