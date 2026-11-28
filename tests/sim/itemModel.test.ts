import { describe, expect, it } from 'vitest';
import { FARMING_ITEMS } from '../../src/content/items/farming';
import { ITEMS_BALANCE as B } from '../../src/content/balance/items';
import { AFFIXES } from '../../src/content/items/affixes';
import { ITEMS } from '../../src/content/items';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import {
  addItem,
  addStack,
  canHold,
  countItem,
  equip,
  gearStats,
  isBroken,
  moveStorage,
  newStack,
  removeItem,
  sameStack,
  useTool,
  wearSystem,
} from '../../src/sim/items';
import type { SimEvent } from '../../src/sim/kernel/events';
import { activeMods, applyMods } from '../../src/sim/mods';
import { createDemoState, type ItemStack, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';

const OPEN = { solidAt: (): number => 0 };

function world(): { s: SimState; me: number } {
  const s = createDemoState(5, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  return { s, me: createAvatar(s, f.x, f.y) };
}
const inv = (s: SimState, me: number) => s.entities.comps.inventory[me]!;
const sword = ITEMS['item.sword_iron']!;

describe('gear stats', () => {
  it('scale with quality, in the percents of balance data', () => {
    const base = sword.equip!.power!;
    const at = (q: 0 | 1 | 2 | 3) => gearStats(sword, { ...newStack(sword.id, 1), q }).power;
    expect(at(0)).toBe(base);
    for (const q of [1, 2, 3] as const)
      expect(at(q)).toBe(Math.floor((base * B.qualityPct[q]!) / 100));
    expect(at(3)).toBeGreaterThan(at(2));
    expect(at(2)).toBeGreaterThan(at(1));
  });
  it('rise with tier', () => {
    const p = (id: string) => gearStats(ITEMS[id]!, newStack(id, 1)).power;
    expect(p('item.sword_iron')).toBeGreaterThan(p('item.sword_rusty'));
    expect(p('item.sword_steel')).toBeGreaterThan(p('item.sword_iron'));
    const d = (id: string) => gearStats(ITEMS[id]!, newStack(id, 1)).defense;
    expect(d('item.cuirass_iron')).toBeGreaterThan(d('item.hauberk_mail'));
  });
  it('halve at 0 durability, and the item is never destroyed', () => {
    const st = newStack(sword.id, 1);
    const full = gearStats(sword, st).power;
    st.dur = 0;
    expect(isBroken(st)).toBe(true);
    expect(gearStats(sword, st).power).toBe(Math.floor((full * B.brokenPct) / 100));
  });
  it('add the flat bonus of two affixes', () => {
    const st: ItemStack = { ...newStack(sword.id, 1), affixes: ['affix.power_1', 'affix.crit_1'] };
    expect(gearStats(sword, st).power).toBe(sword.equip!.power! + 2);
    const shield = ITEMS['item.shield_iron']!;
    const sh: ItemStack = {
      ...newStack(shield.id, 1),
      q: 2,
      affixes: ['affix.defense_1', 'affix.defense_1'],
    };
    expect(gearStats(shield, sh).defense).toBe(Math.floor((6 * B.qualityPct[2]!) / 100) + 2);
  });
  it('quality, broken and affixes combine in one order: base, quality, broken, then affixes', () => {
    const st: ItemStack = { ...newStack(sword.id, 1), q: 3, dur: 0, affixes: ['affix.power_1'] };
    const scaled = Math.floor((14 * B.qualityPct[3]! * B.brokenPct) / 10_000);
    expect(gearStats(sword, st).power).toBe(scaled + 2);
  });
  it('applyMods does flat then percent, rounding down', () => {
    expect(applyMods(10, 'power', [{ stat: 'power', add: 2, pct: 50 }])).toBe(18);
    expect(applyMods(10, 'power', [{ stat: 'defense', add: 9 }])).toBe(10);
  });
});

describe('stack merging', () => {
  it('two stacks merge only if every field but qty is equal', () => {
    const a = newStack('item.sunwort', 3);
    expect(sameStack(a, newStack('item.sunwort', 9))).toBe(true);
    expect(sameStack(a, newStack('item.sunwort', 1, { q: 1 }))).toBe(false);
    expect(sameStack(a, newStack('item.sunwort', 1, { mark: 1 }))).toBe(false);
    expect(sameStack(a, newStack('item.sunwort', 1, { affixes: ['affix.gather_1'] }))).toBe(false);
    expect(sameStack(a, { ...a, dur: 3 })).toBe(false);
  });
  it('same item at a different quality does not merge, and counts together', () => {
    const { s, me } = world();
    const i = inv(s, me);
    addItem(i, 'item.sunwort', 4);
    addItem(i, 'item.sunwort', 2, { q: 1 });
    addItem(i, 'item.sunwort', 3);
    const stacks = i.slots.filter((x) => x?.item === 'item.sunwort');
    expect(stacks.map((x) => [x!.q ?? 0, x!.qty]).sort()).toEqual([
      [0, 7],
      [1, 2],
    ]);
    expect(countItem(i, 'item.sunwort')).toBe(9);
  });
  it('removal takes the lowest quality first', () => {
    const { s, me } = world();
    const i = inv(s, me);
    addItem(i, 'item.sunwort', 2, { q: 2 });
    addItem(i, 'item.sunwort', 2);
    expect(removeItem(i, 'item.sunwort', 3)).toBe(true);
    const left = i.slots.filter((x) => x?.item === 'item.sunwort');
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ q: 2, qty: 1 });
  });
  it('gear and tools never stack, and a full bag has no room for a different quality', () => {
    const { s, me } = world();
    const i = inv(s, me);
    expect(addItem(i, 'item.pick_copper', 1)).toBe(0);
    expect(addItem(i, 'item.pick_copper', 1)).toBe(0);
    expect(i.slots.filter((x) => x?.item === 'item.pick_copper')).toHaveLength(2);
    expect(canHold(i, 'item.sunwort', 1, { q: 3 })).toBe(true);
  });
  it('quality, durability and affixes survive equipping and unequipping', () => {
    const { s, me } = world();
    const i = inv(s, me);
    i.slots[0] = {
      ...newStack('item.sword_steel', 1),
      q: 2,
      dur: 30,
      mark: 1,
      affixes: ['affix.power_1'],
    };
    equip(s, me, 0);
    expect(i.equipment.main).toMatchObject({ q: 2, dur: 30, mark: 1, affixes: ['affix.power_1'] });
    expect(i.slots[0]).toMatchObject({ item: 'item.dagger_wood' });
    expect(s.entities.comps.combatant[me]!.power).toBe(
      gearStats(ITEMS['item.sword_steel']!, i.equipment.main!).power,
    );
  });
});

