import { SHOP_BALANCE as B } from '../content/balance/shop';
import { SHOPS } from '../content/dialogue';
import { ITEMS } from '../content/items';
import { EQUIP_SLOTS, type Quality } from '../content/items/types';
import {
  acceptChance,
  answer,
  buyPrice,
  haggleRounds,
  offerPrice,
  counterPrice,
  repairCost,
  sellPrice,
} from './economy';
import { addStack, canHold, newStack } from './items';
import { getComp, query, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { SUBPX } from './kernel/fixed';
import { nextU32 } from './kernel/rng';
import { earnCoin, madeItems, soldItems, spendCoin, type CoinSink } from './ledger';
import { dayIndex } from './time';
import { activeMods, applyMods, modPct } from './mods';
import type { Haggle, Npc, SimState } from './state';

/** A shopkeeper's starting state: a full shelf and their opening purse. Non shopkeepers hold nothing. */
export function newNpc(id: string, day = 0): Npc {
  const shop = Object.values(SHOPS).find((x) => x.npc === id);
  const stock: Record<string, number> = {};
  for (const s of shop?.stock ?? []) stock[s.item] = s.max;
  return { id, purse: shop?.purse.start ?? 0, stock, day, locked: [], buyback: [] };
}

/** The npc component of the shopkeeper for a shop, if they are in the world. */
export function keeper(state: SimState, shopId: string): { npc: Npc; max: number } | null {
  const shop = SHOPS[shopId];
  if (!shop) return null;
  for (const id of query(state.entities, 'npc')) {
    const n = getComp(state.entities, id, 'npc');
    if (n?.id === shop.npc) return { npc: n, max: shop.purse.max };
  }
  return null;
}

/** Coin the shopkeeper holds, or 0 if they are not here. */
export function shopPurse(state: SimState, shopId: string): number {
  return keeper(state, shopId)?.npc.purse ?? 0;
}

/** True if an NPC with this id stands within talking range of `who`. */
export function near(state: SimState, who: EntityId, npcId: string): boolean {
  const p = getComp(state.entities, who, 'pos');
  if (!p) return false;
  for (const id of query(state.entities, 'npc', 'pos')) {
    if (getComp(state.entities, id, 'npc')?.id !== npcId) continue;
    const q = getComp(state.entities, id, 'pos');
    if (!q) continue;
    if (Math.hypot(q.x - p.x, q.y - p.y) / SUBPX <= B.talkRangePx) return true;
  }
  return false;
}

/** Items on the shelf now: what is left of the stock. */
export function onShelf(state: SimState, shopId: string, item: string): number {
  return keeper(state, shopId)?.npc.stock[item] ?? 0;
}

type Denied = 'coin' | 'bag' | 'stock' | 'worthless' | 'range' | 'purse' | 'locked' | 'nothing';
const deny = (state: SimState, who: EntityId, reason: Denied): void =>
  emit(state.events, { type: 'shopDenied', who, reason });

/** Whether this shop will buy this stack: it has a value and sits in a Bag filter the shop takes. */
export function shopTakes(shopId: string, item: string): boolean {
  const shop = SHOPS[shopId];
  const def = ITEMS[item];
  return !!shop && !!def && item !== 'item.coin' && shop.buys.includes(def.bag);
}

/** The opening price to buy one here. */
export function openBuy(shopId: string, item: string): number {
  return buyPrice(item, 0, SHOPS[shopId]?.region);
}

/** The opening price the shop pays for one of this stack. */
export function openSell(shopId: string, item: string, q: Quality = 0): number {
  return sellPrice(item, q, SHOPS[shopId]?.region);
}

const barteringPoints = (state: SimState, who: EntityId): number =>
  getComp(state.entities, who, 'skills')?.points['skill.bartering'] ?? 0;

/** What a buy price comes to for `who`: the Haggler Path takes its share off, never below 1. */
export function payable(state: SimState, who: EntityId, price: number): number {
  const pct = modPct(activeMods(state, who), 'buyPct');
  return pct === 0 ? price : Math.max(1, Math.ceil((price * (100 + pct)) / 100));
}

/** Buys `qty` at `each` coin. The caller has checked range. Emits `bought` or a denial. */
function completeBuy(
  state: SimState,
  who: EntityId,
  shopId: string,
  item: string,
  qty: number,
  each: number,
): boolean {
  const shop = SHOPS[shopId];
  const a = getComp(state.entities, who, 'avatar');
  const inv = getComp(state.entities, who, 'inventory');
  const k = keeper(state, shopId);
  if (!shop || !a || !inv || !k) return false;
  if (!shop.stock.some((s) => s.item === item) || (k.npc.stock[item] ?? 0) < qty) {
    deny(state, who, 'stock');
    return false;
  }
  // Haggler: the Path takes a share off whatever the price came to.
  each = payable(state, who, each);
  const cost = each * qty;
  if (a.coin < cost) {
    deny(state, who, 'coin');
    return false;
  }
  if (!canHold(inv, item, qty)) {
    deny(state, who, 'bag');
    return false;
  }
  // A recipe scroll is a different sink from goods, so the validator can tell them apart.
  const sink: CoinSink = ITEMS[item]?.teaches ? 'recipe' : 'purchase';
  spendCoin(state, who, cost, sink);
  k.npc.purse = Math.min(k.max, k.npc.purse + cost);
  k.npc.stock[item] = (k.npc.stock[item] ?? 0) - qty;
  const stack = newStack(item, qty);
  addStack(inv.slots, stack);
  madeItems(state, 'shop', item, qty);
  emit(state.events, { type: 'bought', who, item, qty, coin: cost });
  return true;
}

/** Buying at the opening price: needs the coin, room in the bag, and the item on the shelf. */
export function buy(
  state: SimState,
  who: EntityId,
  c: { shop: string; item: string; qty: number },
): void {
  const shop = SHOPS[c.shop];
  if (!shop || !getComp(state.entities, who, 'avatar')) return;
  if (!near(state, who, shop.npc)) return deny(state, who, 'range');
  completeBuy(state, who, c.shop, c.item, c.qty, openBuy(c.shop, c.item));
}

/** Sells `qty` from a slot at `each`. The caller has checked range. */
function completeSell(
  state: SimState,
  who: EntityId,
  shopId: string,
  slot: number,
  qty: number,
  each: number,
  haggled = false,
): boolean {
  const a = getComp(state.entities, who, 'avatar');
  const inv = getComp(state.entities, who, 'inventory');
  const stack = inv?.slots[slot];
  const k = keeper(state, shopId);
  if (!a || !inv || !stack || !k) return false;
  qty = Math.min(qty, stack.qty);
  if (each <= 0 || !shopTakes(shopId, stack.item)) {
    deny(state, who, 'worthless');
    return false;
  }
  if (k.npc.purse < each * qty) {
    deny(state, who, 'purse');
    return false;
  }
  const item = stack.item;
  const sold = { ...stack, qty };
  stack.qty -= qty;
  if (stack.qty === 0) inv.slots[slot] = null;
  k.npc.purse -= each * qty;
  earnCoin(state, who, each * qty, 'sale');
  soldItems(state, item, qty);
  // The last stacks sold stay behind the counter until the next restock.
  k.npc.buyback.push({ stack: sold, price: each });
  while (k.npc.buyback.length > B.buybackSlots) k.npc.buyback.shift();
  emit(state.events, { type: 'sold', who, item, qty, coin: each * qty, haggled });
  return true;
}

/** Selling at the opening price, from a bag slot. */
export function sell(
  state: SimState,
  who: EntityId,
  c: { shop: string; slot: number; qty: number },
): void {
  const shop = SHOPS[c.shop];
  const stack = getComp(state.entities, who, 'inventory')?.slots[c.slot];
  if (!shop || !stack) return;
  if (!near(state, who, shop.npc)) return deny(state, who, 'range');
  completeSell(state, who, c.shop, c.slot, c.qty, openSell(c.shop, stack.item, stack.q ?? 0));
}

/** Buys back a stack sold here, at the price it fetched, until the next restock. */
export function buyback(state: SimState, who: EntityId, c: { shop: string; index: number }): void {
  const shop = SHOPS[c.shop];
  const a = getComp(state.entities, who, 'avatar');
  const inv = getComp(state.entities, who, 'inventory');
  const k = keeper(state, c.shop);
  if (!shop || !a || !inv || !k) return;
  if (!near(state, who, shop.npc)) return deny(state, who, 'range');
  const entry = k.npc.buyback[c.index];
  if (!entry) return deny(state, who, 'nothing');
  const cost = entry.price * entry.stack.qty;
  if (a.coin < cost) return deny(state, who, 'coin');
  if (!inv.slots.some((s) => s === null) && !canHold(inv, entry.stack.item, entry.stack.qty))
    return deny(state, who, 'bag');
  spendCoin(state, who, cost, 'buyback');
  k.npc.purse = Math.min(k.max, k.npc.purse + cost);
  k.npc.buyback.splice(c.index, 1);
  addStack(inv.slots, { ...entry.stack });
  madeItems(state, 'buyback', entry.stack.item, entry.stack.qty);
  emit(state.events, {
    type: 'boughtBack',
    who,
    item: entry.stack.item,
    qty: entry.stack.qty,
    coin: cost,
  });
}

/** What one worn or carried item would cost to mend here, or 0 if it is whole. */
export function mendCost(
  state: SimState,
  who: EntityId,
  from: 'bag' | 'worn',
  slot: number,
): number {
  const inv = getComp(state.entities, who, 'inventory');
  const stack = from === 'bag' ? inv?.slots[slot] : inv?.equipment[EQUIP_SLOTS[slot] as never];
  const max = stack ? ITEMS[stack.item]?.durability : undefined;
  if (!stack || max === undefined) return 0;
  return repairCost(stack.item, stack.dur ?? max, max);
}

/** The repair service: the shopkeeper mends an item for coin. Only shops that repair. */
export function mend(
  state: SimState,
  who: EntityId,
  c: { shop: string; from: 'bag' | 'worn'; slot: number },
): void {
  const shop = SHOPS[c.shop];
  const a = getComp(state.entities, who, 'avatar');
  const inv = getComp(state.entities, who, 'inventory');
  const k = keeper(state, c.shop);
  if (!shop?.repairs || !a || !inv || !k) return;
  if (!near(state, who, shop.npc)) return deny(state, who, 'range');
  const stack = c.from === 'bag' ? inv.slots[c.slot] : inv.equipment[EQUIP_SLOTS[c.slot] as never];
  const max = stack ? ITEMS[stack.item]?.durability : undefined;
  const cost = mendCost(state, who, c.from, c.slot);
  if (!stack || max === undefined || cost <= 0) return deny(state, who, 'nothing');
  if (a.coin < cost) return deny(state, who, 'coin');
  spendCoin(state, who, cost, 'repair');
  k.npc.purse = Math.min(k.max, k.npc.purse + cost);
  stack.dur = max;
  emit(state.events, { type: 'mended', who, item: stack.item, coin: cost });
}

/** The haggle in progress for `who`, if any. */
export function haggleOf(state: SimState, who: EntityId): Haggle | null {
  return getComp(state.entities, who, 'haggle') ?? null;
}

const endHaggle = (state: SimState, who: EntityId): void => {
  const h = haggleOf(state, who);
  state.entities.comps.haggle[who] = null;
  // Walking away, or leaving the counter, is told to the panel so it comes back to the list.
  if (h)
    emit(state.events, {
      type: 'haggleEnded',
      who,
      shop: h.shop,
      item: h.item,
      price: h.open,
      won: false,
      refused: false,
    });
};

/**
 * One step of a haggle. `start` opens it on one item, `low` and `fair` make an offer, `accept`
 * takes the price standing and `cancel` walks away. The shopkeeper's answer is rolled on the
 * `trade` stream, so the same seed and choices give the same price. A refusal ends the haggle
 * and the shopkeeper will not haggle on that item again until dawn.
 */
export function haggle(
  state: SimState,
  who: EntityId,
  c: {
    shop: string;
    step: 'start' | 'low' | 'fair' | 'accept' | 'cancel';
    item?: string;
    dir?: 'buy' | 'sell';
    slot?: number;
  },
): void {
  const shop = SHOPS[c.shop];
  const inv = getComp(state.entities, who, 'inventory');
  const k = keeper(state, c.shop);
  if (!shop || !inv || !k || !getComp(state.entities, who, 'avatar')) return;
  if (c.step === 'cancel') return endHaggle(state, who);
  if (!near(state, who, shop.npc)) {
    endHaggle(state, who);
    return deny(state, who, 'range');
  }

  if (c.step === 'start') {
    const dir = c.dir === 'sell' ? 'sell' : 'buy';
    let item = c.item ?? '';
    let open: number;
    let slot = -1;
    if (dir === 'buy') {
      if (!shop.stock.some((s) => s.item === item) || (k.npc.stock[item] ?? 0) < 1)
        return deny(state, who, 'stock');
      open = openBuy(c.shop, item);
    } else {
      slot = c.slot ?? -1;
      const stack = inv.slots[slot];
      if (!stack || !shopTakes(c.shop, stack.item)) return deny(state, who, 'worthless');
      item = stack.item;
      open = openSell(c.shop, item, stack.q ?? 0);
      if (open <= 0) return deny(state, who, 'worthless');
    }
    if (k.npc.locked.includes(item)) return deny(state, who, 'locked');
    const rounds = haggleRounds(barteringPoints(state, who));
    state.entities.comps.haggle[who] = {
      shop: c.shop,
      item,
      dir,
      slot,
      open,
      cur: open,
      round: 0,
      rounds,
    };
    emit(state.events, {
      type: 'haggleStep',
      who,
      shop: c.shop,
      item,
      price: open,
      round: 0,
      result: 'open',
    });
    return;
  }

  const h = haggleOf(state, who);
  if (!h || h.shop !== c.shop) return;
  const settle = (): void => {
    const won = h.dir === 'buy' ? h.cur < h.open : h.cur > h.open;
    const done =
      h.dir === 'buy'
        ? completeBuy(state, who, h.shop, h.item, 1, h.cur)
        : completeSell(state, who, h.shop, h.slot, 1, h.cur, true);
    state.entities.comps.haggle[who] = null;
    emit(state.events, {
      type: 'haggleEnded',
      who,
      shop: h.shop,
      item: h.item,
      price: h.cur,
      won: won && done,
      refused: false,
    });
    if (won && done)
      emit(state.events, { type: 'haggleWon', who, shop: h.shop, item: h.item, price: h.cur });
  };
  if (c.step === 'accept') return settle();

  // An offer. The last exchange has been used: only accepting or walking away is left.
  if (h.round >= h.rounds) return;
  const kind = c.step;
  const ask = offerPrice(h.dir, h.open, kind);
  const better = h.dir === 'buy' ? ask < h.cur : ask > h.cur;
  // Asking for no more than what stands is just taking it.
  if (!better) return settle();
  h.round++;
  const roll = nextU32(state.rng.trade) % 100;
  const result = answer(roll, acceptChance(kind, barteringPoints(state, who), shop.firmness));
  if (result === 'accept') {
    h.cur = ask;
    emit(state.events, {
      type: 'haggleStep',
      who,
      shop: h.shop,
      item: h.item,
      price: h.cur,
      round: h.round,
      result: 'accept',
    });
    return settle();
  }
  if (result === 'counter') {
    h.cur = counterPrice(h.dir, h.cur, ask);
    emit(state.events, {
      type: 'haggleStep',
      who,
      shop: h.shop,
      item: h.item,
      price: h.cur,
      round: h.round,
      result: 'counter',
    });
    return;
  }
  // Refused: the opening price stands, and this shopkeeper is done haggling on it until dawn.
  k.npc.locked.push(h.item);
  state.entities.comps.haggle[who] = null;
  emit(state.events, {
    type: 'haggleStep',
    who,
    shop: h.shop,
    item: h.item,
    price: h.open,
    round: h.round,
    result: 'refuse',
  });
  emit(state.events, {
    type: 'haggleEnded',
    who,
    shop: h.shop,
    item: h.item,
    price: h.open,
    won: false,
    refused: true,
  });
}

/**
 * Once per tick: a haggle ends when the avatar walks away, shopkeepers refill their purses a
 * little over time, and at each in-game dawn (the world clock, so it counts while the game is
 * closed) shelves refill to their maxima, lost haggles are forgotten and buyback is cleared.
 */
export function tradeSystem(state: SimState): void {
  for (const who of query(state.entities, 'haggle')) {
    const h = haggleOf(state, who);
    const shop = h ? SHOPS[h.shop] : undefined;
    if (!h || !shop || !near(state, who, shop.npc)) endHaggle(state, who);
  }
  const day = dayIndex(state.worldTick);
  const regen = state.tick !== 0 && state.tick % B.purseRegenEvery === 0;
  for (const id of query(state.entities, 'npc')) {
    const n = getComp(state.entities, id, 'npc');
    const shop = n ? Object.values(SHOPS).find((s) => s.npc === n.id) : undefined;
    if (!n || !shop) continue;
    // Fair Dealer: shopkeepers refill faster for an avatar who wears the Path.
    const who = query(state.entities, 'avatar')[0];
    const step = applyMods(
      B.purseRegen,
      'purseRegenPct',
      who === undefined ? [] : activeMods(state, who),
    );
    if (regen && n.purse < shop.purse.start) n.purse = Math.min(shop.purse.start, n.purse + step);
    if (day > n.day) {
      n.day = day;
      for (const s of shop.stock) n.stock[s.item] = s.max;
      n.locked = [];
      n.buyback = [];
    }
  }
}
