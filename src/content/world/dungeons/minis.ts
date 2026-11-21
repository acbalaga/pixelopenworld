/**
 * Dawnmeadow's mini-dungeons (POW-M4-11, regions/01-dawnmeadow section 8): five to ten minutes each,
 * two or three small rooms, one idea. Rooms are 16 tile cells packed four to a chunk in the rock
 * under chunk columns 7 and 8, below the sea. Each has a mouth in the open world, an exit back to
 * it and a chest. Built with `defineDungeon`, so the validator reads the same graph the game runs.
 *
 * Ideas the framework has no rule for yet (tide, heat, a hermit's notes, a lamp that lights a path,
 * a fox that steals, Mending that lays the dead to rest, smoke that calms a hive) are kept for the
 * second batch, with the rules they need. Each mini here is its idea as far as the rules reach.
 */
import type { FixtureDef } from '../fixtures';
import { defineDungeon, type DoorSpec, type RoomSpec } from './build';
import { MOUTHS } from './mouths';
import { LANDING_SPOTS } from './west';
import type { DungeonEdge } from './types';

export const MINI_CELL = 16;
export const MINI_ORIGIN = { x: 7 * 32, y: 12 * 32 } as const;

const column = (x: number, y0: number, y1: number): [number, number][] =>
  Array.from({ length: y1 - y0 + 1 }, (_v, i) => [x, y0 + i]);
const row = (y: number, x0: number, x1: number): [number, number][] =>
  Array.from({ length: x1 - x0 + 1 }, (_v, i) => [x0 + i, y]);

const chest = (
  dungeon: string,
  kind: string,
  loot: NonNullable<FixtureDef['loot']>,
  extra: Partial<FixtureDef> = {},
): FixtureDef => ({
  kind,
  type: 'chest',
  dungeon,
  sprite: 'prop.chest',
  size: 12,
  loot,
  ...extra,
});

/** Two blocks, their plates and the gates the plates open: the pattern of the first cave's stump room. */
function blockPair(p: string, dungeon: string, room: string): FixtureDef[] {
  const out: FixtureDef[] = [];
  for (const k of ['a', 'b'] as const) {
    out.push(
      {
        kind: `fixture.${p}_blk_${k}`,
        type: 'block',
        sprite: 'prop.block',
        size: 14,
        gate: `fixture.${p}_gate_${k}`,
        room: `${dungeon}.${room}`,
      },
      { kind: `fixture.${p}_plate_${k}`, type: 'plate', sprite: 'prop.plate' },
      {
        kind: `fixture.${p}_gate_${k}`,
        type: 'gate',
        sprite: 'prop.gate',
        size: 16,
        plate: `fixture.${p}_plate_${k}`,
      },
    );
  }
  return out;
}

const open = (
  from: string,
  to: string,
  at: [number, number],
  arrive: [number, number],
  extra: Partial<DungeonEdge> = {},
): DungeonEdge => ({
  from,
  to,
  kind: 'open',
  at: { x: at[0], y: at[1] },
  arrive: { x: arrive[0], y: arrive[1] },
  ...extra,
});

interface MiniDef {
  /** `m1`. */
  n: string;
  rooms: readonly RoomSpec[];
  edges: readonly DungeonEdge[];
  parts?: readonly FixtureDef[];
  skills?: readonly string[];
  doors?: readonly DoorSpec[];
  /** First clear, in planning minutes. */
  minutes?: number;
  /** The tile in the entrance room that leads out. */
  exit: { x: number; y: number };
}

function mini(d: MiniDef) {
  const id = `dungeon.${d.n}`;
  const mouth = MOUTHS[d.n];
  if (!mouth) throw new Error(`no mouth for ${d.n}`);
  return defineDungeon({
    id,
    prefix: d.n,
    origin: MINI_ORIGIN,
    cell: MINI_CELL,
    rooms: d.rooms,
    edges: d.edges,
    mouth: {
      at: mouth.portal,
      exit: d.exit,
      kind: `fixture.${d.n}_mouth`,
      exitKind: `fixture.${d.n}_exit`,
    },
    def: {
      skills: d.skills ?? [],
      entrance: (d.rooms[0] as RoomSpec).id,
      region: 'dawnmeadow',
      estMinutes: d.minutes ?? 8,
      mini: true,
    },
    ...(d.doors ? { doors: d.doors } : {}),
    parts: d.parts ?? [],
  });
}

