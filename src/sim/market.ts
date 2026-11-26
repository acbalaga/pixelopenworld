import { MARKET, SEASON_FACTOR, WEATHER_FACTOR } from '../content/balance/market';
import { TIME } from '../content/balance/time';
import { ITEMS } from '../content/items';
import { RECIPES } from '../content/items/recipes';
import { getComp, type EntityId } from './kernel/entities';
import { emit } from './kernel/events';
import { int, next } from './kernel/rng';
import { highestSell, lowestBuy } from './economy';
import { addItem, give, spawnPickup } from './items';
import { spendCoin } from './ledger';
import { deliverProceeds } from './mail';
import type { SimState } from './state';
import { dayIndex, seasonOf, weatherOn } from './time';
import { hash01 } from './travelers/dice';
import { identitiesOf } from './travelers/generate';
import { dayIndexOf, localMinute } from './travelers/schedule';
import { PROGRESS } from '../content/balance/travelers';

/**
 * The market (POW-M5-10, design/05 Economy, design/07 Market). An auction house at the terminal on
 * Hearthford's market street. Each tradeable item has a price that lives between a floor and a
 * ceiling taken from the NPC shop prices, so nothing bought on one side and sold on the other ever
 * gains coin. Each in-game hour the price moves back toward its target (season, weather, a market
 * day) and is pushed by the hour's pressure: Travelers selling and crafting, the player listing
 * (flooding) and buying (cornering). Both pushes are capped, and both wear off over in-game days.
 *
 * The player lists from the bag for a fee; a listing sells to a Traveler over time, faster the
 * cheaper it is, and the proceeds come by mail (`marketSale`). The player buys from Traveler
 * listings shown by handle, each a little under the last. Ledger: `marketFee` and `marketBuy` coin
 * spent, `marketSale` coin earned, `market` items made by buying, and the tallies `itemsListed`,
 * `itemsBought`, `marketSoldQty` and `marketSoldValue` for the integrity rule.
 *
 * Saved: the prices, their daily history, the player's listings. Pure: no clock, no `Math.random`.
 */

export interface MarketListing {
  id: number;
  item: string;
  qty: number;
  /** Price for one, in coin. */
  price: number;
  /** In-game hour it went up. */
  at: number;
}

export interface MarketState {
  /** The last in-game hour played out, or -1 before the first. */
  hour: number;
  /** Price now, per tradeable item. */
  prices: Record<string, number>;
  /** The price chat last talked about, per item. */
  said: Record<string, number>;
  /** One price per in-game day, the last `historyDays`. */
  history: Record<string, number[]>;
  day: number;
  /** Demand minus supply this hour, in units. */
  pressure: Record<string, number>;
  listings: MarketListing[];
  nextId: number;
}

export function newMarket(): MarketState {
  return {
    hour: -1,
    prices: {},
    said: {},
    history: {},
    day: -1,
    pressure: {},
    listings: [],
    nextId: 1,
  };
}

// ---- Bounds ----

/** Fee and cut for selling `qty` at `price`. */
export const feeFor = (price: number, qty: number): number =>
  Math.max(1, Math.ceil((price * qty * MARKET.feePct) / 100));
export const cutFor = (price: number, qty: number): number =>
  Math.ceil((price * qty * MARKET.cutPct) / 100);
/** What a sale of `qty` at `price` leaves the seller, after the fee and the cut. */
export const netFor = (price: number, qty: number): number =>
  price * qty - feeFor(price, qty) - cutFor(price, qty);

export interface Bounds {
  floor: number;
  ceil: number;
  base: number;
}

function boundsOf(item: string): Bounds | null {
  const def = ITEMS[item];
  if (!def || (def.category !== 'material' && def.category !== 'consumable')) return null;
  // Buy on the market, sell to a shop: the market never asks less than a shop ever pays.
  const floor = highestSell(item) + 1;
  // Buy from a shop, sell on the market: what a listing nets stays under what a shop ever charges.
  const keep = 1 - (MARKET.feePct + MARKET.cutPct) / 100;
  const ceil = Math.floor((lowestBuy(item) - 1) / keep);
  if (ceil <= floor) return null;
  return { floor, ceil, base: (floor + ceil) / 2 };
}

/** Items the market trades, in a stable order, with their bounds. */
export const TRADEABLE: ReadonlyMap<string, Bounds> = new Map(
  Object.keys(ITEMS)
    .map((id) => [id, boundsOf(id)] as const)
    .filter((x): x is readonly [string, Bounds] => x[1] !== null),
);

