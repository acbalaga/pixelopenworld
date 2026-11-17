import { describe, expect, it } from 'vitest';
import { createDemoState, hashState, serializeState, deserializeState } from '../../src/sim/state';
import { step } from '../../src/sim/step';

describe('worldTick', () => {
  it('defaults to the sim tick, so a sim with no platform still has a clock', () => {
    const s = createDemoState(1, 0);
    step(s, { commands: [] });
    expect(s.worldTick).toBe(s.tick);
  });

  it('takes the platform value from tick input', () => {
    const s = createDemoState(1, 0);
    step(s, { commands: [], worldTick: 123_456 });
    expect(s.worldTick).toBe(123_456);
    expect(s.tick).toBe(1);
  });

  it('is not saved and does not change the state hash', () => {
    const a = createDemoState(1, 0);
    const b = createDemoState(1, 0);
    step(a, { commands: [], worldTick: 5 });
    step(b, { commands: [], worldTick: 99_999 });
    expect(serializeState(a)).toBe(serializeState(b));
    expect(hashState(a)).toBe(hashState(b));
    expect(serializeState(a)).not.toContain('worldTick');
    expect(deserializeState(serializeState(a)).worldTick).toBe(a.tick);
  });
});