const room = (
  id: string,
  col: number,
  rowN: number,
  w: number,
  h: number,
  more: Partial<RoomSpec> = {},
): RoomSpec => ({ id, col, row: rowN, w, h, ...more });

// ---- m1 Inn Cellar: a grain rat swarm, and barrels that open the way on. ----
const M1 = 'dungeon.m1';
const m1 = mini({
  n: 'm1',
  exit: { x: 7, y: 8 },
  rooms: [
    room('c1', 0, 0, 14, 10, {
      // A closet at the east end, shut by two gates that two barrels open.
      walls: [...column(10, 1, 3), ...column(10, 6, 8)],
      objects: [
        { x: 4, y: 2, kind: 'spawner.dgp_grain_rat' },
        { x: 7, y: 5, kind: 'spawner.dgp_grain_rat' },
        { x: 3, y: 3, kind: 'fixture.m1_blk_a' },
        { x: 3, y: 6, kind: 'fixture.m1_blk_b' },
        { x: 8, y: 3, kind: 'fixture.m1_plate_a' },
        { x: 8, y: 6, kind: 'fixture.m1_plate_b' },
        { x: 10, y: 4, kind: 'fixture.m1_gate_a' },
        { x: 10, y: 5, kind: 'fixture.m1_gate_b' },
      ],
      extra: { start: { x: 7, y: 7 }, reset: true },
    }),
    room('c2', 1, 0, 12, 8, {
      objects: [
        { x: 6, y: 3, kind: 'fixture.chest_manual_road_songs' },
        { x: 9, y: 3, kind: 'fixture.m1_chest' },
      ],
    }),
  ],
  edges: [open('c1', 'c2', [12, 4], [1, 4])],
  parts: [
    ...blockPair('m1', M1, 'c1'),
    chest(M1, 'fixture.m1_chest', { items: [{ item: 'item.dish_bread', qty: 2 }], coin: 25 }),
  ],
});

// ---- m2 Badger Sett: burrows, a sleeping sett mother, and the back door west. ----
const M2 = 'dungeon.m2';
const m2 = mini({
  n: 'm2',
  exit: { x: 7, y: 8 },
  skills: ['skill.stealth'],
  minutes: 10,
  rooms: [
    room('s1', 2, 0, 14, 10, {
      objects: [
        { x: 4, y: 3, kind: 'spawner.dgp_burrow_mole' },
        { x: 10, y: 3, kind: 'spawner.dg_burrow_mole' },
      ],
      extra: { start: { x: 7, y: 7 } },
    }),
    room('s2', 3, 0, 14, 10, {
      // The sett mother sleeps in the passage to the back.
      objects: [
        { x: 7, y: 4, kind: 'spawner.dg_bramble_boar' },
        { x: 3, y: 6, kind: 'fixture.m2_chest' },
      ],
    }),
    room('s3', 3, 1, 10, 8, { objects: [{ x: 5, y: 3, kind: 'fixture.rest_point' }] }),
  ],
  edges: [
    open('s1', 's2', [12, 4], [1, 4]),
    // Past the sleeping mother: Stealth, or a fight.
    open('s2', 's3', [7, 8], [4, 1], { skill: 'skill.stealth' }),
  ],
  doors: [
    {
      room: 's3',
      tile: { x: 1, y: 3 },
      // The badger tunnels' far side: the closed yard on the west edge.
      at: LANDING_SPOTS.tunnel,
      kind: 'fixture.m2_back',
      outKind: 'fixture.m2_back_out',
    },
  ],
  parts: [
    chest(M2, 'fixture.m2_chest', { items: [{ item: 'item.herbed_skewer', qty: 1 }], coin: 30 }),
  ],
});

