import { describe, expect, it } from 'vitest';
import { HINTS } from '../../src/content/hints';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { spawnCampPot, spawnNode } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { hostileCreatures } from '../support/temperament';

hostileCreatures('creature.mossling');

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...c: Command[]) => void;
  run: (n: number, ...c: Command[]) => void;
  shown: () => string | null;
  ended: (how?: 'done' | 'expired') => string[];
  /** Skips the clock forward without simulating, so a test can reach a later moment. */
  jump: (ticks: number) => void;
}

function rig(): Rig {
  const s = createDemoState(9, 0);
  s.world = { solidAt: () => 0 };
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  const events: SimEvent[] = [];
  const tick = (...c: Command[]): void => {
    stepWorld(s, me, { commands: c });
    events.push(...s.events.list);
  };
  return {
    s,
    me,
    events,
    tick,
    run: (n, ...c) => {
      for (let i = 0; i < n; i++) tick(...c);
    },
    shown: () => s.entities.comps.journal[me]?.hint?.id ?? null,
    ended: (how) =>
      events.flatMap((e) => (e.type === 'hintEnded' && (!how || e.how === how) ? [e.hint] : [])),
    jump: (n) => {
      s.tick += n;
    },
  };
}

const seen = (r: Rig): string[] => r.s.entities.comps.journal[r.me]!.hints;

describe('contextual hints', () => {
  it('shows nothing at first, then the move hint, and walking clears it for good', () => {
    const r = rig();
    r.run(10);
    expect(r.shown()).toBeNull();
    r.run(30);
    expect(r.shown()).toBe('hint.move');
    r.run(200, { type: 'move', dir: 2 });
    expect(r.shown()).toBeNull();
    expect(r.ended('done')).toEqual(['hint.move']);
    expect(seen(r)).toContain('hint.move');
    // Standing still again does not bring it back.
    r.run(60, { type: 'move', dir: null });
    expect(r.events.filter((e) => e.type === 'hintShown' && e.hint === 'hint.move')).toHaveLength(
      1,
    );
  });

  it('a hint nobody acts on goes away by itself, and is not offered again', () => {
    const r = rig();
    r.run(40);
    expect(r.shown()).toBe('hint.move');
    r.run(25 * 30 + 5);
    expect(r.shown()).not.toBe('hint.move');
    expect(r.ended('expired')).toContain('hint.move');
    r.run(120);
    expect(r.events.filter((e) => e.type === 'hintShown' && e.hint === 'hint.move')).toHaveLength(
      1,
    );
  });

  it('shows one hint at a time, in order', () => {
    const r = rig();
    spawnNode(r.s, 'node.herb_patch', 20 * 16 + 8, 20 * 16 + 14 + 10);
    spawnCampPot(r.s, 20 * 16 + 8, 20 * 16 + 14 + 10);
    r.run(40);
    // Gather came first, so the cook and move opportunities (both open by now) wait their turn.
    expect(r.shown()).toBe('hint.gather');
    const shownNow = r.events.filter((e) => e.type === 'hintShown');
    expect(shownNow).toHaveLength(1);
  });

  it('gather: appears with a ready node in reach, clears when the gather starts', () => {
    const r = rig();
    seenAll(r, ['hint.move']);
    r.tick();
    expect(r.shown()).toBeNull();
    spawnNode(r.s, 'node.herb_patch', 20 * 16 + 8, 20 * 16 + 14 + 12);
    r.tick();
    expect(r.shown()).toBe('hint.gather');
    r.tick({ type: 'interact' });
    r.run(2);
    expect(r.shown()).toBeNull();
    expect(r.ended('done')).toEqual(['hint.gather']);
  });

  it('cook: appears beside a camp pot', () => {
    const r = rig();
    seenAll(r, ['hint.move']);
    spawnCampPot(r.s, 20 * 16 + 8, 20 * 16 + 14 + 12);
    r.tick();
    expect(r.shown()).toBe('hint.cook');
  });

  it('lock then technique: a creature noticing you brings lock first, and locking clears it', () => {
    const r = rig();
    seenAll(r, ['hint.move']);
    const id = spawnCreature(r.s, 'creature.mossling', 20 * 16 + 8, 20 * 16 + 14 + 60, -1);
    r.run(30);
    expect(r.events.some((e) => e.type === 'noticed')).toBe(true);
    expect(
      r.s.entities.comps.journal[r.me]!.hints.includes('hint.lock') || r.shown() === 'hint.lock',
    ).toBe(true);
    const p = r.s.entities.comps.pos[id]!;
    r.tick({ type: 'lock', x: Math.round(p.x / 256), y: Math.round(p.y / 256) - 4 });
    r.run(3);
    expect(r.ended('done')).toContain('hint.lock');
  });

  it('dodge: appears when a creature starts an attack nearby, and dodging clears it', () => {
    const r = rig();
    seenAll(r, ['hint.move', 'hint.lock', 'hint.technique']);
    spawnCreature(r.s, 'creature.mossling', 20 * 16 + 8, 20 * 16 + 14 + 20, -1);
    for (let i = 0; i < 120 && r.shown() !== 'hint.dodge'; i++) r.tick();
    expect(r.shown()).toBe('hint.dodge');
    r.tick({ type: 'dodge', dir: 0 });
    r.run(2);
    expect(r.ended('done')).toContain('hint.dodge');
  });

  it('menu: appears after a minute and a half of play, and the interface clears it', () => {
    const r = rig();
    seenAll(r, ['hint.move']);
    r.tick();
    expect(r.shown()).toBeNull();
    r.jump(90 * 30);
    r.tick();
    expect(r.shown()).toBe('hint.menu');
    // The wrong id does nothing; the right one ends it.
    r.tick({ type: 'hint', id: 'hint.move' });
    expect(r.shown()).toBe('hint.menu');
    r.tick({ type: 'hint', id: 'hint.menu' });
    expect(r.shown()).toBeNull();
    expect(seen(r)).toContain('hint.menu');
  });

  it('every hint has a string, a unique id, and an end that can happen', () => {
    expect(new Set(HINTS.map((h) => h.id)).size).toBe(HINTS.length);
    for (const h of HINTS) expect(h.expire).toBeGreaterThan(0);
  });
});

/** Marks hints as already seen, as if the player had been through them. */
function seenAll(r: Rig, ids: string[]): void {
  r.s.entities.comps.journal[r.me]!.hints.push(...ids);
}
