import { REQUEST_BALANCE as RB } from '../content/balance/requests';
import { CREATURES, SPAWNERS } from '../content/creatures';
import { NPCS, SHOPS } from '../content/dialogue';
import { ITEMS } from '../content/items';
import { NODES, RECIPES } from '../content/items/recipes';
import { STANDING_TEMPLATES } from '../content/requests/templates';
import type { RequestDef } from '../content/requests/types';
import { ITEM_STRINGS } from '../content/strings/items';
import { fill } from '../content/strings/skills';
import { REQUEST_STRINGS } from '../content/strings/requests';
import { query } from './kernel/entities';
import { int, weighted, type Rng } from './kernel/rng';
import type { SimState } from './state';

/**
 * The standing request generator (M3-11). At each dawn a board posts a few jobs made from what the
 * region has and needs: node kinds that grow here, creatures that spawn here, and the things a
 * shopkeeper has run out of. Everything it asks for has a source in the region, and every number
 * stays inside the caps in `balance/requests.ts`. The rolls come from the `requests` stream, so
 * the same save and the same day post the same jobs.
 */

/** What the generator needs to know about a region. */
export interface RegionFacts {
  /** Node kinds standing in it. */
  nodes: readonly string[];
  /** Creature ids that spawn in it. */
  creatures: readonly string[];
  /** Items a shopkeeper has on the list and none on the shelf. */
  outOfStock: readonly { npc: string; item: string }[];
}

/** Reads the facts off a state: its nodes and spawners, and the shelves that are empty. */
export function regionFacts(state: SimState): RegionFacts {
  const c = state.entities.comps;
  const nodes = new Set<string>();
  for (const id of query(state.entities, 'node')) {
    const n = c.node[id];
    if (n) nodes.add(n.kind);
  }
  const creatures = new Set<string>();
  for (const id of query(state.entities, 'spawner')) {
    const sp = c.spawner[id];
    const cr = sp ? SPAWNERS[sp.kind]?.creature : undefined;
    if (cr) creatures.add(cr);
  }
  const outOfStock: { npc: string; item: string }[] = [];
  for (const id of query(state.entities, 'npc')) {
    const n = c.npc[id];
    const shop = n ? Object.values(SHOPS).find((s) => s.npc === n.id) : undefined;
    if (!n || !shop) continue;
    for (const line of shop.stock)
      if ((n.stock[line.item] ?? 0) === 0) outOfStock.push({ npc: n.id, item: line.item });
  }
  return {
    nodes: [...nodes].sort(),
    creatures: [...creatures].sort(),
    outOfStock: outOfStock.sort((a, b) => (a.npc + a.item < b.npc + b.item ? -1 : 1)),
  };
}

/** The items the region can supply: what its nodes yield and its creatures drop, and anything craftable. */
export function itemSources(facts: RegionFacts): Set<string> {
  const out = new Set<string>();
  for (const k of facts.nodes) for (const y of NODES[k]?.yields ?? []) out.add(y.item);
  for (const k of facts.creatures) for (const d of CREATURES[k]?.drops ?? []) out.add(d.item);
  for (const r of Object.values(RECIPES)) if (r.result) out.add(r.result);
  return out;
}

const itemName = (id: string): string => ITEM_STRINGS[`${id}.name`] ?? id;

/** The most coin one standing request can pay. The validator bounds the ledger by it. */
export const MAX_STANDING_COIN = Math.max(
  Math.round((RB.standing.gather.maxQty * RB.maxAskValue * RB.standing.gather.coinPct) / 100),
  Math.round((RB.standing.deliver.maxQty * RB.maxAskValue * RB.standing.deliver.coinPct) / 100),
  RB.standing.defeat.maxQty * Math.max(...RB.standing.defeat.coinPerTier),
);

/** The title of a request as the player reads it. */
export function titleOf(def: RequestDef): string {
  return fill(REQUEST_STRINGS[def.titleKey] ?? def.titleKey, def.vars ?? {});
}

/** A request that asks for `qty` of an item, or null when the item is not a small job. */
function itemJob(item: string): { value: number } | null {
  const v = ITEMS[item]?.value ?? 0;
  return v > 0 && v <= RB.maxAskValue ? { value: v } : null;
}

/**
 * The skill tag of the first node (by id) that yields an item. It picks the ask's wording
 * ("dug", "cut", "landed"). Foraging when nothing yields it.
 */
function tagOf(item: string): string {
  for (const k of Object.keys(NODES).sort()) {
    const n = NODES[k];
    if (n?.yields.some((y) => y.item === item)) return n.tag;
  }
  return 'foraging';
}

/** The item or creature a request names, for the one-per-day rule. */
function subjectOf(def: RequestDef): string {
  const o = def.solutions[0]?.steps[0];
  if (o?.kind === 'deliver') return o.item;
  if (o?.kind === 'defeat') return o.creature ?? '';
  return '';
}

