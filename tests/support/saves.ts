import { TECHNIQUES } from '../../src/content/combat/techniques';
import { RECIPES } from '../../src/content/items/recipes';
import { REQUESTS } from '../../src/content/requests';
import type { DollSpec } from '../../src/content/dolls/parts';
import { deriveSummary, findAvatar } from '../../src/shared/summary';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { addItem, give, removeItem } from '../../src/sim/items';
import { earnCoin, madeItems, recordCraft, recordKill, spendCoin } from '../../src/sim/ledger';
import { addXp } from '../../src/sim/skills';
import { solutionMax } from '../../src/sim/systems/requests';
import { buyPrice, sellPrice } from '../../src/sim/systems/npcs';
import {
  createDemoState,
  deserializeState,
  serializeState,
  type SimState,
} from '../../src/sim/state';

export const LOOK: DollSpec = {
  body: 'a',
  skin: 'light',
  hair: 'short',
  hairColor: 'brown',
  top: 'tunic',
  topColor: 'blue',
  bottom: 'trousers',
  bottomColor: 'brown',
  mainHand: 'sword',
  offHand: 'none',
};

/** Marks an authored request done under one of its solutions (the first by default). */
export function finishRequest(s: SimState, me: number, id: string, solution?: string): void {
  const def = REQUESTS[id]!;
  const sol = def.solutions.find((x) => x.id === solution) ?? def.solutions[0]!;
  const prog: Record<string, { step: number; p: { n: number; t0: number } }> = {};
  for (const x of def.solutions)
    prog[x.id] = { step: x.id === sol.id ? x.steps.length : 0, p: { n: 0, t0: 0 } };
  s.entities.comps.journal[me]!.requests[id] = {
    state: 'done',
    solution: sol.id,
    prog,
    progress: solutionMax(def, sol.id),
  };
}

/** Wall clock ms the honest save below was first written. */
export const T0 = 1_700_000_000_000;

/** The save record for a state, with the summary and ledger copy the game would write. */
export function plainFor(
  s: SimState,
  o: { seq?: number; playSeconds?: number; startedAt?: number; createdAt?: number } = {},
): SavePlain {
  const playSeconds = o.playSeconds ?? s.tick / 30;
  return {
    schema: CURRENT_SCHEMA,
    saveId: '00112233445566778899aabbccddeeff',
    seq: o.seq ?? 1,
    prevHash: '',
    createdAt: o.createdAt ?? T0 + 200_000,
    playSeconds,
    look: LOOK,
    sim: serializeState(s),
    summary: deriveSummary(s, playSeconds),
    ledger: structuredClone(s.ledger),
    startedAt: o.startedAt ?? T0,
    trust: { state: 'intact', reasons: [], flaggedAt: null },
    time: {
      epoch: o.startedAt ?? T0,
      lastTrustedNow: o.createdAt ?? T0 + 200_000,
      offset: 0,
      accrualUsedMs: 0,
    },
  };
}

/**
 * A state that has played honestly through the real ledger calls: kills and their loot, coin,
 * gathering, a cook, a purchase, a sale, a finished request and some XP. 100 simulated seconds.
 */
export function honestState(): SimState {
  const s = createDemoState(6, 0);
  const f = feetAt(20, 20);
  createAvatar(s, f.x, f.y, 'Honest_1');
  const me = findAvatar(s)!;
  const inv = s.entities.comps.inventory[me]!;
  for (let i = 0; i < 10; i++) recordKill(s, 'creature.mossling');
  madeItems(s, 'loot', 'item.moss_tuft', 12);
  addItem(inv, 'item.moss_tuft', 12);
  earnCoin(s, me, 18, 'loot');
  give(s, me, 'item.sunwort', 3, 'gather');
  give(s, me, 'item.dewmint', 2, 'gather');
  removeItem(inv, 'item.sunwort', 1);
  removeItem(inv, 'item.dewmint', 1);
  give(s, me, 'item.herb_tea', 1, 'cook');
  recordCraft(s, 'recipe.herb_tea');
  inv.recipes.push('recipe.herb_tea');
  // A purchase of bread at the shop's price.
  spendCoin(s, me, buyPrice('item.dish_bread'), 'purchase');
  addItem(inv, 'item.dish_bread', 1);
  madeItems(s, 'shop', 'item.dish_bread', 1);
  // A sale of two tufts.
  removeItem(inv, 'item.moss_tuft', 2);
  earnCoin(s, me, sellPrice('item.moss_tuft') * 2, 'sale');
  // The guard's request, finished and paid.
  finishRequest(s, me, 'request.clear_pests');
  earnCoin(s, me, 50, 'request');
  give(s, me, 'item.ring_copper', 1, 'request');
  addXp(s, me, 'skill.blades', 400);
  s.tick = 3000;
  return s;
}

/** The honest save, ready to validate. */
export function honestPlain(): SavePlain {
  return plainFor(honestState());
}

/**
 * Edits a save the way someone with the tooling would: open the state, change it, and write it
 * back with the summary and the ledger copy made to agree, so only the intended rule can fire.
 */
export function tamper(
  plain: SavePlain,
  edit: (s: SimState, me: number) => void,
  o: { resum?: boolean } = {},
): SavePlain {
  const s = deserializeState(plain.sim);
  edit(s, findAvatar(s)!);
  const next = { ...plain, sim: serializeState(s) };
  if (o.resum !== false) {
    next.summary = deriveSummary(s, plain.playSeconds);
    next.ledger = structuredClone(s.ledger);
  }
  return next;
}

