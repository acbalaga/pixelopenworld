import { DAWNMEADOW_CREATURES } from './dawnmeadow';
import type { SpawnerDef } from './types';

/**
 * Spawners for the rooms of dungeons (POW-M4-11): one creature each, back at the next dawn once all
 * are down. `spawner.dg_<name>` holds one creature on its tile. `spawner.dgp_<name>` is a pack of
 * three within a short reach, for swarms. `<name>` is the creature id without its `creature.`.
 *
 * Only the kinds a dungeon places are made, because a region's supply is exactly what its map
 * places (`validateRegions`). A dungeon that needs a new one adds its kind here.
 */
export const DUNGEON_SPAWNS: readonly string[] = [
  'dgp_grain_rat',
  'dg_burrow_mole',
  'dgp_burrow_mole',
  'dg_bramble_boar',
  'dg_thornling_scout',
  'dgp_hedge_sparrow',
  'dg_barrow_bones',
  'dg_fox',
  'dg_rubblet',
  'dgp_rubblet',
  'dgp_thistle_wasp',
  'dg_moor_wisp',
  'dg_crag_hawk',
  'dgp_reed_crab',
  'dg_reed_crab',
  'dg_marsh_leech',
];

/** Dungeon spawners whose creatures are thieves: Fox Hollow's foxes (m6). */
const THIEVES: readonly string[] = ['dg_fox'];

/** The first map's creatures, which dungeons borrow too. */
const BASE = [
  'creature.mossling',
  'creature.bramble_boar',
  'creature.thornling',
  'creature.spitbloom',
];

export function dungeonSpawners(): Record<string, SpawnerDef> {
  const known = [...Object.keys(DAWNMEADOW_CREATURES), ...BASE];
  const out: Record<string, SpawnerDef> = {};
  for (const short of DUNGEON_SPAWNS) {
    const m = /^(dgp?)_(.+)$/.exec(short) as RegExpExecArray;
    const creature = `creature.${m[2]}`;
    if (!known.includes(creature)) throw new Error(`dungeon spawner ${short}: no ${creature}`);
    const pack = m[1] === 'dgp';
    out[`spawner.${short}`] = {
      kind: `spawner.${short}`,
      creature,
      cap: pack ? 3 : 1,
      respawn: 600,
      radius: pack ? 40 : 0,
      daily: true,
      ...(THIEVES.includes(short) ? { steals: true as const } : {}),
    };
  }
  return out;
}
