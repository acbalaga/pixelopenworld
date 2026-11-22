import { describe, expect, it } from 'vitest';
import { INPUT_TUNABLES as T } from '../../src/content/balance/input';
import { computeLayout, buttonAt } from '../../src/platform/input/layout';
import { InputSampler } from '../../src/platform/input/sampler';
import { TouchController } from '../../src/platform/input/touch';
import { SettingsStore } from '../../src/platform/settings';
import { sanitizeSettings } from '../../src/platform/settingsStorage';
import type { Inventory, ItemStack } from '../../src/sim/state';
import {
  quickCandidates,
  quickCount,
  quickItem,
  quickNext,
  quickSlotOf,
  togglePin,
} from '../../src/ui/hud/quickSlot';
import { itemActions } from '../../src/ui/menu/model';
import { ITEMS } from '../../src/content/items';

const TEA = 'item.herb_tea';
const STEW = 'item.hearty_stew';
const SKEWER = 'item.herbed_skewer';
const COMPOTE = 'item.berry_compote';

const bag = (...stacks: (ItemStack | null)[]): Inventory =>
  ({
    slots: stacks,
    equipment: {},
    recipes: [],
    wear: { hits: 0, taken: 0, uses: 0 },
  }) as unknown as Inventory;
const none = { quickItems: [] as string[], quickPick: '' };

describe('quick slot rules (POW-M5-21)', () => {
  it('with nothing pinned, offers the first usable item, and never gear or a lantern', () => {
    const inv = bag(
      { item: 'item.sword_iron', qty: 1 },
      { item: 'item.lantern', qty: 1 },
      { item: STEW, qty: 2 },
      { item: TEA, qty: 1 },
    );
    expect(quickCandidates(inv)).toEqual([STEW, TEA]);
    expect(quickItem(inv, none)).toBe(STEW);
    expect(quickItem(bag({ item: 'item.sword_iron', qty: 1 }), none)).toBeNull();
  });

  it('holds only consumables with an effect: no raw forage, no burnt mess, yes potions and meals', () => {
    const inv = bag(
      { item: 'item.berry_red', qty: 4 },
      { item: 'item.burnt_mess', qty: 1 },
      { item: 'item.potion_health_s', qty: 1 },
      { item: STEW, qty: 1 },
    );
    expect(quickCandidates(inv)).toEqual(['item.potion_health_s', STEW]);
    expect(quickItem(bag({ item: 'item.berry_red', qty: 4 }), none)).toBeNull();
  });

  it('uses the first stack of the item and counts every stack', () => {
    const inv = bag({ item: TEA, qty: 2 }, null, { item: STEW, qty: 1 }, { item: STEW, qty: 3 });
    expect(quickSlotOf(inv, STEW)).toBe(2);
    expect(quickCount(inv, STEW)).toBe(4);
    expect(quickSlotOf(inv, COMPOTE)).toBe(-1);
  });

  it('steps through pinned items held, wrapping, and skips pinned items that ran out', () => {
    const inv = bag({ item: TEA, qty: 1 }, { item: STEW, qty: 1 }, { item: SKEWER, qty: 1 });
    let p = togglePin(none, STEW);
    p = togglePin(p, COMPOTE); // pinned but not held
    p = togglePin(p, TEA);
    expect(quickItem(inv, p)).toBe(TEA);
    expect(quickNext(inv, p)).toBe(STEW);
    expect(quickNext(inv, { ...p, quickPick: STEW })).toBe(TEA);
  });

  it('pins three at most, dropping the oldest, and unpins', () => {
    let p = togglePin(none, TEA);
    p = togglePin(p, STEW);
    p = togglePin(p, SKEWER);
    p = togglePin(p, COMPOTE);
    expect(p.quickItems).toEqual([STEW, SKEWER, COMPOTE]);
    p = togglePin(p, SKEWER);
    expect(p.quickItems).toEqual([STEW, COMPOTE]);
  });

  it('food offers the pin in the Bag, gear does not', () => {
    expect(itemActions(ITEMS[STEW]!)).toContain('quick');
    expect(itemActions(ITEMS['item.sword_iron']!)).not.toContain('quick');
  });
});

describe('quick slot button', () => {
  it('overlaps no other control in either scheme, with and without a shield, on phones and landscape', () => {
    for (const [w, h] of [
      [320, 568],
      [360, 800],
      [915, 412],
    ] as const)
      for (const scheme of ['flow', 'classic'] as const)
        for (const guard of [false, true])
          for (const left of [false, true]) {
            const l = computeLayout(w, h, left, { scheme, guard });
            const q = l.buttons.quick;
            expect(q.x).toBeGreaterThanOrEqual(0);
            expect(q.x + q.w).toBeLessThanOrEqual(w);
            expect(q.w).toBeGreaterThanOrEqual(T.minTargetPx);
            for (const [id, r] of Object.entries(l.buttons)) {
              if (id === 'quick' || !r) continue;
              const ox = Math.max(0, Math.min(q.x + q.w, r.x + r.w) - Math.max(q.x, r.x));
              const oy = Math.max(0, Math.min(q.y + q.h, r.y + r.h) - Math.max(q.y, r.y));
              expect(ox * oy, `${scheme} ${w}x${h} guard=${guard} ${id}`).toBe(0);
            }
            expect(buttonAt(l, { x: q.x + 2, y: q.y + 2 })).toBe('quick');
          }
  });

  it('a tap uses, a long press steps on once', () => {
    const l = computeLayout(360, 800, false);
    const q = l.buttons.quick;
    const s = new InputSampler(new TouchController(l));
    s.touch.down(1, q.x + 5, q.y + 5, 0);
    s.touch.up(1, q.x + 5, q.y + 5, 50);
    const tap = s.sample(60);
    expect(tap.quick).toBe(true);
    expect(tap.quickNext).toBe(false);
    s.touch.down(2, q.x + 5, q.y + 5, 100);
    const held = [s.sample(100 + T.holdMs + 10), s.sample(100 + T.holdMs + 50)];
    expect(held.map((r) => r.quickNext)).toEqual([true, false]);
    s.touch.up(2, q.x + 5, q.y + 5, 100 + T.holdMs + 80);
    expect(s.sample(100 + T.holdMs + 90).quick).toBe(false);
  });

  it('pins live in settings outside the save and survive a reload, cleaned', () => {
    const st = new SettingsStore({ prefersReducedMotion: () => false });
    st.set(togglePin(st.get(), STEW));
    expect(st.get().quickItems).toEqual([STEW]);
    expect(
      sanitizeSettings({ quickItems: [STEW, 'bad id', 7, TEA, SKEWER, COMPOTE], quickPick: TEA }),
    ).toMatchObject({ quickItems: [TEA, SKEWER, COMPOTE], quickPick: TEA });
    expect(sanitizeSettings({ quickPick: '<script>' }).quickPick).toBeUndefined();
  });
});
