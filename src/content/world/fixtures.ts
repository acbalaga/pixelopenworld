/**
 * Fixtures: the doors, plates, blocks, chests, tablets, portals and Waystones that map data places
 * by kind (`fixture.*` objects). Data only. The sim reads these and never hard-codes a puzzle.
 */

import { MANUALS } from '../items/manuals';
import { BUILT_DUNGEONS } from './dungeons/registry';
import { SECRET_FIXTURES } from '../pois/secrets';
import { WEST_FIXTURES } from './dungeons/west';
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
  | 'board'
  | 'station'
  | 'bed'
  | 'mirror'
  | 'element'
  | 'wall'
  | 'snare'
  | 'switch'
  | 'breakable'
  | 'torch'
  | 'arena'
  | 'ledge'
  | 'rest'
  /** A place where something is found by being there the right way (a secret): sets a journal flag. */
  | 'vigil'
  /** A heat vent: bursts on a cycle and hurts whoever stands near it (m8). */
  | 'vent'
  /** A thing that records being used and does nothing else (a scarecrow, a mound of earth). */
  | 'site';

/** What can press a plate (M4-08). The default is a block alone, as in the first cave. */
export type PlateHolder = 'avatar' | 'creature' | 'block' | 'wall';

/** Kinds of hit that break a wall: a heavy weapon swing, a Stone hit, an Ember hit. */
export type HitKind = 'heavy' | 'stone' | 'ember' | 'tide';

/** A side of a door, for a shortcut that opens from one side only. */
export type Side = 'N' | 'E' | 'S' | 'W';

/** One wave of an arena: how many of a creature kind stand against the avatar. */
export interface ArenaWave {
  creature: string;
  count: number;
}

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
  /** Chest: stays shut until the avatar holds this journal flag (a boss's `cleared:` flag). */
  needsFlag?: string;
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
  /** Board: the id of the request board it is (M3-11). */
  board?: string;
  /** Chest: opening it sets this journal flag (a request step can ask for it). */
  setsFlag?: string;
  /** Plate: what presses it. Defaults to blocks only. */
  holds?: readonly PlateHolder[];
  /**
   * Switch: the avatar uses it to turn it on or off. `latch` keeps it on once on. A gate or a door
   * names a switch kind in `plate`, exactly as it names a plate kind.
   */
  latch?: boolean;
  /** Gate: after it is triggered it stays open this many ticks, then closes. Without it a gate stays open for good. */
  holdTicks?: number;
  /** Breakable wall: broken by these kinds of hit. */
  breaksBy?: readonly HitKind[];
  /** Torch: lit by an Ember hit, and it lights its room. `litAtStart` places it burning. */
  litAtStart?: boolean;
  /** Door: opens, with no key, only for an avatar standing on this side of it. A shortcut. */
  opensFrom?: Side;
  /** Portal: arriving costs this percent of maximum Health (never the last point). A drop. */
  fall?: number;
  /**
   * Gate: opens and shuts with the water level (the Undermill). The level is low while the named
   * sluice switch is on, and high otherwise, or while the named basin has been filled by a Tide hit.
   */
  water?: { sluice: string; when: 'low' | 'high'; basin?: string };
  /**
   * Vigil: an avatar within `radius` px sets the journal flag `flag` once the way is right: with
   * `need` points of a skill, inside the `minutes` window of the in-game day, in `weather`. With
   * `phases` it must have stood here in each of them (the flag `<flag>.<phase>` records each).
   */
  secret?: {
    radius: number;
    flag: string;
    need?: { skill: string; points: number };
    minutes?: readonly [number, number];
    weather?: 'clear';
    phases?: readonly ('dawn' | 'day' | 'dusk' | 'night')[];
  };
  /** Ledge: climbing it needs this much of the skill and costs this much Stamina, and carries the avatar two tiles on. */
  climb?: { skill: string; points: number; stamina: number };
  /**
   * Switch: a bell. Bells of a group must be rung in order, 1 up. A bell rung out of turn silences
   * the whole group, so the order has to be found.
   */
  bell?: { group: string; order: number };
  /** Switch: the avatar must have at least this many points in the skill to throw it. */
  needs?: { skill: string; points: number };
  /** Gate: shut except while the tide is out (m4). No plate needed. */
  tide?: 'low';
  /** Vent: every `period` ticks it shows for `telegraph` ticks, then bursts, hurting an avatar within `radius` px. */
  vent?: { radius: number; telegraph: number; active: number; period: number; damage: number };
  /** Gate: an arena door. It stands open until the arena starts, shuts while it is live, opens when cleared. */
  arenaDoor?: boolean;
  /** Arena trigger: the avatar this close (px) starts it. The doors are the gate kinds named. */
  arena?: { radius: number; doors: readonly string[]; waves: readonly ArenaWave[] };
  /** A fixture that belongs to one dungeon's own rooms. The region supply check leaves it out (M4-21). */
  dungeon?: string;
  /**
   * The region tile the fixture stands on, for fixtures in a fixed place that a portal leads to.
   * It lets a portal find its destination before that chunk has been streamed in (M4-21).
   */
  at?: { x: number; y: number };
  /** Chest: what is inside. `coin` is carried coin. */
  loot?: { items: readonly { item: string; qty: number }[]; coin?: number };
}

