import { ITEMS } from '../../src/content/items';
import { sourcesOf } from '../../src/save/integrity/sources';
import { ALLOWED } from './reachabilityAllow';

/**
 * Content reachability (POW-M3-12): every tier 1 and tier 2 item has at least one way to be
 * obtained: a creature drop, a gathering node, a recipe, a shop, a chest, a request reward, a
 * dialogue gift, or the starting kit. An item with none is listed in `reachabilityAllow.ts` with
 * the reason it is not obtainable yet, or the check fails.
 *
 * Buying back is not a source (it only returns what was sold), and neither is the `seed` source
 * a migrated save uses. An allowlist entry for an item that has a source is also an error, so the
 * list cannot go stale.
 */
export function validateReachability(
  items: Readonly<Record<string, { tier: number }>> = ITEMS,
  sources: (item: string) => readonly string[] = sourcesOf,
  allowed: Readonly<Record<string, string>> = ALLOWED,
): string[] {
  const errors: string[] = [];
  const real = (item: string): string[] =>
    sources(item).filter((s) => s !== 'buyback' && s !== 'seed');
  for (const [id, def] of Object.entries(items)) {
    if (def.tier > 2) continue;
    const has = real(id).length > 0;
    if (!has && !allowed[id])
      errors.push(`item ${id} (tier ${def.tier}) has no source and is not in the allowlist`);
    if (has && allowed[id])
      errors.push(
        `item ${id} is in the reachability allowlist but has a source (${real(id).join(', ')})`,
      );
  }
  for (const id of Object.keys(allowed))
    if (!items[id]) errors.push(`reachability allowlist names unknown item ${id}`);
  return errors;
}
