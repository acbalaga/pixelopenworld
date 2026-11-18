import { describe, expect, it } from 'vitest';
import { REQUESTS } from '../../src/content/requests';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { give, equip, unequip } from '../../src/sim/items';
import { getComp, spawn, setComp } from '../../src/sim/kernel/entities';
import { px } from '../../src/sim/kernel/fixed';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { fixturesSystem, spawnFixture } from '../../src/sim/systems/fixtures';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { emit } from '../../src/sim/kernel/events';

const OPEN = { solidAt: (): number => 0 };

function world(): { s: SimState; me: number } {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  return { s, me: createAvatar(s, f.x, f.y) };
}
const slots = (s: SimState, me: number): (string | null)[] =>
  getComp(s.entities, me, 'fighter')!.slots;
const bagSlot = (s: SimState, me: number, item: string): number =>
  getComp(s.entities, me, 'inventory')!.slots.findIndex((x) => x?.item === item);

describe('the lunge follows the weapon', () => {
  it('a sword gives the Blades lunge, and nothing else is known at the start', () => {
    const { s, me } = world();
    expect(slots(s, me)).toEqual(['technique.blades_lunge', null, null, null]);
  });
  it('a spear gives the Polearms lunge, bare hands give none, and the sword gives it back', () => {
    const { s, me } = world();
    give(s, me, 'item.spear_ash', 1, 'start');
    expect(equip(s, me, bagSlot(s, me, 'item.spear_ash'))).toBe(true);
    expect(slots(s, me)[0]).toBe('technique.polearms_lunge');
    // The sword went back to the bag. Take the spear off: bare hands use the Palm.
    expect(unequip(s, me, 'main')).toBe(true);
    expect(slots(s, me)[0]).toBe('technique.unarmed_palm');
    expect(equip(s, me, bagSlot(s, me, 'item.sword_rusty'))).toBe(true);
    expect(slots(s, me)[0]).toBe('technique.blades_lunge');
  });
  it('a learned technique in another slot survives a weapon change', () => {
    const { s, me } = world();
    getComp(s.entities, me, 'fighter')!.slots[1] = 'technique.ember_bolt';
    give(s, me, 'item.spear_ash', 1, 'start');
    equip(s, me, bagSlot(s, me, 'item.spear_ash'));
    expect(slots(s, me)).toEqual(['technique.polearms_lunge', 'technique.ember_bolt', null, null]);
  });
});

describe("Wren's mission teaches the Ember bolt", () => {
  it('turning in the request slots Ember bolt once, with a notice', () => {
    const { s, me } = world();
    const f = feetAt(20, 20);
    // Stand the scholar next to the avatar.
    spawnNpc(s, 'npc.scholar', 21, 20);
    const j = getComp(s.entities, me, 'journal')!;
    const id = 'request.ember_pods';
    expect(REQUESTS[id]?.reward.techniques).toEqual(['technique.ember_bolt']);
    j.requests[id] = {
      state: 'ready',
      solution: 'defeat',
      prog: { defeat: { step: 1, p: { n: 0, t0: 0 } } },
      progress: 2,
    };
    void f;
    stepWorld(s, me, {
      commands: [{ type: 'talk', npc: 'npc.scholar', node: 'report', choice: -1 }],
    });
    expect(j.requests[id]?.state).toBe('done');
    expect(slots(s, me)[1]).toBe('technique.ember_bolt');
    expect(s.events.list.some((e) => e.type === 'techniqueLearned')).toBe(true);
    // Doing it again teaches nothing new and does not duplicate.
    stepWorld(s, me, {
      commands: [{ type: 'talk', npc: 'npc.scholar', node: 'report', choice: -1 }],
    });
    expect(slots(s, me).filter((x) => x === 'technique.ember_bolt')).toHaveLength(1);
  });
  it('the technique is not known before the mission', () => {
    const { s, me } = world();
    expect(slots(s, me)).not.toContain('technique.ember_bolt');
  });
});

describe('the boss-room shortcut', () => {
  function withShortcut(): { s: SimState; me: number; id: number } {
    const { s, me } = world();
    const id = spawnFixture(s, 'fixture.portal_e_shortcut', 30, 30);
    spawnFixture(s, 'fixture.arrival_a_shortcut', 5, 5);
    return { s, me, id };
  }
  it('stays shut and hidden until the boss is down', () => {
    const { s, me, id } = withShortcut();
    const pos = getComp(s.entities, id, 'pos')!;
    const a = getComp(s.entities, me, 'pos')!;
    a.x = pos.x;
    a.y = pos.y - px(8);
    stepWorld(s, me, { commands: [] });
    // Standing on it does nothing.
    expect(Math.abs(a.x - pos.x)).toBeLessThan(px(2));
    expect(getComp(s.entities, id, 'fixture')!.open).toBe(false);
  });
  it('opens for good when the boss dies, and then carries the avatar through', () => {
    const { s, me, id } = withShortcut();
    const boss = spawn(s.entities);
    setComp(s.entities, boss, 'combatant', {
      weapon: 'claws',
      power: 1,
      defense: 0,
      skillRank: 0,
      name: 'Boss',
      kind: 'creature.old_bramblehide',
      tier: 3,
    });
    // The tick clears events first, so hand the fixtures system the death directly.
    emit(s.events, { type: 'died', id: boss, team: 1 });
    fixturesSystem(s);
    expect(getComp(s.entities, id, 'fixture')!.open).toBe(true);
    expect(s.events.list.some((e) => e.type === 'shortcutOpened')).toBe(true);
    // Open now: standing on it carries the avatar to the landing.
    const pos = getComp(s.entities, id, 'pos')!;
    const a = getComp(s.entities, me, 'pos')!;
    a.x = pos.x;
    a.y = pos.y - px(8);
    fixturesSystem(s);
    expect(Math.abs(a.y - px(110))).toBeLessThan(px(2));
  });
});
