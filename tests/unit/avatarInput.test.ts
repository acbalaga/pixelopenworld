import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/platform/input/layout';
import { InputSampler, toCommands } from '../../src/platform/input/sampler';
import { TouchController } from '../../src/platform/input/touch';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { createDemoState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';

describe('touch to motion', () => {
  it('a thumb drag moves the avatar by the next sim tick (limit: 2 ticks)', () => {
    const touch = new TouchController(computeLayout(360, 800, false));
    const sampler = new InputSampler(touch);
    const s = createDemoState(1, 0);
    s.world = { solidAt: () => 0 };
    const f = feetAt(5, 5);
    const id = createAvatar(s, f.x, f.y);

    // Pointer lands and slides right between tick 0 and tick 1.
    touch.down(1, 100, 600, 0);
    touch.move(1, 160, 600);
    let prevDir: number | null = null;
    let prevFull = false;
    let movedAtTick = -1;
    for (let tickNo = 1; tickNo <= 2; tickNo++) {
      const rec = sampler.sample(tickNo * 33);
      stepWorld(s, id, { commands: toCommands(rec, prevDir, prevFull) });
      prevDir = rec.moveDir;
      prevFull = rec.full;
      if (movedAtTick < 0 && (s.entities.comps.pos[id]?.x ?? 0) > f.x) movedAtTick = tickNo;
    }
    expect(movedAtTick).toBe(1);
  });
});

describe('toCommands full extent', () => {
  it('sends full only when the stick is at full extent, and re-sends when that changes', () => {
    const rec = (mag: number) => ({
      move: { x: mag, y: 0 },
      moveDir: 2 as const,
      full: mag >= 0.95,
      technique: [false, false, false, false] as [boolean, boolean, boolean, boolean],
      techniqueHeld: [false, false, false, false] as [boolean, boolean, boolean, boolean],
      dodge: null,
      context: false,
      menu: false,
      bag: false,
      targetTap: null,
      longPress: null,
    });
    expect(toCommands(rec(1), null)).toEqual([{ type: 'move', dir: 2, full: true }]);
    expect(toCommands(rec(0.5), 2, true)).toEqual([{ type: 'move', dir: 2 }]);
    expect(toCommands(rec(1), 2, true)).toEqual([]);
  });
});
