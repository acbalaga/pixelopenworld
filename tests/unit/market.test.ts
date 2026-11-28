import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARKET } from '../../src/content/balance/market';
import { TIME } from '../../src/content/balance/time';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar } from '../../src/sim/avatar';
import { highestSell, lowestBuy } from '../../src/sim/economy';
import { addItem, countItem } from '../../src/sim/items';
import { earnCoin } from '../../src/sim/ledger';
import { claimLetter } from '../../src/sim/mail';
import { px } from '../../src/sim/kernel/fixed';
import { int, next, createStreams } from '../../src/sim/kernel/rng';
import {
  buyFrom,
  cancelListing,
  feeFor,
  listItem,
  marketSystem,
  netFor,
  newMarket,
  priceOf,
  TRADEABLE,
  travelerOffers,
} from '../../src/sim/market';
import {
  createDemoState,
  deserializeState,
  hashState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { honestPlain, plainFor, tamper } from '../support/saves';

/**
 * The market (POW-M5-10): bounded prices, no coin loop with the shops, flooding that wears off,
 * listings that sell by mail, buying from Travelers, the ledger rule and the save.
 */
function world(seed = 3): { s: SimState; me: number } {
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  s.weatherOverride = 'clear';
  const me = createAvatar(s, px(100), px(100));
  s.worldTick = 10 * TIME.hourTicks;
  marketSystem(s);
  return { s, me };
}

/** Plays out `n` in-game hours. */
function hours(s: SimState, n: number): void {
  for (let i = 0; i < n; i++) {
    s.worldTick += TIME.hourTicks;
    s.events.list.length = 0;
    marketSystem(s);
  }
}

const ITEMS = [...TRADEABLE.keys()];

describe('prices', () => {
  it('stay within their floor and ceiling over 10,000 random event sequences', () => {
    const { s, me } = world(5);
    earnCoin(s, me, 1_000_000, 'seed');
    const r = createStreams(99).misc;
    let checks = 0;
    for (let seq = 0; seq < 10_000; seq++) {
      const steps = int(r, 1, 4);
      for (let k = 0; k < steps; k++) {
        const item = ITEMS[int(r, 0, ITEMS.length - 1)]!;
        const kind = int(r, 0, 3);
        if (kind === 0) s.market.pressure[item] = (s.market.pressure[item] ?? 0) - int(r, 0, 5000);
        else if (kind === 1)
          s.market.pressure[item] = (s.market.pressure[item] ?? 0) + int(r, 0, 5000);
        else if (kind === 2) s.marketDay = next(r) < 0.5;
        else s.weatherOverride = (['clear', 'rain', 'storm', 'snow'] as const)[int(r, 0, 3)]!;
      }
      hours(s, int(r, 1, 3));
      if (seq % 97 === 0) hours(s, 400); // a long gap, decayed in one step
      for (const [item, b] of TRADEABLE) {
        const p = s.market.prices[item]!;
        expect(p).toBeGreaterThanOrEqual(b.floor);
        expect(p).toBeLessThanOrEqual(b.ceil);
        checks++;
      }
    }
    expect(checks).toBe(10_000 * TRADEABLE.size);
  }, 120_000);

  it('no loop between the market and the NPC shops gains coin over 1,000 cycles', () => {
    const r = createStreams(7).misc;
    let shopToMarket = 0;
    let marketToShop = 0;
    for (let cycle = 0; cycle < 1000; cycle++) {
      const item = ITEMS[int(r, 0, ITEMS.length - 1)]!;
      const b = TRADEABLE.get(item)!;
      const qty = int(r, 1, 20);
      // Buy from a shop at the very cheapest anyone can, list at the very most the market allows.
      const gain1 = netFor(b.ceil, qty) - lowestBuy(item) * qty;
      expect(gain1).toBeLessThan(0);
      shopToMarket += gain1;
      // Buy on the market at the very cheapest it goes, sell to a shop at the most a shop pays.
      const gain2 = highestSell(item) * qty - b.floor * qty;
      expect(gain2).toBeLessThan(0);
      marketToShop += gain2;
    }
    expect(shopToMarket).toBeLessThan(0);
    expect(marketToShop).toBeLessThan(0);
  });

  it('a real round trip through the terminal loses coin, never gains it', () => {
    const { s, me } = world(9);
    earnCoin(s, me, 10_000, 'seed');
    const a = s.entities.comps.avatar[me]!;
    for (let cycle = 0; cycle < 200; cycle++) {
      const item = ITEMS[cycle % ITEMS.length]!;
      const offer = travelerOffers(s, item)[0];
      if (!offer) continue;
      const before = a.coin;
      expect(buyFrom(s, me, item, offer.slot, 1)).toBe(true);
      // Sell it to the shop at the best a haggle could ever get.
      const inv = s.entities.comps.inventory[me]!;
      const slot = inv.slots.findIndex((x) => x?.item === item);
      inv.slots[slot]!.qty -= 1;
      if (inv.slots[slot]!.qty === 0) inv.slots[slot] = null;
      a.coin += highestSell(item);
      expect(a.coin).toBeLessThan(before);
    }
  });

  it('flooding drops the price, and it comes back to within 10% of base within 7 in-game days', () => {
    const { s, me } = world(11);
    const control = world(11).s;
    const item = 'item.copper_ingot';
    const b = TRADEABLE.get(item)!;
    expect(b).toBeDefined();
    earnCoin(s, me, 100_000, 'seed');
    const inv = s.entities.comps.inventory[me]!;
    const before = priceOf(s, item);
    for (let k = 0; k < 10; k++) {
      addItem(inv, item, 20);
      const slot = inv.slots.findIndex((x) => x?.item === item);
      expect(listItem(s, me, slot, 20, b.floor)).toBe(true);
      hours(s, 1);
      hours(control, 1);
      // Keep the listings out of the way: the flood is what was put up, not what sold.
      for (const l of [...s.market.listings]) cancelListing(s, me, l.id);
      inv.slots.fill(null);
    }
    const low = priceOf(s, item);
    expect(low).toBeLessThan(before);
    hours(s, 7 * 24);
    hours(control, 7 * 24);
    const gap = Math.abs(s.market.prices[item]! - control.market.prices[item]!);
    console.log(
      `Copper ingot: base ${b.base.toFixed(1)}, before ${before}, flooded ${low}, a week on ${priceOf(s, item)} (no flood ${priceOf(control, item)}).`,
    );
    expect(gap).toBeLessThanOrEqual(b.base * 0.1);
  });

  it('buying up an item raises its price (cornering), bounded', () => {
    const { s, me } = world(13);
    earnCoin(s, me, 1_000_000, 'seed');
    const item = 'item.salt';
    const before = priceOf(s, item);
    for (let h = 0; h < 6; h++) {
      for (const o of travelerOffers(s, item)) buyFrom(s, me, item, o.slot, o.qty);
      s.market.pressure[item] = (s.market.pressure[item] ?? 0) + 40;
      hours(s, 1);
    }
    expect(priceOf(s, item)).toBeGreaterThan(before);
    expect(priceOf(s, item)).toBeLessThanOrEqual(TRADEABLE.get(item)!.ceil);
  });
});

describe('listings', () => {
  it('a listing sells over time, the proceeds come by mail as marketSale, and can be taken once', () => {
    const { s, me } = world(15);
    earnCoin(s, me, 500, 'seed');
    const inv = s.entities.comps.inventory[me]!;
    const item = 'item.copper_ingot';
    addItem(inv, item, 5);
    const slot = inv.slots.findIndex((x) => x?.item === item);
    const price = TRADEABLE.get(item)!.floor;
    const coin0 = s.entities.comps.avatar[me]!.coin;
    expect(listItem(s, me, slot, 5, price)).toBe(true);
    expect(countItem(inv, item)).toBe(0);
    expect(s.entities.comps.avatar[me]!.coin).toBe(coin0 - feeFor(price, 5));
    for (let h = 0; h < 200 && s.market.listings.length > 0; h++) hours(s, 1);
    expect(s.market.listings).toHaveLength(0);
    const letter = s.mail.letters.find((l) => l.market)!;
    expect(letter).toBeDefined();
    expect(letter.coin).toBe(price * 5 - Math.ceil((price * 5 * MARKET.cutPct) / 100));
    expect(claimLetter(s, me, letter.id)).toBe(true);
    expect(claimLetter(s, me, letter.id)).toBe(false);
    expect(s.ledger.coinEarned.marketSale).toBe(letter.coin);
    expect(s.ledger.marketSoldValue).toBe(price * 5);
    expect(s.ledger.itemsListed?.[item]).toBe(5);
    expect(validateSave(plainFor(s)).reasons.map((r) => r.code)).toEqual([]);
  });

  it('a price out of bounds, a marked stack, or no coin for the fee cannot be listed', () => {
    const { s, me } = world(17);
    const inv = s.entities.comps.inventory[me]!;
    const item = 'item.copper_ingot';
    const b = TRADEABLE.get(item)!;
    addItem(inv, item, 3);
    const slot = inv.slots.findIndex((x) => x?.item === item);
    expect(listItem(s, me, slot, 3, b.floor)).toBe(false); // no coin for the fee
    earnCoin(s, me, 100, 'seed');
    expect(listItem(s, me, slot, 3, b.floor - 1)).toBe(false);
    expect(listItem(s, me, slot, 3, b.ceil + 1)).toBe(false);
    inv.slots[slot]!.mark = 1;
    expect(listItem(s, me, slot, 3, b.floor)).toBe(false);
  });

  it('Traveler listings undercut each other and name real Travelers', () => {
    const { s } = world(19);
    const offers = travelerOffers(s, 'item.copper_ingot');
    expect(offers.length).toBeGreaterThan(1);
    for (let i = 1; i < offers.length; i++)
      expect(offers[i]!.price).toBeGreaterThanOrEqual(offers[i - 1]!.price);
    for (const o of offers) expect(o.slot).toBeGreaterThanOrEqual(0);
  });

  it('history keeps one price per in-game day, at most 14', () => {
    const { s } = world(21);
    hours(s, 24 * 20);
    for (const h of Object.values(s.market.history)) expect(h.length).toBe(MARKET.historyDays);
  });
});

describe('integrity and the save', () => {
  it('a save whose market income exceeds its sold listings is flagged', () => {
    const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
    expect(codes(honestPlain())).not.toContain('MARKET_INCOME');
    const rich = tamper(honestPlain(), (st, who) => {
      st.entities.comps.avatar[who]!.coin += 900;
      st.ledger.coinEarned.marketSale = 900;
      st.ledger.marketSoldValue = 100;
    });
    expect(codes(rich)).toContain('MARKET_INCOME');
    const sold = tamper(honestPlain(), (st) => {
      st.ledger.marketSoldQty = { 'item.salt': 4 };
      st.ledger.itemsListed = { 'item.salt': 1 };
    });
    expect(codes(sold)).toContain('MARKET_INCOME');
  });

  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-33.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('schema 33 to 34 gives an old save an empty market and nothing else changes', async () => {
    expect(f.plain.schema).toBe(33);
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('market');
    const at34 = migrate(await decode(), MIGRATIONS, 34);
    expect(at34.schema).toBe(34);
    const s = deserializeState(at34.sim);
    expect(s.market).toEqual(newMarket());
    delete (s as { market?: unknown }).market;
    delete (s as { calendar?: unknown }).calendar;
    delete (s as { farm?: unknown }).farm;
    delete (s as { fishing?: unknown }).fishing;
    delete (s as { home?: unknown }).home;
    expect(hashState(s)).toBe(f.expectedHash);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });

  it('round trips through a save', () => {
    const { s } = world(23);
    hours(s, 30);
    const back = deserializeState(serializeState(s));
    expect(back.market).toEqual(s.market);
  });
});
