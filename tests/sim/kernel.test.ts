import { describe, expect, it } from 'vitest';
import { createDemoState, deserializeState, hashState, serializeState } from '../../src/sim/state';
import { step } from '../../src/sim/step';
import { chance, createStreams, int, next, pick, weighted } from '../../src/sim/kernel/rng';
import {
  count,
  createStore,
  destroy,
  getComp,
  query,
  setComp,
  spawn,
} from '../../src/sim/kernel/entities';
import { validateCommand } from '../../src/sim/kernel/commands';

const script = (t: number): unknown[] =>
  t % 97 === 0
    ? [{ type: 'move', dir: (t / 97) % 8 }]
    : t % 211 === 0
      ? [{ type: 'move', dir: null }]
      : [];

function run(seed: number, from: number, to: number, state = createDemoState(seed, 50)) {
  for (let t = from; t < to; t++) step(state, { commands: script(t) });
  return state;
}

describe('determinism', () => {
  it('same seed and commands give the same hash over 10,000 ticks; another seed differs', () => {
    expect(hashState(run(1, 0, 10_000))).toBe(hashState(run(1, 0, 10_000)));
    expect(hashState(run(2, 0, 10_000))).not.toBe(hashState(run(1, 0, 10_000)));
  });

  it('serialize at tick 5,000, deserialize, continue: same final hash', () => {
    const straight = hashState(run(7, 0, 10_000));
    const half = run(7, 0, 5_000);
    const restored = deserializeState(serializeState(half));
    expect(hashState(restored)).toBe(hashState(half));
    expect(hashState(run(7, 5_000, 10_000, restored))).toBe(straight);
  });

  it('events are cleared each tick and do not affect the hash', () => {
    const s = createDemoState(3, 20);
    for (let i = 0; i < 2000; i++) step(s, { commands: [] });
    const h = hashState(s);
    s.events.list.push({ type: 'bounce', id: 0, axis: 'x' });
    expect(hashState(s)).toBe(h);
  });
});

describe('rng', () => {
  it('streams are independent', () => {
    const a = createStreams(42);
    const b = createStreams(42);
    for (let i = 0; i < 1000; i++) next(a.combat);
    const seqA = Array.from({ length: 20 }, () => next(a.loot));
    const seqB = Array.from({ length: 20 }, () => next(b.loot));
    expect(seqA).toEqual(seqB);
    expect(next(createStreams(42).combat)).not.toBe(next(createStreams(42).loot));
  });

  it('helpers stay in range and are reproducible', () => {
    const r = createStreams(9).misc;
    for (let i = 0; i < 2000; i++) {
      const n = int(r, -3, 4);
      expect(n).toBeGreaterThanOrEqual(-3);
      expect(n).toBeLessThanOrEqual(4);
      const f = next(r);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
    expect(chance(r, 0)).toBe(false);
    expect(chance(r, 1)).toBe(true);
    expect(['a', 'b', 'c']).toContain(pick(r, ['a', 'b', 'c']));
    const tally = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++)
      tally[
        weighted(r, [
          ['a', 1],
          ['b', 3],
        ] as const)
      ]++;
    expect(tally.b / tally.a).toBeGreaterThan(2.4);
    expect(tally.b / tally.a).toBeLessThan(3.8);
    expect(() => pick(r, [])).toThrow();
    expect(() => weighted(r, [['a', 0]])).toThrow();
  });
});

describe('entities', () => {
  it('reuses the lowest free id and queries ascending', () => {
    const s = createStore<{ a: number; b: number }>(['a', 'b']);
    const ids = [spawn(s), spawn(s), spawn(s), spawn(s)];
    ids.forEach((id) => setComp(s, id, 'a', id));
    setComp(s, 2, 'b', 1);
    destroy(s, 3);
    destroy(s, 1);
    expect(getComp(s, 1, 'a')).toBeUndefined();
    expect(spawn(s)).toBe(1);
    expect(spawn(s)).toBe(3);
    expect(spawn(s)).toBe(4);
    expect(query(s, 'a')).toEqual([0, 2]);
    expect(query(s, 'a', 'b')).toEqual([2]);
    expect(count(s)).toBe(5);
    expect(() => setComp(s, 99, 'a', 1)).toThrow();
  });
});

describe('commands', () => {
  it('rejects bad input without throwing', () => {
    expect(validateCommand({ type: 'move', dir: 9 }).ok).toBe(false);
    expect(validateCommand({ type: 'fly' }).ok).toBe(false);
    expect(validateCommand(null).ok).toBe(false);
    const s = createDemoState(1, 1);
    expect(
      step(s, {
        commands: [
          { type: 'move', dir: 99 },
          { type: 'move', dir: 2 },
        ],
      }),
    ).toBe(1);
    expect(s.entities.comps.vel[0]).toEqual({ x: 128, y: 0 });
  });
});
