import { describe, expect, it } from 'vitest';
import { COOKING } from '../../src/content/balance/cooking';
import { DIALOGUES, SHOPS } from '../../src/content/dialogue';
import { CROP_LIST } from '../../src/content/farming/crops';
import { ITEMS } from '../../src/content/items';
import { ANIMAL_GOODS, COOKBOOKS, DISHES } from '../../src/content/items/dishes';
import { RECIPES } from '../../src/content/items/recipes';
import { STATIONS } from '../../src/content/items/stations';
import { taughtBy } from '../../src/content/items/types';
import { FIXTURES } from '../../src/content/world/fixtures';
import { SINGULARS } from '../../src/content/singulars';
import { validateSave } from '../../src/save/integrity';
import { sourcesOf } from '../../src/save/integrity/sources';
import { createAvatar } from '../../src/sim/avatar';
import { campMeal, isDish, mill, shareFood } from '../../src/sim/cooking';
import { px } from '../../src/sim/kernel/fixed';
import { addItem, countItem, give, readScroll } from '../../src/sim/items';
import { earnCoin } from '../../src/sim/ledger';
import { addMember, memberOf } from '../../src/sim/party';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { statusesOf } from '../../src/sim/statuses';
import { spawnNpc, talk } from '../../src/sim/systems/npcs';
import { crowdOf } from '../../src/sim/travelers/crowd';
import { standPx } from '../../src/sim/travelers/entities';
import { PLACE_LIST } from '../../src/sim/travelers/lists';
import { regardNow } from '../../src/sim/travelers/social';
import { findAvatar } from '../../src/shared/summary';
import { plainFor, tamper } from '../support/saves';

/** Cooking in full (POW-M6-04). */
const COOKS = Object.values(RECIPES).filter((r) => r.craft === 'cooking');
const ANIMAL = new Set(ANIMAL_GOODS);
const animalDish = (r: (typeof COOKS)[number]): boolean =>
  r.ingredients.some((i) => ANIMAL.has(i.item));

const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const SQUARE = standPx(0, PLACE_LIST.indexOf('hearthford.square'))!;

