import { describe, expect, it } from 'vitest';
import { COMBAT as C } from '../../src/content/balance/combat';
import { ITEMS_BALANCE as B } from '../../src/content/balance/items';
import { CREATURES } from '../../src/content/creatures';
import { WEAPONS } from '../../src/content/combat/attacks';
import { ITEMS } from '../../src/content/items';
import { NODES, RECIPES, expand } from '../../src/content/items/recipes';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnEnemy } from '../../src/sim/combat/enemy';
import {
  addItem,
  canHold,
  countItem,
  equip,
  newInventory,
  removeItem,
  rollDrops,
  spawnCampPot,
  spawnNode,
  spawnPickup,
  stackSize,
  unequip,
} from '../../src/sim/items';
import { validateCommand, type Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createStream } from '../../src/sim/kernel/rng';
import { createDemoState, hashState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
  run: (n: number) => void;
}

/** The avatar at tile (20, 20), facing south, with a log of every event. */
function rig(): Rig {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  const events: SimEvent[] = [];
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds });
    events.push(...s.events.list);
  };
  const run = (n: number): void => {
    for (let i = 0; i < n; i++) tick();
  };
  run(1);
  events.length = 0;
  return { s, me, events, tick, run };
}

const inv = (r: Rig) => r.s.entities.comps.inventory[r.me]!;
const cb = (r: Rig) => r.s.entities.comps.combatant[r.me]!;
const pools = (r: Rig) => r.s.entities.comps.pools[r.me]!;
const fedOf = (r: Rig) => r.s.entities.comps.statuses[r.me]?.find((s) => s.id === 'fed');
const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const feetPx = (r: Rig) => ({
  x: r.s.entities.comps.pos[r.me]!.x / 256,
  y: r.s.entities.comps.pos[r.me]!.y / 256,
});

/** Puts `item` in the first free slot and returns the slot index. */
function stash(r: Rig, item: string, qty = 1): number {
  addItem(inv(r), item, qty);
  return inv(r).slots.findIndex((x) => x?.item === item);
}

describe('stacking and overflow', () => {
  it('tops up stacks before opening new slots, and splits at the stack size', () => {
    const i = newInventory();
    i.slots.fill(null);
    const max = stackSize('item.sunwort');
    expect(addItem(i, 'item.sunwort', max + 5)).toBe(0);
    expect(i.slots[0]).toEqual({ item: 'item.sunwort', qty: max });
    expect(i.slots[1]).toEqual({ item: 'item.sunwort', qty: 5 });
    expect(addItem(i, 'item.sunwort', 3)).toBe(0);
    expect(i.slots[1]?.qty).toBe(8);
    expect(countItem(i, 'item.sunwort')).toBe(max + 8);
  });
  it('returns what does not fit when the bag is full, and changes nothing else', () => {
    const i = newInventory();
    i.slots.fill(null);
    const max = stackSize('item.sunwort');
    const cap = i.slots.length;
    expect(addItem(i, 'item.sunwort', max * cap + 7)).toBe(7);
    expect(canHold(i, 'item.sunwort')).toBe(false);
    expect(canHold(i, 'item.dewmint')).toBe(false);
    expect(countItem(i, 'item.sunwort')).toBe(max * cap);
  });
  it('gear and keys do not stack', () => {
    const i = newInventory();
    i.slots.fill(null);
    addItem(i, 'item.sword_iron', 3);
    expect(i.slots.filter(Boolean)).toHaveLength(3);
  });
  it('removes across stacks, and refuses to take more than is held', () => {
    const i = newInventory();
    i.slots.fill(null);
    addItem(i, 'item.sunwort', 25);
    expect(removeItem(i, 'item.sunwort', 30)).toBe(false);
    expect(countItem(i, 'item.sunwort')).toBe(25);
    expect(removeItem(i, 'item.sunwort', 22)).toBe(true);
    expect(countItem(i, 'item.sunwort')).toBe(3);
  });
  it('an unknown item is never added', () => {
    const i = newInventory();
    expect(addItem(i, 'item.nope', 2)).toBe(2);
  });
  it('capacity comes from balance data, and a new avatar has the starter kit', () => {
    const r = rig();
    expect(inv(r).slots).toHaveLength(B.inventory.slots);
    expect(inv(r).equipment.main?.item).toBe('item.sword_rusty');
    expect(countItem(inv(r), 'item.dish_bread')).toBe(2);
  });
});