/** Makes one request from one template and the facts, or null when the region cannot support it. */
function make(
  kind: 'gather' | 'deliver' | 'defeat',
  facts: RegionFacts,
  rng: Rng,
  id: string,
  boardId: string,
): RequestDef | null {
  const tpl = STANDING_TEMPLATES.find((t) => t.kind === kind);
  if (!tpl) return null;
  const base = {
    id,
    giver: { board: boardId },
    kind: 'standing' as const,
    region: RB.homeRegion,
    titleKey: tpl.titleKey,
    askKey: tpl.askKey,
  };
  if (kind === 'gather') {
    const pool = [
      ...new Set(facts.nodes.flatMap((k) => (NODES[k]?.yields ?? []).map((y) => y.item))),
    ]
      .filter((i) => itemJob(i))
      .sort();
    if (pool.length === 0) return null;
    const item = pool[int(rng, 0, pool.length - 1)] as string;
    const tag = tagOf(item);
    const B = RB.standing.gather;
    const n = int(rng, B.qty[0], B.qty[1]);
    const value = (itemJob(item) as { value: number }).value;
    return {
      ...base,
      askKey: `${tpl.askKey}.${tag}`,
      vars: { n, what: itemName(item) },
      // A hand-in at the board: what is already in the bag counts, and it is taken (POW-M4-22A).
      solutions: [
        {
          id: 'way',
          labelKey: tpl.wayKey,
          steps: [{ kind: 'deliver', item, qty: n, to: boardId }],
        },
      ],
      reward: {
        coin: Math.max(B.minCoin, Math.round((n * value * B.coinPct) / 100)),
        items: [],
        renown: RB.renown.standing,
      },
      estMinutes: 4,
    };
  }
  if (kind === 'deliver') {
    const have = itemSources(facts);
    const pool = facts.outOfStock.filter((o) => itemJob(o.item) && have.has(o.item));
    if (pool.length === 0) return null;
    const o = pool[int(rng, 0, pool.length - 1)] as { npc: string; item: string };
    const B = RB.standing.deliver;
    const n = int(rng, B.qty[0], B.qty[1]);
    const value = (itemJob(o.item) as { value: number }).value;
    return {
      ...base,
      vars: { n, what: itemName(o.item), who: NPCS[o.npc]?.name ?? o.npc },
      solutions: [
        {
          id: 'way',
          labelKey: tpl.wayKey,
          steps: [{ kind: 'deliver', item: o.item, qty: n, to: o.npc }],
        },
      ],
      reward: {
        coin: Math.max(B.minCoin, Math.round((n * value * B.coinPct) / 100)),
        items: [],
        renown: RB.renown.standing,
      },
      estMinutes: 5,
    };
  }
  const pool = facts.creatures.filter((c) => CREATURES[c] && CREATURES[c].archetype !== 'dummy');
  if (pool.length === 0) return null;
  const creature = pool[int(rng, 0, pool.length - 1)] as string;
  const def = CREATURES[creature];
  if (!def) return null;
  const B = RB.standing.defeat;
  const n = int(rng, B.qty[0], B.qty[1]);
  return {
    ...base,
    vars: { n, what: def.name },
    solutions: [
      { id: 'way', labelKey: tpl.wayKey, steps: [{ kind: 'defeat', creature, count: n }] },
    ],
    reward: {
      coin: n * (B.coinPerTier[def.tier] ?? B.coinPerTier[1] ?? 0),
      items: [],
      renown: RB.renown.standing,
    },
    estMinutes: 5,
  };
}

/**
 * Up to `count` requests for a board on a day. Fewer when the region cannot supply that many
 * different ones. Never two the same, and every title fits the title limit.
 */
export function generateStanding(
  facts: RegionFacts,
  rng: Rng,
  boardId: string,
  day: number,
  count: number = RB.boardSize,
): RequestDef[] {
  const out: RequestDef[] = [];
  const seen = new Set<string>();
  const subjects = new Set<string>();
  let rerolls = 0;
  const table = STANDING_TEMPLATES.map((t) => [t.kind, t.weight] as const);
  for (let tries = 0; out.length < count && tries < count * 10; tries++) {
    const kind = weighted(rng, table);
    const def = make(kind, facts, rng, `standing.${boardId}.${day}.${out.length}`, boardId);
    if (!def) continue;
    const step = def.solutions[0]?.steps[0];
    const key = JSON.stringify(step);
    const subject = subjectOf(def);
    if (seen.has(key) || titleOf(def).length > RB.titleMax) continue;
    // One job per item or creature per day: reroll, and post fewer when the rerolls run out.
    if (subject && subjects.has(subject)) {
      if (++rerolls > RB.standing.dedupeTries) break;
      continue;
    }
    seen.add(key);
    if (subject) subjects.add(subject);
    out.push(def);
  }
  return out;
}
