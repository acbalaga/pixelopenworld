import { describe, expect, it } from 'vitest';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { countItem } from '../../src/sim/items';
import { requestState, startNode } from '../../src/sim/journal';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { buyPrice, sellPrice, spawnNpc } from '../../src/sim/systems/npcs';

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...c: Command[]) => void;
  count: (t: SimEvent['type']) => number;
}

/** The avatar at tile (20, 20) facing south, an open world, a guard and a shopkeeper beside. */
function rig(): Rig {
  const s = createDemoState(11, 0);
  s.world = { solidAt: () => 0 };
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  spawnNpc(s, 'npc.guard', 19, 20);
  spawnNpc(s, 'npc.shopkeeper', 21, 20);
  spawnNpc(s, 'npc.cook', 20, 19);
  const events: SimEvent[] = [];
  const tick = (...c: Command[]): void => {
    stepWorld(s, me, { commands: c });
    events.push(...s.events.list);
  };
  tick({ type: 'scheme', scheme: 'classic' });
  return { s, me, events, tick, count: (t) => events.filter((e) => e.type === t).length };
}

const say = (npc: string, node: string, choice: number): Command => ({
  type: 'talk',
  npc,
  node,
  choice,
});

describe('requests', () => {
  /** Kills one Mossling that stands in front of the avatar. */
  function killOne(r: Rig): void {
    const id = spawnCreature(r.s, 'creature.mossling', 20 * 16 + 8, 20 * 16 + 14 + 14, -1);
    const pools = r.s.entities.comps.pools[id];
    if (pools) pools.hp = 1;
    const before = r.count('died');
    for (let i = 0; i < 120 && r.count('died') === before; i++)
      r.tick(i % 12 === 2 ? { type: 'attack' } : { type: 'move', dir: null });
    expect(r.count('died')).toBe(before + 1);
  }

  it('accept, kill the required creatures, turn in, reward granted once', () => {
    const r = rig();
    const j = (): ReturnType<typeof requestState> =>
      requestState(r.s.entities.comps.journal[r.me]!, 'request.clear_pests');
    expect(startNode(r.s, r.me, 'npc.guard')).toBe('ask');
    expect(j()).toBe('none');

    r.tick(say('npc.guard', 'ask', 0));
    expect(j()).toBe('active');
    expect(r.count('requestStarted')).toBe(1);
    // Taking it twice does nothing.
    r.tick(say('npc.guard', 'ask', 0));
    expect(r.count('requestStarted')).toBe(1);
    expect(startNode(r.s, r.me, 'npc.guard')).toBe('progress');

    // Turning in too early pays nothing.
    r.tick(say('npc.guard', 'report', -1));
    expect(r.count('requestCompleted')).toBe(0);

    for (let i = 0; i < 3; i++) killOne(r);
    expect(j()).toBe('active');
    killOne(r);
    expect(j()).toBe('ready');
    expect(r.count('requestProgress')).toBe(4);
    expect(r.count('requestReady')).toBe(1);
    expect(startNode(r.s, r.me, 'npc.guard')).toBe('report');

    const coin0 = r.s.entities.comps.avatar[r.me]!.coin;
    r.tick(say('npc.guard', 'report', -1));
    expect(j()).toBe('done');
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(coin0 + 50);
    expect(countItem(r.s.entities.comps.inventory[r.me]!, 'item.ring_copper')).toBe(1);

    // Again: nothing more.
    r.tick(say('npc.guard', 'report', -1));
    expect(r.count('requestCompleted')).toBe(1);
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(coin0 + 50);
    expect(startNode(r.s, r.me, 'npc.guard')).toBe('after');
  });

  it('kills that are not the target, or not the avatar, do not count', () => {
    const r = rig();
    r.tick(say('npc.guard', 'ask', 0));
    const id = spawnCreature(r.s, 'creature.bramble_boar', 20 * 16 + 8, 20 * 16 + 28, -1);
    const pools = r.s.entities.comps.pools[id];
    if (pools) pools.hp = 1;
    for (let i = 0; i < 80; i++)
      r.tick(i % 12 === 2 ? { type: 'attack' } : { type: 'move', dir: null });
    expect(r.count('died')).toBeGreaterThan(0);
    expect(r.count('requestProgress')).toBe(0);
  });

  it('a conversation far from the NPC changes nothing', () => {
    const r = rig();
    const p = r.s.entities.comps.pos[r.me]!;
    p.x += 40 * 16 * 256;
    r.tick(say('npc.guard', 'ask', 0));
    expect(r.count('requestStarted')).toBe(0);
  });

  it('a choice the conditions rule out, or a made-up node, does nothing', () => {
    const r = rig();
    r.tick(say('npc.guard', 'nope', -1));
    r.tick(say('npc.guard', 'ask', 7));
    r.tick(say('npc.nobody', 'ask', 0));
    expect(r.events.filter((e) => e.type === 'requestStarted')).toHaveLength(0);
  });
});

