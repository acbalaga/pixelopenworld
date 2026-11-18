import { CRAFTING } from '../../src/content/balance/crafting';
import { ITEMS } from '../../src/content/items';
import { RECIPES } from '../../src/content/items/recipes';
import { sourcesOf, BURNT } from '../../src/save/integrity/sources';
import { ALLOWED } from './reachabilityAllow';

/** The recipe fields the check reads. */
interface RecipeLike {
  result: string;
  ingredients: readonly { item: string }[];
}

/**
 * Content reachability (POW-M3-12): every tier 1 and tier 2 item can be obtained. An item is
 * reachable when something supplies it outright (a creature drop, a gathering node, a shop, a
 * chest, a request reward, a dialogue gift, the starting kit, or the leftovers of a failed
 * craft), or when a recipe makes it from ingredients that are themselves reachable. So a recipe
 * that needs an item nothing supplies does not count, and the items downstream of it are listed
 * too. An unreachable item is listed in `reachabilityAllow.ts` with the reason, or the check fails.
 *
 * Buying back is not a source (it only returns what was sold), and neither is the `seed` source a
 * migrated save uses. An allowlist entry for an item that is reachable is an error, so the list
 * cannot go stale.
 */
export function validateReachability(
  items: Readonly<Record<string, { tier: number }>> = ITEMS,
  sources: (item: string) => readonly string[] = sourcesOf,
  recipes: readonly RecipeLike[] = Object.values(RECIPES),
  fails: ReadonlySet<string> = new Set([...Object.values(CRAFTING.failItem), BURNT]),
  allowed: Readonly<Record<string, string>> = ALLOWED,
): string[] {
  const outright = (id: string): boolean =>
    fails.has(id) || sources(id).some((s) => !['buyback', 'seed', 'craft', 'cook'].includes(s));
  const reach = new Set(Object.keys(items).filter(outright));
  for (let grew = true; grew;) {
    grew = false;
    for (const r of recipes) {
      if (!r.result || reach.has(r.result)) continue;
      if (r.ingredients.every((g) => reach.has(g.item))) {
        reach.add(r.result);
        grew = true;
      }
    }
  }
  const errors: string[] = [];
  for (const [id, def] of Object.entries(items)) {
    if (def.tier > 2) continue;
    const has = reach.has(id);
    if (!has && !allowed[id])
      errors.push(`item ${id} (tier ${def.tier}) cannot be obtained and is not in the allowlist`);
    if (has && allowed[id])
      errors.push(`item ${id} is in the reachability allowlist but can be obtained`);
  }
  for (const id of Object.keys(allowed))
    if (!items[id]) errors.push(`reachability allowlist names unknown item ${id}`);
  return errors;
}
