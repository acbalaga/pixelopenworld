import { SPAWNERS } from '../../src/content/creatures';
import { ROSTER_SPAWNERS } from '../../src/content/creatures/rosters';
import { DAWNMEADOW } from '../../src/content/world/regions/dawnmeadow/spec';
import { NODES } from '../../src/content/items/recipes';
import { FIXTURES } from '../../src/content/world/fixtures';
import { REGIONS, type RegionDef } from '../../src/content/world/regions';
import { SLICE_MAP } from '../../src/content/world/slice-map';

/**
 * Regions and supply (POW-M3-12). Every gathering node kind, creature spawner kind and chest with
 * loot belongs to exactly one region's supply, and every supply entry exists. A built region's
 * supply is exactly what its map places, so the first map cannot quietly grow what is meant to
 * live outside it. A planned region has no map to compare with.
 */
export function validateRegions(
  regions: readonly RegionDef[] = REGIONS,
  nodes: readonly string[] = Object.keys(NODES),
  spawners: readonly string[] = Object.keys(SPAWNERS),
  chests: readonly string[] = Object.values(FIXTURES)
    .filter((f) => f.type === 'chest' && f.loot)
    .map((f) => f.kind),
  // The slice map, the Dawnmeadow spec's own placements, and the zone spawners the bake places in
  // every zone (the bake check fails if a slot has none).
  placed: readonly string[] = [
    ...(SLICE_MAP.objects ?? []).map((o) => o.kind),
    ...DAWNMEADOW.placements.map((p) => p.kind),
    ...Object.keys(ROSTER_SPAWNERS),
  ],
): string[] {
  const errors: string[] = [];
  const homes = new Map<string, string[]>();
  for (const r of regions) {
    for (const k of [...r.supply.nodes, ...r.supply.spawners, ...r.supply.chests])
      homes.set(k, [...(homes.get(k) ?? []), r.id]);
    for (const k of r.supply.nodes)
      if (!nodes.includes(k)) errors.push(`region ${r.id}: unknown node ${k}`);
    for (const k of r.supply.spawners)
      if (!spawners.includes(k)) errors.push(`region ${r.id}: unknown spawner ${k}`);
    for (const k of r.supply.chests)
      if (!chests.includes(k)) errors.push(`region ${r.id}: unknown chest ${k}`);
  }
  for (const k of [...nodes, ...spawners, ...chests]) {
    const h = homes.get(k) ?? [];
    if (h.length === 0) errors.push(`${k} belongs to no region's supply`);
    if (h.length > 1)
      errors.push(`${k} is in the supply of more than one region (${h.join(', ')})`);
  }
  const supplyKinds = new Set([...nodes, ...spawners, ...chests]);
  for (const r of regions.filter((x) => x.status === 'built')) {
    const mine = new Set([...r.supply.nodes, ...r.supply.spawners, ...r.supply.chests]);
    const there = new Set(placed.filter((k) => supplyKinds.has(k)));
    for (const k of there)
      if (!mine.has(k)) errors.push(`${k} is placed on the ${r.id} map but not in its supply`);
    for (const k of mine)
      if (!there.has(k)) errors.push(`${k} is in the ${r.id} supply but its map does not place it`);
  }
  return errors;
}