describe('equipment', () => {
  it('a new avatar fights with the base sword stats', () => {
    const r = rig();
    expect(cb(r)).toMatchObject({ weapon: 'sword', power: 10, defense: 0 });
  });
  it('equipping a weapon changes power, and swaps the old one back into the slot', () => {
    const r = rig();
    const slot = stash(r, 'item.sword_iron');
    r.tick({ type: 'equip', slot });
    expect(cb(r).power).toBe(14);
    expect(inv(r).equipment.main?.item).toBe('item.sword_iron');
    expect(inv(r).slots[slot]).toMatchObject({ item: 'item.sword_rusty', qty: 1 });
    expect(ofType(r.events, 'equipped')).toHaveLength(1);
  });
  it('a spear changes the weapon family as well as the power', () => {
    const r = rig();
    r.tick({ type: 'equip', slot: stash(r, 'item.spear_ash') });
    expect(cb(r)).toMatchObject({ weapon: 'spear', power: 11 });
  });
  it('worn gear adds defense, and taking it off removes it', () => {
    const r = rig();
    r.tick({ type: 'equip', slot: stash(r, 'item.outfit_leather') });
    r.tick({ type: 'equip', slot: stash(r, 'item.shield_wood') });
    r.tick({ type: 'equip', slot: stash(r, 'item.cap_wool') });
    expect(cb(r).defense).toBe(5 + 3 + 1);
    r.tick({ type: 'unequip', slot: 'off' });
    expect(cb(r).defense).toBe(5 + 1);
    expect(countItem(inv(r), 'item.shield_wood')).toBe(1);
    expect(inv(r).equipment.off).toBeNull();
    r.tick({ type: 'equip', slot: stash(r, 'item.outfit_wayfarer') });
    expect(cb(r).defense).toBe(2 + 1);
  });
  it('an empty main hand fights with bare hands, and a weapon takes over again', () => {
    const r = rig();
    r.tick({ type: 'unequip', slot: 'main' });
    expect(inv(r).equipment.main).toBeNull();
    expect(countItem(inv(r), 'item.sword_rusty')).toBe(1);
    expect(cb(r)).toMatchObject({ weapon: 'fists', power: WEAPONS.fists!.power });
    r.tick({ type: 'equip', slot: inv(r).slots.findIndex((x) => x?.item === 'item.sword_rusty') });
    expect(cb(r)).toMatchObject({ weapon: 'sword', power: 10 });
  });
  it('bare hands hit enemies through the real combat loop and pay no weapon skill', () => {
    const r = rig();
    r.tick({ type: 'unequip', slot: 'main' });
    const p = feetPx(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x + 14, p.y);
    r.tick({ type: 'move', dir: 2 });
    r.tick({ type: 'move', dir: null });
    r.events.length = 0;
    for (let i = 0; i < 60; i++) r.tick();
    const hits = ofType(r.events, 'damageDealt').filter((e) => e.src === r.me && e.dst === foe);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.tag === 'unarmed')).toBe(true);
    expect(r.s.entities.comps.skills[r.me]!.xp['skill.blades']).toBeUndefined();
  });
  it('the weapon rank of a held weapon does not carry over to bare hands', () => {
    const r = rig();
    r.s.entities.comps.skills[r.me]!.points['skill.blades'] = 20;
    r.run(1);
    expect(cb(r).skillRank).toBe(20);
    r.tick({ type: 'unequip', slot: 'main' });
    r.run(1);
    expect(cb(r).skillRank).toBe(0);
  });
  it('taking gear off with a full bag is refused', () => {
    const r = rig();
    r.tick({ type: 'equip', slot: stash(r, 'item.cap_wool') });
    for (let i = 0; i < inv(r).slots.length; i++)
      if (!inv(r).slots[i]) inv(r).slots[i] = { item: 'item.old_key', qty: 1 };
    expect(unequip(r.s, r.me, 'head')).toBe(false);
    expect(inv(r).equipment.head?.item).toBe('item.cap_wool');
  });
  it('cannot equip food, or anything while mid swing', () => {
    const r = rig();
    expect(equip(r.s, r.me, stash(r, 'item.herb_tea'))).toBe(false);
    r.s.entities.comps.fighter[r.me]!.state = 'attack';
    expect(equip(r.s, r.me, stash(r, 'item.sword_iron'))).toBe(false);
  });
});

