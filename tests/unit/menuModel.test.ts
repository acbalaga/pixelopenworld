import { describe, expect, it } from 'vitest';
import { COMBAT as C } from '../../src/content/balance/combat';
import { TIME } from '../../src/content/balance/time';
import { UI_BALANCE } from '../../src/content/balance/ui';
import { ITEMS } from '../../src/content/items';
import { registerSkill, unregisterSkill } from '../../src/content/skills';
import { UI_STRINGS } from '../../src/content/strings/ui';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { addItem, eat } from '../../src/sim/items';
import { addXp, offerTrial, xpToNext } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { TAB_IDS, ENABLED_TABS } from '../../src/ui/dom/menu';
import { FadeTracker } from '../../src/ui/hud/fade';
import {
  bagView,
  characterView,
  clockView,
  itemActions,
  itemDetail,
  itemName,
  skillsView,
  statusIcons,
} from '../../src/ui/menu/model';

function rig(): { s: SimState; me: number } {
  const s = createDemoState(3, 0);
  const f = feetAt(10, 10);
  return { s, me: createAvatar(s, f.x, f.y) };
}

describe('character view', () => {
  it('shows pools in whole points, with Stamina and Focus converted from tenths', () => {
    const { s, me } = rig();
    const v = characterView(s, me);
    expect(v.pools.map((p) => p.key)).toEqual(['hp', 'sta', 'foc']);
    expect(v.pools[0]).toMatchObject({
      curText: String(C.pools.hpMax),
      maxText: String(C.pools.hpMax),
    });
    expect(v.pools[1]).toMatchObject({ curText: String(C.pools.staMax / 10) });
  });
  it('lists all six gear slots in order, with the worn item and its icon', () => {
    const { s, me } = rig();
    const g = characterView(s, me).gear;
    expect(g.map((x) => x.slot)).toEqual(['main', 'off', 'head', 'body', 'legs', 'accessory']);
    expect(g[0]).toMatchObject({
      item: 'item.sword_rusty',
      itemName: 'Rusty Sword',
      icon: 'icon.sword_rusty',
    });
    expect(g[1]).toMatchObject({ item: null, itemName: null, icon: null });
  });
});

describe('skills view', () => {
  it('lists nothing for a new avatar: no skill is shown before it first ranks up', () => {
    const { s, me } = rig();
    expect(skillsView(s, me)).toEqual([]);
    addXp(s, me, 'skill.blades', xpToNext(0) - 1);
    expect(skillsView(s, me)).toEqual([]);
  });

  it('groups the skills by family, with rank and progress', () => {
    const { s, me } = rig();
    addXp(s, me, 'skill.blades', xpToNext(0) + Math.floor(xpToNext(1) / 2));
    const fams = skillsView(s, me);
    // Only skills that have ranked up are listed, so only Arms shows.
    expect(fams.map((f) => f.family)).toEqual(['arms']);
    expect(fams[0]!.rows.map((r) => r.id)).toEqual(['skill.blades']);
    const blades = fams[0]!.rows.find((r) => r.id === 'skill.blades')!;
    expect(blades).toMatchObject({ points: 1, mastery: 'Novice' });
    expect(blades.progressPct).toBeGreaterThanOrEqual(45);
    expect(blades.progressPct).toBeLessThanOrEqual(50);
    expect(blades.label).toBe('Blades, Novice, 1 of 100');
  });
  it('shows a Trial hint when XP waits at a threshold, and says if it was given', () => {
    const { s, me } = rig();
    s.entities.comps.skills[me]!.points['skill.foraging'] = 14;
    addXp(s, me, 'skill.foraging', xpToNext(14) + 10);
    const row = () =>
      skillsView(s, me)
        .flatMap((f) => f.rows)
        .find((r) => r.id === 'skill.foraging')!;
    expect(row().trial).toBe('ready');
    offerTrial(s, me, 'trial.foraging.15');
    expect(row().trial).toBe('offered');
    expect(row().progressPct).toBe(100);
  });
  it('a skill added as data shows up with no code change', () => {
    registerSkill({
      id: 'skill.fake',
      name: 'Fake',
      family: 'social',
      sources: [{ on: 'gather', tag: 'x', base: 1 }],
    });
    try {
      const { s, me } = rig();
      // Hidden until it first ranks up, like every other skill.
      expect(skillsView(s, me).find((f) => f.family === 'social')).toBeUndefined();
      addXp(s, me, 'skill.fake', xpToNext(0));
      expect(skillsView(s, me).find((f) => f.family === 'social')?.rows[0]).toMatchObject({
        id: 'skill.fake',
        points: 1,
      });
    } finally {
      unregisterSkill('skill.fake');
    }
  });
});

