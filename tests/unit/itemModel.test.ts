import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/content/items';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { addItem, newStack } from '../../src/sim/items';
import { createDemoState, deserializeState, type SimState } from '../../src/sim/state';
import { bagView, itemDetail } from '../../src/ui/menu/model';
import { honestPlain, tamper } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-6.json'), 'utf8'),
) as { plain: SavePlain };

async function migrated(): Promise<SavePlain> {
  const bytes = new TextEncoder().encode(JSON.stringify(fixture.plain));
  return migrate(await new JsonCodec().decode(bytes));
}

/** Everything held, by item id, in the bag and worn (and in storage when there is any). */
function held(sim: string): Record<string, number> {
  const s = deserializeState(sim);
  const me = findAvatar(s)!;
  const inv = s.entities.comps.inventory[me]!;
  const out: Record<string, number> = {};
  const add = (item: string, n: number): void => {
    out[item] = (out[item] ?? 0) + n;
  };
  for (const st of inv.slots) if (st) add(st.item, st.qty);
  for (const e of Object.values(inv.equipment) as unknown[]) {
    if (e) add(typeof e === 'string' ? e : (e as { item: string }).item, 1);
  }
  return out;
}

describe('schema 6 to 7 migration', () => {
  it('turns worn items into stacks, adds storage and wear, and loses nothing', async () => {
    expect(fixture.plain.schema).toBe(6);
    const before = held(fixture.plain.sim);
    const raw = deserializeState(fixture.plain.sim).entities.comps.inventory.find((x) => x)!;
    expect(typeof raw.equipment.main).toBe('string');
    expect(raw.slots.every((x) => x !== null)).toBe(true);
    const now = await migrated();
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(held(now.sim)).toEqual(before);
    const s = deserializeState(now.sim);
    const me = findAvatar(s)!;
    const inv = s.entities.comps.inventory[me]!;
    expect(inv.equipment.main).toEqual({
      item: 'item.sword_rusty',
      qty: 1,
      dur: ITEMS['item.sword_rusty']!.durability,
    });
    expect(inv.equipment.off?.item).toBe('item.shield_wood');
    expect(inv.wear).toEqual({ hits: 0, taken: 0, uses: 0 });
    expect(s.entities.comps.storage[me]!.slots).toHaveLength(40);
    for (const st of inv.slots) {
      const max = ITEMS[st!.item]!.durability;
      expect(st!.dur).toBe(max);
    }
    expect(s.ledger.masterworks).toEqual({});
    expect(now.ledger.marked).toEqual({});
    expect(validateSave(now).reasons).toEqual([]);
  });
});

describe('item integrity rules', () => {
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  const base = honestPlain();
  const setSlot = (stack: unknown) =>
    tamper(base, (s, me) => {
      s.entities.comps.inventory[me]!.slots[19] = stack as never;
    });

  it('an honest save is clean', () => {
    expect(codes(base)).toEqual([]);
  });
  it('DUR_RANGE: durability above the maximum, or on an item that does not wear', () => {
    expect(codes(setSlot({ ...newStack('item.sword_iron', 1), dur: 999 }))).toContain('DUR_RANGE');
    expect(codes(setSlot({ item: 'item.sunwort', qty: 1, dur: 3 }))).toContain('DUR_RANGE');
  });
  it('QUALITY_ON_PLAIN: a quality on an item that cannot have one', () => {
    expect(codes(setSlot({ item: 'item.coin', qty: 1, q: 2 }))).toContain('QUALITY_ON_PLAIN');
    expect(codes(setSlot({ item: 'item.moss_tuft', qty: 1, q: 1 }))).toContain('QUALITY_ON_PLAIN');
  });
  it('AFFIX_OVERFLOW: too many affixes, or one that is not real', () => {
    const three = {
      ...newStack('item.sword_iron', 1),
      affixes: ['affix.power_1', 'affix.power_1', 'affix.power_1'],
    };
    expect(codes(setSlot(three))).toContain('AFFIX_OVERFLOW');
    const fake = { ...newStack('item.sword_iron', 1), affixes: ['affix.nope'] };
    expect(codes(setSlot(fake))).toContain('AFFIX_OVERFLOW');
  });
  it('STACK_RULES: gear in a stack of more than one', () => {
    expect(codes(setSlot({ ...newStack('item.sword_iron', 1), qty: 2 }))).toContain('STACK_RULES');
  });
  it('MARK_WITHOUT_CRAFT: a maker mark that nothing ever crafted', () => {
    const marked = { ...newStack('item.sword_iron', 1), mark: 1 };
    expect(codes(setSlot(marked))).toContain('MARK_WITHOUT_CRAFT');
  });
  it('held counts include storage: a stack in the chest that was never made is caught', () => {
    const p = tamper(base, (s, me) => {
      s.entities.comps.storage[me]!.slots[0] = newStack('item.dish_bread', 5);
    });
    expect(codes(p)).toContain('ITEMS_EXCEED_MADE');
  });
});