export const boundsFor = (item: string): Bounds | undefined => TRADEABLE.get(item);

const clamp = (v: number, b: Bounds): number => Math.min(b.ceil, Math.max(b.floor, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** The price to show and pay: whole coin, inside the bounds. */
export function priceOf(state: SimState, item: string): number {
  const b = TRADEABLE.get(item);
  if (!b) return 0;
  return Math.round(clamp(state.market.prices[item] ?? b.base, b));
}

/** The price an item is drawn back to this hour: its base, the season, the weather, a market day. */
function targetOf(state: SimState, item: string, b: Bounds, hourTick: number): number {
  const cat = ITEMS[item]!.category === 'material' ? 'material' : 'consumable';
  const season = SEASON_FACTOR[seasonOf(hourTick)][cat];
  const weather = WEATHER_FACTOR[weatherOn(state, hourTick)] ?? 1;
  return clamp(b.base * season * weather, b);
}

// ---- The hour ----

function pushPressure(state: SimState, item: string, units: number): void {
  if (!TRADEABLE.has(item) || units === 0) return;
  const p = state.market.pressure;
  p[item] = (p[item] ?? 0) + units;
}

/** Counts the hour's Traveler activity: what they sold is supply, what their crafts used is demand. */
function readEvents(state: SimState): void {
  for (const e of state.events.list) {
    if (e.type === 'travelerSold') pushPressure(state, e.item, -e.qty * 0.2);
    else if (e.type === 'travelerCrafted') {
      const rc = RECIPES[e.recipe];
      if (rc) for (const i of rc.ingredients) pushPressure(state, i.item, i.qty * 0.2);
    }
  }
}

/** A player listing sells to an online Traveler, or nobody, this hour. */
function sales(state: SimState, hour: number): void {
  const m = state.market;
  const r = state.rng.trade;
  for (const l of [...m.listings]) {
    const now = priceOf(state, l.item);
    const chance = Math.min(
      MARKET.saleMax,
      MARKET.saleChance * (now / l.price) ** MARKET.saleSteep,
    );
    if (next(r) >= chance) continue;
    m.listings.splice(m.listings.indexOf(l), 1);
    const online = state.crowd
      ? [...state.crowd.online.keys()].filter((i) => state.crowd!.online[i] === 1)
      : [];
    const buyer = online.length > 0 ? online[int(r, 0, online.length - 1)]! : int(r, 0, 239);
    const gross = l.price * l.qty;
    const proceeds = gross - cutFor(l.price, l.qty);
    const led = state.ledger;
    led.marketSoldValue = (led.marketSoldValue ?? 0) + gross;
    const sold = (led.marketSoldQty ??= {});
    sold[l.item] = (sold[l.item] ?? 0) + l.qty;
    const day = state.clock
      ? dayIndexOf(localMinute(state.clock.nowMs, state.clock.tzOffsetMin))
      : 0;
    deliverProceeds(state, { slot: buyer, item: l.item, qty: l.qty, coin: proceeds, day });
    emit(state.events, {
      type: 'marketSold',
      id: l.id,
      item: l.item,
      qty: l.qty,
      coin: proceeds,
      slot: buyer,
      hour,
    });
  }
}

/** One in-game hour of the market. */
function hourStep(state: SimState, hour: number, withSales: boolean): void {
  const m = state.market;
  const tick = hour * TIME.hourTicks;
  const marketDay = state.marketDay === true;
  const ann: { item: string; from: number; to: number }[] = [];
  for (const [item, b] of TRADEABLE) {
    const target = targetOf(state, item, b, tick);
    const p = m.prices[item] ?? target;
    let push = (m.pressure[item] ?? 0) + (marketDay ? MARKET.marketDayDemand : 0);
    push = Math.max(
      -MARKET.pressureCap,
      Math.min(MARKET.pressureCap, push * MARKET.pressurePerUnit),
    );
    const np = clamp(target + (p - target) * (1 - MARKET.decay) + b.base * push, b);
    m.prices[item] = round2(np);
    const said = m.said[item] ?? np;
    if (Math.abs(np - said) / said >= MARKET.announcePct / 100) {
      ann.push({ item, from: Math.round(said), to: Math.round(np) });
      m.said[item] = round2(np);
    } else m.said[item] ??= round2(np);
  }
  m.pressure = {};
  // Chat talks about the biggest few moves, not all of them.
  ann
    .sort((a, b) => Math.abs(b.to - b.from) / b.from - Math.abs(a.to - a.from) / a.from)
    .slice(0, 2)
    .forEach((a) =>
      emit(state.events, { type: 'priceMoved', item: a.item, from: a.from, to: a.to }),
    );
  if (withSales) sales(state, hour);
  const day = dayIndex(tick);
  if (day !== m.day) {
    m.day = day;
    for (const item of TRADEABLE.keys()) {
      const h = (m.history[item] ??= []);
      h.push(Math.round(m.prices[item]!));
      while (h.length > MARKET.historyDays) h.shift();
    }
  }
}

/** A long gap: the rest of the hours decay in one step, with no pressure and no sales. */
function decayGap(state: SimState, hours: number, hour: number): void {
  const m = state.market;
  const tick = hour * TIME.hourTicks;
  const k = (1 - MARKET.decay) ** hours;
  for (const [item, b] of TRADEABLE) {
    const target = targetOf(state, item, b, tick);
    m.prices[item] = round2(clamp(target + ((m.prices[item] ?? target) - target) * k, b));
  }
  m.pressure = {};
}

/** The market system: reads the tick's Traveler activity, and plays out each in-game hour that turned. */
export function marketSystem(state: SimState): void {
  const m = state.market;
  readEvents(state);
  const hour = Math.floor(state.worldTick / TIME.hourTicks);
  if (m.hour < 0) {
    for (const [item, b] of TRADEABLE) {
      m.prices[item] ??= round2(targetOf(state, item, b, hour * TIME.hourTicks));
      m.said[item] ??= m.prices[item]!;
      // The market was there before the player: its history opens flat at the opening price.
      m.history[item] ??= Array.from({ length: MARKET.historyDays }, () =>
        Math.round(m.prices[item]!),
      );
    }
    m.hour = hour;
    m.day = dayIndex(hour * TIME.hourTicks);
    return;
  }
  const gap = hour - m.hour;
  if (gap <= 0) return;
  const played = Math.min(gap, MARKET.catchUpHours);
  if (gap > played) decayGap(state, gap - played, m.hour + gap - played);
  for (let h = hour - played + 1; h <= hour; h++) hourStep(state, h, true);
  m.hour = hour;
}

// ---- The player ----

/** Lists `qty` from a bag slot at `price` each. Plain stacks only. False if it cannot go up. */
export function listItem(
  state: SimState,
  who: EntityId,
  slot: number,
  qty: number,
  price: number,
): boolean {
  const inv = getComp(state.entities, who, 'inventory');
  const a = getComp(state.entities, who, 'avatar');
  const m = state.market;
  const st = inv?.slots[slot];
  if (!inv || !a || !st || !Number.isInteger(qty) || qty < 1 || qty > st.qty) return false;
  if (st.q || st.mark || st.affixes?.length || st.dur !== undefined) return false;
  const b = TRADEABLE.get(st.item);
  if (!b || !Number.isInteger(price) || price < b.floor || price > b.ceil) return false;
  if (m.listings.length >= MARKET.maxListings) return false;
  const fee = feeFor(price, qty);
  if (a.coin < fee) return false;
  spendCoin(state, who, fee, 'marketFee');
  st.qty -= qty;
  if (st.qty === 0) inv.slots[slot] = null;
  const listed = (state.ledger.itemsListed ??= {});
  listed[st.item] = (listed[st.item] ?? 0) + qty;
  const id = m.nextId++;
  m.listings.push({ id, item: st.item, qty, price, at: Math.max(0, m.hour) });
  // Flooding: what the player puts up is supply this hour.
  pushPressure(state, st.item, -qty);
  emit(state.events, { type: 'marketListed', id, item: st.item, qty, price, fee });
  return true;
}

/** Takes a listing down: the goods come back to the bag (or the ground if it is full). The fee does not. */
export function cancelListing(state: SimState, who: EntityId, id: number): boolean {
  const m = state.market;
  const i = m.listings.findIndex((l) => l.id === id);
  const inv = getComp(state.entities, who, 'inventory');
  const p = getComp(state.entities, who, 'pos');
  if (i < 0 || !inv || !p) return false;
  const l = m.listings.splice(i, 1)[0]!;
  const left = addItem(inv, l.item, l.qty);
  if (left > 0) spawnPickup(state, l.item, left, p.x, p.y);
  emit(state.events, { type: 'marketCancelled', id, item: l.item, qty: l.qty });
  return true;
}

/** A Traveler's listing on the terminal: who, how many, and the price for one. */
export interface TravelerOffer {
  slot: number;
  qty: number;
  price: number;
}

/** What the player bought from each Traveler listing this session, by `hour|item|slot`. */
const boughtOf = (state: SimState): Map<string, number> => (state.marketTaken ??= new Map());

/**
 * Traveler listings for an item this hour, cheapest first: Travelers who work it (their focus) put
 * it up, each undercutting the one before by a little. Deterministic in the seed, the item and the
 * hour. What the player bought this hour is gone from them.
 */
export function travelerOffers(state: SimState, item: string): TravelerOffer[] {
  const b = TRADEABLE.get(item);
  if (!b) return [];
  const hour = Math.max(0, state.market.hour);
  const ids = identitiesOf(state.seed);
  const n = state.marketDay ? MARKET.marketDayListings : MARKET.travelerListings;
  const out: TravelerOffer[] = [];
  const now = priceOf(state, item);
  const taken = boughtOf(state);
  let k = 0;
  for (let i = 0; i < 240 && out.length < n; i++) {
    const slot = Math.floor(hash01(state.seed, i, 900 + item.length, hour * 31 + k++) * 240);
    if (out.some((o) => o.slot === slot)) continue;
    const t = ids[slot]!;
    if (
      t.archetype !== 'Trader' &&
      t.archetype !== 'Crafter' &&
      hash01(state.seed, slot, 901, hour) > 0.4
    )
      continue;
    // Each seller undercuts the one before by a few percent, and by at least a coin.
    const top = Math.round((now * (100 + 3 * MARKET.undercutPct)) / 100);
    const step = Math.max(1, Math.round((now * MARKET.undercutPct) / 100));
    const price = Math.max(b.floor, Math.min(b.ceil, top - out.length * step));
    const [lo, hi] = MARKET.travelerQty;
    const qty =
      lo +
      Math.floor(hash01(state.seed, slot, 902, hour) * (hi - lo + 1)) -
      (taken.get(`${hour}|${item}|${slot}`) ?? 0);
    if (qty > 0) out.push({ slot, qty, price });
  }
  return out.sort((a, c) => a.price - c.price || a.slot - c.slot);
}

/** Buys `qty` from a Traveler's listing at its price. */
export function buyFrom(
  state: SimState,
  who: EntityId,
  item: string,
  slot: number,
  qty: number,
): boolean {
  const a = getComp(state.entities, who, 'avatar');
  const offer = travelerOffers(state, item).find((o) => o.slot === slot);
  if (!a || !offer || !Number.isInteger(qty) || qty < 1 || qty > offer.qty) return false;
  const cost = offer.price * qty;
  if (a.coin < cost) return false;
  spendCoin(state, who, cost, 'marketBuy');
  give(state, who, item, qty, 'market');
  const tally = (state.ledger.itemsBought ??= {});
  tally[item] = (tally[item] ?? 0) + qty;
  const key = `${Math.max(0, state.market.hour)}|${item}|${slot}`;
  boughtOf(state).set(key, (boughtOf(state).get(key) ?? 0) + qty);
  const life = state.travelers[slot];
  if (life) life.coin = Math.min(PROGRESS.coinCap, life.coin + cost);
  // Cornering: what the player buys is demand this hour.
  pushPressure(state, item, qty);
  emit(state.events, { type: 'marketBought', item, qty, coin: cost, slot });
  return true;
}

/** A market command from the terminal. */
export function marketCommand(
  state: SimState,
  who: EntityId,
  c: {
    op: 'list' | 'cancel' | 'buy';
    slot?: number;
    qty?: number;
    price?: number;
    id?: number;
    item?: string;
    seller?: number;
  },
): void {
  if (c.op === 'list' && c.slot !== undefined && c.qty !== undefined && c.price !== undefined)
    listItem(state, who, c.slot, c.qty, c.price);
  else if (c.op === 'cancel' && c.id !== undefined) cancelListing(state, who, c.id);
  else if (c.op === 'buy' && c.item && c.seller !== undefined && c.qty !== undefined)
    buyFrom(state, who, c.item, c.seller, c.qty);
}
