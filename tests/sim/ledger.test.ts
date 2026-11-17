import { describe, expect, it } from 'vitest';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { countItem, give } from '../../src/sim/items';
import { earnCoin, madeItems, recordCraft, recordKill, spendCoin } from '../../src/sim/ledger';
import { addXp, xpToNext } from '../../src/sim/skills';
import { createDemoState, deserializeState, serializeState } from '../../src/sim/state';

function fresh(): { s: ReturnType<typeof createDemoState>; me: number } {
  const s = createDemoState(3, 0);
  const f = feetAt(5, 5);
  return { s, me: createAvatar(s, f.x, f.y) };
}

const sum = (t: Record<string, number>): number => Object.values(t).reduce((a, b) => a + b, 0);

describe('ledger', () => {
  it('coin held always equals earned minus spent', () => {
    const { s, me } = fresh();
    const held = (): number => s.entities.comps.avatar[me]!.coin;
    earnCoin(s, me, 50, 'loot');
    earnCoin(s, me, 20, 'chest');
    spendCoin(s, me, 30, 'purchase');
    earnCoin(s, me, 7, 'echo');
    spendCoin(s, me, 12, 'echo');
    expect(held()).toBe(35);
    expect(held()).toBe(sum(s.ledger.coinEarned) - sum(s.ledger.coinSpent));
    expect(s.ledger.coinEarned).toEqual({ loot: 50, chest: 20, echo: 7 });
  });

  it('ignores zero and negative amounts', () => {
    const { s, me } = fresh();
    earnCoin(s, me, 0, 'loot');
    earnCoin(s, me, -5, 'loot');
    spendCoin(s, me, -5, 'purchase');
    expect(s.entities.comps.avatar[me]!.coin).toBe(0);
    expect(s.ledger.coinEarned).toEqual({});
    expect(s.ledger.coinSpent).toEqual({});
  });

  it('records the starter kit as made at the start', () => {
    const { s, me } = fresh();
    const inv = s.entities.comps.inventory[me]!;
    let held = 0;
    for (const st of inv.slots) if (st) held += st.qty;
    for (const item of Object.values(inv.equipment)) if (item) held++;
    expect(sum(s.ledger.itemsMade.start ?? {})).toBe(held);
  });

  it('records items by source and by item, whether they fit in the bag or not', () => {
    const { s, me } = fresh();
    give(s, me, 'item.sunwort', 3, 'gather');
    give(s, me, 'item.sunwort', 2, 'gather');
    give(s, me, 'item.ring_copper', 1, 'request');
    expect(s.ledger.itemsMade.gather).toEqual({ 'item.sunwort': 5 });
    expect(s.ledger.itemsMade.request).toEqual({ 'item.ring_copper': 1 });
    expect(countItem(s.entities.comps.inventory[me]!, 'item.sunwort')).toBe(5);
    madeItems(s, 'loot', 'item.raw_meat', 0);
    expect(s.ledger.itemsMade.loot).toBeUndefined();
  });

  it('records XP, kills and crafts', () => {
    const { s, me } = fresh();
    addXp(s, me, 'skill.blades', 10);
    addXp(s, me, 'skill.blades', 5);
    addXp(s, me, 'skill.not_a_skill', 99);
    recordKill(s, 'creature.mossling');
    recordKill(s, 'creature.mossling');
    recordCraft(s, 'recipe.herb_tea');
    expect(s.ledger.xpEarned).toEqual({ 'skill.blades': 15 });
    expect(s.ledger.kills).toEqual({ 'creature.mossling': 2 });
    expect(s.ledger.crafts).toEqual({ 'recipe.herb_tea': 1 });
    // The XP earned covers what the skill holds, ranks included.
    const sk = s.entities.comps.skills[me]!;
    let held = sk.xp['skill.blades'] ?? 0;
    for (let i = 0; i < (sk.points['skill.blades'] ?? 0); i++) held += xpToNext(i);
    expect(held).toBeLessThanOrEqual(15);
  });

  it('is part of the saved state and round trips exactly', () => {
    const { s, me } = fresh();
    earnCoin(s, me, 9, 'sale');
    recordKill(s, 'creature.boar');
    const text = serializeState(s);
    const back = deserializeState(text);
    expect(back.ledger).toEqual(s.ledger);
    expect(serializeState(back)).toBe(text);
  });
});
