/**
 * Stonecrop Deeps (POW-M4-11, regions/01-dawnmeadow section 8): the old quarry galleries. Idea:
 * weight. Carts (blocks) press plates that open gates; a plate under the avatar or a Stone wall
 * holds a timed gate for a few seconds. Boss: the Foreman's Engine, a clockwork digger that adds
 * rail each phase. Non-combat: Tinkering 15 at the gear box jams it. Return secret: a sealed vein
 * that needs Mining 20 to open. 25 to 35 minutes.
 */
import type { FixtureDef } from '../fixtures';
import { defineDungeon, type RoomSpec } from './build';
import type { DungeonEdge } from './types';

const ID = 'dungeon.deeps';
export const DEEPS_ORIGIN = { x: 0, y: 12 * 32 } as const;
/** The way down: a mine mouth south of the quarry camp. */
export const DEEPS_MOUTH = { stamp: 'dg_mouth_arch', x: 175, y: 63 } as const;

const column = (x: number, y0: number, y1: number): [number, number][] =>
  Array.from({ length: y1 - y0 + 1 }, (_v, i) => [x, y0 + i]);
const row = (y: number, x0: number, x1: number): [number, number][] =>
  Array.from({ length: x1 - x0 + 1 }, (_v, i) => [x0 + i, y]);

const SPECS: readonly RoomSpec[] = [
  {
    id: 'd1',
    col: 0,
    row: 0,
    w: 16,
    h: 10,
    objects: [
      { x: 4, y: 3, kind: 'spawner.dg_rubblet' },
      { x: 11, y: 3, kind: 'spawner.dg_rubblet' },
    ],
    extra: { start: { x: 8, y: 6 } },
  },
  {
    // The cart hall: two carts, two plates, two gates.
    id: 'd2',
    col: 1,
    row: 0,
    w: 18,
    h: 12,
    walls: [...column(13, 1, 4), ...column(13, 7, 10)],
    objects: [
      { x: 4, y: 4, kind: 'fixture.sd_cart_a' },
      { x: 4, y: 7, kind: 'fixture.sd_cart_b' },
      { x: 10, y: 4, kind: 'fixture.sd_plate_a' },
      { x: 10, y: 7, kind: 'fixture.sd_plate_b' },
      { x: 13, y: 5, kind: 'fixture.sd_gate_a' },
      { x: 13, y: 6, kind: 'fixture.sd_gate_b' },
      { x: 7, y: 9, kind: 'spawner.dg_rubblet' },
    ],
    extra: { reset: true },
  },
  {
    // The weighing room: step on the plate (or wall it down) and the gate holds a while. The
    // sealed vein is in the nook at the south, behind a switch that wants Mining 20.
    id: 'd3',
    col: 2,
    row: 0,
    w: 18,
    h: 12,
    walls: [
      ...column(12, 1, 4),
      ...column(12, 7, 10),
      ...row(8, 5, 11),
      [5, 9],
      [5, 10],
      [11, 9],
      [11, 10],
    ],
    objects: [
      { x: 4, y: 5, kind: 'fixture.sd_plate_c' },
      { x: 12, y: 5, kind: 'fixture.sd_gate_c' },
      { x: 12, y: 6, kind: 'fixture.sd_gate_c' },
      { x: 8, y: 2, kind: 'fixture.sd_vein_switch' },
      { x: 8, y: 8, kind: 'fixture.sd_vein_gate' },
      { x: 8, y: 4, kind: 'spawner.dgp_rubblet' },
    ],
  },
  {
    id: 'd4',
    col: 3,
    row: 0,
    w: 14,
    h: 10,
    objects: [
      { x: 6, y: 3, kind: 'fixture.sd_chest_key' },
      { x: 9, y: 5, kind: 'spawner.dg_rubblet' },
      { x: 7, y: 6, kind: 'fixture.rest_point' },
    ],
    extra: { keys: ['item.foreman_key'] },
  },
  {
    id: 'd5',
    col: 0,
    row: 1,
    w: 22,
    h: 14,
    objects: [
      { x: 11, y: 6, kind: 'spawner.sd_engine' },
      { x: 18, y: 2, kind: 'fixture.sd_gear_jam' },
      { x: 19, y: 11, kind: 'fixture.sd_chest_den' },
    ],
  },
  {
    // The sealed vein.
    id: 'd6',
    col: 1,
    row: 1,
    w: 12,
    h: 8,
    objects: [
      { x: 6, y: 3, kind: 'fixture.sd_chest_vein' },
      // A fragment slot, empty (DM-F09). Lore arrives in M10.
      { x: 9, y: 5, kind: 'marker.fragment.dm_f09' },
      // The firebricks the camp kept here (the Cold Oven, M4-20).
      { x: 3, y: 5, kind: 'fixture.chest_firebrick' },
    ],
  },
];

