import { describe, expect, it } from 'vitest';
import { createLoop } from '../../src/platform/loop';

function simulate(hz: number, seconds: number) {
  let ticks = 0;
  const alphas: number[] = [];
  const loop = createLoop({ tick: () => ticks++, render: (a) => alphas.push(a) });
  const dt = 1000 / hz;
  const frames = Math.round(hz * seconds);
  for (let i = 0; i <= frames; i++) loop.frame(i * dt);
  return { ticks, alphas };
}

describe('frame loop', () => {
  it.each([60, 120, 144, 30])('advances exactly 30 ticks per second at %i Hz', (hz) => {
    const { ticks, alphas } = simulate(hz, 10);
    expect(ticks).toBe(300);
    expect(Math.max(...alphas)).toBeLessThan(1);
    expect(Math.min(...alphas)).toBeGreaterThanOrEqual(0);
  });

  it('caps a 2 second stall at 5 ticks and reports the dropped time', () => {
    let ticks = 0;
    let dropped = 0;
    const loop = createLoop({
      tick: () => ticks++,
      render: () => {},
      onGap: (ms) => (dropped = ms),
    });
    loop.frame(0);
    expect(loop.frame(2000)).toBe(5);
    expect(ticks).toBe(5);
    expect(dropped).toBeGreaterThan(1700);
    expect(loop.frame(2017)).toBe(0);
  });

  it('discards time spent paused', () => {
    let ticks = 0;
    const loop = createLoop({ tick: () => ticks++, render: () => {} });
    loop.frame(0);
    loop.pause();
    expect(loop.frame(5000)).toBe(0);
    loop.resume();
    loop.frame(60_000);
    expect(loop.frame(60_034)).toBe(1);
    expect(ticks).toBe(1);
  });
});