describe('bag view', () => {
  function rig(): { s: SimState; me: number } {
    const s = createDemoState(3, 0);
    const f = feetAt(10, 10);
    const me = createAvatar(s, f.x, f.y);
    const inv = s.entities.comps.inventory[me]!;
    inv.slots.fill(null);
    for (const [item, q] of [
      ['item.sunwort', 0],
      ['item.pick_iron', 0],
      ['item.dish_bread', 2],
      ['item.sword_steel', 3],
      ['item.copper_ingot', 1],
    ] as const)
      addItem(inv, item, 1, { q });
    return { s, me };
  }
  const names = (s: SimState, me: number, o: Parameters<typeof bagView>[2]) =>
    bagView(s, me, o).slots.map((x) => x.item);

  it('filters by chip', () => {
    const { s, me } = rig();
    expect(names(s, me, { filter: 'gear' })).toEqual(['item.sword_steel']);
    expect(names(s, me, { filter: 'tools' })).toEqual(['item.pick_iron']);
    expect(names(s, me, { filter: 'food' })).toEqual(['item.dish_bread']);
    expect(names(s, me, { filter: 'materials' })).toEqual(['item.sunwort', 'item.copper_ingot']);
    expect(names(s, me, { filter: 'other' })).toEqual([]);
  });
  it('sorts by type, tier, value and newest', () => {
    const { s, me } = rig();
    expect(names(s, me, { sort: 'type' })[0]).toBe('item.sword_steel');
    expect(names(s, me, { sort: 'tier' })[0]).toBe('item.sword_steel');
    expect(names(s, me, { sort: 'value' })[0]).toBe('item.sword_steel');
    expect(names(s, me, { sort: 'newest' })[0]).toBe('item.copper_ingot');
  });
  it('shows quality as a glyph and a name, never color alone, and a broken item says so', () => {
    const { s, me } = rig();
    const sword = bagView(s, me, { filter: 'gear' }).slots[0]!;
    expect(sword.glyph).toBe('+++');
    expect(sword.label).toContain('Masterwork');
    s.entities.comps.inventory[me]!.slots[sword.index]!.dur = 0;
    const b = bagView(s, me, { filter: 'gear' }).slots[0]!;
    expect(b.broken).toBe(true);
    expect(b.label).toContain('Broken');
  });
  it('the long-press detail names quality, durability and the maker mark', () => {
    const { s, me } = rig();
    const slot = bagView(s, me, { filter: 'gear' }).slots[0]!.index;
    const st = s.entities.comps.inventory[me]!.slots[slot]!;
    st.mark = 1;
    st.dur = 20;
    const d = itemDetail(s, me, slot)!;
    expect(d.lines).toContain('Masterwork quality');
    expect(d.lines).toContain('Durability 20 of 100');
    expect(d.lines.some((l) => l.startsWith('Made by '))).toBe(true);
  });
});