describe('loot', () => {
  it('a drop table gives each item at its chance over 10,000 rolls', () => {
    const rng = createStream(99, 'loot');
    const drops = CREATURES['creature.mossling']!.drops;
    const n = 10_000;
    const got = new Map<string, { hits: number; qty: number }>();
    for (let i = 0; i < n; i++)
      for (const d of rollDrops(rng, drops)) {
        const g = got.get(d.item) ?? { hits: 0, qty: 0 };
        g.hits++;
        g.qty += d.qty;
        got.set(d.item, g);
      }
    for (const d of drops) {
      const g = got.get(d.item)!;
      expect(Math.abs(g.hits / n - d.chance / 100), d.item).toBeLessThan(0.02);
      expect(g.qty / g.hits, d.item).toBeGreaterThan(d.min);
      expect(g.qty / g.hits, d.item).toBeLessThan(d.max);
    }
  });
  it('every drop table entry names a real item', () => {
    for (const c of Object.values(CREATURES))
      for (const d of c.drops) expect(ITEMS[d.item], `${c.id} ${d.item}`).toBeDefined();
  });
  it('a creature killed in combat drops loot that is picked up', () => {
    const r = rig();
    const p = feetPx(r);
    const foe = spawnEnemy(r.s, 'creature.mossling', p.x + 16, p.y);
    r.s.entities.comps.pools[foe]!.hp = 1;
    r.tick({ type: 'move', dir: 2 });
    r.tick({ type: 'move', dir: null });
    for (let i = 0; i < 80 && ofType(r.events, 'died').length === 0; i++) r.tick();
    expect(ofType(r.events, 'died').some((e) => e.id === foe)).toBe(true);
    const dropped = ofType(r.events, 'lootDropped');
    expect(dropped.length).toBeGreaterThan(0);
    const before = countItem(inv(r), 'item.moss_tuft');
    const coin = r.s.entities.comps.avatar[r.me]!.coin;
    for (let i = 0; i < 120; i++) r.tick();
    for (const d of dropped) {
      if (d.item === 'item.coin')
        expect(r.s.entities.comps.avatar[r.me]!.coin).toBeGreaterThan(coin);
      else expect(countItem(inv(r), d.item)).toBeGreaterThanOrEqual(before);
    }
    expect(r.s.entities.comps.pickup.filter(Boolean)).toHaveLength(0);
    expect(ofType(r.events, 'itemPickedUp').length).toBe(dropped.length);
  });
  it('drops pop out first, then slide to an avatar inside the magnet radius', () => {
    const r = rig();
    const p = feetPx(r);
    const id = spawnPickup(r.s, 'item.sunwort', 2, (p.x + B.loot.magnetPx - 4) * 256, p.y * 256);
    const x0 = r.s.entities.comps.pos[id]!.x;
    for (let i = 0; i < B.loot.popTicks - 2; i++) r.tick();
    expect(r.s.entities.comps.pos[id]!.x).toBe(x0);
    r.run(40);
    expect(r.s.entities.comps.pickup[id]).toBeNull();
    expect(countItem(inv(r), 'item.sunwort')).toBe(2);
  });
  it('drops outside the magnet radius stay put, then fade', () => {
    const r = rig();
    const p = feetPx(r);
    const id = spawnPickup(r.s, 'item.sunwort', 1, (p.x + 100) * 256, p.y * 256);
    r.run(100);
    expect(r.s.entities.comps.pickup[id]).not.toBeNull();
    r.s.entities.comps.pickup[id]!.age = B.loot.lifeTicks - 1;
    r.tick();
    expect(r.s.entities.comps.pickup[id]).toBeNull();
  });
  it('coin goes to the purse, not a slot', () => {
    const r = rig();
    const p = feetPx(r);
    spawnPickup(r.s, 'item.coin', 7, (p.x + 3) * 256, p.y * 256);
    r.run(B.loot.popTicks + 3);
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(7);
    expect(countItem(inv(r), 'item.coin')).toBe(0);
  });
  it('a full bag leaves the drop where it is and says so once', () => {
    const r = rig();
    inv(r).slots.fill({ item: 'item.old_key', qty: 1 });
    const p = feetPx(r);
    const id = spawnPickup(r.s, 'item.sunwort', 1, (p.x + 2) * 256, p.y * 256);
    r.run(B.loot.popTicks + 20);
    expect(r.s.entities.comps.pickup[id]).not.toBeNull();
    expect(ofType(r.events, 'bagFull')).toHaveLength(1);
  });
});

