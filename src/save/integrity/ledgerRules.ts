import { COOKING } from '../../content/balance/cooking';
import { CRAFTING } from '../../content/balance/crafting';
import { ITEMS_BALANCE } from '../../content/balance/items';
import { REQUEST_BALANCE as RB } from '../../content/balance/requests';
import { REQUESTS } from '../../content/requests';
import { RECIPES } from '../../content/items/recipes';
import { SINGULARS } from '../../content/singulars';
import { ITEMS } from '../../content/items';
import { INTERIOR_BY_ID, whyNot } from '../../sim/home';
import { PIECE_BY_ID, STARTER_PIECES } from '../../content/furniture/pieces';
import { FISH_BY_ITEM } from '../../content/fishing/fish';
import { FISH_PLACES } from '../../content/fishing/places';
import { buyPrice, lowestBuy } from '../../sim/economy';
import { MAX_STANDING_COIN } from '../../sim/requestGen';
import { xpToNext } from '../../sim/skills';
import { maxItemPerKill } from './bounds';
import type { Reason } from './reasons';
import { canCome, droppedBy } from './sources';
import type { View } from './view';

const sum = (t: Record<string, number>): number => Object.values(t).reduce((a, b) => a + b, 0);

/** Layer 2. What the avatar holds reconciles with what the sim recorded. */
export function ledgerRules(v: View): Reason[] {
  const out: Reason[] = [];
  const fail = (code: Reason['code'], detail: string): void => {
    out.push({ code, layer: 'ledger', detail });
  };
  const { avatar, inv, storage, skills, journal, ledger } = v;

  // Coin held equals earned minus spent.
  const expected = sum(ledger.coinEarned) - sum(ledger.coinSpent);
  if (avatar.coin !== expected)
    fail('COIN_RECONCILE', `holds ${avatar.coin}, ledger says ${expected}`);
  if ((ledger.coinEarned.echo ?? 0) > (ledger.coinSpent.echo ?? 0))
    fail('ECHO_EXCEEDS_DROPPED', 'more echo coin picked up than was ever left');

  // XP held (banked, plus what the points cost) never exceeds XP earned.
  for (const id of new Set([...Object.keys(skills.points), ...Object.keys(skills.xp)])) {
    let held = skills.xp[id] ?? 0;
    for (let i = 0; i < (skills.points[id] ?? 0); i++) held += xpToNext(i);
    if (held > (ledger.xpEarned[id] ?? 0))
      fail('XP_EXCEEDS_EARNED', `${id} holds ${held}, earned ${ledger.xpEarned[id] ?? 0}`);
  }

  // Items held never exceed items made, and every item came from a source that can make it.
  const held: Record<string, number> = {};
  for (const s of inv.slots) if (s) held[s.item] = (held[s.item] ?? 0) + s.qty;
  for (const s of storage.slots) if (s) held[s.item] = (held[s.item] ?? 0) + s.qty;
  for (const s of Object.values(inv.equipment)) if (s) held[s.item] = (held[s.item] ?? 0) + 1;
  // Furniture standing in a room is still held (M6-07), and the inn room's own bed and chest are
  // made by the room: they are the pieces it starts with.
  for (const list of Object.values(v.sim.home.rooms))
    for (const o of list) {
      const item = PIECE_BY_ID[o.piece]?.item;
      if (item) held[item] = (held[item] ?? 0) + 1;
    }
  const made: Record<string, number> = {};
  for (const id of STARTER_PIECES) {
    const item = PIECE_BY_ID[id]?.item;
    if (item) made[item] = 1;
  }
  for (const [src, items] of Object.entries(ledger.itemsMade)) {
    for (const [item, n] of Object.entries(items)) {
      made[item] = (made[item] ?? 0) + n;
      if (n > 0 && !canCome(item, src))
        fail('ITEM_SOURCE_LOCKED', `${item} cannot come from ${src}`);
    }
  }
  for (const [item, n] of Object.entries(held))
    if (n > (made[item] ?? 0))
      fail('ITEMS_EXCEED_MADE', `${item} held ${n}, made ${made[item] ?? 0}`);

  // Milling (M6-04): every sack of flour was paid for at the mill, at the mill's fee.
  const milled = ledger.itemsMade.mill?.['item.flour'] ?? 0;
  if (milled * COOKING.mill.fee !== (ledger.coinSpent.mill ?? 0))
    fail('MILL_MISMATCH', `${milled} flour, ${ledger.coinSpent.mill ?? 0} coin paid`);

  // Fishing (M6-05): each record names a species, a place, and a length inside that species'
  // range, and counts no more fish than gathering made. Old Gnarl is landed once, and the flag and
  // her record agree.
  const fishing = v.sim.fishing;
  for (const [item, r] of Object.entries(fishing.records)) {
    const fd = FISH_BY_ITEM[item];
    const gathered = ledger.itemsMade.gather?.[item] ?? 0;
    if (!fd) fail('FISH_RECORD', `${item} is not a fish`);
    else if (!(r.best >= fd.size[0] && r.best <= fd.size[1]))
      fail('FISH_RECORD', `${item} ${r.best} cm outside ${fd.size[0]} to ${fd.size[1]}`);
    else if (!Number.isInteger(r.n) || r.n < 1 || r.n > gathered)
      fail('FISH_RECORD', `${item} landed ${r.n}, gathered ${gathered}`);
    else if (!FISH_PLACES.some((p) => p.id === r.where))
      fail('FISH_RECORD', `${item} from ${r.where}`);
    else if (fd.legend && r.n > 1) fail('FISH_RECORD', `${item} landed ${r.n} times`);
  }
  if (fishing.gnarl !== (fishing.records['item.old_gnarl'] !== undefined))
    fail('FISH_RECORD', 'Old Gnarl flag and record disagree');

  // Rooms (M6-07): every piece is a known piece in a room that exists, standing where the rules
  // of the room let it stand, given the pieces before it in the list.
  for (const [room, list] of Object.entries(v.sim.home.rooms)) {
    const r = INTERIOR_BY_ID[room];
    if (!r) {
      fail('HOME_LAYOUT', `no room ${room}`);
      continue;
    }
    list.forEach((o, i) => {
      const p = PIECE_BY_ID[o.piece];
      const why = p ? whyNot(r, p, o.x, o.y, o.rot, list.slice(0, i)) : 'unknown piece';
      if (why) fail('HOME_LAYOUT', `${room} ${o.piece} at ${o.x},${o.y}: ${why}`);
    });
  }

  // Every affix on a held piece came from an enchant: no more of them than Enchanting crafts made.
  let affixes = 0;
  for (const s of [...inv.slots, ...storage.slots, ...Object.values(inv.equipment)])
    affixes += s?.affixes?.length ?? 0;
  let enchants = 0;
  for (const [rid, n] of Object.entries(ledger.crafts)) if (RECIPES[rid]?.enchant) enchants += n;
  if (affixes > enchants) fail('AFFIX_WITHOUT_ENCHANT', `${affixes} affixes, ${enchants} enchants`);

  // The starter kit is exactly the starter kit.
  // A save names the kit it began with. A missing field counts as the current kit, never the old.
  const start = ledger.startKit === 1 ? ITEMS_BALANCE.starterV1 : ITEMS_BALANCE.starter;
  const kit: Record<string, number> = {};
  for (const s of start.bag) kit[s.item] = (kit[s.item] ?? 0) + s.qty;
  for (const item of Object.values(start.equipment)) kit[item] = (kit[item] ?? 0) + 1;
  for (const [item, n] of Object.entries(ledger.itemsMade.start ?? {}))
    if (n > (kit[item] ?? 0)) fail('START_KIT_MISMATCH', `${item} x${n}`);

  // A technique read from a manual needs a copy of that manual found in the world (a chest or a
  // pickup). The manual is made from `chest` when the chest is opened, so the ledger holds it.
  for (const [technique, via] of Object.entries(journal.learnedVia ?? {})) {
    if (via !== 'manual') continue;
    const copies = Object.values(ITEMS).filter((i) => i.manual?.technique === technique);
    const found = copies.reduce(
      (a, i) =>
        a + (ledger.itemsMade.chest?.[i.id] ?? 0) + (ledger.itemsMade.singular?.[i.id] ?? 0),
      0,
    );
    if (found < 1) fail('MANUAL_READ_UNSOURCED', technique);
  }

  // Singular gifts (M4-20): no more than the steps the avatar has finished, and the reward only
  // once the Singular is done.
  const allowed: Record<string, number> = {};
  for (const def of Object.values(SINGULARS)) {
    const p = journal.singulars?.[def.id];
    if (!p) continue;
    const stages = [def.trigger, ...def.steps];
    // `step` is the index of the step in hand, so the trigger and `step` steps are behind it.
    const behind = p.done ? stages.length : p.step + 1;
    for (const s of stages.slice(0, behind))
      for (const e of s.then ?? [])
        if ('give' in e) allowed[e.give] = (allowed[e.give] ?? 0) + e.qty;
    if (p.done)
      for (const e of def.reward) if ('give' in e) allowed[e.give] = (allowed[e.give] ?? 0) + e.qty;
  }
  for (const [item, n] of Object.entries(ledger.itemsMade.singular ?? {}))
    if (n > (allowed[item] ?? 0))
      fail('SINGULAR_REWARD_UNEARNED', `${item} made ${n}, earned ${allowed[item] ?? 0}`);

  // Loot needs kills of something that drops it, in numbers that could have dropped it.
  for (const [item, n] of Object.entries(ledger.itemsMade.loot ?? {})) {
    const from = droppedBy(item);
    const kills = from.reduce((a, c) => a + (ledger.kills[c] ?? 0), 0);
    const most = from.reduce((a, c) => a + (ledger.kills[c] ?? 0) * maxItemPerKill(c, item), 0);
    if (n > 0 && (kills === 0 || n > most))
      fail('LOOT_WITHOUT_KILL', `${item} x${n} from ${kills} kills of ${from.join(', ')}`);
  }

  // Requests: a finished request paid out exactly its reward, and its kill steps were met. A
  // standing request is made at the board, so its reward is counted in `requestRewards` as it is
  // paid, and that tally is bounded by what a board can post.
  let coin = 0;
  const gifts: Record<string, number> = {};
  for (const [id, r] of Object.entries(journal.requests)) {
    const def = REQUESTS[id] ?? r.gen;
    if (!def) continue;
    if (r.state !== 'done' && r.state !== 'ready') continue;
    const sol = def.solutions.find((s) => s.id === r.solution);
    for (const o of sol?.steps ?? []) {
      if (o.kind !== 'defeat' || !o.creature) continue;
      if ((ledger.kills[o.creature] ?? 0) < o.count)
        fail('REQUEST_STATE', `${id} finished with ${ledger.kills[o.creature] ?? 0} kills`);
    }
    if (r.state !== 'done' || r.gen) continue;
    coin += def.reward.coin;
    for (const i of def.reward.items) gifts[i.item] = (gifts[i.item] ?? 0) + i.qty;
  }
  const standing = ledger.requestRewards ?? {};
  const n = standing.n ?? 0;
  const days = Math.max(0, v.plain.createdAt - v.plain.startedAt) / (48 * 60_000);
  const posted = RB.boardSize * (Math.ceil(days) + 2);
  if (n > posted || (standing.coin ?? 0) > n * MAX_STANDING_COIN)
    fail('REQUEST_REWARD_UNMATCHED', `standing rewards n ${n}, coin ${standing.coin ?? 0}`);
  for (const [k, q] of Object.entries(standing))
    if (k !== 'n' && k !== 'coin' && q > 0)
      fail('REQUEST_REWARD_UNMATCHED', `standing requests pay no ${k}`);
  coin += standing.coin ?? 0;
  if ((ledger.coinEarned.request ?? 0) !== coin)
    fail('REQUEST_PAYOUT_MISMATCH', `coin ${ledger.coinEarned.request ?? 0}, expected ${coin}`);
  const paid = ledger.itemsMade.request ?? {};
  for (const item of new Set([...Object.keys(gifts), ...Object.keys(paid)])) {
    const got = paid[item] ?? 0;
    const want = gifts[item] ?? 0;
    if (got > want) fail('REQUEST_REWARD_UNMATCHED', `${item} paid ${got}, rewards ${want}`);
    else if (got < want) fail('REQUEST_PAYOUT_MISMATCH', `${item} paid ${got}, expected ${want}`);
  }

  // Crafts: every successful craft made exactly its recipe's result, `qty` times. Old saves
  // recorded cooking under `cook`, so both sources count. Failed crafts leave only their fail item.
  const crafted: Record<string, number> = {};
  for (const src of ['cook', 'craft'])
    for (const [item, n] of Object.entries(ledger.itemsMade[src] ?? {}))
      crafted[item] = (crafted[item] ?? 0) + n;
  const results: Record<string, number> = {};
  for (const [rid, n] of Object.entries(ledger.crafts)) {
    const r = RECIPES[rid];
    if (r?.result) results[r.result] = (results[r.result] ?? 0) + n * r.qty;
  }
  const fails = new Set<string>(Object.values(CRAFTING.failItem));
  for (const item of new Set([...Object.keys(results), ...Object.keys(crafted)])) {
    if (fails.has(item)) continue;
    if ((crafted[item] ?? 0) !== (results[item] ?? 0))
      fail(
        'CRAFT_MISMATCH',
        `${item} crafted ${crafted[item] ?? 0}, crafts say ${results[item] ?? 0}`,
      );
  }

  // Purchases cost no more than the opening price and no less than the lowest price a full haggle
  // and the Haggler Path can reach. Recipe scrolls are a sink of their own.
  const range = { purchase: [0, 0], recipe: [0, 0] } as Record<string, [number, number]>;
  for (const [item, n] of Object.entries(ledger.itemsMade.shop ?? {})) {
    const r = range[ITEMS[item]?.teaches ? 'recipe' : 'purchase'] as [number, number];
    r[0] += lowestBuy(item) * n;
    r[1] += buyPrice(item) * n;
  }
  for (const sink of ['purchase', 'recipe'] as const) {
    const spent = ledger.coinSpent[sink] ?? 0;
    const [lo, hi] = range[sink] as [number, number];
    if (spent < lo || spent > hi)
      fail('PURCHASE_MISMATCH', `${sink} spent ${spent}, items cost between ${lo} and ${hi}`);
  }

  // Buyback can only return what was sold.
  for (const [item, n] of Object.entries(ledger.itemsMade.buyback ?? {}))
    if (n > (ledger.itemsSold[item] ?? 0))
      fail('BUYBACK_EXCEEDS_SOLD', `${item} bought back ${n}, sold ${ledger.itemsSold[item] ?? 0}`);

  return out;
}