// ---- m3 Old Watchtower: three floors, one stair a floor. ----
const M3 = 'dungeon.m3';
const m3 = mini({
  n: 'm3',
  exit: { x: 5, y: 8 },
  rooms: [
    room('f1', 0, 1, 12, 10, {
      objects: [
        { x: 4, y: 3, kind: 'spawner.dg_thornling_scout' },
        { x: 8, y: 4, kind: 'spawner.dg_thornling_scout' },
      ],
      extra: { start: { x: 5, y: 7 } },
    }),
    room('f2', 0, 2, 12, 10, {
      walls: row(5, 1, 7),
      objects: [
        { x: 3, y: 3, kind: 'spawner.dgp_hedge_sparrow' },
        { x: 9, y: 7, kind: 'spawner.dg_thornling_scout' },
        // A crossbow trap across the stair: it hurts whatever stands in its line, creatures too.
        { x: 6, y: 7, kind: 'fixture.m3_bolt' },
      ],
    }),
    room('f3', 0, 3, 12, 8, {
      objects: [
        { x: 5, y: 3, kind: 'fixture.m3_chest' },
        { x: 8, y: 5, kind: 'fixture.rest_point' },
      ],
    }),
  ],
  edges: [open('f1', 'f2', [10, 1], [10, 8]), open('f2', 'f3', [1, 1], [1, 6])],
  parts: [
    {
      kind: 'fixture.m3_bolt',
      type: 'vent',
      sprite: 'prop.plate',
      vent: { radius: 30, telegraph: 40, active: 6, period: 120, damage: 35, all: true },
    },
    chest(M3, 'fixture.m3_chest', { items: [{ item: 'item.copper_ingot', qty: 2 }], coin: 35 }),
  ],
});

// ---- m5 Drowned Chapel Crypt: dark, with the bones of the parish in it. ----
const M5 = 'dungeon.m5';
const m5 = mini({
  n: 'm5',
  exit: { x: 7, y: 8 },
  rooms: [
    room('k1', 1, 1, 14, 10, {
      objects: [
        { x: 3, y: 3, kind: 'spawner.dg_barrow_bones' },
        { x: 10, y: 5, kind: 'spawner.dg_barrow_bones' },
        { x: 7, y: 2, kind: 'fixture.torch' },
      ],
      extra: { dark: true, start: { x: 7, y: 7 } },
    }),
    room('k2', 1, 2, 12, 10, {
      objects: [
        { x: 3, y: 4, kind: 'spawner.dg_barrow_bones' },
        { x: 8, y: 4, kind: 'spawner.dg_barrow_bones' },
        { x: 6, y: 7, kind: 'fixture.m5_chest' },
        // A fragment slot, empty (DM-F05). Lore arrives in M10.
        { x: 10, y: 2, kind: 'marker.fragment.dm_f05' },
      ],
      extra: { dark: true },
    }),
  ],
  edges: [open('k1', 'k2', [11, 8], [10, 1])],
  parts: [
    chest(M5, 'fixture.m5_chest', { items: [{ item: 'item.dish_bread', qty: 1 }], coin: 45 }),
  ],
});

// ---- m6 Fox Hollow: a maze of dens. ----
const M6 = 'dungeon.m6';
const m6 = mini({
  n: 'm6',
  exit: { x: 7, y: 8 },
  rooms: [
    room('h1', 2, 1, 14, 10, {
      walls: [...row(4, 1, 8), ...row(6, 5, 12)],
      objects: [{ x: 11, y: 2, kind: 'spawner.dg_fox' }],
      extra: { start: { x: 7, y: 7 } },
    }),
    room('h2', 2, 2, 14, 10, {
      walls: [...column(5, 1, 6), ...column(9, 3, 8)],
      objects: [
        { x: 3, y: 4, kind: 'spawner.dg_fox' },
        { x: 12, y: 6, kind: 'spawner.dg_fox' },
      ],
    }),
    room('h3', 2, 3, 12, 8, {
      objects: [
        { x: 6, y: 3, kind: 'fixture.m6_chest' },
        { x: 3, y: 5, kind: 'spawner.dg_fox' },
      ],
    }),
  ],
  edges: [open('h1', 'h2', [2, 1], [2, 8]), open('h2', 'h3', [12, 1], [10, 6])],
  parts: [chest(M6, 'fixture.m6_chest', { items: [{ item: 'item.raw_meat', qty: 2 }], coin: 30 })],
});