describe('gathering nodes', () => {
  function nodeInFront(r: Rig, kind = 'node.herb_patch'): number {
    const p = feetPx(r);
    return spawnNode(r.s, kind, p.x, p.y + 10);
  }

  it('starts on the context button and a press in the sweet window pays the bonus', () => {
    const r = rig();
    const node = nodeInFront(r);
    r.tick({ type: 'interact' });
    expect(ofType(r.events, 'gatherStarted')).toHaveLength(1);
    for (let i = 0; i < B.gather.sweetFrom; i++) r.tick();
    r.tick({ type: 'interact' });
    const done = ofType(r.events, 'gatherResolved')[0]!;
    expect(done.sweet).toBe(true);
    expect(done.qty).toBeGreaterThanOrEqual(B.gather.baseMin + B.gather.sweetBonus);
    expect(countItem(inv(r), done.item)).toBe(done.qty);
    expect(ofType(r.events, 'gathered')[0]).toMatchObject({ tag: 'foraging', item: done.item });
    expect(r.s.entities.comps.node[node]!.readyAt).toBeGreaterThan(r.s.tick);
  });
  it('a press that misses the window still yields, without the bonus', () => {
    const r = rig();
    nodeInFront(r);
    r.tick({ type: 'interact' });
    r.tick({ type: 'interact' });
    const done = ofType(r.events, 'gatherResolved')[0]!;
    expect(done.sweet).toBe(false);
    expect(done.qty).toBeGreaterThanOrEqual(B.gather.baseMin);
    expect(done.qty).toBeLessThanOrEqual(B.gather.baseMax);
  });
  it('running out the sweep with no second press yields too', () => {
    const r = rig();
    nodeInFront(r);
    r.tick({ type: 'interact' });
    r.run(B.gather.sweepTicks + 2);
    const done = ofType(r.events, 'gatherResolved');
    expect(done).toHaveLength(1);
    expect(done[0]!.sweet).toBe(false);
  });
  it('walking away cancels the gather and the node stays ready', () => {
    const r = rig();
    const node = nodeInFront(r);
    r.tick({ type: 'interact' });
    r.s.entities.comps.pos[r.me]!.x += 256 * 80;
    r.tick();
    expect(ofType(r.events, 'gatherCancelled')).toHaveLength(1);
    expect(ofType(r.events, 'gatherResolved')).toHaveLength(0);
    expect(r.s.entities.comps.node[node]!.readyAt).toBe(0);
  });
  it('a spent node cannot be worked until it respawns, then announces itself', () => {
    const r = rig();
    const node = nodeInFront(r, 'node.berry_bush');
    r.tick({ type: 'interact' });
    r.tick({ type: 'interact' });
    const gives = r.events.length;
    expect(gives).toBeGreaterThan(0);
    r.events.length = 0;
    r.tick({ type: 'interact' });
    expect(ofType(r.events, 'gatherStarted')).toHaveLength(0);
    const ready = r.s.entities.comps.node[node]!.readyAt;
    expect(ready - r.s.tick).toBeLessThanOrEqual(NODES['node.berry_bush']!.respawn);
    r.s.tick = ready - 2;
    r.run(3);
    expect(ofType(r.events, 'nodeReady')).toEqual([{ type: 'nodeReady', id: node }]);
    r.events.length = 0;
    r.tick({ type: 'interact' });
    expect(ofType(r.events, 'gatherStarted')).toHaveLength(1);
  });
  it('an overflowing gather leaves the rest at the avatar feet instead of losing it', () => {
    const r = rig();
    inv(r).slots.fill({ item: 'item.old_key', qty: 1 });
    nodeInFront(r);
    r.tick({ type: 'interact' });
    r.tick({ type: 'interact' });
    expect(ofType(r.events, 'bagFull').length).toBeGreaterThan(0);
    expect(ofType(r.events, 'lootDropped').length).toBe(1);
  });
  it('yields follow the node weights', () => {
    const r = rig();
    const seen = new Set<string>();
    nodeInFront(r);
    for (let i = 0; i < 60; i++) {
      r.s.entities.comps.node.forEach((n) => n && (n.readyAt = 0));
      r.tick({ type: 'interact' });
      r.tick({ type: 'interact' });
      for (const e of ofType(r.events, 'gatherResolved')) seen.add(e.item);
      inv(r).slots.fill(null);
    }
    expect([...seen].sort()).toEqual(NODES['node.herb_patch']!.yields.map((y) => y.item).sort());
  });
});

