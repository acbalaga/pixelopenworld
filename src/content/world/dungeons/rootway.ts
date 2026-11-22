/**
 * The Rootway (POW-M4-21, regions/01-dawnmeadow section 8): Dawnmeadow's first cave. Light and
 * roots. Ten rooms on a grid of 32 tile cells under the region (chunk columns 4 to 6, rows 12 to
 * 15), each a walled stamp with its own portals. Two routes fork at R2: the Root Hall (fight, R3a)
 * and the Narrow Crawl (sneak, R3b). The dark gallery, the snare chamber, the stump puzzle with the
 * Root Key, a shortcut back to the mouth, the den and a secret behind a root wall follow.
 *
 * The data is the room graph the validator reads. `rootwayFixtures` and `rootwayRooms` turn it into
 * the portals, arrival markers and camera rooms the game needs, and `ROOTWAY_STAMPS` into the
 * stamps the region places.
 */
import type { FixtureDef, RoomDef } from '../fixtures';
import type { StampV2 } from '../../../sim/world/stamp';
import { CELL, defineDungeon, type RoomSpec } from './build';
import type { DungeonDef, DungeonEdge } from './types';

/** Where the Rootway's grid starts in the region (tiles). */
export const ROOTWAY_ORIGIN = { x: 4 * CELL, y: 12 * CELL } as const;
const ID = 'dungeon.rootway';

const column = (x: number, y0: number, y1: number): [number, number][] =>
  Array.from({ length: y1 - y0 + 1 }, (_v, i) => [x, y0 + i]);

