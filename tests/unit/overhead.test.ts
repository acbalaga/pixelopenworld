import { describe, expect, it } from 'vitest';
import { OverheadFader } from '../../src/render/chunks';

describe('overhead fade', () => {
  it('fades down while an entity is beneath, back up when it leaves, and forgets finished fades', () => {
    const f = new OverheadFader();
    let a = 1;
    for (let i = 0; i < 20; i++) a = f.step(7, true, 16);
    expect(a).toBeLessThan(1);
    expect(a).toBeGreaterThanOrEqual(0.4);
    for (let i = 0; i < 100; i++) a = f.step(7, true, 16);
    expect(a).toBeCloseTo(0.4);
    for (let i = 0; i < 100; i++) a = f.step(7, false, 16);
    expect(a).toBe(1);
    expect(f.step(8, false, 16)).toBe(1);
  });
});
