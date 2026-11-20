import { describe, expect, it } from 'vitest';
import { SPAWNS } from '../../src/content/balance/world';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { rosterSpawnerKinds, zoneSpawnerKind } from '../../src/content/creatures/zoneSpawners';
import { ROSTERS } from '../../src/content/world/rosters';
import { getComp } from '../../src/sim/kernel/entities';
import { createDemoState } from '../../src/sim/state';
import { createSpawner, spawnerSystem } from '../../src/sim/systems/spawner';
import { dayPhase } from '../../src/sim/time';

/** The first world tick at or after `from` that falls in one of the phases. */
function tickIn(phases: readonly string[], from = 0): number {
  let t = from;
  while (!phases.includes(dayPhase(t))) t += 10;
  return t;
}

describe('zone spawners (M4-05)', () => {
  it('every Dawnmeadow roster creature has a spawner kind at its step and hours', () => {
    for (const r of Object.values(ROSTERS).filter((x) => x.id.startsWith('roster.dm_'))) {
      expect(r.step, r.id).toBeDefined();
      for (const k of rosterSpawnerKinds(r.id)) {
        const def = SPAWNERS[k];
        expect(def, k).toBeDefined();
        expect(CREATURES[def!.creature], k).toBeDefined();
        expect(def!.step).toBe(r.step);
      }
    }
    expect(SPAWNERS[zoneSpawnerKind('creature.moorhound', 'c', 'night')]).toMatchObject({
      when: 'night',
      cap: SPAWNS.packCap,
    });
  });

  it('scales Health and Power by the step', () => {
    const s = createDemoState(1, 0);
    s.worldTick = tickIn(['day']);
    const sp = createSpawner(s, zoneSpawnerKind('creature.bramble_boar', 'b', 'day'), 300, 300);
    spawnerSystem(s);
    const [m] = getComp(s.entities, sp, 'spawner')!.members;
    const base = CREATURES['creature.bramble_boar']!;
    const pools = getComp(s.entities, m!, 'pools')!;
    expect(pools.hpMax).toBe(Math.round((base.hp * SPAWNS.steps.b.hpPct) / 100));
    expect(pools.hp).toBe(pools.hpMax);
    expect(getComp(s.entities, m!, 'combatant')!.power).toBe(
      Math.round((base.power * SPAWNS.steps.b.powerPct) / 100),
    );
  });

  it('a day spawner fills by day, its creatures go to ground at dusk, and it fills again at dawn', () => {
    const s = createDemoState(1, 0);
    const kind = zoneSpawnerKind('creature.meadow_hare', 'a', 'day');
    s.worldTick = tickIn(['day']);
    const sp = createSpawner(s, kind, 300, 300);
    spawnerSystem(s);
    const sc = getComp(s.entities, sp, 'spawner')!;
    expect(sc.members).toHaveLength(1);
    const first = sc.members[0]!;
    s.worldTick = tickIn(['dusk'], s.worldTick);
    spawnerSystem(s);
    expect(sc.members).toHaveLength(0);
    expect(s.entities.alive[first]).not.toBe(true);
    s.worldTick = tickIn(['night'], s.worldTick);
    for (let i = 0; i < 5; i++) spawnerSystem(s);
    expect(sc.members).toHaveLength(0);
    s.worldTick = tickIn(['dawn'], s.worldTick);
    spawnerSystem(s);
    expect(sc.members).toHaveLength(1);
  });

  it('a creature in a fight stays out past its hours', () => {
    const s = createDemoState(1, 0);
    s.worldTick = tickIn(['day']);
    const sp = createSpawner(s, zoneSpawnerKind('creature.fox', 'a', 'day'), 300, 300);
    spawnerSystem(s);
    const sc = getComp(s.entities, sp, 'spawner')!;
    const m = sc.members[0]!;
    getComp(s.entities, m, 'ai')!.target = 0;
    s.worldTick = tickIn(['night'], s.worldTick);
    spawnerSystem(s);
    expect(sc.members).toEqual([m]);
  });
});