const SPECS: readonly RoomSpec[] = [
  {
    id: 'r1',
    col: 0,
    row: 0,
    w: 16,
    h: 10,
    objects: [
      { x: 4, y: 3, kind: 'spawner.mossling' },
      { x: 11, y: 3, kind: 'spawner.mossling' },
    ],
    extra: { start: { x: 8, y: 6 } },
  },
  { id: 'r2', col: 1, row: 0, w: 14, h: 10 },
  {
    id: 'r3a',
    col: 2,
    row: 0,
    w: 18,
    h: 12,
    // A pillar to break the Spitbloom's line of sight.
    walls: [
      [8, 5],
      [9, 5],
      [8, 6],
      [9, 6],
    ],
    objects: [
      { x: 5, y: 3, kind: 'spawner.mossling' },
      { x: 5, y: 8, kind: 'spawner.mossling' },
      { x: 12, y: 8, kind: 'spawner.mossling' },
      { x: 15, y: 5, kind: 'spawner.spitbloom' },
    ],
  },
  {
    id: 'r3b',
    col: 1,
    row: 1,
    w: 18,
    h: 7,
    objects: [
      // The sleeping boar in the passage, and what lies past it: the patrol's satchel (the guard's
      // request) and the Hide manual.
      { x: 9, y: 3, kind: 'spawner.bramble_boar' },
      { x: 12, y: 5, kind: 'fixture.satchel' },
      { x: 15, y: 5, kind: 'fixture.chest_manual_hide' },
    ],
  },
  {
    id: 'r4',
    col: 2,
    row: 1,
    w: 20,
    h: 12,
    // Unlit: only telegraphs show until a torch is lit or a lantern is carried.
    objects: [
      { x: 6, y: 3, kind: 'spawner.rw_glowcap' },
      { x: 12, y: 8, kind: 'spawner.rw_glowcap' },
      { x: 15, y: 3, kind: 'spawner.rw_glowcap' },
      { x: 10, y: 2, kind: 'fixture.torch' },
    ],
    extra: { dark: true },
  },
  {
    id: 'r5',
    col: 2,
    row: 2,
    w: 16,
    h: 14,
    objects: [
      // The gate behind the player when they pass the threshold, and the waves it holds.
      ...[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((x) => ({
        x,
        y: 3,
        kind: 'fixture.rw_arena_door',
      })),
      { x: 8, y: 6, kind: 'fixture.rw_arena' },
    ],
  },
  {
    id: 'r6',
    col: 1,
    row: 2,
    w: 16,
    h: 12,
    // The Root Key alcove, shut behind two gates that two stumps open.
    walls: [...column(13, 1, 4), ...column(13, 7, 10)],
    objects: [
      { x: 4, y: 4, kind: 'fixture.rw_stump_a' },
      { x: 4, y: 7, kind: 'fixture.rw_stump_b' },
      { x: 10, y: 4, kind: 'fixture.rw_plate_a' },
      { x: 10, y: 7, kind: 'fixture.rw_plate_b' },
      { x: 13, y: 5, kind: 'fixture.rw_gate_a' },
      { x: 13, y: 6, kind: 'fixture.rw_gate_b' },
      { x: 3, y: 10, kind: 'fixture.reset_post' },
      { x: 14, y: 5, kind: 'fixture.rw_chest_key' },
    ],
    extra: { reset: true, keys: ['item.root_key'] },
  },
  {
    id: 'r7',
    col: 0,
    row: 1,
    w: 16,
    h: 10,
    // Two closets: the Den's door (locked) and the root wall of the secret (heavy hit).
    walls: [...column(7, 1, 3), ...column(9, 1, 3), ...column(13, 1, 3)],
    objects: [
      { x: 8, y: 3, kind: 'fixture.rw_door_den' },
      { x: 14, y: 3, kind: 'fixture.wall_heavy' },
      { x: 8, y: 5, kind: 'fixture.rest_point' },
      { x: 5, y: 2, kind: 'node.copper_vein' },
      { x: 11, y: 5, kind: 'node.iron_vein' },
    ],
  },
  {
    id: 'r8',
    col: 0,
    row: 2,
    w: 20,
    h: 14,
    objects: [
      { x: 10, y: 5, kind: 'spawner.rw_bramblehide' },
      { x: 18, y: 2, kind: 'fixture.rw_chest_den' },
    ],
  },
  {
    id: 'r9',
    col: 0,
    row: 3,
    w: 12,
    h: 8,
    objects: [
      { x: 8, y: 2, kind: 'fixture.chest_manual_palm' },
      { x: 10, y: 2, kind: 'fixture.rw_chest_heart' },
      // A fragment slot, empty (DM-F07). Lore arrives in M10.
      { x: 6, y: 5, kind: 'marker.fragment.dm_f07' },
    ],
  },
];

/** The edges, with the portal tile on each side. See the file comment for the routes. */
const EDGES: readonly DungeonEdge[] = [
  { from: 'r1', to: 'r2', kind: 'open', at: { x: 14, y: 4 }, arrive: { x: 1, y: 4 } },
  { from: 'r2', to: 'r3a', kind: 'open', at: { x: 12, y: 1 }, arrive: { x: 1, y: 10 } },
  { from: 'r2', to: 'r3b', kind: 'open', at: { x: 12, y: 8 }, arrive: { x: 1, y: 5 } },
  { from: 'r3a', to: 'r4', kind: 'open', at: { x: 16, y: 1 }, arrive: { x: 1, y: 1 } },
  {
    from: 'r3b',
    to: 'r4',
    kind: 'open',
    skill: 'skill.stealth',
    at: { x: 16, y: 1 },
    arrive: { x: 1, y: 10 },
  },
  { from: 'r4', to: 'r5', kind: 'open', at: { x: 18, y: 10 }, arrive: { x: 1, y: 1 } },
  { from: 'r5', to: 'r6', kind: 'open', at: { x: 14, y: 12 }, arrive: { x: 1, y: 10 } },
  { from: 'r6', to: 'r7', kind: 'open', at: { x: 1, y: 1 }, arrive: { x: 14, y: 8 } },
  { from: 'r7', to: 'r1', kind: 'shortcut', at: { x: 1, y: 8 }, arrive: { x: 3, y: 8 } },
  {
    from: 'r7',
    to: 'r8',
    kind: 'locked',
    key: 'item.root_key',
    at: { x: 8, y: 1 },
    arrive: { x: 1, y: 12 },
  },
  { from: 'r8', to: 'r1', kind: 'oneWay', at: { x: 18, y: 12 }, arrive: { x: 12, y: 8 } },
  {
    from: 'r7',
    to: 'r9',
    kind: 'open',
    skill: 'skill.heavy_arms',
    at: { x: 14, y: 1 },
    arrive: { x: 1, y: 6 },
  },
];

/** The region tile the outside mouth stands on, at the great oak on Hollow Downs. */
export const ROOTWAY_MOUTH = { x: 119, y: 250 } as const;

/** The fixture kinds of the rooms' own puzzles, doors, gates and chests. */
function partsList(): FixtureDef[] {
  const stump = (k: 'a' | 'b'): FixtureDef => ({
    kind: `fixture.rw_stump_${k}`,
    type: 'block',
    sprite: 'prop.block',
    size: 14,
    gate: `fixture.rw_gate_${k}`,
    room: `${ID}.r6`,
  });
  return [
    stump('a'),
    stump('b'),
    { kind: 'fixture.rw_plate_a', type: 'plate', sprite: 'prop.plate' },
    { kind: 'fixture.rw_plate_b', type: 'plate', sprite: 'prop.plate' },
    {
      kind: 'fixture.rw_gate_a',
      type: 'gate',
      sprite: 'prop.gate',
      size: 16,
      plate: 'fixture.rw_plate_a',
    },
    {
      kind: 'fixture.rw_gate_b',
      type: 'gate',
      sprite: 'prop.gate',
      size: 16,
      plate: 'fixture.rw_plate_b',
    },
    {
      kind: 'fixture.rw_chest_key',
      type: 'chest',
      dungeon: ID,
      sprite: 'prop.chest',
      size: 12,
      loot: { items: [{ item: 'item.root_key', qty: 1 }] },
    },
    {
      kind: 'fixture.rw_door_den',
      type: 'door',
      sprite: 'prop.door_locked',
      size: 16,
      key: 'item.root_key',
    },
    // The snare chamber: a gate behind the avatar, and what comes from the floor.
    {
      kind: 'fixture.rw_arena_door',
      type: 'gate',
      sprite: 'prop.gate',
      size: 16,
      arenaDoor: true,
    },
    {
      kind: 'fixture.rw_arena',
      type: 'arena',
      arena: {
        radius: 40,
        doors: ['fixture.rw_arena_door'],
        waves: [
          { creature: 'creature.root_grub', count: 3 },
          { creature: 'creature.bramble_boar', count: 1 },
        ],
      },
    },
    {
      kind: 'fixture.rw_chest_den',
      type: 'chest',
      dungeon: ID,
      sprite: 'prop.chest',
      size: 12,
      loot: { items: [{ item: 'item.herbed_skewer', qty: 2 }], coin: 60 },
      // Shut for anyone who fled past the boss to the drop.
      needsFlag: 'cleared:boss.old_bramblehide',
    },
    {
      kind: 'fixture.rw_chest_heart',
      type: 'chest',
      dungeon: ID,
      sprite: 'prop.chest',
      size: 12,
      loot: { items: [{ item: 'item.copper_ingot', qty: 3 }], coin: 40 },
    },
  ];
}

const D = defineDungeon({
  id: ID,
  prefix: 'rw',
  origin: ROOTWAY_ORIGIN,
  rooms: SPECS,
  edges: EDGES,
  mouth: {
    at: ROOTWAY_MOUTH,
    exit: { x: 8, y: 8 },
    kind: 'fixture.rootway_mouth',
    exitKind: 'fixture.rootway_exit',
  },
  def: {
    // Skills a character at this cave's tier has. Heavy Arms is for the secret only.
    skills: ['skill.stealth', 'skill.athletics', 'skill.heavy_arms'],
    entrance: 'r1',
    boss: 'boss.old_bramblehide',
    // The design's first-clear target for the target loadout is 12 to 18 minutes (regions/01).
    region: 'dawnmeadow',
    estMinutes: 15,
  },
  parts: partsList(),
});

export const ROOTWAY_BUILT = D;
export const ROOTWAY: DungeonDef = D.def;

/** Tile of a room's top left in the region. */
export const roomOrigin = D.roomOrigin;

/** Where a tile of a room is in the region. */
export const regionTile = D.regionTile;

/** The portal fixture that takes the avatar from room `from` into room `to`, as a Trial can name it. */
export const rootwayPortal = D.portal;

/** The id the avatar's room has while it stands in a Rootway room. */
export const rootwayRoomId = D.roomId;

/** Portals and arrival markers for every edge, the mouth and the exit, as fixtures. */
export const rootwayFixtures = D.fixtures;

/** The fixture kinds of the rooms' own puzzles, doors, gates and chests. */
export const rootwayParts = D.parts;

/** The camera rooms, in region tiles. */
export const rootwayRooms = (): RoomDef[] => D.rooms();

/** The room stamps, with each room's portals and markers added, by stamp id. */
export const ROOTWAY_STAMPS: readonly StampV2[] = D.stamps;

/** Where each room stamp goes, for the region spec. */
export const rootwayPlacements = D.placements;