/**
 * A state with what later schemas added taken off, so an old fixture's recorded hash can be
 * checked against it: nothing else changed. Covers statuses and clouds (12) and skills.nightAcc (6), and storage, wear, worn
 * stacks and bag durability (7), and the fighter's guard fields (9).
 */
export function asSchema5(s: SimState): SimState {
  for (const sk of s.entities.comps.skills) {
    if (!sk) continue;
    delete (sk as { nightAcc?: number }).nightAcc;
    delete (sk as { trial?: unknown }).trial;
    delete (sk as { fight?: unknown }).fight;
  }
  for (const f of s.entities.comps.fighter) {
    if (!f) continue;
    delete (f as { guard?: unknown }).guard;
    delete (f as { guardT?: unknown }).guardT;
    delete (f as { still?: unknown }).still;
  }
  delete (s.rng as { craft?: unknown }).craft;
  delete (s.entities.comps as { craft?: unknown }).craft;
  delete (s as { deltas?: unknown }).deltas;
  delete (s.entities.comps as { boss?: unknown }).boss;
  // Schema 17: requests v2. The old request record is a state and a count, Renown and the pin
  // are new, and so are the board component, its stream and the standing-reward tally.
  delete (s.rng as { requests?: unknown }).requests;
  // Schema 19: awake skills, insight counts, how techniques were learned, and the `learned.*`
  // flags of the techniques an old save already knew (taught ones were flagged before).
  for (const sk of s.entities.comps.skills) {
    if (!sk) continue;
    delete (sk as { awake?: unknown }).awake;
    delete (sk as { insight?: unknown }).insight;
  }
  for (const j of s.entities.comps.journal) {
    if (!j) continue;
    delete (j as { learnedVia?: unknown }).learnedVia;
    j.flags = j.flags.filter((f) => {
      const t = f.startsWith('learned.') ? TECHNIQUES[f.slice(8)] : undefined;
      return !t || t.source === 'taught';
    });
  }
  // Schema 20: the avatar's origin.
  for (const a of s.entities.comps.avatar) if (a) delete (a as { origin?: unknown }).origin;
  // Schema 18: the `start` stream and the ledger's start kit.
  delete (s.rng as { start?: unknown }).start;
  if (s.ledger) delete (s.ledger as { startKit?: unknown }).startKit;
  delete (s.entities.comps as { board?: unknown }).board;
  if (s.ledger) delete (s.ledger as { requestRewards?: unknown }).requestRewards;
  for (const j of s.entities.comps.journal) {
    if (!j) continue;
    delete (j as { renown?: unknown }).renown;
    delete (j as { tradeCoin?: unknown }).tradeCoin;
    delete (j as { pinned?: unknown }).pinned;
    for (const r of Object.values(j.requests)) {
      delete (r as { solution?: unknown }).solution;
      delete (r as { prog?: unknown }).prog;
    }
  }
  // Schema 16: deeds and paths.
  delete (s.entities.comps as { deeds?: unknown }).deeds;
  delete (s.entities.comps as { paths?: unknown }).paths;
  // Schema 14: loadouts, channels and the learned flags of taught techniques.
  delete (s.entities.comps as { loadouts?: unknown }).loadouts;
  delete (s.entities.comps as { channel?: unknown }).channel;
  for (const j of s.entities.comps.journal)
    if (j) j.flags = j.flags.filter((f) => !f.startsWith('learned.'));
  // Schema 13: trade. No trade stream, haggle component, itemsSold or shop state.
  delete (s.rng as { trade?: unknown }).trade;
  delete (s.entities.comps as { haggle?: unknown }).haggle;
  if (s.ledger) delete (s.ledger as { itemsSold?: unknown }).itemsSold;
  for (const n of s.entities.comps.npc) {
    if (!n) continue;
    delete (n as { stock?: unknown }).stock;
    delete (n as { day?: unknown }).day;
    delete (n as { locked?: unknown }).locked;
    delete (n as { buyback?: unknown }).buyback;
  }
  // Schema 12 moved Fed onto statuses. Every old fixture has no meal in progress.
  delete (s.entities.comps as { statuses?: unknown }).statuses;
  delete (s.entities.comps as { cloud?: unknown }).cloud;
  (s.entities.comps as { fed?: unknown }).fed = s.entities.comps.pos.map(() => null);
  for (const inv of s.entities.comps.inventory)
    if (inv) inv.recipes = inv.recipes.filter((id) => RECIPES[id]?.learn !== 'start');
  delete (s.entities.comps as { storage?: unknown }).storage;
  for (const inv of s.entities.comps.inventory) {
    if (!inv) continue;
    delete (inv as { wear?: unknown }).wear;
    const eq = inv.equipment as Record<string, unknown>;
    for (const k of Object.keys(eq)) eq[k] = (eq[k] as { item: string } | null)?.item ?? null;
    for (const st of inv.slots) if (st) delete st.dur;
  }
  if (s.ledger) {
    delete (s.ledger as { masterworks?: unknown }).masterworks;
    delete (s.ledger as { marked?: unknown }).marked;
  }
  return s;
}

/**
 * The last schema in which the game ran on the slice map. Migration tests for the steps before it
 * stop here, since the step to Dawnmeadow (22 to 23) removes the slice's objects and moves the
 * avatar, which is what those tests look at.
 */
export const LAST_SLICE_SCHEMA = 22;
