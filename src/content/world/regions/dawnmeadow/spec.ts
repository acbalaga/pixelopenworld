import { DAWNMEADOW_POIS, poiChest } from '../../../pois/dawnmeadow';
import { PLACED_SIGNS, signKind } from '../../../pois/signs';
import { BEE_DOOR, DUNGEON_SECRETS, REGION_SECRETS } from '../../../pois/secrets';
import { FRAGMENT_SLOTS, fragmentMarker } from '../../../pois/fragments';
import { DAWNMEADOW_PENDING_DISCOVERABLES } from '../../../pois/pending';
import { DAWNMEADOW_CLUSTERS } from './clusters';
import { MOUTHS } from '../../dungeons/mouths';
import { THORNWALL_MOUTH } from '../../dungeons/thornwall';
import { DEEPS_MOUTH } from '../../dungeons/deeps';
import { UNDERMILL_MOUTH } from '../../dungeons/undermill';
import { CLIMB_TOP, LANDING, LANDING_SPOTS } from '../../dungeons/west';
import { BUILT_DUNGEONS } from '../../dungeons/registry';
import { HEARTHFORD_SIZE, TOWN_PARTS } from '../../stamps/hearthford';
import { DAWNMEADOW_WAKE_POINTS, WAKE_IDS } from '../../wake';
import { WAYSTONES } from '../../waystones';
import type { District, Placement, RegionSpec, SpawnZone } from '../types';

/*
 * Dawnmeadow (POW-M4-04, regions/01-dawnmeadow). 12 x 12 chunks. This file is authoritative for
 * coordinates; the region doc is authoritative for intent, names and counts.
 */

/** The map sketch: one letter per chunk (regions/01 section 2). */
const CHUNKS = [
  '^^^^^^^^^^^^',
  'CCCssSssr^^^',
  'CCcsssssrm^^',
  'FFcdddsrMmm~',
  'TFFddhhrmmmE',
  'TFFdhHHrmmmE',
  'TFddhHHrmmRE',
  'FFdddhhrrRRE',
  'FdddddddrRR~',
  '~ddddddrRR~~',
  '~~dd~~~RR~~~',
  '~~~~~~~~~~~~',
];

/**
 * Spawn zones by sketch letter (regions/01 section 3). Settlements (H, M, S), the river, the pass,
 * the coast road, the cliffs and the sea have none.
 */
const ZONE_OF: Record<string, { id: string; roster: string }> = {
  h: { id: 'commons', roster: 'roster.dm_commons' },
  m: { id: 'millbrook_fields', roster: 'roster.dm_millbrook_fields' },
  d: { id: 'hollow_downs', roster: 'roster.dm_hollow_downs' },
  R: { id: 'reedmouth', roster: 'roster.dm_reedmouth' },
  s: { id: 'stonecrop', roster: 'roster.dm_stonecrop' },
  F: { id: 'fernside', roster: 'roster.dm_fernside' },
  C: { id: 'cairnmoor', roster: 'roster.dm_cairnmoor' },
  c: { id: 'cairnmoor', roster: 'roster.dm_cairnmoor' },
};

/** One square zone per sketch chunk that has a roster, named for its zone and chunk. */
function zones(): SpawnZone[] {
  const out: SpawnZone[] = [];
  const t = 32;
  CHUNKS.forEach((row, cy) => {
    for (let cx = 0; cx < row.length; cx++) {
      const z = ZONE_OF[row[cx] as string];
      if (!z) continue;
      const x0 = cx * t;
      const y0 = cy * t;
      out.push({
        id: `${z.id}_${cx}_${cy}`,
        roster: z.roster,
        polygon: [
          { x: x0, y: y0 },
          { x: x0 + t - 1, y: y0 },
          { x: x0 + t - 1, y: y0 + t - 1 },
          { x: x0, y: y0 + t - 1 },
        ],
      });
    }
  });
  return out;
}

/** Biome by sketch letter. */
const BIOME_OF: Record<string, string> = {
  '^': 'r',
  C: 'o',
  c: 'o',
  s: 'r',
  S: 'r',
  F: 'w',
  T: 'p',
  d: 'd',
  h: 'm',
  H: 'm',
  r: 'm',
  m: 'm',
  M: 'm',
  R: 'a',
  E: 'm',
  '~': 'x',
};

