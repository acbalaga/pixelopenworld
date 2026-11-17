import { describe, expect, it } from 'vitest';
import { SPAWNERS } from '../../src/content/creatures';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { destroy } from '../../src/sim/kernel/entities';
import { createDemoState, deserializeState, serializeState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { createSpawner } from '../../src/sim/systems/spawner';

const OPEN = { solidAt: (): number => 0 };
const TPS = 30;

describe('miniboss rematch', () => {
  it('comes back within a minute of play, also after a save and load', () => {
    const def = SPAWNERS['spawner.old_bramblehide']!;
    expect(def.respawn).toBeLessThanOrEqual(60 * TPS);

    let s = createDemoState(5, 0);
    s.world = OPEN;
    const f = feetAt(10, 10);
    const me = createAvatar(s, f.x, f.y);
    const sp = createSpawner(s, 'spawner.old_bramblehide', 600, 600);
    const run = (n: number): void => {
      for (let i = 0; i < n; i++) stepWorld(s, me, { commands: [] });
    };
    const members = (): number => s.entities.comps.spawner[sp]!.members.length;

    run(5);
    expect(members()).toBe(1);
    destroy(s.entities, s.entities.comps.spawner[sp]!.members[0]!);
    run(Math.floor(def.respawn / 2));
    expect(members()).toBe(0);

    // Logging out and back in keeps the timer.
    s = deserializeState(serializeState(s), OPEN);
    run(Math.ceil(def.respawn / 2) + 2);
    expect(members()).toBe(1);
  });
});
