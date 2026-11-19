import { describe, expect, it } from 'vitest';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { createDemoState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { committed, warnMarkers } from '../../src/render/warning';

describe('warning markers', () => {
  it('a warning draws the territory edge around home, and a chase commit draws a "!"', () => {
    const s = createDemoState(5, 0);
    s.world = { solidAt: () => 0 };
    const f = feetAt(30, 30);
    const me = createAvatar(s, f.x, f.y);
    const m = spawnCreature(s, 'creature.spitbloom', 30 * 16 + 8 + 60, 30 * 16 + 14);
    for (let i = 0; i < 6; i++) stepWorld(s, me, { commands: [] });
    const w = warnMarkers(s);
    expect(w).toHaveLength(1);
    expect(w[0]?.id).toBe(m);
    expect(w[0]?.radius).toBe(80);
    expect(w[0]?.progress).toBeGreaterThan(0);
    expect(committed(s)).toHaveLength(0);
    for (let i = 0; i < 60 && committed(s).length === 0; i++) stepWorld(s, me, { commands: [] });
    expect(committed(s).map((c) => c.id)).toEqual([m]);
    expect(warnMarkers(s)).toHaveLength(0);
  });
});