describe('eating and the Fed buff', () => {
  it('restores pools and consumes one', () => {
    const r = rig();
    const slot = stash(r, 'item.hearty_stew', 2);
    pools(r).hp = 10;
    pools(r).sta = 0;
    r.tick({ type: 'use', slot });
    expect(pools(r).hp).toBeGreaterThan(40);
    expect(pools(r).sta).toBeGreaterThanOrEqual(250);
    expect(countItem(inv(r), 'item.hearty_stew')).toBe(1);
  });
  it('a meal with no buff only restores', () => {
    const r = rig();
    r.tick({ type: 'use', slot: stash(r, 'item.dish_bread') });
    expect(fedOf(r)).toBeUndefined();
  });
  it('the Fed buff replaces rather than stacks', () => {
    const r = rig();
    r.tick({ type: 'use', slot: stash(r, 'item.hearty_stew') });
    expect(pools(r).hpMax).toBe(C.pools.hpMax + 20);
    expect(pools(r).staMax).toBe(C.pools.staMax + 150);
    r.events.length = 0;
    r.tick({ type: 'use', slot: stash(r, 'item.berry_compote') });
    expect(ofType(r.events, 'fedStarted')[0]).toMatchObject({
      item: 'item.berry_compote',
      replaced: 'item.hearty_stew',
    });
    expect(pools(r).hpMax).toBe(C.pools.hpMax + 10);
    expect(pools(r).staMax).toBe(C.pools.staMax);
    expect(fedOf(r)!.item).toBe('item.berry_compote');
  });
  it('the buff ends on time and pools clamp back down', () => {
    const r = rig();
    r.tick({ type: 'use', slot: stash(r, 'item.hearty_stew') });
    const until = fedOf(r)!.until;
    r.s.tick = until - 2;
    r.run(1);
    expect(pools(r).hpMax).toBe(C.pools.hpMax + 20);
    r.run(2);
    expect(ofType(r.events, 'fedEnded')).toHaveLength(1);
    expect(pools(r).hpMax).toBe(C.pools.hpMax);
    expect(pools(r).hp).toBeLessThanOrEqual(C.pools.hpMax);
    expect(fedOf(r)).toBeUndefined();
  });
  it('non-food cannot be used', () => {
    const r = rig();
    const slot = stash(r, 'item.old_key');
    r.tick({ type: 'use', slot });
    expect(countItem(inv(r), 'item.old_key')).toBe(1);
  });
});

