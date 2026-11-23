import { describe, expect, it } from 'vitest';
import { ITEMS_BALANCE } from '../../src/content/balance/items';
import { ITEMS } from '../../src/content/items';
import { POTION_ITEMS } from '../../src/content/items/potions';
import { addItem } from '../../src/sim/items';
import type { Inventory } from '../../src/sim/state';

describe('potion stacks', () => {
  it('every potion stacks to the balance value, the same as food', () => {
    for (const p of POTION_ITEMS) expect(p.stack).toBe(ITEMS_BALANCE.potionStack);
    expect(ITEMS['item.potion_health_s']!.stack).toBe(ITEMS['item.hearty_stew']!.stack);
  });
  it('twenty potions of one quality take one slot, a different quality takes another', () => {
    const inv = { slots: Array(4).fill(null), equipment: {}, recipes: [] } as unknown as Inventory;
    expect(addItem(inv, 'item.potion_health_s', 20)).toBe(0);
    expect(addItem(inv, 'item.potion_health_s', 5, { q: 1 })).toBe(0);
    expect(inv.slots.filter((s) => s).length).toBe(2);
  });
});