// ---- m7 The Sinkhole: two drops and a rope. ----
const M7 = 'dungeon.m7';
const m7 = mini({
  n: 'm7',
  exit: { x: 7, y: 8 },
  rooms: [
    room('p1', 3, 2, 14, 10, {
      objects: [{ x: 4, y: 3, kind: 'spawner.dg_burrow_mole' }],
      extra: { start: { x: 7, y: 7 } },
    }),
    room('p2', 3, 3, 14, 10, { objects: [{ x: 9, y: 4, kind: 'spawner.dgp_rubblet' }] }),
    room('p3', 3, 4, 12, 10, {
      objects: [
        { x: 5, y: 3, kind: 'fixture.m7_chest' },
        { x: 8, y: 6, kind: 'spawner.dg_rubblet' },
      ],
    }),
  ],
  edges: [
    { ...open('p1', 'p2', [7, 3], [7, 3]), kind: 'oneWay' },
    { ...open('p2', 'p3', [10, 6], [6, 3]), kind: 'oneWay' },
    // A rope, found at the bottom, that goes back up to the first room's ledge.
    { ...open('p3', 'p1', [1, 8], [12, 5]), kind: 'shortcut' },
  ],
  parts: [chest(M7, 'fixture.m7_chest', { items: [{ item: 'item.coal', qty: 3 }], coin: 30 })],
});

// ---- m10 Shepherd's Barrow: plates, and an urn that wakes the guardian. ----
const M10 = 'dungeon.m10';
const m10 = mini({
  n: 'm10',
  exit: { x: 7, y: 8 },
  rooms: [
    room('b1', 1, 3, 14, 10, {
      objects: [{ x: 5, y: 3, kind: 'spawner.dg_barrow_bones' }],
      extra: { start: { x: 7, y: 7 } },
    }),
    room('b2', 0, 4, 12, 10, {
      objects: [
        // The urn. Taking what is in it wakes what lies with it.
        { x: 6, y: 4, kind: 'fixture.m10_urn' },
        { x: 10, y: 3, kind: 'marker.fragment.dm_f06' },
      ],
    }),
  ],
  edges: [open('b1', 'b2', [12, 4], [1, 4])],
  parts: [
    chest(
      M10,
      'fixture.m10_urn',
      { items: [{ item: 'item.copper_ingot', qty: 2 }], coin: 50 },
      { wakes: { creature: 'creature.barrow_bones', count: 2 } },
    ),
  ],
});

// ---- m11 Hive Hill: wasps. ----
const M11 = 'dungeon.m11';
const m11 = mini({
  n: 'm11',
  exit: { x: 7, y: 8 },
  rooms: [
    room('v1', 1, 4, 14, 10, {
      objects: [
        { x: 3, y: 3, kind: 'spawner.dgp_thistle_wasp' },
        { x: 10, y: 5, kind: 'spawner.dgp_thistle_wasp' },
      ],
      extra: { start: { x: 7, y: 7 } },
    }),
    room('v2', 2, 4, 12, 10, {
      objects: [
        { x: 4, y: 3, kind: 'spawner.dgp_thistle_wasp' },
        { x: 6, y: 6, kind: 'fixture.m11_chest' },
      ],
    }),
  ],
  edges: [open('v1', 'v2', [12, 4], [1, 4])],
  parts: [
    chest(M11, 'fixture.m11_chest', { items: [{ item: 'item.honey_cake', qty: 2 }], coin: 25 }),
  ],
});

// ---- m4 Smugglers' Cove: a cave that floods twice a day. The inner gate is open only at low tide. ----
const M4 = 'dungeon.m4';
const m4 = mini({
  n: 'm4',
  exit: { x: 7, y: 8 },
  rooms: [
    room('cv1', 0, 5, 14, 10, {
      // A closet at the east end behind the tide gate.
      walls: [...column(10, 1, 3), ...column(10, 5, 8)],
      objects: [
        { x: 4, y: 3, kind: 'spawner.dgp_reed_crab' },
        { x: 10, y: 4, kind: 'fixture.m4_tide_gate' },
      ],
      extra: { start: { x: 7, y: 7 } },
    }),
    room('cv2', 1, 5, 12, 10, {
      objects: [
        { x: 4, y: 4, kind: 'spawner.dg_marsh_leech' },
        { x: 8, y: 6, kind: 'spawner.dg_reed_crab' },
        { x: 6, y: 3, kind: 'fixture.m4_chest' },
      ],
    }),
  ],
  edges: [open('cv1', 'cv2', [12, 4], [1, 4])],
  parts: [
    {
      kind: 'fixture.m4_tide_gate',
      type: 'gate',
      sprite: 'prop.gate',
      size: 16,
      tide: 'low',
    },
    chest(M4, 'fixture.m4_chest', { items: [{ item: 'item.fish_river', qty: 2 }], coin: 40 }),
  ],
});

