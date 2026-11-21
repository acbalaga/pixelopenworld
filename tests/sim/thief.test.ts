import { describe, expect, it } from 'vitest';
import { TEMPERAMENT as TB } from '../../src/content/balance/temperament';
import { createAvatar } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { kill } from '../../src/sim/combat/fighter';
import { getComp, query } from '../../src/sim/kernel/entities';
import { emit } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { give } from '../../src/sim/items';
import { createDemoState, type SimState } from '../../src/sim/state';
import { createSpawner, spawnerSystem } from '../../src/sim/systems/spawner';
import { thiefSystem } from '../../src/sim/systems/thief';

function game(): { s: SimState; me: number; fox: number } {
  const s = createDemoState(3, 0);
  const me = createAvatar(s, px(160), px(160));
  // A fox from Fox Hollow's spawner, which is the thief.
  const sp = createSpawner(s, 'spawner.dg_fox', 170, 150);
  spawnerSystem(s);
  const fox = getComp(s.entities, sp, 'spawner')!.members[0]!;
  return { s, me, fox };
}
const bagCount = (s: SimState, me: number, item: string): number =>
  getComp(s.entities, me, 'inventory')!.slots.reduce(
    (n, x) => n + (x?.item === item ? x.qty : 0),
    0,
  );
const bite = (s: SimState, src: number, dst: number): void => {
  emit(s.events, {
    type: 'damageDealt',
    src,
    dst,
    amount: 3,
    crit: false,
    bonus: false,
    heavy: false,
    tag: 'creature',
  });
  thiefSystem(s);
  s.events.list.length = 0;
};
const pickups = (s: SimState, item: string): number =>
  query(s.entities, 'pickup').filter((id) => getComp(s.entities, id, 'pickup')?.item === item)
    .length;

describe('the Fox Hollow thief (m6)', () => {
  it('a bite takes one unit of food or material and the fox runs with it', () => {
    const { s, me, fox } = game();
    give(s, me, 'item.raw_meat', 3, 'seed');
    const before = bagCount(s, me, 'item.raw_meat');
    bite(s, fox, me);
    expect(bagCount(s, me, 'item.raw_meat')).toBe(before - 1);
    expect(getComp(s.entities, fox, 'ai')?.loot?.stack.item).toBe('item.raw_meat');
    expect(getComp(s.entities, fox, 'ai')?.state).toBe('flee');
    // It takes only once.
    bite(s, fox, me);
    expect(bagCount(s, me, 'item.raw_meat')).toBe(before - 1);
  });

  it('takes nothing when the bag holds nothing it wants', () => {
    const { s, me, fox } = game();
    for (const sl of getComp(s.entities, me, 'inventory')!.slots) if (sl) sl.qty = 0;
    getComp(s.entities, me, 'inventory')!.slots.fill(null);
    bite(s, fox, me);
    expect(getComp(s.entities, fox, 'ai')?.loot).toBeUndefined();
  });

  it('the item drops where the thief falls', () => {
    const { s, me, fox } = game();
    give(s, me, 'item.raw_meat', 1, 'seed');
    bite(s, fox, me);
    expect(bagCount(s, me, 'item.raw_meat')).toBe(0);
    kill(s, fox);
    thiefSystem(s);
    expect(pickups(s, 'item.raw_meat')).toBe(1);
    expect(getComp(s.entities, fox, 'ai')?.loot).toBeUndefined();
  });

  it('a thief that runs its course drops it, and nothing is lost', () => {
    const { s, me, fox } = game();
    give(s, me, 'item.raw_meat', 1, 'seed');
    bite(s, fox, me);
    for (let i = 0; i < TB.thief.runTicks; i++) thiefSystem(s);
    expect(pickups(s, 'item.raw_meat')).toBe(1);
  });

  it('the item goes back to the bag when its owner falls', () => {
    const { s, me, fox } = game();
    give(s, me, 'item.raw_meat', 1, 'seed');
    bite(s, fox, me);
    kill(s, me);
    thiefSystem(s);
    expect(bagCount(s, me, 'item.raw_meat') + pickups(s, 'item.raw_meat')).toBe(1);
  });

  it('an ordinary fox still only bites', () => {
    const { s, me } = game();
    const wild = spawnCreature(s, 'creature.fox', 170, 150);
    give(s, me, 'item.raw_meat', 1, 'seed');
    bite(s, wild, me);
    expect(bagCount(s, me, 'item.raw_meat')).toBe(1);
  });
});
