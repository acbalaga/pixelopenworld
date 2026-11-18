import { describe, expect, it } from 'vitest';
import { SHOP_BALANCE as B } from '../../src/content/balance/shop';
import { SHOPS } from '../../src/content/dialogue';
import { ITEMS } from '../../src/content/items';
import { RECIPES } from '../../src/content/items/recipes';
import type { Quality } from '../../src/content/items/types';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import {
  acceptChance,
  answer,
  bestPrice,
  buyPrice,
  counterPrice,
  highestSell,
  haggleRounds,
  lowestBuy,
  offerPrice,
  repairCost,
  sellPrice,
} from '../../src/sim/economy';
import { addItem, countItem } from '../../src/sim/items';
import { validateCommand, type Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { dayIndex } from '../../src/sim/time';
import {
  createDemoState,
  deserializeState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { onShelf, tradeSystem } from '../../src/sim/trade';
import { TIME } from '../../src/content/balance/time';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};
const BRIN = 'shop.brin';

interface Rig {
  s: SimState;
  me: number;
  keeper: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
}

/** The avatar at tile (20, 20) with Brin one tile north, a purse of coin, and a log of events. */
function rig(seed = 7, coin = 500): Rig {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  const me = createAvatar(s, feetAt(20, 20).x, feetAt(20, 20).y);
  s.entities.comps.avatar[me]!.coin = coin;
  const keeper = spawnNpc(s, 'npc.shopkeeper', 20, 19);
  const events: SimEvent[] = [];
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds });
    events.push(...s.events.list);
  };
  tick();
  events.length = 0;
  return { s, me, keeper, events, tick };
}
const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const coin = (r: Rig) => r.s.entities.comps.avatar[r.me]!.coin;
const npc = (r: Rig) => r.s.entities.comps.npc[r.keeper]!;
const inv = (r: Rig) => r.s.entities.comps.inventory[r.me]!;
const haggleCmd = (step: 'low' | 'fair' | 'accept' | 'cancel'): Command => ({
  type: 'haggle',
  shop: BRIN,
  step,
});
const startBuy = (item: string): Command => ({
  type: 'haggle',
  shop: BRIN,
  step: 'start',
  item,
  dir: 'buy',
});

describe('prices', () => {
  it('buy and sell follow the table: value, rate, region and quality', () => {
    expect(buyPrice('item.dish_bread')).toBe(
      Math.max(1, Math.round(((ITEMS['item.dish_bread']?.value ?? 0) * B.buyPct) / 100)),
    );
    expect(sellPrice('item.sword_bronze')).toBe(
      Math.floor(((ITEMS['item.sword_bronze']?.value ?? 0) * B.sellPct) / 100),
    );
    const v0 = sellPrice('item.sword_bronze', 0);
    const v3 = sellPrice('item.sword_bronze', 3);
    expect(v3).toBeGreaterThan(v0);
    expect(v3).toBe(
      Math.floor(
        ((ITEMS['item.sword_bronze']?.value ?? 0) * B.sellPct * (B.qualityPct[3] ?? 100)) / 10000,
      ),
    );
    expect(buyPrice('item.sword_bronze', 0, 'nowhere')).toBe(buyPrice('item.sword_bronze'));
  });

  it('repairs cost value times wear times repairPct', () => {
    expect(repairCost('item.sword_bronze', 50, 50)).toBe(0);
    const value = ITEMS['item.sword_bronze']!.value;
    expect(repairCost('item.sword_bronze', 0, 50)).toBe(Math.round((value * B.repairPct) / 100));
    expect(repairCost('item.sword_bronze', 25, 50)).toBe(
      Math.round((value * 0.5 * B.repairPct) / 100),
    );
    expect(repairCost('item.sword_bronze', 49, 50)).toBeGreaterThanOrEqual(1);
  });

  it('Read the Room adds one exchange', () => {
    expect(haggleRounds(0)).toBe(B.haggleRounds);
    expect(haggleRounds(B.readTheRoomPoints)).toBe(B.haggleRounds + 1);
  });
});

