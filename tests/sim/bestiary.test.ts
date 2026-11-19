import { describe, expect, it } from 'vitest';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { feedCreature } from '../../src/sim/creatureCare';
import { addItem } from '../../src/sim/items';
import { emit } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { bestiarySystem } from '../../src/sim/systems/bestiary';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 90 || ty > 90 ? 1 : 0),
};
function arena() {
  const s = createDemoState(9, 0);
  s.world = OPEN;
  const me = createAvatar(s, feetAt(30, 30).x, feetAt(30, 30).y);
  const bestiary = () => s.entities.comps.journal[me]!.bestiary;
  const send = (e: Parameters<typeof emit>[1]): void => {
    s.events.list.length = 0;
    emit(s.events, e);
    bestiarySystem(s);
  };
  return { s, me, bestiary, send };
}
const run = (s: SimState, me: number, n: number): void => {
  for (let i = 0; i < n; i++) stepWorld(s, me, { commands: [] });
};

describe('the Bestiary fills as the avatar plays', () => {
  it('a new character has an empty bestiary and nothing to list', () => {
    const { s, me, bestiary } = arena();
    expect(bestiary()).toEqual({});
    expect(s.entities.comps.journal[me]!.bestiary).toEqual({});
  });

  it('the first kill lists a kind, and a dummy never does', () => {
    const { me, send, bestiary } = arena();
    send({ type: 'killed', src: me, dst: 99, kind: 'creature.training_dummy', tag: 'blades' });
    expect(bestiary()['creature.training_dummy']).toBeUndefined();
    send({ type: 'killed', src: me, dst: 99, kind: 'creature.mossling', tag: 'blades' });
    expect(bestiary()['creature.mossling']?.slain).toBe(true);
    // Someone else's kill is not the avatar's.
    send({ type: 'killed', src: me + 7, dst: 99, kind: 'creature.fox', tag: 'blades' });
    expect(bestiary()['creature.fox']).toBeUndefined();
  });

  it('taking food from the hand lists a kind as befriended, and both marks read as both', () => {
    const { s, me, bestiary } = arena();
    addItem(s.entities.comps.inventory[me]!, 'item.berry_red', 1);
    s.entities.comps.avatar[me]!.facing = 2;
    spawnCreature(s, 'creature.meadow_hare', 30 * 16 + 8 + 20, 30 * 16 + 14);
    const slot = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.berry_red',
    );
    expect(feedCreature(s, me, slot)).toBe(true);
    bestiarySystem(s);
    expect(bestiary()['creature.meadow_hare']?.befriended).toBe(true);
    s.events.list.length = 0;
    emit(s.events, {
      type: 'killed',
      src: me,
      dst: 1,
      kind: 'creature.meadow_hare',
      tag: 'blades',
    });
    bestiarySystem(s);
    expect(bestiary()['creature.meadow_hare']).toMatchObject({ slain: true, befriended: true });
  });

  it('a creature that acts on its nature in front of the avatar has that nature recorded once', () => {
    const { s, me, bestiary } = arena();
    spawnCreature(s, 'creature.barrow_bones', 30 * 16 + 8 + 50, 30 * 16 + 14);
    run(s, me, 60);
    expect(bestiary()['creature.barrow_bones']?.temperaments).toEqual(['hostile']);
    run(s, me, 60);
    expect(bestiary()['creature.barrow_bones']?.temperaments).toEqual(['hostile']);
  });
});
