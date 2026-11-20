import { describe, expect, it } from 'vitest';
import { TEMPERAMENT as TB } from '../../src/content/balance/temperament';
import { CREATURES } from '../../src/content/creatures';
import { FEEDS } from '../../src/content/creatures/interactions';
import { ITEMS } from '../../src/content/items';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { dealDamage } from '../../src/sim/combat/fighter';
import { feedTarget } from '../../src/sim/creatureFeed';
import { getComp } from '../../src/sim/kernel/entities';
import type { SimEvent } from '../../src/sim/kernel/events';
import { dirStep } from '../../src/sim/kernel/fixed';
import { validateCommand } from '../../src/sim/kernel/commands';
import { addItem } from '../../src/sim/items';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { hostileCreatures } from '../support/temperament';

hostileCreatures('creature.moorhound');

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 80 || ty > 80 ? 1 : 0),
};

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  run: (n: number) => void;
  /** Puts a creature `px` in front of the avatar, along its facing. */
  place: (creature: string, px: number) => number;
}

function rig(): Rig {
  const s = createDemoState(9, 0);
  s.world = OPEN;
  const f = feetAt(30, 30);
  const me = createAvatar(s, f.x, f.y);
  const events: SimEvent[] = [];
  const r: Rig = {
    s,
    me,
    events,
    run: (n) => {
      for (let i = 0; i < n; i++) {
        stepWorld(s, me, { commands: [] });
        events.push(...s.events.list);
      }
    },
    place: (creature, dist) => {
      const a = s.entities.comps.avatar[me]!;
      const p = s.entities.comps.pos[me]!;
      const d = dirStep(a.facing);
      return spawnCreature(
        s,
        creature,
        Math.round(p.x / 256 + d.x * dist),
        Math.round(p.y / 256 + d.y * dist),
      );
    },
  };
  return r;
}

const slotOf = (s: SimState, me: number, item: string): number =>
  s.entities.comps.inventory[me]!.slots.findIndex((x) => x?.item === item);
const feed = (r: Rig, item: string): void => {
  stepWorld(r.s, r.me, { commands: [{ type: 'feed', slot: slotOf(r.s, r.me, item) }] });
  r.events.push(...r.s.events.list);
};