describe('the cook', () => {
  it('teaches a recipe and gives the Foraging Trial', () => {
    const r = rig();
    r.tick(say('npc.cook', 'teach', -1));
    expect(r.s.entities.comps.inventory[r.me]!.recipes).toContain('recipe.herb_tea');
    r.tick(say('npc.cook', 'trial', -1));
    expect(r.count('trialOffered')).toBe(1);
    expect(r.s.entities.comps.skills[r.me]!.offered).toContain('trial.foraging.15');
  });
});

describe('the shop', () => {
  const buy = (item: string, qty = 1): Command => ({ type: 'buy', shop: 'shop.brin', item, qty });
  const sell = (slot: number, qty = 1): Command => ({ type: 'sell', shop: 'shop.brin', slot, qty });
  const denials = (r: Rig): string[] =>
    r.events.flatMap((e) => (e.type === 'shopDenied' ? [e.reason] : []));

  it('buying with too little coin is refused and takes nothing', () => {
    const r = rig();
    const had = countItem(r.s.entities.comps.inventory[r.me]!, 'item.dish_bread');
    r.tick(buy('item.dish_bread'));
    expect(denials(r)).toEqual(['coin']);
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(0);
    expect(countItem(r.s.entities.comps.inventory[r.me]!, 'item.dish_bread')).toBe(had);
  });

  it('selling pays the sell rate, and buying then works', () => {
    const r = rig();
    const inv = r.s.entities.comps.inventory[r.me]!;
    inv.slots[0] = { item: 'item.sword_iron', qty: 1 };
    r.tick(sell(0));
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(sellPrice('item.sword_iron'));
    expect(inv.slots[0]).toBeNull();
    const had = countItem(inv, 'item.dish_bread');
    r.tick(buy('item.dish_bread'));
    expect(r.count('bought')).toBe(1);
    expect(countItem(inv, 'item.dish_bread')).toBe(had + 1);
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(
      sellPrice('item.sword_iron') - buyPrice('item.dish_bread'),
    );
  });

  it('refuses items not in stock, worthless items, a full bag, and a shop out of reach', () => {
    const r = rig();
    const a = r.s.entities.comps.avatar[r.me]!;
    a.coin = 1000;
    r.tick(buy('item.sword_iron'));
    const inv = r.s.entities.comps.inventory[r.me]!;
    inv.slots[0] = { item: 'item.burnt_mess', qty: 1 };
    r.tick(sell(0));
    inv.slots.forEach((_s, i) => (inv.slots[i] = { item: 'item.river_pebble', qty: 20 }));
    r.tick(buy('item.dish_bread'));
    r.s.entities.comps.pos[r.me]!.x += 40 * 16 * 256;
    r.tick(buy('item.dish_bread'));
    expect(denials(r)).toEqual(['stock', 'worthless', 'bag', 'range']);
    expect(a.coin).toBe(1000);
  });

  it('buying costs more than selling pays, so there is no free coin', () => {
    for (const item of ['item.dish_bread', 'item.herb_tea', 'item.cap_wool', 'item.spear_ash'])
      expect(buyPrice(item)).toBeGreaterThan(sellPrice(item));
  });
});