const EDGES: readonly DungeonEdge[] = [
  { from: 'd1', to: 'd2', kind: 'open', at: { x: 14, y: 4 }, arrive: { x: 1, y: 4 } },
  { from: 'd2', to: 'd3', kind: 'open', at: { x: 16, y: 5 }, arrive: { x: 1, y: 5 } },
  { from: 'd3', to: 'd4', kind: 'open', at: { x: 15, y: 5 }, arrive: { x: 1, y: 4 } },
  {
    from: 'd4',
    to: 'd5',
    kind: 'locked',
    key: 'item.foreman_key',
    at: { x: 7, y: 8 },
    arrive: { x: 10, y: 1 },
  },
  { from: 'd5', to: 'd1', kind: 'oneWay', at: { x: 20, y: 12 }, arrive: { x: 8, y: 8 } },
  // The return visit: the sealed vein, behind a switch that needs Mining 20.
  {
    from: 'd3',
    to: 'd6',
    kind: 'open',
    skill: 'skill.mining',
    at: { x: 8, y: 10 },
    arrive: { x: 5, y: 1 },
  },
];

const chest = (
  kind: string,
  loot: NonNullable<FixtureDef['loot']>,
  extra: Partial<FixtureDef> = {},
): FixtureDef => ({
  kind,
  type: 'chest',
  dungeon: ID,
  sprite: 'prop.chest',
  size: 12,
  loot,
  ...extra,
});

const PARTS: FixtureDef[] = [
  ...(['a', 'b'] as const).flatMap((k): FixtureDef[] => [
    {
      kind: `fixture.sd_cart_${k}`,
      type: 'block',
      sprite: 'prop.block',
      size: 14,
      gate: `fixture.sd_gate_${k}`,
      room: `${ID}.d2`,
    },
    { kind: `fixture.sd_plate_${k}`, type: 'plate', sprite: 'prop.plate' },
    {
      kind: `fixture.sd_gate_${k}`,
      type: 'gate',
      sprite: 'prop.gate',
      size: 16,
      plate: `fixture.sd_plate_${k}`,
    },
  ]),
  // Held by a cart, the avatar, or a Stone wall. The gate stays open 15 seconds after it is released.
  {
    kind: 'fixture.sd_plate_c',
    type: 'plate',
    sprite: 'prop.plate',
    holds: ['avatar', 'block', 'wall'],
  },
  {
    kind: 'fixture.sd_gate_c',
    type: 'gate',
    sprite: 'prop.gate',
    size: 16,
    plate: 'fixture.sd_plate_c',
    holdTicks: 450,
  },
  {
    kind: 'fixture.sd_vein_switch',
    type: 'switch',
    sprite: 'prop.plate',
    size: 12,
    latch: true,
    needs: { skill: 'skill.mining', points: 20 },
  },
  {
    kind: 'fixture.sd_vein_gate',
    type: 'gate',
    sprite: 'prop.gate',
    size: 16,
    plate: 'fixture.sd_vein_switch',
  },
  {
    kind: 'fixture.sd_gear_jam',
    type: 'switch',
    sprite: 'prop.plate',
    size: 12,
    latch: true,
    needs: { skill: 'skill.tinkering', points: 15 },
  },
  chest('fixture.sd_chest_key', { items: [{ item: 'item.foreman_key', qty: 1 }] }),
  chest(
    'fixture.sd_chest_den',
    { items: [{ item: 'item.iron_ingot', qty: 3 }], coin: 100 },
    {
      needsFlag: 'cleared:boss.foremans_engine',
    },
  ),
  chest('fixture.sd_chest_vein', { items: [{ item: 'item.iron_ore', qty: 4 }], coin: 70 }),
];

export const DEEPS_BUILT = defineDungeon({
  id: ID,
  prefix: 'sd',
  origin: DEEPS_ORIGIN,
  rooms: SPECS,
  edges: EDGES,
  mouth: {
    at: { x: DEEPS_MOUTH.x + 1, y: DEEPS_MOUTH.y + 1 },
    exit: { x: 8, y: 8 },
    kind: 'fixture.sd_mouth',
    exitKind: 'fixture.sd_exit',
  },
  def: {
    skills: ['skill.mining', 'skill.tinkering'],
    entrance: 'd1',
    boss: 'boss.foremans_engine',
    region: 'dawnmeadow',
    estMinutes: 30,
  },
  parts: PARTS,
});