describe('cooking and experiments', () => {
  function atPot(): Rig {
    const r = rig();
    const p = feetPx(r);
    spawnCampPot(r.s, p.x, p.y + 10);
    return r;
  }

  it('discovers a recipe exactly once, and knows it after', () => {
    const r = atPot();
    stash(r, 'item.sunwort', 3);
    stash(r, 'item.dewmint', 3);
    // A new avatar knows the start recipes, and none of the cooking ones.
    const cooking = (): string[] => inv(r).recipes.filter((id) => RECIPES[id]?.craft === 'cooking');
    expect(cooking()).toEqual([]);
    r.tick({ type: 'cook', items: ['item.dewmint', 'item.sunwort'] });
    expect(ofType(r.events, 'recipeDiscovered')).toEqual([
      { type: 'recipeDiscovered', id: r.me, recipe: 'recipe.herb_tea' },
    ]);
    expect(cooking()).toEqual(['recipe.herb_tea']);
    expect(countItem(inv(r), 'item.herb_tea')).toBe(1);
    expect(countItem(inv(r), 'item.sunwort')).toBe(2);
    r.tick({ type: 'cook', items: ['item.sunwort', 'item.dewmint'] });
    expect(ofType(r.events, 'recipeDiscovered')).toHaveLength(1);
    expect(cooking()).toEqual(['recipe.herb_tea']);
    expect(countItem(inv(r), 'item.herb_tea')).toBe(2);
    expect(ofType(r.events, 'crafted')).toHaveLength(2);
  });
  it('a burnt mess is still edible, but weak, and gives no Fed buff', () => {
    const r = atPot();
    stash(r, 'item.sunwort');
    stash(r, 'item.clay');
    r.tick({ type: 'cook', items: ['item.sunwort', 'item.clay'] });
    const mess = ITEMS['item.burnt_mess']!.food!;
    const best = Math.max(...Object.values(ITEMS).map((i) => i.food?.hp ?? 0));
    expect(mess.hp).toBeGreaterThan(0);
    expect(mess.hp).toBeLessThan(ITEMS['item.dish_bread']!.food!.hp);
    expect(mess.hp).toBeLessThan(best / 4);
    expect(mess.fed).toBeUndefined();
    pools(r).hp = 10;
    r.tick({ type: 'use', slot: inv(r).slots.findIndex((x) => x?.item === 'item.burnt_mess') });
    expect(pools(r).hp).toBe(10 + mess.hp);
    expect(countItem(inv(r), 'item.burnt_mess')).toBe(0);
    expect(fedOf(r)).toBeUndefined();
  });
  it('a combination with no recipe burns the ingredients and teaches nothing', () => {
    const r = atPot();
    stash(r, 'item.sunwort');
    stash(r, 'item.clay');
    r.tick({ type: 'cook', items: ['item.sunwort', 'item.clay'] });
    expect(ofType(r.events, 'craftFailed')).toHaveLength(1);
    expect(countItem(inv(r), 'item.burnt_mess')).toBe(1);
    expect(countItem(inv(r), 'item.sunwort')).toBe(0);
    expect(inv(r).recipes.filter((id) => RECIPES[id]?.craft === 'cooking')).toEqual([]);
  });
  it('needs a pot in front and the ingredients in the bag, and takes nothing otherwise', () => {
    const r = rig();
    stash(r, 'item.sunwort');
    stash(r, 'item.dewmint');
    r.tick({ type: 'cook', items: ['item.sunwort', 'item.dewmint'] });
    expect(countItem(inv(r), 'item.sunwort')).toBe(1);
    const p = feetPx(r);
    spawnCampPot(r.s, p.x, p.y + 10);
    r.tick({ type: 'cook', items: ['item.sunwort', 'item.sunwort'] });
    expect(countItem(inv(r), 'item.sunwort')).toBe(1);
    expect(ofType(r.events, 'craftFailed')).toHaveLength(0);
  });
  it('all fourteen cooking recipes work at the pot, and cooking pays Cooking skill XP', () => {
    const r = atPot();
    const cooking = Object.values(RECIPES).filter((x) => x.craft === 'cooking');
    expect(cooking).toHaveLength(14);
    for (const rec of cooking) {
      const units = expand(rec.ingredients);
      for (const i of units) stash(r, i);
      r.tick({ type: 'cook', items: units });
      expect(countItem(inv(r), rec.result), rec.id).toBeGreaterThanOrEqual(rec.qty);
    }
    expect(inv(r).recipes.filter((id) => RECIPES[id]?.craft === 'cooking')).toHaveLength(14);
    const skills = r.s.entities.comps.skills[r.me]!;
    expect(skills.points['skill.cooking']! + skills.xp['skill.cooking']!).toBeGreaterThan(0);
  });
});