describe('wear', () => {
  const ev = (s: SimState, ...e: SimEvent[]): void => {
    s.events.list.length = 0;
    s.events.list.push(...e);
    wearSystem(s);
  };
  it('a weapon loses 1 per weaponHits hits landed', () => {
    const { s, me } = world();
    const hit: SimEvent = {
      type: 'damageDealt',
      src: me,
      dst: 99,
      amount: 1,
      crit: false,
      bonus: false,
      heavy: false,
      tag: 'blades',
    };
    const max = ITEMS['item.dagger_wood']!.durability!;
    for (let n = 0; n < B.wear.weaponHits - 1; n++) ev(s, hit);
    expect(inv(s, me).equipment.main!.dur).toBe(max);
    ev(s, hit);
    expect(inv(s, me).equipment.main!.dur).toBe(max - 1);
  });
  it('armor loses 1 per armorHits hits taken', () => {
    const { s, me } = world();
    equip(s, me, addItemSlot(s, me, 'item.jerkin_leather'));
    const max = ITEMS['item.jerkin_leather']!.durability!;
    const taken: SimEvent = {
      type: 'damageDealt',
      src: 99,
      dst: me,
      amount: 1,
      crit: false,
      bonus: false,
      heavy: false,
      tag: 'creature',
    };
    for (let n = 0; n < B.wear.armorHits; n++) ev(s, taken);
    expect(inv(s, me).equipment.body!.dur).toBe(max - 1);
  });
  it('every worn item loses deathPct of its maximum on death, and none is ever destroyed', () => {
    const { s, me } = world();
    const max = ITEMS['item.dagger_wood']!.durability!;
    for (let n = 0; n < 12; n++) ev(s, { type: 'died', id: me, team: 0 });
    const main = inv(s, me).equipment.main!;
    expect(main.dur).toBe(0);
    expect(isBroken(main)).toBe(true);
    expect(main.item).toBe('item.dagger_wood');
    ev(s, { type: 'died', id: me, team: 0 });
    expect(inv(s, me).equipment.main!.dur).toBe(0);
    expect(max).toBeGreaterThan(0);
  });
  it('a broken weapon hits for half', () => {
    const { s, me } = world();
    const before = s.entities.comps.combatant[me]!.power;
    for (let n = 0; n < 12; n++) ev(s, { type: 'died', id: me, team: 0 });
    expect(s.entities.comps.combatant[me]!.power).toBe(Math.floor((before * B.brokenPct) / 100));
  });
  it('a tool loses 1 per toolUses gathers', () => {
    const { s, me } = world();
    const slot = addItemSlot(s, me, 'item.pick_iron');
    const max = ITEMS['item.pick_iron']!.durability!;
    for (let n = 0; n < B.wear.toolUses - 1; n++) expect(useTool(s, me, slot)).toBe(false);
    expect(useTool(s, me, slot)).toBe(true);
    expect(inv(s, me).slots[slot]!.dur).toBe(max - 1);
  });
});

function addItemSlot(s: SimState, me: number, item: string): number {
  const i = inv(s, me);
  addItem(i, item, 1);
  return i.slots.findIndex((x) => x?.item === item);
}

