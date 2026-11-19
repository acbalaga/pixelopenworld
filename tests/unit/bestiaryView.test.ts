import { describe, expect, it } from 'vitest';
import { UI_STRINGS as S } from '../../src/content/strings/ui';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { emit } from '../../src/sim/kernel/events';
import { createDemoState } from '../../src/sim/state';
import { bestiarySystem } from '../../src/sim/systems/bestiary';
import { bestiaryView, creatureSheetView, habitatsOf } from '../../src/ui/menu/model';

function arena() {
  const s = createDemoState(9, 0);
  const me = createAvatar(s, feetAt(30, 30).x, feetAt(30, 30).y);
  const send = (e: Parameters<typeof emit>[1]): void => {
    s.events.list.length = 0;
    emit(s.events, e);
    bestiarySystem(s);
  };
  return { s, me, send };
}

describe('the Bestiary view', () => {
  it('lists by tier then name, and only kinds that are beaten or befriended', () => {
    const { s, me, send } = arena();
    for (const kind of ['creature.moorhound', 'creature.thornling_scout', 'creature.fox'])
      send({ type: 'killed', src: me, dst: 9, kind, tag: 'blades' });
    // Seen, but neither beaten nor befriended: not listed.
    send({
      type: 'temperamentSeen',
      id: 1,
      target: me,
      kind: 'creature.hollowhorn',
      temperament: 'territorial',
    });
    expect(bestiaryView(s, me).map((r) => r.name)).toEqual(['Fox', 'Moorhound', 'Thornling Scout']);
  });

  it('a nature shows only once it has been seen, and drops only once beaten', () => {
    const { s, me, send } = arena();
    send({ type: 'killed', src: me, dst: 9, kind: 'creature.fox', tag: 'blades' });
    let v = creatureSheetView(s, me, 'creature.fox')!;
    expect(v.notes.join('\n')).toContain(S.bestiary.unknownNature);
    expect(v.notes.join('\n')).toContain('Hide');
    expect(v.notes.join('\n')).not.toContain('Takes from your hand');
    send({
      type: 'temperamentSeen',
      id: 1,
      target: me,
      kind: 'creature.fox',
      temperament: 'hostile',
    });
    v = creatureSheetView(s, me, 'creature.fox')!;
    expect(v.notes.join('\n')).toContain(S.bestiary.temperaments.hostile!);
    expect(v.notes.join('\n')).not.toContain(S.bestiary.unknownNature);
    // A creature never beaten has no drops line, and one never listed has no sheet.
    send({ type: 'creatureFed', id: 99, who: me, item: 'item.berry_red' });
    expect(creatureSheetView(s, me, 'creature.hollowhorn')).toBeNull();
  });

  it('where a kind is found comes from the zones and the hand placed spawners', () => {
    expect(habitatsOf('creature.fox')).toEqual(
      expect.arrayContaining(['Millbrook fields', 'Fernside Edge']),
    );
    expect(habitatsOf('creature.grain_rat')).toEqual(['Millbrook barns']);
    expect(habitatsOf('creature.hollowhorn').join(' ')).toContain('Cairnmoor');
  });

  it('every string reads clearly: no em dashes, every temperament has a line', () => {
    const all = JSON.stringify(S.bestiary);
    expect(all).not.toContain('—');
    for (const t of ['hostile', 'territorial', 'defensive', 'skittish', 'passive', 'curious'])
      expect(S.bestiary.temperaments[t], t).toBeTruthy();
  });
});

describe('the Bestiary rows', () => {
  it('an empty bestiary lists nothing, and a kill gives a row that says beaten', () => {
    const { s, me, send } = arena();
    expect(bestiaryView(s, me)).toEqual([]);
    send({ type: 'killed', src: me, dst: 9, kind: 'creature.mossling', tag: 'blades' });
    const rows = bestiaryView(s, me);
    expect(rows.map((r) => r.id)).toEqual(['creature.mossling']);
    expect(rows[0]!.state).toBe(S.bestiary.beaten);
    send({ type: 'creatureFed', id: 99, who: me, item: 'item.berry_red' });
  });
});
