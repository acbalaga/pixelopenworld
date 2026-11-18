import { CRAFTING } from '../../content/balance/crafting';
import { ITEMS_BALANCE } from '../../content/balance/items';
import { REQUESTS } from '../../content/dialogue';
import { RECIPES } from '../../content/items/recipes';
import { buyPrice } from '../../sim/systems/npcs';
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
  const made: Record<string, number> = {};
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

  // The starter kit is exactly the starter kit.
  const kit: Record<string, number> = {};
  for (const s of ITEMS_BALANCE.starter.bag) kit[s.item] = (kit[s.item] ?? 0) + s.qty;
  for (const item of Object.values(ITEMS_BALANCE.starter.equipment))
    kit[item] = (kit[item] ?? 0) + 1;
  for (const [item, n] of Object.entries(ledger.itemsMade.start ?? {}))
    if (n > (kit[item] ?? 0)) fail('START_KIT_MISMATCH', `${item} x${n}`);

  // Loot needs kills of something that drops it, in numbers that could have dropped it.
  for (const [item, n] of Object.entries(ledger.itemsMade.loot ?? {})) {
    const from = droppedBy(item);
    const kills = from.reduce((a, c) => a + (ledger.kills[c] ?? 0), 0);
    const most = from.reduce((a, c) => a + (ledger.kills[c] ?? 0) * maxItemPerKill(c, item), 0);
    if (n > 0 && (kills === 0 || n > most))
      fail('LOOT_WITHOUT_KILL', `${item} x${n} from ${kills} kills of ${from.join(', ')}`);
  }

  // Requests: a finished request paid out exactly its reward, and kill goals were met.
  let coin = 0;
  const gifts: Record<string, number> = {};
  for (const [id, r] of Object.entries(journal.requests)) {
    const def = REQUESTS[id];
    if (!def) continue;
    if (r.state !== 'done' && r.state !== 'ready') continue;
    if (def.goal.kill && (ledger.kills[def.goal.kill] ?? 0) < def.goal.count)
      fail('REQUEST_STATE', `${id} finished with ${ledger.kills[def.goal.kill] ?? 0} kills`);
    if (r.state !== 'done') continue;
    coin += def.reward.coin;
    for (const i of def.reward.items) gifts[i.item] = (gifts[i.item] ?? 0) + i.qty;
  }
  if ((ledger.coinEarned.request ?? 0) !== coin)
    fail('REQUEST_PAYOUT_MISMATCH', `coin ${ledger.coinEarned.request ?? 0}, expected ${coin}`);
  const paid = ledger.itemsMade.request ?? {};
  for (const item of new Set([...Object.keys(gifts), ...Object.keys(paid)]))
    if ((paid[item] ?? 0) !== (gifts[item] ?? 0))
      fail(
        'REQUEST_PAYOUT_MISMATCH',
        `${item} paid ${paid[item] ?? 0}, expected ${gifts[item] ?? 0}`,
      );

  // Crafts: every successful craft made exactly its recipe's result, `qty` times. Old saves
  // recorded cooking under `cook`, so both sources count. Failed crafts leave only their fail item.
  const crafted: Record<string, number> = {};
  for (const src of ['cook', 'craft'])
    for (const [item, n] of Object.entries(ledger.itemsMade[src] ?? {}))
      crafted[item] = (crafted[item] ?? 0) + n;
  const results: Record<string, number> = {};
  for (const [rid, n] of Object.entries(ledger.crafts)) {
    const r = RECIPES[rid];
    if (r) results[r.result] = (results[r.result] ?? 0) + n * r.qty;
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

  // Purchases cost exactly what the items cost.
  let cost = 0;
  for (const [item, n] of Object.entries(ledger.itemsMade.shop ?? {})) cost += buyPrice(item) * n;
  if ((ledger.coinSpent.purchase ?? 0) !== cost)
    fail('PURCHASE_MISMATCH', `spent ${ledger.coinSpent.purchase ?? 0}, items cost ${cost}`);

  return out;
}
