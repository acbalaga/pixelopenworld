/**
 * The Undermill (POW-M4-11, regions/01-dawnmeadow section 8): the old works under Millbrook's mill.
 * Idea: water level. Each sluice wheel sets the level of the rooms it serves. Low water (a wheel
 * thrown) opens low gates and shuts high ones. A Tide hit fills a basin, which holds a high gate
 * open whatever the wheel says. Rooms: the entry, the wheel hall with a sunken alcove, the sluice
 * gallery, the key room, the channel where the Millrace Eel lives, and a drained cistern behind a
 * seeping wall that a Tide hit bursts (return visit). 25 to 35 minutes.
 */
import type { FixtureDef } from '../fixtures';
import { defineDungeon, type RoomSpec } from './build';
import type { DungeonEdge } from './types';

const ID = 'dungeon.undermill';
export const UNDERMILL_ORIGIN = { x: 9 * 32, y: 12 * 32 } as const;
/** Where it opens: the old sluice door below Millbrook's mill, on the path to the south. */
export const UNDERMILL_MOUTH = { stamp: 'dg_mouth_arch', x: 284, y: 129 } as const;

const column = (x: number, y0: number, y1: number): [number, number][] =>
  Array.from({ length: y1 - y0 + 1 }, (_v, i) => [x, y0 + i]);

const SPECS: readonly RoomSpec[] = [
  {
    id: 'u1',
    col: 0,
    row: 0,
    w: 16,
    h: 10,
    objects: [
      { x: 4, y: 3, kind: 'spawner.dg_reed_crab' },
      { x: 11, y: 3, kind: 'spawner.dg_reed_crab' },
    ],
    extra: { start: { x: 8, y: 6 } },
  },
  {
    // The wheel hall: sluice A, the low gate east, and a sunken alcove west that is open at high
    // water or while its basin is full.
    id: 'u2',
    col: 1,
    row: 0,
    w: 18,
    h: 12,
    walls: [...column(14, 1, 4), ...column(14, 7, 10), ...column(5, 1, 4), ...column(5, 7, 10)],
    objects: [
      { x: 9, y: 2, kind: 'fixture.um_sluice_a' },
      { x: 14, y: 5, kind: 'fixture.um_gate_low_a' },
      { x: 14, y: 6, kind: 'fixture.um_gate_low_a' },
      { x: 5, y: 5, kind: 'fixture.um_gate_high_a' },
      { x: 5, y: 6, kind: 'fixture.um_gate_high_a' },
      { x: 2, y: 5, kind: 'fixture.um_chest_a' },
      { x: 8, y: 9, kind: 'fixture.um_basin' },
      { x: 10, y: 6, kind: 'spawner.dg_marsh_leech' },
    ],
  },
  {
    // The sluice gallery: sluice B, the low gate to the key room, and the seeping wall.
    id: 'u3',
    col: 2,
    row: 0,
    w: 18,
    h: 12,
    walls: [...column(10, 1, 4), ...column(10, 7, 10)],
    objects: [
      { x: 4, y: 3, kind: 'fixture.um_sluice_b' },
      { x: 10, y: 5, kind: 'fixture.um_gate_low_b' },
      { x: 10, y: 6, kind: 'fixture.um_gate_low_b' },
      { x: 6, y: 8, kind: 'spawner.dgp_reed_crab' },
      { x: 5, y: 2, kind: 'fixture.um_seep_wall' },
    ],
  },
  {
    id: 'u4',
    col: 0,
    row: 1,
    w: 14,
    h: 10,
    objects: [
      { x: 6, y: 3, kind: 'fixture.um_chest_key' },
      { x: 9, y: 5, kind: 'spawner.dg_reed_crab' },
      { x: 7, y: 6, kind: 'fixture.rest_point' },
    ],
    extra: { keys: ['item.mill_key'] },
  },
  {
    // The channel: the Eel, and the two sluices that fight it or keep it out.
    id: 'u5',
    col: 1,
    row: 1,
    w: 22,
    h: 14,
    objects: [
      { x: 11, y: 6, kind: 'spawner.um_eel' },
      { x: 3, y: 2, kind: 'fixture.um_sluice_c' },
      { x: 18, y: 2, kind: 'fixture.um_sluice_d' },
      { x: 19, y: 11, kind: 'fixture.um_chest_den' },
    ],
  },
  {
    // The drained cistern, behind the seeping wall.
    id: 'u6',
    col: 2,
    row: 1,
    w: 12,
    h: 8,
    objects: [
      { x: 6, y: 3, kind: 'fixture.um_chest_cistern' },
      // A fragment slot, empty (DM-F08). Lore arrives in M10.
      { x: 9, y: 5, kind: 'marker.fragment.dm_f08' },
      // The firebricks the baker left (the Cold Oven, M4-20).
      { x: 3, y: 5, kind: 'fixture.chest_firebrick' },
    ],
  },
];