/** Elevation by sketch letter. The Crown is a true wall; the rises and the moor step up. */
/** Chunk rows in the region: 12 of land and sea, and 4 underground for the Rootway (M4-21). */
const ROWS = 16;

const HEIGHT_OF: Record<string, string> = { '^': '3', C: '1', c: '1', s: '1', S: '1', T: '1' };

/** A small stable hash, for the ragged edges between chunks. */
function hash(a: number, b: number, c: number, d: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2147483647) + d) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Expands the chunk sketch to the 48 x 48 mask the baker wants (4 x 4 cells a chunk). A cell on a
 * chunk's edge takes the neighbor's letter about a third of the time, so borders are ragged and
 * not ruled.
 */
function masks(): { biomes: string[]; elevation: string[] } {
  const letter = (cx: number, cy: number): string =>
    (CHUNKS[Math.max(0, Math.min(11, cy))] as string)[Math.max(0, Math.min(11, cx))] as string;
  const biomes: string[] = [];
  const elevation: string[] = [];
  // Rows 12 to 15 are underground: the Rootway's rooms stand in the rock below the sea, which
  // takes the sea's letter, so no one can walk to them.
  for (let y = 0; y < ROWS * 4; y++) {
    let b = '';
    let e = '';
    for (let x = 0; x < 48; x++) {
      const cx = Math.floor(x / 4);
      const cy = Math.floor(y / 4);
      let l = letter(cx, cy);
      const ix = x % 4;
      const iy = y % 4;
      const nx = ix === 0 ? -1 : ix === 3 ? 1 : 0;
      const ny = iy === 0 ? -1 : iy === 3 ? 1 : 0;
      const pick = (dx: number, dy: number, salt: number): void => {
        if ((dx !== 0 || dy !== 0) && hash(x, y, salt, 91) % 100 < 34) l = letter(cx + dx, cy + dy);
      };
      pick(nx, 0, 1);
      pick(0, ny, 2);
      b += BIOME_OF[l] ?? 'm';
      e += HEIGHT_OF[l] ?? '0';
    }
    biomes.push(b);
    elevation.push(e);
  }
  return { biomes, elevation };
}

/** Hearthford's top left, so its center is (192, 192) and the four gates face the four roads. */
export const TOWN_ORIGIN = { x: 164, y: 164 } as const;

const districts: District[] = TOWN_PARTS.map((p) => ({
  id: p.id,
  kind: p.kind,
  x: TOWN_ORIGIN.x + p.rect.x,
  y: TOWN_ORIGIN.y + p.rect.y,
  w: p.rect.w,
  h: p.rect.h,
}));

/** Stamps at their top left corner. */
const stamp = (id: string, x: number, y: number): Placement => ({ kind: id, stamp: id, x, y });
/** One object on one tile. */
const at = (kind: string, x: number, y: number): Placement => ({ kind, x, y });