describe('no buy and sell loop makes coin', () => {
  /**
   * Every price a haggle can end at, for `rounds` exchanges: take the standing price, or make
   * either offer and have it taken or countered, again and again.
   */
  function reachable(dir: 'buy' | 'sell', open: number, rounds: number): Set<number> {
    const out = new Set<number>([open]);
    const walk = (cur: number, left: number): void => {
      if (left === 0) return;
      for (const kind of ['low', 'fair'] as const) {
        const ask = offerPrice(dir, open, kind);
        const better = dir === 'buy' ? ask < cur : ask > cur;
        if (!better) continue;
        out.add(ask);
        const next = counterPrice(dir, cur, ask);
        out.add(next);
        walk(next, left - 1);
      }
    };
    walk(open, rounds);
    return out;
  }

  it('for every item, quality, region and haggle outcome the cheapest buy beats the dearest sell', () => {
    let checked = 0;
    for (const item of Object.values(ITEMS)) {
      if (item.value <= 0) continue;
      for (const q of [0, 1, 2, 3] as Quality[]) {
        for (const region of Object.keys(B.regionPct)) {
          const buys = reachable('buy', buyPrice(item.id, q, region), haggleRounds(100));
          const sells = reachable('sell', sellPrice(item.id, q, region), haggleRounds(100));
          // The Haggler Path takes a further percent off whatever the price is.
          const cheapest = Math.min(
            ...[...buys].map((p) => Math.max(1, Math.ceil((p * (100 - B.hagglerPathPct)) / 100))),
          );
          const dearest = Math.max(...sells);
          expect(cheapest, `${item.id} q${q} ${region}`).toBeGreaterThan(dearest);
          // The shortcut bounds used by the validator are at least as tight.
          expect(lowestBuy(item.id, q, region)).toBeLessThanOrEqual(cheapest);
          expect(highestSell(item.id, q, region)).toBeGreaterThanOrEqual(dearest);
          expect(lowestBuy(item.id, q, region)).toBeGreaterThan(highestSell(item.id, q, region));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('a haggle never moves a price past haggleMaxPct', () => {
    for (const open of [1, 2, 3, 7, 40, 150, 999]) {
      expect(bestPrice('buy', open)).toBeGreaterThanOrEqual(
        Math.floor((open * (100 - B.haggleMaxPct)) / 100),
      );
      expect(bestPrice('sell', open)).toBeLessThanOrEqual(
        Math.ceil((open * (100 + B.haggleMaxPct)) / 100),
      );
    }
  });

  it('odds rise with Bartering, fall with firmness, and stay inside their bounds', () => {
    expect(acceptChance('fair', 50, 20)).toBeGreaterThan(acceptChance('fair', 0, 20));
    expect(acceptChance('fair', 0, 50)).toBeLessThan(acceptChance('fair', 0, 10));
    expect(acceptChance('low', 0, 100)).toBe(B.accept.floor);
    expect(acceptChance('fair', 100, 0)).toBe(B.accept.ceil);
    expect(answer(0, 50)).toBe('accept');
    expect(answer(50, 50)).toBe('counter');
    expect(answer(50 + B.counterPct, 50)).toBe('refuse');
  });
});

describe('buying and selling', () => {
  it('buys at the opening price from the shelf, and the shelf runs out', () => {
    const r = rig();
    const left = onShelf(r.s, BRIN, 'item.cap_wool');
    expect(left).toBe(3);
    for (let i = 0; i < left; i++)
      r.tick({ type: 'buy', shop: BRIN, item: 'item.cap_wool', qty: 1 });
    expect(ofType(r.events, 'bought')).toHaveLength(left);
    expect(coin(r)).toBe(500 - left * buyPrice('item.cap_wool'));
    r.events.length = 0;
    r.tick({ type: 'buy', shop: BRIN, item: 'item.cap_wool', qty: 1 });
    expect(ofType(r.events, 'shopDenied')[0]).toMatchObject({ reason: 'stock' });
    expect(r.s.ledger.itemsMade.shop?.['item.cap_wool']).toBe(left);
  });

  it('sells only what the shop takes, and records it as sold', () => {
    const r = rig();
    addItem(inv(r), 'item.moss_tuft', 3);
    const slot = inv(r).slots.findIndex((x) => x?.item === 'item.moss_tuft');
    r.tick({ type: 'sell', shop: BRIN, slot, qty: 2 });
    expect(ofType(r.events, 'sold')[0]).toMatchObject({ item: 'item.moss_tuft', qty: 2 });
    expect(r.s.ledger.itemsSold['item.moss_tuft']).toBe(2);
    r.events.length = 0;
    // Mara's trade is tailoring: Tobin does not take tufts of moss (not in his Bag filters).
    expect(SHOPS['shop.tobin']!.buys).not.toContain('other');
    r.tick({ type: 'sell', shop: 'shop.tobin', slot, qty: 1 });
    expect(ofType(r.events, 'shopDenied')).toHaveLength(1);
  });

  it('shelves, lost haggles and buyback all reset at dawn, from the world clock', () => {
    const r = rig();
    for (let i = 0; i < 3; i++) r.tick({ type: 'buy', shop: BRIN, item: 'item.cap_wool', qty: 1 });
    addItem(inv(r), 'item.moss_tuft', 1);
    r.tick({
      type: 'sell',
      shop: BRIN,
      slot: inv(r).slots.findIndex((x) => x?.item === 'item.moss_tuft'),
      qty: 1,
    });
    npc(r).locked.push('item.dish_bread');
    expect(onShelf(r.s, BRIN, 'item.cap_wool')).toBe(0);
    expect(npc(r).buyback).toHaveLength(1);
    // Save and load: the shop is the same, still empty.
    const loaded = deserializeState(serializeState(r.s), OPEN);
    const lk = loaded.entities.comps.npc.findIndex((n) => n?.id === 'npc.shopkeeper');
    expect(loaded.entities.comps.npc[lk]!.stock['item.cap_wool']).toBe(0);
    // The same day: nothing changes.
    loaded.worldTick = r.s.worldTick + 10;
    tradeSystem(loaded);
    expect(loaded.entities.comps.npc[lk]!.stock['item.cap_wool']).toBe(0);
    // Move the world clock past the next dawn, as if the game had been closed overnight.
    const cycle = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;
    loaded.worldTick = loaded.worldTick + cycle;
    expect(dayIndex(loaded.worldTick)).toBeGreaterThan(loaded.entities.comps.npc[lk]!.day);
    tradeSystem(loaded);
    const n = loaded.entities.comps.npc[lk]!;
    expect(n.stock['item.cap_wool']).toBe(3);
    expect(n.locked).toEqual([]);
    expect(n.buyback).toEqual([]);
  });
});

describe('haggling', () => {
  /** Plays a script of offers against a fresh rig and returns what the shopkeeper did. */
  function play(seed: number, script: ('low' | 'fair' | 'accept')[], item = 'item.shield_wood') {
    const r = rig(seed);
    r.tick(startBuy(item));
    for (const step of script) r.tick(haggleCmd(step));
    return { r, steps: ofType(r.events, 'haggleStep'), ended: ofType(r.events, 'haggleEnded') };
  }

  it('is deterministic: the same seed and choices give the same price and the same coin', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const a = play(seed, ['low', 'fair', 'accept']);
      const b = play(seed, ['low', 'fair', 'accept']);
      expect(b.steps).toEqual(a.steps);
      expect(b.ended).toEqual(a.ended);
      expect(coin(b.r)).toBe(coin(a.r));
    }
  });

  it('every outcome is seen across seeds, and a price never leaves its bounds', () => {
    const seen = new Set<string>();
    const open = buyPrice('item.shield_wood');
    for (let seed = 1; seed <= 120; seed++) {
      const { r, steps, ended } = play(seed, ['low', 'low', 'accept']);
      for (const st of steps) {
        seen.add(st.result);
        expect(st.price).toBeLessThanOrEqual(open);
        expect(st.price).toBeGreaterThanOrEqual(bestPrice('buy', open));
      }
      // Whatever happened, the shop was paid at most the opening price and at least the best.
      for (const e of ended) {
        expect(e.price).toBeLessThanOrEqual(open);
        expect(e.price).toBeGreaterThanOrEqual(bestPrice('buy', open));
      }
      const refused = steps.some((x) => x.result === 'refuse');
      expect(npc(r).locked.includes('item.shield_wood')).toBe(refused);
    }
    expect([...seen].sort()).toEqual(['accept', 'counter', 'open', 'refuse']);
  });

  it('a lost haggle keeps the opening price, and that item is closed to haggling until dawn', () => {
    let found = false;
    for (let seed = 1; seed <= 200 && !found; seed++) {
      const r = rig(seed);
      r.tick(startBuy('item.shield_wood'));
      r.tick(haggleCmd('low'));
      if (!ofType(r.events, 'haggleStep').some((x) => x.result === 'refuse')) continue;
      found = true;
      expect(ofType(r.events, 'haggleEnded')[0]).toMatchObject({
        won: false,
        price: buyPrice('item.shield_wood'),
      });
      expect(coin(r)).toBe(500);
      r.events.length = 0;
      r.tick(startBuy('item.shield_wood'));
      expect(ofType(r.events, 'shopDenied')[0]).toMatchObject({ reason: 'locked' });
      // Another item is still open, and the opening price still buys.
      r.tick(startBuy('item.cap_wool'));
      expect(ofType(r.events, 'haggleStep')).toHaveLength(1);
      r.tick(haggleCmd('cancel'));
      r.events.length = 0;
      r.tick({ type: 'buy', shop: BRIN, item: 'item.shield_wood', qty: 1 });
      expect(ofType(r.events, 'bought')).toHaveLength(1);
    }
    expect(found).toBe(true);
  });

  it('taking the price standing buys it, a win pays Bartering XP, and the shop is paid', () => {
    let won = false;
    for (let seed = 1; seed <= 200 && !won; seed++) {
      const { r, ended } = play(seed, ['fair']);
      const e = ended[0];
      if (!e?.won) continue;
      won = true;
      expect(coin(r)).toBe(500 - e.price);
      expect(countItem(inv(r), 'item.shield_wood')).toBe(1);
      expect(onShelf(r.s, BRIN, 'item.shield_wood')).toBe(2);
      expect(ofType(r.events, 'haggleWon')).toHaveLength(1);
      const sk = r.s.entities.comps.skills[r.me]!;
      expect((sk.xp['skill.bartering'] ?? 0) + (sk.points['skill.bartering'] ?? 0)).toBeGreaterThan(
        0,
      );
    }
    expect(won).toBe(true);
    // Accepting the opening price is no win.
    const r = rig();
    r.tick(startBuy('item.shield_wood'));
    r.tick(haggleCmd('accept'));
    expect(ofType(r.events, 'haggleEnded')[0]).toMatchObject({
      won: false,
      price: buyPrice('item.shield_wood'),
    });
    expect(ofType(r.events, 'haggleWon')).toHaveLength(0);
  });

  it('exchanges are limited, and Read the Room gives one more', () => {
    const used = (points: number): number => {
      for (let seed = 1; seed <= 200; seed++) {
        const r = rig(seed);
        r.s.entities.comps.skills[r.me]!.points['skill.bartering'] = points;
        r.tick(startBuy('item.shield_wood'));
        for (let i = 0; i < 6; i++) r.tick(haggleCmd('fair'));
        const h = r.s.entities.comps.haggle[r.me];
        if (h && h.round >= h.rounds) return h.round;
      }
      return -1;
    };
    expect(used(0)).toBe(B.haggleRounds);
    expect(used(B.readTheRoomPoints)).toBe(B.haggleRounds + 1);
  });

  it('walking away ends it, and so does leaving the counter', () => {
    const r = rig();
    r.tick(startBuy('item.shield_wood'));
    expect(r.s.entities.comps.haggle[r.me]).not.toBeNull();
    r.tick(haggleCmd('cancel'));
    expect(r.s.entities.comps.haggle[r.me]).toBeNull();
    r.tick(startBuy('item.shield_wood'));
    r.s.entities.comps.pos[r.me]!.x += 200 * 256;
    r.tick();
    expect(r.s.entities.comps.haggle[r.me]).toBeNull();
    expect(coin(r)).toBe(500);
  });

  it('can be done selling, and the price only moves up', () => {
    const r = rig();
    addItem(inv(r), 'item.moss_tuft', 1);
    const slot = inv(r).slots.findIndex((x) => x?.item === 'item.moss_tuft');
    r.tick({ type: 'haggle', shop: BRIN, step: 'start', dir: 'sell', slot });
    const open = sellPrice('item.moss_tuft');
    expect(ofType(r.events, 'haggleStep')[0]).toMatchObject({ price: open, result: 'open' });
    r.tick(haggleCmd('accept'));
    expect(ofType(r.events, 'sold')[0]).toMatchObject({ item: 'item.moss_tuft', coin: open });
  });
});

describe('buyback', () => {
  it('returns a sold stack as it was, at the price it fetched, and records both ends', () => {
    const r = rig();
    addItem(inv(r), 'item.sword_bronze', 1, { q: 2 });
    const slot = inv(r).slots.findIndex((x) => x?.item === 'item.sword_bronze');
    inv(r).slots[slot]!.dur = 7;
    const before = coin(r);
    r.tick({ type: 'sell', shop: BRIN, slot, qty: 1 });
    const got = coin(r) - before;
    expect(got).toBe(sellPrice('item.sword_bronze', 2));
    expect(npc(r).buyback).toHaveLength(1);
    r.tick({ type: 'buyback', shop: BRIN, index: 0 });
    expect(coin(r)).toBe(before);
    const back = inv(r).slots.find((x) => x?.item === 'item.sword_bronze')!;
    expect(back).toMatchObject({ q: 2, dur: 7 });
    expect(npc(r).buyback).toHaveLength(0);
    expect(r.s.ledger.itemsSold['item.sword_bronze']).toBe(1);
    expect(r.s.ledger.itemsMade.buyback?.['item.sword_bronze']).toBe(1);
    expect(r.s.ledger.coinSpent.buyback).toBe(got);
  });

  it('keeps the last ten, and refuses what is not there', () => {
    const r = rig(7, 2000);
    for (let i = 0; i < 12; i++) {
      addItem(inv(r), 'item.moss_tuft', 1);
      r.tick({
        type: 'sell',
        shop: BRIN,
        slot: inv(r).slots.findIndex((x) => x?.item === 'item.moss_tuft'),
        qty: 1,
      });
    }
    expect(npc(r).buyback.length).toBeLessThanOrEqual(B.buybackSlots);
    r.events.length = 0;
    r.tick({ type: 'buyback', shop: BRIN, index: 40 });
    expect(ofType(r.events, 'shopDenied')[0]).toMatchObject({ reason: 'nothing' });
  });
});

describe('repair service', () => {
  it('Brin mends worn and carried gear for coin, and nobody else does', () => {
    const r = rig();
    addItem(inv(r), 'item.sword_bronze', 1);
    const slot = inv(r).slots.findIndex((x) => x?.item === 'item.sword_bronze');
    const max = ITEMS['item.sword_bronze']!.durability!;
    inv(r).slots[slot]!.dur = 0;
    const cost = repairCost('item.sword_bronze', 0, max);
    r.tick({ type: 'mend', shop: BRIN, from: 'bag', slot });
    expect(ofType(r.events, 'mended')[0]).toMatchObject({ coin: cost });
    expect(inv(r).slots[slot]!.dur).toBe(max);
    expect(coin(r)).toBe(500 - cost);
    expect(r.s.ledger.coinSpent.repair).toBe(cost);
    // A whole item costs nothing and is refused.
    r.events.length = 0;
    r.tick({ type: 'mend', shop: BRIN, from: 'bag', slot });
    expect(ofType(r.events, 'shopDenied')[0]).toMatchObject({ reason: 'nothing' });
    // The worn weapon too.
    const worn = inv(r).equipment.main!;
    worn.dur = 1;
    r.events.length = 0;
    r.tick({ type: 'mend', shop: BRIN, from: 'worn', slot: 0 });
    expect(ofType(r.events, 'mended')).toHaveLength(1);
    expect(worn.dur).toBe(ITEMS[worn.item]!.durability);
    // Tobin does not repair.
    inv(r).slots[slot]!.dur = 0;
    r.events.length = 0;
    r.tick({ type: 'mend', shop: 'shop.tobin', from: 'bag', slot });
    expect(ofType(r.events, 'mended')).toHaveLength(0);
  });
});

describe('recipe scrolls', () => {
  it('are sold by Brin, bought under their own sink, and read to learn the recipe', () => {
    const r = rig();
    const scroll = 'item.scroll_sword_iron';
    expect(ITEMS[scroll]!.teaches).toBe('recipe.sword_iron');
    expect(RECIPES['recipe.sword_iron']).toBeDefined();
    r.tick({ type: 'buy', shop: BRIN, item: scroll, qty: 1 });
    expect(r.s.ledger.coinSpent.recipe).toBe(buyPrice(scroll));
    expect(r.s.ledger.coinSpent.purchase ?? 0).toBe(0);
    const slot = inv(r).slots.findIndex((x) => x?.item === scroll);
    expect(inv(r).recipes).not.toContain('recipe.sword_iron');
    r.tick({ type: 'use', slot });
    expect(inv(r).recipes).toContain('recipe.sword_iron');
    expect(countItem(inv(r), scroll)).toBe(0);
  });
});

describe('commands', () => {
  it('validate the trade commands and drop malformed ones', () => {
    const ok = (c: unknown) => validateCommand(c).ok;
    expect(ok({ type: 'buyback', shop: BRIN, index: 2 })).toBe(true);
    expect(ok({ type: 'buyback', shop: BRIN, index: -1 })).toBe(false);
    expect(ok({ type: 'mend', shop: BRIN, from: 'bag', slot: 3 })).toBe(true);
    expect(ok({ type: 'mend', shop: BRIN, from: 'sky', slot: 3 })).toBe(false);
    expect(
      ok({ type: 'haggle', shop: BRIN, step: 'start', dir: 'buy', item: 'item.cap_wool' }),
    ).toBe(true);
    expect(ok({ type: 'haggle', shop: BRIN, step: 'start', dir: 'sell', slot: 4 })).toBe(true);
    expect(ok({ type: 'haggle', shop: BRIN, step: 'start', dir: 'buy' })).toBe(false);
    expect(ok({ type: 'haggle', shop: BRIN, step: 'shout' })).toBe(false);
    expect(ok({ type: 'haggle', shop: 'nope', step: 'low' })).toBe(false);
    expect(ok({ type: 'haggle', shop: BRIN, step: 'low' })).toBe(true);
  });
});

describe('content', () => {
  it('every shop names real items, a real region and buys something; scrolls teach real recipes', () => {
    for (const shop of Object.values(SHOPS)) {
      expect(B.regionPct[shop.region], shop.id).toBeDefined();
      expect(shop.buys.length).toBeGreaterThan(0);
      for (const s of shop.stock) {
        expect(ITEMS[s.item], s.item).toBeDefined();
        expect(s.max).toBeGreaterThanOrEqual(1);
      }
    }
    for (const item of Object.values(ITEMS))
      if (item.teaches) expect(RECIPES[item.teaches], item.id).toBeDefined();
  });
});