describe('bag view and item actions', () => {
  it('lists every slot with a label a screen reader can read', () => {
    const { s, me } = rig();
    const v = bagView(s, me);
    expect(v.total).toBe(v.slots.length);
    expect(v.used).toBe(1);
    expect(v.slots[0]).toMatchObject({ item: 'item.dish_bread', qty: 2, label: 'Bread, 2' });
    expect(v.slots[1]).toMatchObject({ item: null, label: UI_STRINGS.bagSlotEmptyLabel });
  });
  it('offers Eat for food, Wear for gear, and Drop for everything', () => {
    expect(itemActions(ITEMS['item.dish_bread']!)).toEqual(['use', 'drop']);
    expect(itemActions(ITEMS['item.sword_iron']!)).toEqual(['equip', 'drop']);
    expect(itemActions(ITEMS['item.moss_tuft']!)).toEqual(['drop']);
    // Raw forage can be eaten as found (it pays Survival XP).
    expect(itemActions(ITEMS['item.sunwort']!)).toEqual(['use', 'drop']);
    expect(itemActions(ITEMS['item.burnt_mess']!)).toEqual(['use', 'drop']);
  });
  it('shows an item detail from the slot, and nothing for an empty slot', () => {
    const { s, me } = rig();
    const d = itemDetail(s, me, 0)!;
    expect(d).toMatchObject({ name: 'Bread', category: 'Food', actions: ['use', 'drop'] });
    expect(d.description.length).toBeGreaterThan(5);
    expect(d.qty).toBe('Carrying 2');
    expect(itemDetail(s, me, 5)).toBeNull();
  });
  it('names every item', () => {
    for (const id of Object.keys(ITEMS)) expect(itemName(id)).not.toBe(id);
  });
});

describe('status icons', () => {
  it('shows a Fed icon with its timer, and drops it when it ends', () => {
    const { s, me } = rig();
    expect(statusIcons(s, me)).toEqual([]);
    addItem(s.entities.comps.inventory[me]!, 'item.hearty_stew', 1);
    const slot = s.entities.comps.inventory[me]!.slots.findIndex(
      (x) => x?.item === 'item.hearty_stew',
    );
    eat(s, me, slot);
    const [fed] = statusIcons(s, me);
    expect(fed).toMatchObject({ id: 'fed', icon: 'icon.hearty_stew', label: 'Fed: Hearty Stew' });
    expect(fed!.ticksLeft).toBeGreaterThan(0);
  });
  it('shows an out of breath icon with a shape of its own', () => {
    const { s, me } = rig();
    s.entities.comps.avatar[me]!.winded = true;
    expect(statusIcons(s, me)).toEqual([
      { id: 'winded', icon: 'ui.status_winded', label: UI_STRINGS.statusWinded, ticksLeft: null },
    ]);
  });
});

describe('clock', () => {
  it('starts in the morning and walks through the four phases', () => {
    expect(clockView(0)).toMatchObject({ phase: 'day', hhmm: '07:00' });
    const m = TIME.ticksPerMinute;
    expect(clockView(30 * m).phase).toBe('dusk');
    expect(clockView(34 * m).phase).toBe('night');
    expect(clockView(44 * m)).toMatchObject({ phase: 'dawn', hhmm: '05:00' });
    expect(clockView(48 * m)).toMatchObject({ phase: 'day', hhmm: '07:00' });
  });
  it('always gives a valid 24 hour time', () => {
    for (let t = 0; t < 48 * TIME.ticksPerMinute * 2; t += 997) {
      const { hhmm } = clockView(t);
      expect(hhmm).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
  });
});

describe('fade when idle', () => {
  const H = UI_BALANCE.hud;
  it('stays opaque while changing, fades after the idle time, and snaps back on change', () => {
    const f = new FadeTracker();
    f.observe('p', 'a', 0);
    expect(f.alpha('p', H.idleMs - 1)).toBe(1);
    expect(f.alpha('p', H.idleMs + H.fadeOutMs)).toBeCloseTo(H.fadedAlpha);
    expect(f.alpha('p', H.idleMs + H.fadeOutMs / 2)).toBeGreaterThan(H.fadedAlpha);
    f.observe('p', 'a', 9000);
    expect(f.alpha('p', 9000 + H.idleMs + H.fadeOutMs)).toBeCloseTo(H.fadedAlpha);
    f.observe('p', 'b', 9500);
    expect(f.alpha('p', 9500)).toBe(1);
  });
  it('wake brings an element back, and reduced motion skips the gradual fade', () => {
    const f = new FadeTracker();
    f.observe('p', 'a', 0);
    f.wake('p', 5000);
    expect(f.alpha('p', 5000 + H.idleMs - 1)).toBe(1);
    const g = new FadeTracker();
    g.observe('p', 'a', 0);
    expect(g.alpha('p', H.idleMs + 10, true)).toBe(H.fadedAlpha);
  });
  it('never fades fully out', () => {
    const f = new FadeTracker();
    f.observe('p', 'a', 0);
    expect(f.alpha('p', 1e9)).toBeGreaterThan(0.2);
  });
});

describe('menu tabs', () => {
  it('has all eight tabs from design/09, each named, and only the slice ones enabled', () => {
    expect([...TAB_IDS]).toEqual([
      'character',
      'skills',
      'bag',
      'map',
      'chronicle',
      'social',
      'routines',
      'system',
    ]);
    for (const t of TAB_IDS) expect(UI_STRINGS.tabs[t]).toBeTruthy();
    expect([...ENABLED_TABS]).toEqual(['character', 'skills', 'bag', 'system']);
  });
  it('has no em dashes in any HUD or Menu string', () => {
    const walk = (v: unknown): string[] =>
      typeof v === 'string'
        ? [v]
        : v && typeof v === 'object'
          ? Object.values(v).flatMap(walk)
          : [];
    for (const t of walk(UI_STRINGS)) expect(t).not.toContain('—');
  });
});