const placements: Placement[] = [
  stamp('hearthford', TOWN_ORIGIN.x, TOWN_ORIGIN.y),
  stamp('millbrook', 272, 96),
  stamp('reedmouth', 296, 236),
  stamp('stonecrop', 164, 36),
  stamp('fernside_arch', 90, 168),
  stamp('cairn_ring', 44, 44),
  // Hollowhorn's spawner, at the middle of its route on Cairnmoor (creatures/roamers.ts).
  { kind: 'spawner.hollowhorn', x: 19, y: 54 },
  // Old Fen keeps to the well on Cairnmoor, away from Hollowhorn's grazing (creatures/roamers.ts).
  { kind: 'npc.hermit', x: 12, y: 85 },
  stamp('chapel', 171, 262),
  stamp('lean_to', 76, 176),
  stamp('shepherd_hut', 108, 232),
  stamp('milestone', 188, 98),
  stamp('great_oak', 118, 244),
  stamp('fernside_climb', 46, 100),
  // Above-tier sights (regions/01 section 7).
  stamp('floating_stones', 100, 2),
  stamp('cliff_window', 56, 22),
  stamp('far_den', 330, 262),

  // The Rootway (M4-21) and the mini-dungeons (M4-11): their rooms under the region, and their
  // mouths, with a stamp to mark each mini-dungeon's.
  ...BUILT_DUNGEONS.flatMap((d) => d.placements().map((r) => stamp(r.stamp, r.x, r.y))),
  ...BUILT_DUNGEONS.flatMap((d) => d.outside().map((o) => at(o.kind, o.x, o.y))),
  // The closed yard at the far west, and the ends of the climb.
  stamp(LANDING.stamp, LANDING.x, LANDING.y),
  at('fixture.fc_top', CLIMB_TOP.x, CLIMB_TOP.y),
  at('fixture.wl_climb', LANDING_SPOTS.climb.x, LANDING_SPOTS.climb.y),
  stamp(UNDERMILL_MOUTH.stamp, UNDERMILL_MOUTH.x, UNDERMILL_MOUTH.y),
  stamp(DEEPS_MOUTH.stamp, DEEPS_MOUTH.x, DEEPS_MOUTH.y),
  stamp(THORNWALL_MOUTH.stamp, THORNWALL_MOUTH.x, THORNWALL_MOUTH.y),
  ...Object.values(MOUTHS).flatMap((m) => (m.stamp ? [stamp(m.stamp, m.x, m.y)] : [])),

  // The practice field outside the north gate: the M3 element set pieces, moved from the square.
  at('fixture.brush_wall', 176, 146),
  at('fixture.fire_barrier', 180, 146),
  at('fixture.windmill_gate', 184, 146),
  at('fixture.stone_gap', 202, 146),
  at('fixture.withered_vine', 206, 146),
  at('fixture.hidden_niche', 210, 146),

  // The manual chests, each at the place of interest that holds it (POW-M4-11). The two in the
  // Rootway are placed by its own rooms.
  ...DAWNMEADOW_POIS.flatMap((p) =>
    p.manual && !p.inDungeon ? [at(poiChest(p.manual), p.x, p.y)] : [],
  ),
  // The places of interest that have a shape of their own.
  ...DAWNMEADOW_POIS.flatMap((p) => (p.stamp ? [stamp(p.stamp.id, p.stamp.x, p.stamp.y)] : [])),

  // Gathering nodes round the Commons and the rises.
  at('node.oak_tree', 150, 160),
  at('node.oak_tree', 145, 185),
  at('node.oak_tree', 170, 205),
  at('node.oak_tree', 215, 215),
  at('node.ash_tree', 135, 170),
  at('node.berry_bush', 152, 150),
  at('node.berry_bush', 182, 138),
  at('node.herb_patch', 200, 135),
  at('node.herb_patch', 208, 232),
  at('node.herb_patch', 150, 225),
  at('node.copper_vein', 175, 80),
  at('node.copper_vein', 180, 70),
  at('node.copper_vein', 165, 90),
  at('node.iron_vein', 185, 75),
  at('node.fishing_spot', 238, 170),

  // The readable signs that are not part of a stamp.
  ...PLACED_SIGNS.map((s) => at(signKind(s.id), s.x, s.y)),

  // Secrets in the open (regions/01 section 13): a chest each, and what wakes it.
  ...REGION_SECRETS.flatMap((s) => [
    at(`fixture.sec_${s.id}_chest`, s.chest.x, s.chest.y),
    ...(s.trigger && s.vigil ? [at(s.vigil, s.trigger.x, s.trigger.y)] : []),
  ]),
  at('fixture.sec_bee_door', BEE_DOOR.x, BEE_DOOR.y),

  // Lore fragment slots: empty markers (content arrives in M10).
  ...FRAGMENT_SLOTS.flatMap((f) => (f.at ? [at(fragmentMarker(f.id), f.at.x, f.at.y)] : [])),

  // A node cluster in every land chunk with no other discoverable (POW-M4-11).
  ...DAWNMEADOW_CLUSTERS,
];

const { biomes, elevation } = masks();

