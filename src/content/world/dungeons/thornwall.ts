/**
 * Thornwall Pass (POW-M4-11, regions/01-dawnmeadow section 8): the briar-choked gorge and ruined
 * keep that are the road west. Idea: cutting and growing. A briar wall is cut (Heavy Arms), burnt
 * (Ember), or the withered root beside it is grown aside (Mending). Rooms: the gorge mouth, the
 * briar walk, the keep hall with the carving of the bell order, the bell wall (three ledges up,
 * Athletics 20), the Warden's grove, the way out (shut behind a slab until the Warden is down or
 * asleep) and the keep's upper room, which only the Fernside climb reaches from outside.
 * Boss: the Hedge Warden. Non-combat: the Keeper's Bells in order, then a song at its root
 * (Performance 30). 3 to 5 minutes at par; 25 to 35 for a first clear.
 */
import type { FixtureDef } from '../fixtures';
import { defineDungeon, type RoomSpec } from './build';
import type { DungeonEdge } from './types';
import { LANDING_SPOTS } from './west';

const ID = 'dungeon.thornwall';
export const THORNWALL_ORIGIN = { x: 0, y: 14 * 32 } as const;
/** The gorge mouth, at the west end of the road. */
export const THORNWALL_MOUTH = { stamp: 'dg_mouth_arch', x: 26, y: 152 } as const;
/** The door from the Fernside climb into the keep's upper room (a tile of the climb, region tiles). */
export const KEEP_DOOR = { x: 49, y: 109 } as const;

const column = (x: number, y0: number, y1: number): [number, number][] =>
  Array.from({ length: y1 - y0 + 1 }, (_v, i) => [x, y0 + i]);
const ledgeRow = (y: number, kind: string) =>
  Array.from({ length: 16 }, (_v, i) => ({ x: i + 1, y, kind }));

const SPECS: readonly RoomSpec[] = [
  {
    id: 't1',
    col: 0,
    row: 0,
    w: 16,
    h: 10,
    objects: [
      { x: 4, y: 3, kind: 'spawner.dg_thornling_scout' },
      { x: 11, y: 3, kind: 'spawner.dg_thornling_scout' },
    ],
    extra: { start: { x: 8, y: 6 } },
  },
  {
    // The briar walk: a wall of briar across the way, cut or burnt; and a withered root in the
    // same wall that Mending grows aside.
    id: 't2',
    col: 1,
    row: 0,
    w: 18,
    h: 12,
    walls: [...column(9, 1, 1), ...column(9, 3, 4), ...column(9, 7, 10)],
    objects: [
      { x: 9, y: 2, kind: 'fixture.tw_vine' },
      { x: 9, y: 5, kind: 'fixture.tw_briar' },
      { x: 9, y: 6, kind: 'fixture.tw_briar' },
      { x: 4, y: 4, kind: 'spawner.dg_thornling_scout' },
      { x: 13, y: 8, kind: 'spawner.dg_thornling_scout' },
    ],
  },
  {
    // The keep hall: the carving of the bell order.
    id: 't3',
    col: 2,
    row: 0,
    w: 18,
    h: 12,
    objects: [
      { x: 9, y: 2, kind: 'fixture.tw_order' },
      { x: 5, y: 6, kind: 'spawner.dg_thornling_scout' },
      { x: 12, y: 6, kind: 'spawner.dgp_hedge_sparrow' },
      { x: 14, y: 9, kind: 'fixture.rest_point' },
    ],
  },
  {
    // The bell wall: two rows of ledges, then the bells. Arrive from the south.
    id: 't4',
    col: 3,
    row: 0,
    w: 18,
    h: 12,
    objects: [
      ...ledgeRow(8, 'fixture.tw_ledge'),
      ...ledgeRow(5, 'fixture.tw_ledge'),
      { x: 4, y: 2, kind: 'fixture.tw_bell_1' },
      { x: 9, y: 2, kind: 'fixture.tw_bell_2' },
      { x: 14, y: 2, kind: 'fixture.tw_bell_3' },
    ],
  },
  {
    // The Warden's grove: the Warden, the bloom, the root.
    id: 't5',
    col: 0,
    row: 1,
    w: 22,
    h: 14,
    objects: [
      { x: 11, y: 6, kind: 'spawner.tw_warden' },
      { x: 17, y: 10, kind: 'fixture.tw_bloom' },
      { x: 11, y: 11, kind: 'fixture.tw_root' },
      { x: 19, y: 2, kind: 'fixture.tw_chest_grove' },
    ],
  },
  {
    // The way out, shut behind a slab until the Warden is down.
    id: 't6',
    col: 1,
    row: 1,
    w: 12,
    h: 8,
    objects: [],
  },
  {
    // The keep's upper room, reached from the Fernside climb only.
    id: 't7',
    col: 2,
    row: 1,
    w: 12,
    h: 8,
    objects: [
      { x: 6, y: 3, kind: 'fixture.tw_chest_keep' },
      // A fragment slot, empty (DM-F10). Lore arrives in M10.
      { x: 9, y: 5, kind: 'marker.fragment.dm_f10' },
    ],
    extra: { outsideOnly: true },
  },
];

