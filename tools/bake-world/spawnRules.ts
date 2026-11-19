import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import type { SpawnerDef } from '../../src/content/creatures/types';

/** No hostile or territorial spawn within this many tiles of a wake point, a road or a town wall. */
export const SAFE_TILES = 12;

/**
 * Spawners that the safe distance does not apply to, each with the reason. The region doc puts
 * Grain Rats "only in barns" and a barn stands beside the road, so the two rules cannot both hold
 * (Design Query on the M4-05 part 3 PR). The rats are small (28 Health, 4 power).
 */
export const FIGHT_RULE_EXEMPT: Readonly<Record<string, string>> = {
  'spawner.barn_rats': 'pests live in the barn, which stands beside the road',
};

/** True if anything this spawner puts out, by day or night, starts fights on its own. */
export function startsFights(def: SpawnerDef): boolean {
  if (FIGHT_RULE_EXEMPT[def.kind]) return false;
  const ids = def.phases
    ? [def.phases.day, def.phases.night].filter((x): x is string => x !== null)
    : [def.creature];
  return ids.some((id) => {
    const c = CREATURES[id];
    return !!c && [c.temperament, c.night].some((t) => t === 'hostile' || t === 'territorial');
  });
}

/** The spawner definition of an object kind, if it is one. */
export function spawnerOf(kind: string): SpawnerDef | undefined {
  return kind.startsWith('spawner.') ? SPAWNERS[kind] : undefined;
}
