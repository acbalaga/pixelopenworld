/**
 * Where each item can legitimately come from, derived from content so it cannot drift from the
 * game: creature drop tables, gathering nodes, recipes, request rewards, chests, shop stock and
 * dialogue gifts. The ledger records the source of every item the sim creates; a rule compares.
 */
import { DIALOGUES, SHOPS } from '../../content/dialogue';
import { REQUESTS } from '../../content/requests';
import { CRAFTING } from '../../content/balance/crafting';
import { ITEMS_BALANCE } from '../../content/balance/items';
import { CREATURES } from '../../content/creatures';
import { ITEMS } from '../../content/items';
import { NODES, RECIPES } from '../../content/items/recipes';
import { FIXTURES } from '../../content/world/fixtures';
import { CROP_LIST } from '../../content/farming/crops';
import { FISH } from '../../content/fishing/fish';
import { SINGULARS } from '../../content/singulars';
import type { ItemSource } from '../../sim/ledger';

/** The item a failed cook makes. */
export const BURNT = 'item.burnt_mess';

function build(): Map<string, Set<ItemSource>> {
  const out = new Map<string, Set<ItemSource>>();
  const add = (item: string, source: ItemSource): void => {
    let s = out.get(item);
    if (!s) out.set(item, (s = new Set()));
    s.add(source);
  };
  for (const c of Object.values(CREATURES)) for (const d of c.drops) add(d.item, 'loot');
  for (const n of Object.values(NODES)) for (const y of n.yields) add(y.item, 'gather');
  // Every fish, the legend included, is landed through gathering (M6-05).
  for (const f of FISH) add(f.item, 'gather');
  // Crops come from the field (M6-02).
  for (const c of CROP_LIST) add(c.result, 'harvest');
  // Aldo mills wheat to flour (M6-04).
  add('item.flour', 'mill');
  // Crafting pays under `craft`. Old saves recorded cooking under `cook`, so cooking keeps it.
  for (const r of Object.values(RECIPES)) {
    if (!r.result) continue;
    add(r.result, 'craft');
    if (r.craft === 'cooking') add(r.result, 'cook');
  }
  add(BURNT, 'cook');
  for (const fail of Object.values(CRAFTING.failItem)) add(fail, 'craft');
  for (const r of Object.values(REQUESTS)) {
    for (const i of r.reward.items) add(i.item, 'request');
    // Items handed over when the request is taken (a letter to carry).
    for (const i of r.give ?? []) add(i.item, 'request');
  }
  for (const f of Object.values(FIXTURES))
    for (const i of f.loot?.items ?? []) add(i.item, 'chest');
  for (const s of Object.values(SHOPS)) for (const i of s.stock) add(i.item, 'shop');
  // Anything with a value can be sold and bought back.
  for (const i of Object.values(ITEMS)) if (i.value > 0) add(i.id, 'buyback');
  for (const d of Object.values(DIALOGUES)) {
    for (const n of Object.values(d.nodes)) {
      const effects = [...(n.do ?? []), ...(n.choices ?? []).flatMap((c) => c.do ?? [])];
      for (const e of effects) if ('give' in e) add(e.give, 'dialogue');
    }
  }
  // Singular gifts and rewards (M4-20).
  for (const def of Object.values(SINGULARS))
    for (const e of [
      ...(def.trigger.then ?? []),
      ...def.steps.flatMap((s) => s.then ?? []),
      ...def.reward,
    ])
      if ('give' in e) add(e.give, 'singular');
  // Both kits can come from `start`. The exact kit is checked against the one the save began with.
  for (const kit of [ITEMS_BALANCE.starter, ITEMS_BALANCE.starterV1]) {
    for (const s of kit.bag) add(s.item, 'start');
    for (const item of Object.values(kit.equipment)) add(item, 'start');
  }
  return out;
}

const SOURCES = build();

/** Whether `item` can come from `source`. `seed` is allowed for anything: see the plausibility layer. */
export function canCome(item: string, source: string): boolean {
  if (source === 'seed') return true;
  return SOURCES.get(item)?.has(source as ItemSource) ?? false;
}

/** Creatures whose drop table includes `item`. */
export function droppedBy(item: string): string[] {
  return Object.values(CREATURES)
    .filter((c) => c.drops.some((d) => d.item === item))
    .map((c) => c.id);
}

/** Every source `item` can come from, as the ledger names them. Empty when nothing makes it. */
export function sourcesOf(item: string): ItemSource[] {
  return [...(SOURCES.get(item) ?? [])];
}