// ---- m8 Abandoned Kiln: vents that burst on a cycle. ----
const M8 = 'dungeon.m8';
const vent = (kind: string): FixtureDef => ({
  kind,
  type: 'vent',
  sprite: 'prop.plate',
  vent: { radius: 36, telegraph: 45, active: 12, period: 150, damage: 40 },
});
const m8 = mini({
  n: 'm8',
  exit: { x: 7, y: 8 },
  rooms: [
    room('kn1', 3, 5, 14, 10, {
      objects: [
        { x: 4, y: 3, kind: 'spawner.dg_rubblet' },
        { x: 6, y: 5, kind: 'fixture.m8_vent' },
        { x: 9, y: 4, kind: 'fixture.m8_vent' },
      ],
      extra: { start: { x: 7, y: 7 } },
    }),
    room('kn2', 0, 6, 14, 10, {
      objects: [
        { x: 5, y: 3, kind: 'fixture.m8_vent' },
        { x: 8, y: 5, kind: 'fixture.m8_vent' },
        { x: 10, y: 3, kind: 'spawner.dgp_rubblet' },
        { x: 11, y: 7, kind: 'fixture.m8_chest' },
      ],
    }),
  ],
  edges: [open('kn1', 'kn2', [12, 4], [1, 4])],
  parts: [
    vent('fixture.m8_vent'),
    chest(M8, 'fixture.m8_chest', { items: [{ item: 'item.coal', qty: 4 }], coin: 40 }),
  ],
});

// ---- m9 Hermit's Well: rings going down, and a hermit's notes on the way (Deciphering). ----
const M9 = 'dungeon.m9';
const m9 = mini({
  n: 'm9',
  exit: { x: 7, y: 8 },
  rooms: [
    room('w1', 1, 6, 14, 10, {
      objects: [
        { x: 3, y: 3, kind: 'fixture.m9_note_a' },
        { x: 10, y: 5, kind: 'spawner.dg_moor_wisp' },
      ],
      extra: { start: { x: 7, y: 7 } },
    }),
    room('w2', 2, 6, 12, 10, {
      objects: [
        { x: 3, y: 3, kind: 'fixture.m9_note_b' },
        { x: 8, y: 5, kind: 'spawner.dg_moor_wisp' },
        { x: 9, y: 3, kind: 'fixture.m9_note_c' },
      ],
    }),
    room('w3', 3, 6, 10, 8, {
      objects: [
        { x: 5, y: 3, kind: 'fixture.m9_chest' },
        { x: 3, y: 3, kind: 'fixture.m9_note_d' },
        // A fragment slot, empty (DM-F13). Lore arrives in M10.
        { x: 7, y: 5, kind: 'marker.fragment.dm_f13' },
      ],
    }),
  ],
  edges: [open('w1', 'w2', [12, 4], [1, 4]), open('w2', 'w3', [10, 6], [1, 4])],
  minutes: 10,
  parts: [
    ...['a', 'b', 'c', 'd'].map((k): FixtureDef => ({
      kind: `fixture.m9_note_${k}`,
      type: 'tablet',
      sprite: 'prop.tablet',
      size: 12,
    })),
    chest(M9, 'fixture.m9_chest', { items: [{ item: 'item.herbed_skewer', qty: 2 }], coin: 45 }),
  ],
});

// ---- m12 Lamp Tower: the way up is dark until the lamp at the top is lit. ----
const M12 = 'dungeon.m12';
const m12 = mini({
  n: 'm12',
  exit: { x: 5, y: 8 },
  rooms: [
    room('l1', 0, 7, 12, 10, {
      objects: [{ x: 4, y: 3, kind: 'spawner.dg_crag_hawk' }],
      extra: { start: { x: 5, y: 7 } },
    }),
    room('l2', 1, 7, 12, 10, {
      objects: [
        { x: 6, y: 2, kind: 'fixture.torch' },
        { x: 4, y: 5, kind: 'spawner.dg_thornling_scout' },
        { x: 9, y: 6, kind: 'fixture.m12_chest' },
      ],
      extra: { dark: true },
    }),
  ],
  edges: [open('l1', 'l2', [10, 1], [10, 8])],
  parts: [
    chest(M12, 'fixture.m12_chest', { items: [{ item: 'item.lantern_oil', qty: 2 }], coin: 40 }),
  ],
});

/** The mini-dungeons so far. */
export const MINIS = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12] as const;