describe('modifiers', () => {
  it('affixes on worn gear feed activeMods and the pool maxima', () => {
    const { s, me } = world();
    const before = s.entities.comps.pools[me]!.staMax;
    const i = inv(s, me);
    i.slots[0] = { ...newStack('item.ring_silver', 1), affixes: ['affix.stamina_1'] };
    // Light Feet, the Evasion passive, is known from the first point and is the only mod there is.
    expect(activeMods(s, me)).toEqual([{ stat: 'perfectWindow', add: 2 }]);
    equip(s, me, 0);
    expect(activeMods(s, me)).toEqual([
      ...AFFIXES['affix.stamina_1']!.mods,
      { stat: 'perfectWindow', add: 2 },
    ]);
    expect(s.entities.comps.pools[me]!.staMax).toBe(before + 100);
    i.equipment.accessory = null;
    equip(s, me, 0);
  });
  it('every affix names a real string, only fits slots that exist, and has mods', () => {
    for (const a of Object.values(AFFIXES)) {
      expect(a.mods.length, a.id).toBeGreaterThan(0);
      expect(a.slots.length, a.id).toBeGreaterThan(0);
    }
    expect(Object.keys(AFFIXES)).toHaveLength(8);
  });
});

describe('storage chest', () => {
  function atChest(): { s: SimState; me: number } {
    const w = world();
    spawnFixture(w.s, 'fixture.storage', 21, 20);
    // Face the chest: the context target is what stands in front.
    stepWorld(w.s, w.me, { commands: [{ type: 'move', dir: 2 }] });
    stepWorld(w.s, w.me, { commands: [{ type: 'move', dir: null }] });
    for (let n = 0; n < 6; n++) stepWorld(w.s, w.me, { commands: [] });
    return w;
  }
  it('holds the balance number of slots on the avatar', () => {
    const { s, me } = world();
    expect(s.entities.comps.storage[me]!.slots).toHaveLength(B.storage.slots);
    expect(B.storage.slots).toBe(80);
  });
  it('moves a stack in and out, never losing or making anything', () => {
    const { s, me } = atChest();
    const i = inv(s, me);
    const store = s.entities.comps.storage[me]!;
    addItem(i, 'item.sunwort', 5, { q: 1 });
    const slot = i.slots.findIndex((x) => x?.item === 'item.sunwort');
    const made = JSON.stringify(s.ledger);
    expect(moveStorage(s, me, 'in', slot)).toBe(true);
    expect(i.slots[slot]).toBeNull();
    expect(store.slots[0]).toMatchObject({ item: 'item.sunwort', qty: 5, q: 1 });
    expect(moveStorage(s, me, 'out', 0)).toBe(true);
    expect(countItem(i, 'item.sunwort')).toBe(5);
    expect(i.slots.find((x) => x?.item === 'item.sunwort')).toMatchObject({ q: 1 });
    expect(JSON.stringify(s.ledger)).toBe(made);
  });
  it('does nothing away from the chest, and keeps what does not fit', () => {
    const w = world();
    addItem(inv(w.s, w.me), 'item.sunwort', 5);
    expect(moveStorage(w.s, w.me, 'in', 3)).toBe(false);
    const { s, me } = atChest();
    const store = s.entities.comps.storage[me]!;
    for (let k = 0; k < store.slots.length; k++) store.slots[k] = newStack('item.old_key', 1);
    addItem(inv(s, me), 'item.sunwort', 2);
    const slot = inv(s, me).slots.findIndex((x) => x?.item === 'item.sunwort');
    expect(moveStorage(s, me, 'in', slot)).toBe(false);
    expect(inv(s, me).slots[slot]).toMatchObject({ qty: 2 });
  });
  it('addStack fills equal stacks before empty slots', () => {
    const slots: (ItemStack | null)[] = [newStack('item.sunwort', 19), null];
    expect(addStack(slots, newStack('item.sunwort', 3))).toBe(0);
    expect(slots.map((x) => x?.qty)).toEqual([20, 2]);
  });
});

describe('item set', () => {
  it('has about 120 items split into the target kinds', () => {
    // The farming items (M6-02) are counted on their own below.
    const farm = new Set(FARMING_ITEMS.map((i) => i.id));
    const all = Object.values(ITEMS).filter((i) => !farm.has(i.id));
    expect(all.length).toBeGreaterThanOrEqual(110);
    expect(all.length).toBeLessThanOrEqual(180);
    const n = (f: (i: (typeof all)[number]) => boolean) => all.filter(f).length;
    expect(n((i) => i.tool !== undefined)).toBe(10);
    expect(n((i) => i.category === 'material')).toBe(44);
    expect(n((i) => i.category === 'consumable')).toBe(30);
    expect(n((i) => i.equip?.slot === 'accessory')).toBe(8);
    expect(n((i) => i.equip?.slot === 'off' && !!i.equip.doll?.offHand)).toBe(4);
    expect(ITEMS['item.flute_reed']?.equip?.slot).toBe('off');
  });
  it('adds the farming items: 26 new crops, 30 seeds, compost, the hoe and the can (M6-02)', () => {
    expect(FARMING_ITEMS).toHaveLength(59);
    for (const i of FARMING_ITEMS) expect(ITEMS[i.id]).toBe(i);
  });
  it('every item lists under exactly one Bag filter', () => {
    for (const i of Object.values(ITEMS))
      expect(['gear', 'tools', 'food', 'materials', 'other']).toContain(i.bag);
  });
});
