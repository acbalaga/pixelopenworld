import { SPAWNS } from '../balance/world';
import { ROSTERS, type SpawnStep } from '../world/rosters';
import { DAWNMEADOW_CREATURES } from './dawnmeadow';
import type { SpawnerDef } from './types';

/**
 * The spawner kind the baker places in a zone for one creature at one step and time of day, for
 * example `spawner.zb_n_bramble_boar` (step b, by night). No time of day means all hours (`a`).
 */
export function zoneSpawnerKind(creature: string, step: SpawnStep, when?: 'day' | 'night'): string {
  const w = when === 'day' ? 'd' : when === 'night' ? 'n' : 'a';
  return `spawner.z${step}_${w}_${creature.replace(/^creature\./, '')}`;
}

/** Every spawner kind a roster's zones can hold. */
export function rosterSpawnerKinds(rosterId: string): string[] {
  const r = ROSTERS[rosterId];
  if (!r?.step) return [];
  const step = r.step;
  if (!r.night) return r.creatures.map((c) => zoneSpawnerKind(c, step));
  return [
    ...r.creatures.map((c) => zoneSpawnerKind(c, step, 'day')),
    ...r.night.map((c) => zoneSpawnerKind(c, step, 'night')),
  ];
}

/** Pack and flock creatures that spawn as a group. The older three are known here by id. */
function isPack(creature: string): boolean {
  return DAWNMEADOW_CREATURES[creature]?.pack !== undefined;
}

/** One spawner kind for every creature, step and time of day the rosters with a step name. */
export function zoneSpawners(): Record<string, SpawnerDef> {
  const out: Record<string, SpawnerDef> = {};
  for (const r of Object.values(ROSTERS)) {
    const step = r.step;
    if (!step) continue;
    const lists: ['day' | 'night' | undefined, readonly string[]][] = r.night
      ? [
          ['day', r.creatures],
          ['night', r.night],
        ]
      : [[undefined, r.creatures]];
    for (const [when, list] of lists)
      for (const creature of list) {
        const kind = zoneSpawnerKind(creature, step, when);
        out[kind] = {
          kind,
          creature,
          cap: isPack(creature) ? SPAWNS.packCap : SPAWNS.cap,
          respawn: SPAWNS.respawn,
          radius: SPAWNS.radius,
          step,
          // A roster with no night list spawns its day list at all hours.
          ...(when ? { when } : {}),
        };
      }
  }
  return out;
}