export const DAWNMEADOW: RegionSpec = {
  id: 'dawnmeadow',
  seed: 20260101,
  chunks: { w: 12, h: ROWS },
  biomeLegend: {
    m: 'meadow',
    d: 'downs',
    r: 'rise',
    o: 'moor',
    w: 'woodland',
    p: 'pinewood',
    a: 'marsh',
    x: 'sea',
  },
  biomes,
  elevation,
  roads: {
    nodes: {
      hearth_n: { x: 192, y: 163 },
      hearth_s: { x: 192, y: 220 },
      hearth_w: { x: 163, y: 192 },
      hearth_e: { x: 220, y: 192 },
      wlink: { x: 126, y: 190 },
      fernside: { x: 88, y: 172 },
      thornwall: { x: 24, y: 150 },
      lark_bridge: { x: 240, y: 192 },
      east_mid: { x: 262, y: 160 },
      millbrook_s: { x: 276, y: 126 },
      coast1: { x: 330, y: 126 },
      coast2: { x: 368, y: 150 },
      coast3: { x: 376, y: 205 },
      coast4: { x: 378, y: 252 },
      cart1: { x: 272, y: 200 },
      cart2: { x: 286, y: 230 },
      reed: { x: 294, y: 244 },
      n1: { x: 194, y: 110 },
      n2: { x: 190, y: 62 },
      stonecrop: { x: 178, y: 59 },
      s1: { x: 190, y: 250 },
      chapel: { x: 190, y: 266 },
      s2: { x: 190, y: 292 },
    },
    edges: [
      { a: 'hearth_w', b: 'wlink', width: 3, surface: 'dirt' },
      { a: 'wlink', b: 'fernside', width: 3, surface: 'dirt' },
      { a: 'fernside', b: 'thornwall', width: 3, surface: 'dirt' },
      { a: 'hearth_e', b: 'lark_bridge', width: 3, surface: 'cobble' },
      { a: 'lark_bridge', b: 'east_mid', width: 3, surface: 'cobble' },
      { a: 'east_mid', b: 'millbrook_s', width: 3, surface: 'cobble' },
      { a: 'millbrook_s', b: 'coast1', width: 3, surface: 'cobble' },
      { a: 'coast1', b: 'coast2', width: 3, surface: 'cobble' },
      { a: 'coast2', b: 'coast3', width: 3, surface: 'cobble' },
      { a: 'coast3', b: 'coast4', width: 3, surface: 'cobble' },
      { a: 'east_mid', b: 'cart1', width: 2, surface: 'dirt' },
      { a: 'cart1', b: 'cart2', width: 2, surface: 'dirt' },
      { a: 'cart2', b: 'reed', width: 2, surface: 'dirt' },
      { a: 'hearth_n', b: 'n1', width: 3, surface: 'dirt' },
      { a: 'n1', b: 'n2', width: 3, surface: 'dirt' },
      { a: 'n2', b: 'stonecrop', width: 3, surface: 'dirt' },
      { a: 'hearth_s', b: 's1', width: 3, surface: 'dirt' },
      { a: 's1', b: 'chapel', width: 3, surface: 'dirt' },
      { a: 'chapel', b: 's2', width: 3, surface: 'dirt' },
    ],
  },
  rivers: [
    {
      id: 'lark',
      width: 4,
      points: [
        { x: 272, y: 36 },
        { x: 270, y: 70 },
        { x: 262, y: 100 },
        { x: 252, y: 130 },
        { x: 244, y: 160 },
        { x: 240, y: 192 },
        { x: 240, y: 230 },
        { x: 246, y: 262 },
        { x: 262, y: 282 },
        { x: 282, y: 300 },
      ],
    },
  ],
  placements,
  zones: zones(),
  interiors: [],
  landmarks: [
    { id: 'mill_sails', x: 277, y: 99 },
    { id: 'bell_tower', x: 185, y: 166 },
    { id: 'quarry_crane', x: 184, y: 37 },
  ],
  wakePoints: WAKE_IDS.map((id) => ({ id, ...DAWNMEADOW_WAKE_POINTS[id] })),
  waystones: WAYSTONES['dawnmeadow'] ?? [],
  districts,
  secrets: [
    ...DUNGEON_SECRETS,
    ...REGION_SECRETS.map((s) => ({ id: s.id, ...(s.skill ? { skill: s.skill } : {}) })),
  ],
  pois: DAWNMEADOW_POIS.map((p) => ({ id: p.id, x: p.x, y: p.y })),
  pendingDiscoverables: DAWNMEADOW_PENDING_DISCOVERABLES,
  landmarkHeights: { mill_sails: 16, bell_tower: 10, quarry_crane: 14 },
};

export const TOWN_SIZE = HEARTHFORD_SIZE;