const EDGES: readonly DungeonEdge[] = [
  { from: 't1', to: 't2', kind: 'open', at: { x: 14, y: 4 }, arrive: { x: 1, y: 4 } },
  // The briar wall in the middle of t2 stands between the way in and the way on.
  { from: 't2', to: 't3', kind: 'open', at: { x: 16, y: 5 }, arrive: { x: 1, y: 5 } },
  { from: 't3', to: 't4', kind: 'open', at: { x: 16, y: 10 }, arrive: { x: 9, y: 10 } },
  { from: 't3', to: 't5', kind: 'open', at: { x: 9, y: 10 }, arrive: { x: 10, y: 1 } },
  { from: 't5', to: 't6', kind: 'open', at: { x: 20, y: 12 }, arrive: { x: 1, y: 4 } },
];

const chest = (kind: string, loot: NonNullable<FixtureDef['loot']>): FixtureDef => ({
  kind,
  type: 'chest',
  dungeon: ID,
  sprite: 'prop.chest',
  size: 12,
  loot,
});

const PARTS: FixtureDef[] = [
  // Briar: cut by a heavy swing or burnt by Ember.
  {
    kind: 'fixture.tw_briar',
    type: 'breakable',
    sprite: 'prop.brush_wall',
    size: 16,
    breaksBy: ['heavy', 'ember'],
  },
  // A withered root in the briar wall: Mending grows it aside.
  {
    kind: 'fixture.tw_vine',
    type: 'element',
    sprite: 'prop.withered_vine',
    size: 16,
    onElement: { mending: 'grow' },
  },
  // The bloom of the Warden's last phase: burnt or cut.
  {
    kind: 'fixture.tw_bloom',
    type: 'breakable',
    sprite: 'prop.brush_wall',
    size: 16,
    breaksBy: ['heavy', 'ember'],
  },
  // The ledges of the bell wall: Athletics 20.
  {
    kind: 'fixture.tw_ledge',
    type: 'ledge',
    sprite: 'prop.block',
    size: 12,
    climb: { skill: 'skill.athletics', points: 20, stamina: 30 },
  },
  // The carving of the bell order (read it: three marks, left, middle or right).
  { kind: 'fixture.tw_order', type: 'tablet', sprite: 'prop.tablet', size: 12 },
  // The Warden's root: the song is Performance 30.
  {
    kind: 'fixture.tw_root',
    type: 'switch',
    sprite: 'prop.plate',
    size: 12,
    latch: true,
    needs: { skill: 'skill.performance', points: 30 },
  },
  chest('fixture.tw_chest_grove', { items: [{ item: 'item.ash_plank', qty: 4 }], coin: 120 }),
  chest('fixture.tw_chest_keep', { items: [{ item: 'item.iron_ingot', qty: 3 }], coin: 80 }),
];

export const THORNWALL_BUILT = defineDungeon({
  id: ID,
  prefix: 'tw',
  origin: THORNWALL_ORIGIN,
  rooms: SPECS,
  edges: EDGES,
  mouth: {
    at: { x: THORNWALL_MOUTH.x + 1, y: THORNWALL_MOUTH.y + 1 },
    exit: { x: 8, y: 8 },
    kind: 'fixture.tw_mouth',
    exitKind: 'fixture.tw_exit',
  },
  def: {
    // Heavy Arms or Mending for the briar, Athletics for the bells. Performance is for the sleep.
    skills: ['skill.heavy_arms', 'skill.athletics'],
    entrance: 't1',
    boss: 'boss.hedge_warden',
    region: 'dawnmeadow',
    estMinutes: 30,
  },
  doors: [
    {
      // The way out, west, into the closed yard: shut until the Warden is down or asleep.
      room: 't6',
      tile: { x: 5, y: 4 },
      at: LANDING_SPOTS.pass,
      kind: 'fixture.tw_out',
      outKind: 'fixture.wl_pass',
      unlockedBy: 'creature.hedge_warden',
    },
    {
      // From the Fernside climb into the keep's upper room.
      room: 't7',
      tile: { x: 1, y: 3 },
      at: KEEP_DOOR,
      kind: 'fixture.tw_keep',
      outKind: 'fixture.fc_keep',
    },
  ],
  parts: PARTS,
});