const LIST: readonly FixtureDef[] = [
  { kind: 'fixture.waystone', type: 'waystone', sprite: 'prop.waystone', size: 12 },

  // Millbrook's scarecrow with a crow on it, and a mound of turned earth (M4-20). Both only record
  // being used. What they mean is in `content/singulars`.
  { kind: 'fixture.scarecrow', type: 'site', sprite: 'prop.scarecrow', size: 10 },
  { kind: 'fixture.crow_mound', type: 'site', sprite: 'prop.crow_mound', size: 10 },
  // A set of firebricks in a crate: a stand-in for the Rootway R9, the Deeps and the Undermill.
  {
    kind: 'fixture.chest_firebrick',
    type: 'chest',
    sprite: 'prop.chest',
    size: 12,
    loot: { items: [{ item: 'item.firebrick', qty: 1 }] },
  },

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
  // The request board in the square (M3-11). Posts a few jobs at each dawn.
  { kind: 'fixture.board', type: 'board', sprite: 'prop.board', size: 14, board: 'board.square' },
  // A satchel a patrol dropped in the first cave room. Taking it is one way to finish the boar request.
  {
    kind: 'fixture.satchel',
    type: 'chest',
    sprite: 'prop.satchel',
    size: 10,
    loot: { items: [] },
    setsFlag: 'flag.satchel_taken',
  },
  // Whisperwood finds (M3-12): placed by that region's map, not the first one.
  {
    kind: 'fixture.chest_cairn',
    type: 'chest',
    sprite: 'prop.chest',
    size: 12,
    loot: {
      items: [
        { item: 'item.worn_map', qty: 1 },
        { item: 'item.chalk_stub', qty: 1 },
        { item: 'item.crow_feather', qty: 2 },
      ],
    },
  },
  {
    kind: 'fixture.chest_hollow',
    type: 'chest',
    sprite: 'prop.chest',
    size: 12,
    loot: {
      items: [
        { item: 'item.ring_silver', qty: 1 },
        { item: 'item.charm_sun', qty: 1 },
      ],
      coin: 60,
    },
  },
  // Crafting stations in the square (M3-07). The camp pot is a prop with its own kind.
  { kind: 'fixture.anvil', type: 'station', sprite: 'prop.anvil', size: 12 },
  { kind: 'fixture.workbench', type: 'station', sprite: 'prop.workbench', size: 14 },
  // Crafting II stations in the square (M3-14).
  { kind: 'fixture.loom', type: 'station', sprite: 'prop.loom', size: 14 },
  { kind: 'fixture.alchemy_table', type: 'station', sprite: 'prop.alchemy_table', size: 14 },
  { kind: 'fixture.rune_stone', type: 'station', sprite: 'prop.rune_stone', size: 12 },
  { kind: 'fixture.tinker_bench', type: 'station', sprite: 'prop.tinker_bench', size: 14 },
  // A snare set by the Snare gadget: it roots the first creature to step on it, then is gone.
  { kind: 'fixture.snare', type: 'snare', sprite: 'prop.snare', size: 8 },
  // A bedroll by the square Waystone. Sleeping on it applies Rested (M3-09).
  { kind: 'fixture.bed', type: 'bed', sprite: 'prop.bedroll', size: 14 },
  // The inn mirror (M4-19), placed in the square until the inn is built (M4-04). Free.
  { kind: 'fixture.mirror', type: 'mirror', sprite: 'prop.mirror', size: 12 },
  // Raised by the Earth Wall technique (M3-13). It blocks bodies and bolts and does not last.
  { kind: 'fixture.earth_wall', type: 'wall', sprite: 'prop.earth_wall', size: 16 },
  // Dungeon building blocks (M4-08). Generic kinds that every dungeon reuses.
  // A floor switch the avatar turns on and off, and a latching one that stays on.
  { kind: 'fixture.switch', type: 'switch', sprite: 'prop.plate', size: 12 },
  { kind: 'fixture.switch_latch', type: 'switch', sprite: 'prop.plate', size: 12, latch: true },
  // A plate that anything heavy enough presses: the avatar, a creature, a block or a Stone wall.
  {
    kind: 'fixture.plate_any',
    type: 'plate',
    sprite: 'prop.plate',
    holds: ['avatar', 'creature', 'block', 'wall'],
  },
  // A plate only a living thing presses, so it is held by standing on it.
  {
    kind: 'fixture.plate_step',
    type: 'plate',
    sprite: 'prop.plate',
    holds: ['avatar', 'creature'],
  },
  // Gates opened by the switch and plate kinds above. The timed one closes again.
  {
    kind: 'fixture.gate_switch',
    type: 'gate',
    sprite: 'prop.gate',
    size: 16,
    plate: 'fixture.switch',
  },
  {
    kind: 'fixture.gate_timed',
    type: 'gate',
    sprite: 'prop.gate',
    size: 16,
    plate: 'fixture.plate_step',
    holdTicks: 150,
  },
  {
    kind: 'fixture.gate_any',
    type: 'gate',
    sprite: 'prop.gate',
    size: 16,
    plate: 'fixture.plate_any',
  },
  // Walls that break to one kind of hit each.
  {
    kind: 'fixture.wall_heavy',
    type: 'breakable',
    sprite: 'prop.brush_wall',
    size: 16,
    breaksBy: ['heavy'],
  },
  {
    kind: 'fixture.wall_stone',
    type: 'breakable',
    sprite: 'prop.stone_gap',
    size: 16,
    breaksBy: ['stone'],
  },
  {
    kind: 'fixture.wall_ember',
    type: 'breakable',
    sprite: 'prop.brush_wall',
    size: 16,
    breaksBy: ['ember'],
  },
  // A torch. Ember lights it, and a lit one lights a dark room.
  {
    kind: 'fixture.torch',
    type: 'torch',
    sprite: 'prop.torch',
    size: 8,
    onElement: { ember: 'open' },
  },
  // A shortcut back to the entrance: a door that opens, for good, from the far side only.
  {
    kind: 'fixture.door_shortcut',
    type: 'door',
    sprite: 'prop.door_locked',
    size: 16,
    opensFrom: 'S',
  },
  // A hole in the floor. The way down is one way and costs a little Health.
  {
    kind: 'fixture.drop_hole',
    type: 'portal',
    to: 'fixture.arrival_drop',
    arrive: [0, 8],
    fall: 10,
  },
  { kind: 'fixture.arrival_drop', type: 'arrival', arrive: [0, 8] },
  // An arena: the trigger, and the doors that shut while its waves are live.
  {
    kind: 'fixture.arena_door',
    type: 'gate',
    sprite: 'prop.gate',
    size: 16,
    arenaDoor: true,
  },
  {
    kind: 'fixture.arena_trigger',
    type: 'arena',
    arena: {
      radius: 40,
      doors: ['fixture.arena_door'],
      waves: [
        { creature: 'creature.thornling', count: 2 },
        { creature: 'creature.bramble_boar', count: 1 },
      ],
    },
  },
  // The Fernside climb (M4-04): a stamina ledge and a rest point along a cliff route.
  // Athletics 25 and 30 Stamina a ledge (regions/01 section 7).
  {
    kind: 'fixture.ledge',
    type: 'ledge',
    sprite: 'prop.block',
    size: 12,
    climb: { skill: 'skill.athletics', points: 25, stamina: 30 },
  },
  { kind: 'fixture.rest_point', type: 'rest', sprite: 'prop.bedroll', size: 12 },
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

/**
 * One chest for each manual (M4-15), named for the manual: `fixture.chest_manual_lunge`. They are
 * stand-ins on the slice map until POW-M4-11 and POW-M4-21 move each to its place in the region.
 */
const MANUAL_CHESTS: readonly FixtureDef[] = MANUALS.filter((m) => m.via !== 'singular').map(
  (m) => ({
    kind: `fixture.chest_${m.id.replace(/^item\./, '')}`,
    type: 'chest',
    sprite: 'prop.chest',
    size: 12,
    loot: { items: [{ item: m.id, qty: 1 }] },
  }),
);

/** Every fixture kind. */
export const FIXTURES: Readonly<Record<string, FixtureDef>> = Object.fromEntries(
  [
    ...LIST,
    ...MANUAL_CHESTS,
    ...WEST_FIXTURES,
    ...SECRET_FIXTURES,
    ...BUILT_DUNGEONS.flatMap((d) => [...d.fixtures(), ...d.parts()]),
  ].map((f) => [f.kind, f]),
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
  /** Dark: everything but telegraphs is hidden until a torch is lit here or the avatar carries a lantern (M4-08). */
  dark?: true;
  /** Blocks that belong to an unsolved puzzle here go back to their start when the room is entered. */
  reset?: true;
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
