import { describe, expect, it } from 'vitest';
import { BOSSES } from '../../src/content/creatures/bosses';
import { CREATURES, SPAWNERS } from '../../src/content/creatures';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { kill } from '../../src/sim/combat/fighter';
import { getComp, query } from '../../src/sim/kernel/entities';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { interactFixture, spawnFixture } from '../../src/sim/systems/fixtures';
import { createSpawner } from '../../src/sim/systems/spawner';

const OPEN = { solidAt: (): number => 0 };

function den(): { s: SimState; me: number; sp: number; log: SimEvent[]; run: (n: number) => void } {
  const s = createDemoState(5, 0);
  s.world = OPEN;
  const f = feetAt(10, 10);
  const me = createAvatar(s, f.x, f.y);
  const log: SimEvent[] = [];
  const run = (n: number): void => {
    for (let i = 0; i < n; i++) {
      stepWorld(s, me, { commands: [] });
      log.push(...s.events.list);
    }
  };
  const sp = createSpawner(s, 'spawner.rw_bramblehide', 40 * 16, 40 * 16);
  run(2);
  return { s, me, sp, log, run };
}
const bossId = (d: ReturnType<typeof den>): number =>
  getComp(d.s.entities, d.sp, 'spawner')!.members[0]!;

describe("Old Bramblehide, the Rootway's boss (M4-21)", () => {
  it('has two phases: a long-tell charge, then boarlets and roots below half Health', () => {
    const b = BOSSES['boss.old_bramblehide']!;
    expect(b.phases).toHaveLength(2);
    expect(b.phases[0]!.pattern.map((p) => p.attack)).toContain('attack.bramble_charge');
    expect(b.phases[1]!.enter).toEqual({ hpPct: 50 });
    expect(b.phases[1]!.summon).toEqual({ creature: 'creature.boarlet', count: 3, radius: 4 });
    expect(b.phases[1]!.hazards?.[0]?.telegraph).toBeGreaterThanOrEqual(30);
    expect(b.dungeon).toBe('dungeon.rootway');
  });

  it('the spawner makes a boss, not a plain creature, and it is back the next day', () => {
    const d = den();
    const id = bossId(d);
    expect(getComp(d.s.entities, id, 'boss')?.id).toBe('boss.old_bramblehide');
    expect(getComp(d.s.entities, id, 'ai')?.spawner).toBe(d.sp);
    expect(SPAWNERS['spawner.rw_bramblehide']?.daily).toBe(true);
  });

  it('calls three boarlets once, when Health first falls to half', () => {
    const d = den();
    const id = bossId(d);
    const pools = getComp(d.s.entities, id, 'pools')!;
    const boarlets = (): number =>
      query(d.s.entities, 'ai').filter(
        (e) => getComp(d.s.entities, e, 'ai')?.creature === 'creature.boarlet',
      ).length;
    expect(boarlets()).toBe(0);
    pools.hp = Math.floor(pools.hpMax * 0.6);
    d.run(3);
    expect(boarlets()).toBe(0);
    pools.hp = Math.floor(pools.hpMax * 0.49);
    d.run(3);
    expect(boarlets()).toBe(3);
    expect(d.log.filter((e) => e.type === 'bossPhase')).toHaveLength(1);
    // Healing and falling again does not call more.
    pools.hp = pools.hpMax;
    d.run(3);
    pools.hp = Math.floor(pools.hpMax * 0.4);
    d.run(3);
    expect(boarlets()).toBe(3);
  });

  it('brings roots up through marked tiles in phase two, telegraphed first', () => {
    const d = den();
    const id = bossId(d);
    const pools = getComp(d.s.entities, id, 'pools')!;
    pools.hp = Math.floor(pools.hpMax * 0.4);
    d.run(3);
    const h = BOSSES['boss.old_bramblehide']!.phases[1]!.hazards![0]!;
    // Stand on a marked tile at the start of a telegraph: nothing yet. Then the root bursts.
    const boss = getComp(d.s.entities, id, 'ai')!.home;
    const [tx, ty] = h.tiles[0]!;
    const me = d.s.entities.comps.pos[d.me]!;
    me.x = boss.x + tx * 16 * 256;
    me.y = boss.y + ty * 16 * 256 - 4 * 256;
    const hp0 = getComp(d.s.entities, d.me, 'pools')!.hp;
    d.run(h.telegraph - 5);
    expect(getComp(d.s.entities, d.me, 'pools')!.hp).toBe(hp0);
    d.run(h.telegraph + h.active);
    expect(getComp(d.s.entities, d.me, 'pools')!.hp).toBeLessThan(hp0);
  });

  it('the den chest stays shut until the boss is down, and opens after', () => {
    const d = den();
    const chest = spawnFixture(d.s, 'fixture.rw_chest_den', 10, 11);
    const j = getComp(d.s.entities, d.me, 'journal')!;
    interactFixture(d.s, d.me);
    expect(getComp(d.s.entities, chest, 'fixture')!.open).toBeFalsy();
    expect(d.s.events.list.some((e) => e.type === 'doorLocked')).toBe(true);
    kill(d.s, bossId(d));
    d.run(3);
    expect(j.flags).toContain('cleared:boss.old_bramblehide');
    interactFixture(d.s, d.me);
    expect(getComp(d.s.entities, chest, 'fixture')!.open).toBe(true);
  });

  it('the new creatures exist, and a Root Grub is a hostile burrower and a Glowcap a territorial shooter', () => {
    expect(CREATURES['creature.root_grub']).toMatchObject({
      archetype: 'burrower',
      temperament: 'hostile',
    });
    expect(CREATURES['creature.glowcap']).toMatchObject({
      archetype: 'shooter',
      temperament: 'territorial',
    });
    expect(CREATURES['creature.boarlet']).toMatchObject({
      archetype: 'chaser',
      temperament: 'hostile',
    });
  });
});