const EDGES: readonly DungeonEdge[] = [
  { from: 'u1', to: 'u2', kind: 'open', at: { x: 14, y: 4 }, arrive: { x: 1, y: 4 } },
  { from: 'u2', to: 'u3', kind: 'open', at: { x: 16, y: 5 }, arrive: { x: 1, y: 5 } },
  { from: 'u3', to: 'u4', kind: 'open', at: { x: 12, y: 5 }, arrive: { x: 1, y: 4 } },
  {
    from: 'u4',
    to: 'u5',
    kind: 'locked',
    key: 'item.mill_key',
    at: { x: 7, y: 8 },
    arrive: { x: 10, y: 1 },
  },
  { from: 'u5', to: 'u1', kind: 'oneWay', at: { x: 20, y: 12 }, arrive: { x: 8, y: 8 } },
  // The return visit: a Tide hit on the seeping wall.
  {
    from: 'u3',
    to: 'u6',
    kind: 'open',
    skill: 'skill.tide',
    at: { x: 5, y: 1 },
    arrive: { x: 5, y: 1 },
  },
];

const switchPart = (kind: string): FixtureDef => ({
  kind,
  type: 'switch',
  sprite: 'prop.plate',
  size: 12,
});
const gate = (kind: string, sluice: string, when: 'low' | 'high', basin?: string): FixtureDef => ({
  kind,
  type: 'gate',
  sprite: 'prop.gate',
  size: 16,
  water: { sluice, when, ...(basin ? { basin } : {}) },
});
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
  switchPart('fixture.um_sluice_a'),
  switchPart('fixture.um_sluice_b'),
  switchPart('fixture.um_sluice_c'),
  switchPart('fixture.um_sluice_d'),
  gate('fixture.um_gate_low_a', 'fixture.um_sluice_a', 'low'),
  gate('fixture.um_gate_high_a', 'fixture.um_sluice_a', 'high', 'fixture.um_basin'),
  gate('fixture.um_gate_low_b', 'fixture.um_sluice_b', 'low'),
  // A basin: a Tide hit fills it and it stays full.
  {
    kind: 'fixture.um_basin',
    type: 'element',
    sprite: 'prop.fire_barrier',
    size: 16,
    onElement: { tide: 'open' },
  },
  {
    kind: 'fixture.um_seep_wall',
    type: 'breakable',
    sprite: 'prop.brush_wall',
    size: 16,
    breaksBy: ['tide'],
  },
  chest('fixture.um_chest_a', { items: [{ item: 'item.clay', qty: 3 }], coin: 30 }),
  chest('fixture.um_chest_key', { items: [{ item: 'item.mill_key', qty: 1 }] }),
  chest(
    'fixture.um_chest_den',
    { items: [{ item: 'item.fish_river', qty: 3 }], coin: 90 },
    {
      needsFlag: 'cleared:boss.millrace_eel',
    },
  ),
  chest('fixture.um_chest_cistern', { items: [{ item: 'item.copper_ingot', qty: 3 }], coin: 60 }),
];

export const UNDERMILL_BUILT = defineDungeon({
  id: ID,
  prefix: 'um',
  origin: UNDERMILL_ORIGIN,
  rooms: SPECS,
  edges: EDGES,
  mouth: {
    at: { x: UNDERMILL_MOUTH.x + 1, y: UNDERMILL_MOUTH.y + 1 },
    exit: { x: 8, y: 8 },
    kind: 'fixture.um_mouth',
    exitKind: 'fixture.um_exit',
  },
  def: {
    // Tide is for the return visit only.
    skills: ['skill.tide'],
    entrance: 'u1',
    boss: 'boss.millrace_eel',
    region: 'dawnmeadow',
    estMinutes: 35,
  },
  parts: PARTS,
});