describe('feeding a creature (M4-05)', () => {
  it('takes one item, calms the creature, and opens its Bestiary entry as a friend', () => {
    const r = rig();
    addItem(r.s.entities.comps.inventory[r.me]!, 'item.raw_meat', 3);
    const id = r.place('creature.moorhound', 16);
    feed(r, 'item.raw_meat');
    const inv = r.s.entities.comps.inventory[r.me]!;
    expect(inv.slots[slotOf(r.s, r.me, 'item.raw_meat')]?.qty).toBe(2);
    const ai = getComp(r.s.entities, id, 'ai')!;
    expect(ai.calmUntil).toBeGreaterThan(r.s.worldTick);
    expect(r.events).toContainEqual({
      type: 'creatureFed',
      who: r.me,
      id,
      kind: 'creature.moorhound',
      item: 'item.raw_meat',
    });
    r.run(1);
    expect(r.s.entities.comps.journal[r.me]!.bestiary['creature.moorhound']).toEqual({
      temperaments: expect.any(Array),
      befriended: true,
    });
  });

  it('refuses what a creature does not eat, a creature too far off, and one behind', () => {
    const r = rig();
    const inv = r.s.entities.comps.inventory[r.me]!;
    addItem(inv, 'item.raw_meat', 2);
    addItem(inv, 'item.berry_red', 2);
    const far = r.place('creature.moorhound', TB.feed.reachPx + 40);
    feed(r, 'item.raw_meat');
    expect(getComp(r.s.entities, far, 'ai')!.calmUntil).toBeUndefined();
    const near = r.place('creature.moorhound', 16);
    // A hound does not eat berries.
    feed(r, 'item.berry_red');
    expect(getComp(r.s.entities, near, 'ai')!.calmUntil).toBeUndefined();
    expect(inv.slots[slotOf(r.s, r.me, 'item.berry_red')]?.qty).toBe(2);
    // Behind the avatar is not in front of it.
    const behind = rig();
    addItem(behind.s.entities.comps.inventory[behind.me]!, 'item.raw_meat', 1);
    const b = behind.place('creature.moorhound', -16);
    expect(feedTarget(behind.s, behind.me, 'item.raw_meat')).toBeNull();
    feed(behind, 'item.raw_meat');
    expect(getComp(behind.s.entities, b, 'ai')!.calmUntil).toBeUndefined();
    expect(
      behind.s.entities.comps.inventory[behind.me]!.slots[
        slotOf(behind.s, behind.me, 'item.raw_meat')
      ]?.qty,
    ).toBe(1);
  });

  it('a calm hostile creature starts nothing, until the calm runs out', () => {
    const r = rig();
    addItem(r.s.entities.comps.inventory[r.me]!, 'item.raw_meat', 1);
    const id = r.place('creature.moorhound', 16);
    // Without food it comes for the avatar at once.
    const wild = rig();
    const w = wild.place('creature.moorhound', 16);
    wild.run(10);
    expect(getComp(wild.s.entities, w, 'ai')!.target).toBe(wild.me);
    feed(r, 'item.raw_meat');
    r.run(TB.feed.calmTicks - 60);
    const ai = getComp(r.s.entities, id, 'ai')!;
    expect(ai.target).toBeNull();
    // Flow's automatic swing leaves a fed creature alone.
    const hp = getComp(r.s.entities, id, 'pools')!;
    expect(hp.hp).toBe(hp.hpMax);
    expect(getComp(r.s.entities, r.me, 'pools')!.hp).toBe(
      getComp(r.s.entities, r.me, 'pools')!.hpMax,
    );
    r.run(200);
    expect(ai.target).toBe(r.me);
  });

  it('a hit ends the calm at once, and the creature fights back', () => {
    const r = rig();
    addItem(r.s.entities.comps.inventory[r.me]!, 'item.raw_meat', 1);
    const id = r.place('creature.moorhound', 16);
    feed(r, 'item.raw_meat');
    r.run(30);
    const ai = getComp(r.s.entities, id, 'ai')!;
    expect(ai.target).toBeNull();
    dealDamage(r.s, id, {
      src: r.me,
      from: { x: 0, y: 0 },
      power: 1,
      rank: 0,
      mult: 1,
      stagger: 0,
      knock: 0,
      element: 0,
      heavy: false,
      tag: 'blades',
    });
    expect(ai.calmUntil).toBeUndefined();
    expect(ai.provoked).toBe(true);
    expect(ai.target).toBe(r.me);
  });

  it('lets go of the lock on a creature it feeds', () => {
    const r = rig();
    addItem(r.s.entities.comps.inventory[r.me]!, 'item.raw_meat', 1);
    const id = r.place('creature.moorhound', 16);
    const c = r.s.entities.comps.pos[id]!;
    // Between swings, so the avatar is idle when the food goes out.
    r.s.entities.comps.fighter[r.me]!.gap = 60;
    stepWorld(r.s, r.me, { commands: [{ type: 'lock', x: c.x / 256, y: c.y / 256 - 4 }] });
    expect(r.s.entities.comps.fighter[r.me]!.lock).toBe(id);
    feed(r, 'item.raw_meat');
    expect(r.s.entities.comps.fighter[r.me]!.lock).toBeNull();
  });

  it('validates the feed command like the other slot commands', () => {
    expect(validateCommand({ type: 'feed', slot: 2 })).toEqual({
      ok: true,
      command: { type: 'feed', slot: 2 },
    });
    expect(validateCommand({ type: 'feed', slot: -1 }).ok).toBe(false);
    expect(validateCommand({ type: 'feed' }).ok).toBe(false);
  });

  it('only real creatures and real items are in the data, and no boss is fed', () => {
    for (const [id, def] of Object.entries(FEEDS)) {
      expect(CREATURES[id], id).toBeDefined();
      expect(def.items.length, id).toBeGreaterThan(0);
      for (const it of def.items) expect(ITEMS[it], `${id} ${it}`).toBeDefined();
    }
    expect(FEEDS['creature.hollowhorn']).toBeUndefined();
    expect(FEEDS['creature.old_bramblehide']).toBeUndefined();
  });
});