describe('commands and determinism', () => {
  it('validates the new commands', () => {
    expect(validateCommand({ type: 'interact' }).ok).toBe(true);
    expect(validateCommand({ type: 'equip', slot: 3 }).ok).toBe(true);
    expect(validateCommand({ type: 'equip', slot: -1 }).ok).toBe(false);
    expect(validateCommand({ type: 'use', slot: 1.5 }).ok).toBe(false);
    expect(validateCommand({ type: 'unequip', slot: 'head' }).ok).toBe(true);
    expect(validateCommand({ type: 'unequip', slot: 'feet' }).ok).toBe(false);
    expect(validateCommand({ type: 'cook', items: ['item.sunwort'] }).ok).toBe(true);
    expect(validateCommand({ type: 'cook', items: [] }).ok).toBe(false);
    expect(validateCommand({ type: 'cook', items: ['a', 'b', 'c', 'd'] }).ok).toBe(false);
    expect(validateCommand({ type: 'cook', items: ['<script>'] }).ok).toBe(false);
    expect(validateCommand({ type: 'cook', items: [5] }).ok).toBe(false);
  });
  it('the same inputs give the same state', () => {
    const run = (): string => {
      const r = rig();
      const p = feetPx(r);
      spawnNode(r.s, 'node.herb_patch', p.x, p.y + 10);
      for (let i = 0; i < 6; i++) {
        r.tick({ type: 'interact' });
        r.run(5);
        r.tick({ type: 'interact' });
        r.s.entities.comps.node.forEach((n) => n && (n.readyAt = 0));
      }
      return hashState(r.s);
    };
    expect(run()).toBe(run());
  });
});

describe('dropping', () => {
  it('drops a whole slot at the feet, and it is not re-collected for a moment', () => {
    const r = rig();
    const slot = stash(r, 'item.sunwort', 3);
    r.tick({ type: 'drop', slot });
    expect(inv(r).slots[slot]).toBeNull();
    const drop = r.s.entities.comps.pickup.findIndex((p) => p?.item === 'item.sunwort');
    expect(drop).toBeGreaterThanOrEqual(0);
    r.run(B.loot.dropGraceTicks - 5);
    expect(countItem(inv(r), 'item.sunwort')).toBe(0);
    expect(r.s.entities.comps.pickup[drop]).not.toBeNull();
    r.run(30);
    expect(countItem(inv(r), 'item.sunwort')).toBe(3);
  });
  it('dropping an empty slot or a bad slot does nothing', () => {
    const r = rig();
    const before = JSON.stringify(inv(r));
    r.tick({ type: 'drop', slot: 19 });
    r.tick({ type: 'drop', slot: 200 });
    expect(JSON.stringify(inv(r))).toBe(before);
  });
  it('validates the drop command', () => {
    expect(validateCommand({ type: 'drop', slot: 2 }).ok).toBe(true);
    expect(validateCommand({ type: 'drop', slot: -2 }).ok).toBe(false);
    expect(validateCommand({ type: 'drop', slot: 'a' }).ok).toBe(false);
  });
});