function world(seed: number): SimState {
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  s.weatherOverride = 'clear';
  createAvatar(s, px(SQUARE.x), px(SQUARE.y));
  s.worldTick = 9000;
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

function run(s: SimState, ticks: number): void {
  const me = findAvatar(s)!;
  for (let i = 0; i < ticks; i++) {
    const clock = { ...s.clock!, nowMs: s.clock!.nowMs + 33 };
    stepWorld(s, me, { commands: [], worldTick: s.worldTick + 1, clock });
  }
}

describe('the recipe set (M6-04)', () => {
  it('has 100 cooking recipes: 30 at tier 1, 30 at tier 2, 25 at tier 3 and 15 at tier 4', () => {
    expect(COOKS).toHaveLength(100);
    const at = (t: number): number => COOKS.filter((r) => r.tier === t).length;
    expect([at(1), at(2), at(3), at(4)]).toEqual([30, 30, 25, 15]);
    // The oven bakes bread, pies and roasts; the rest are at the pot.
    expect(STATIONS['fixture.oven']?.craft).toBe('cooking');
    expect(COOKS.filter((r) => r.station === 'fixture.oven').length).toBeGreaterThan(25);
  });

  it('learns about 60% by experiment, 20% taught, 10% bought and 10% found', () => {
    const n = (l: string): number => COOKS.filter((r) => r.learn === l).length;
    expect(n('experiment')).toBeGreaterThanOrEqual(55);
    expect(n('experiment')).toBeLessThanOrEqual(65);
    // Hesper's herb tea is taught by her in dialogue, as it was before M6-04.
    expect(n('teach') + 1).toBeGreaterThanOrEqual(18);
    expect(n('buy')).toBe(10);
    expect(n('find')).toBe(10);
  });

  it('writes ten dishes of animal goods, which wait for Husbandry', () => {
    expect(COOKS.filter(animalDish)).toHaveLength(10);
    for (const r of COOKS.filter(animalDish)) expect(r.learn, r.id).toBe('experiment');
  });

  it('uses every crop in at least two dishes, without counting the dishes of animal goods', () => {
    // Flour is wheat milled at Aldo's, so a dish with flour uses wheat.
    const uses = (item: string, crop: string): boolean =>
      item === crop || (crop === 'item.wheat' && item === 'item.flour');
    for (const c of CROP_LIST) {
      const n = COOKS.filter(
        (r) => !animalDish(r) && r.ingredients.some((i) => uses(i.item, c.result)),
      ).length;
      expect(n, c.result).toBeGreaterThanOrEqual(2);
    }
  });

  it('every dish is reachable: its ingredients can be had, and it can be learned', () => {
    // Items anything supplies outright, then everything a recipe makes from those, to a fixed point.
    const outright = (id: string): boolean =>
      sourcesOf(id).some((x) => !['buyback', 'seed', 'craft', 'cook'].includes(x));
    const have = new Set(Object.keys(ITEMS).filter(outright));
    for (let grew = true; grew;) {
      grew = false;
      for (const r of Object.values(RECIPES))
        if (r.result && !have.has(r.result) && r.ingredients.every((i) => have.has(i.item))) {
          have.add(r.result);
          grew = true;
        }
    }
    const taught = new Set(
      Object.values(DIALOGUES).flatMap((d) =>
        Object.values(d.nodes).flatMap((n) =>
          [...(n.do ?? []), ...(n.choices ?? []).flatMap((c) => c.do ?? [])].flatMap((e) =>
            'learnRecipe' in e ? [e.learnRecipe] : [],
          ),
        ),
      ),
    );
    const sold = new Set(Object.values(SHOPS).flatMap((s) => s.stock.map((x) => x.item)));
    const looted = new Set(
      Object.values(FIXTURES).flatMap((f) => (f.loot?.items ?? []).map((x) => x.item)),
    );
    // A Singular's reward teaches its recipe outright (the Baker's Peel, M4-20).
    for (const g of Object.values(SINGULARS))
      for (const e of g.reward) if ('learnRecipe' in e) taught.add(e.learnRecipe);
    const inBook = (id: string, where: Set<string>): boolean =>
      Object.values(ITEMS).some((i) => where.has(i.id) && taughtBy(i).includes(id));
    for (const r of COOKS) {
      const learnable =
        r.learn === 'experiment' ||
        (r.learn === 'teach' && taught.has(r.id)) ||
        (r.learn === 'buy' && inBook(r.id, sold)) ||
        (r.learn === 'find' && (inBook(r.id, looted) || taught.has(r.id)));
      expect(learnable, `${r.id} (${r.learn}) cannot be learned`).toBe(true);
      if (animalDish(r)) expect(have.has(r.result), r.id).toBe(false);
      else expect(have.has(r.result), `${r.id}: an ingredient cannot be had`).toBe(true);
    }
  });

  it('a cookbook teaches every recipe in it, and is kept if it teaches nothing new', () => {
    const s = world(3);
    const me = findAvatar(s)!;
    const inv = s.entities.comps.inventory[me]!;
    give(s, me, COOKBOOKS.old, 1, 'chest');
    const slot = inv.slots.findIndex((x) => x?.item === COOKBOOKS.old);
    expect(readScroll(s, me, slot)).toBe(true);
    const want = DISHES.filter((d) => d.from === COOKBOOKS.old).map((d) => `recipe.${d.key}`);
    expect(want.length).toBeGreaterThan(1);
    for (const r of want) expect(inv.recipes).toContain(r);
    give(s, me, COOKBOOKS.old, 1, 'chest');
    const again = inv.slots.findIndex((x) => x?.item === COOKBOOKS.old);
    expect(readScroll(s, me, again)).toBe(false);
    expect(countItem(inv, COOKBOOKS.old)).toBe(1);
  });

  it('a teacher teaches a dish in dialogue, once', () => {
    const s = world(3);
    const me = findAvatar(s)!;
    const f = s.entities.comps.pos[me]!;
    spawnNpc(s, 'npc.cook', Math.floor(f.x / 256 / 16) + 1, Math.floor(f.y / 256 / 16));
    const node = DIALOGUES['npc.cook']!.nodes['cook_teach']!;
    const k = node.choices!.findIndex((c) => c.text === 'dlg.cook.t_hop_tea');
    expect(k).toBeGreaterThanOrEqual(0);
    talk(s, me, { npc: 'npc.cook', node: 'cook_teach', choice: k });
    expect(s.entities.comps.inventory[me]!.recipes).toContain('recipe.hop_tea');
  });

  it('marks dishes as gifts and as stall-ready', () => {
    for (const d of DISHES) {
      expect(isDish(`item.${d.key}`), d.key).toBe(true);
      expect(ITEMS[`item.${d.key}`]?.stall, d.key).toBe(true);
    }
    expect(isDish('item.herb_tea')).toBe(true);
    expect(isDish('item.turnip')).toBe(false);
  });
});

describe('camp meals (M6-04)', () => {
  it('a meal at the camp pot feeds every party member in range and nobody out of range', () => {
    const s = world(7);
    run(s, 60);
    const me = findAvatar(s)!;
    const c = crowdOf(s);
    const slots: number[] = [];
    for (let i = 0; i < 240 && slots.length < 4; i++)
      if (c.online[i] && !memberOf(s, i)) slots.push(i);
    for (const slot of slots) addMember(s, slot, 'dungeon.rootway');
    run(s, 300);
    const ents = slots.map((slot) => c.entOf[slot] ?? -1);
    expect(ents.every((e) => e >= 0)).toBe(true);
    const mine = s.entities.comps.pos[me]!;
    // Two stand by the pot, two are sent away.
    ents.forEach((e, k) => {
      const p = s.entities.comps.pos[e]!;
      const off = k < 2 ? 16 : COOKING.campPx + 40;
      p.x = mine.x + px(off);
      p.y = mine.y;
    });
    const fed = campMeal(s, me, 'item.hearty_stew');
    expect(fed.sort()).toEqual(slots.slice(0, 2).sort());
    ents.forEach((e, k) => {
      const has = statusesOf(s, e).some((st) => st.id === 'fed' && st.item === 'item.hearty_stew');
      expect(has, `member ${k}`).toBe(k < 2);
    });
    expect(s.events.list.some((e) => e.type === 'campMeal')).toBe(true);
  });

  it('nobody is fed without a party', () => {
    const s = world(7);
    expect(campMeal(s, findAvatar(s)!, 'item.hearty_stew')).toEqual([]);
  });
});

describe('Share food (M6-04)', () => {
  it('gives a dish to a Traveler here, who remembers it as a gift, once a day for regard', () => {
    const s = world(9);
    run(s, 60);
    const me = findAvatar(s)!;
    const c = crowdOf(s);
    const slot = c.entOf.findIndex((e) => e >= 0);
    expect(slot).toBeGreaterThanOrEqual(0);
    const life = s.travelers[slot]!;
    const now = Math.floor((s.clock!.nowMs + s.clock!.tzOffsetMin * 60_000) / 60_000);
    const before = regardNow(life, now);
    // Only the stew in the Bag: the starter bread would be shared first.
    const inv = s.entities.comps.inventory[me]!;
    inv.slots = inv.slots.map((x) => (x && isDish(x.item) ? null : x));
    give(s, me, 'item.hearty_stew', 2, 'cook');
    expect(shareFood(s, me, slot)).toBe(true);
    expect(countItem(s.entities.comps.inventory[me]!, 'item.hearty_stew')).toBe(1);
    const after = regardNow(life, now);
    expect(after).toBeGreaterThan(before);
    expect(shareFood(s, me, slot)).toBe(true);
    expect(regardNow(life, now)).toBe(after);
    expect(shareFood(s, me, slot)).toBe(false);
  });
});

describe("Aldo's mill (M6-04)", () => {
  it('mills two wheat into a flour for the fee, and refuses without them', () => {
    const s = world(3);
    const me = findAvatar(s)!;
    const inv = s.entities.comps.inventory[me]!;
    expect(mill(s, me)).toBe(false);
    give(s, me, 'item.wheat', 3, 'harvest');
    earnCoin(s, me, COOKING.mill.fee, 'loot');
    expect(mill(s, me)).toBe(true);
    expect(countItem(inv, 'item.flour')).toBe(1);
    expect(countItem(inv, 'item.wheat')).toBe(1);
    expect(s.entities.comps.avatar[me]!.coin).toBe(0);
    expect(mill(s, me)).toBe(false);
  });

  it('flour edited into the ledger without the fee paid is caught', () => {
    const s = world(3);
    const me = findAvatar(s)!;
    s.ledger.harvests = 1;
    give(s, me, 'item.wheat', 2, 'harvest');
    s.ledger.kills['creature.mossling'] = 10;
    earnCoin(s, me, COOKING.mill.fee, 'loot');
    mill(s, me);
    s.tick = 3000;
    const plain = plainFor(s, { playSeconds: 100 });
    const codes = (p: typeof plain): string[] => validateSave(p).reasons.map((r) => r.code);
    expect(codes(plain)).not.toContain('MILL_MISMATCH');
    const bad = tamper(plain, (st, who) => {
      give(st, who, 'item.flour', 5, 'mill');
    });
    expect(codes(bad)).toContain('MILL_MISMATCH');
    // Flour from nowhere at all is caught too.
    const free = tamper(plain, (st, who) => {
      addItem(st.entities.comps.inventory[who]!, 'item.flour', 5);
    });
    expect(codes(free)).toContain('ITEMS_EXCEED_MADE');
  });
});
