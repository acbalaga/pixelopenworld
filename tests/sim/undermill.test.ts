import { describe, expect, it } from 'vitest';
import { BOSSES } from '../../src/content/creatures/bosses';
import { UNDERMILL_BUILT } from '../../src/content/world/dungeons/undermill';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { getComp, query } from '../../src/sim/kernel/entities';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { elementHitsWorld } from '../../src/sim/elements';
import { interactFixture, spawnFixture } from '../../src/sim/systems/fixtures';
import { dungeonSystem } from '../../src/sim/systems/dungeon';
import { bossSystem } from '../../src/sim/systems/boss';
import { createSpawner } from '../../src/sim/systems/spawner';
import { validateDungeon } from '../../tools/bake-world/validateDungeon';

const OPEN = { solidAt: (): number => 0 };
function world(): { s: SimState; me: number; run: (n: number) => void } {
  const s = createDemoState(5, 0);
  s.world = OPEN;
  const f = feetAt(10, 10);
  const me = createAvatar(s, f.x, f.y);
  return {
    s,
    me,
    run: (n) => void Array.from({ length: n }, () => stepWorld(s, me, { commands: [] })),
  };
}
const open = (s: SimState, id: number): boolean => getComp(s.entities, id, 'fixture')!.open;
const flip = (s: SimState, who: number, id: number): void => {
  const p = getComp(s.entities, id, 'pos')!;
  const tx = Math.floor(p.x / 256 / 16);
  const ty = Math.round(p.y / 256 / 16) - 1;
  s.entities.comps.pos[who] = { x: (tx * 16 + 8) * 256, y: ((ty + 1) * 16 + 8) * 256 };
  const a = getComp(s.entities, who, 'avatar');
  if (a) a.facing = 0;
  interactFixture(s, who);
};

describe('the Undermill', () => {
  it('passes the dungeon validator', () => {
    expect(validateDungeon(UNDERMILL_BUILT.def)).toEqual([]);
  });

  it('has the six rooms, a locked way to the channel, a drop home and a tide-only secret', () => {
    expect(UNDERMILL_BUILT.def.rooms.map((r) => r.id)).toEqual([
      'u1',
      'u2',
      'u3',
      'u4',
      'u5',
      'u6',
    ]);
    const e = (a: string, b: string) =>
      UNDERMILL_BUILT.def.edges.find((x) => x.from === a && x.to === b);
    expect(e('u4', 'u5')).toMatchObject({ kind: 'locked', key: 'item.mill_key' });
    expect(e('u5', 'u1')?.kind).toBe('oneWay');
    expect(e('u3', 'u6')?.skill).toBe('skill.tide');
    expect(UNDERMILL_BUILT.def.estMinutes).toBeGreaterThanOrEqual(25);
  });
});

describe('water levels', () => {
  it('a low gate opens when its sluice is thrown, and the sunken alcove closes', () => {
    const { s, me, run } = world();
    const sluice = spawnFixture(s, 'fixture.um_sluice_a', 12, 10);
    const low = spawnFixture(s, 'fixture.um_gate_low_a', 20, 10);
    const high = spawnFixture(s, 'fixture.um_gate_high_a', 22, 10);
    run(2);
    expect([open(s, low), open(s, high)]).toEqual([false, true]);
    flip(s, me, sluice);
    run(2);
    expect(open(s, sluice)).toBe(true);
    expect([open(s, low), open(s, high)]).toEqual([true, false]);
    // Thrown back, the water rises again.
    flip(s, me, sluice);
    run(2);
    expect([open(s, low), open(s, high)]).toEqual([false, true]);
  });

  it('a Tide hit fills the basin, which holds the high gate open at low water', () => {
    const { s, me, run } = world();
    const sluice = spawnFixture(s, 'fixture.um_sluice_a', 12, 10);
    const high = spawnFixture(s, 'fixture.um_gate_high_a', 22, 10);
    const basin = spawnFixture(s, 'fixture.um_basin', 16, 10);
    flip(s, me, sluice);
    run(2);
    expect(open(s, high)).toBe(false);
    const bp = getComp(s.entities, basin, 'pos')!;
    elementHitsWorld(s, 'tide', { x: bp.x / 256, y: bp.y / 256 - 8 });
    run(2);
    expect(open(s, basin)).toBe(true);
    expect(open(s, high)).toBe(true);
  });

  it('a Tide hit bursts the seeping wall, and nothing else does', () => {
    const { s } = world();
    const wall = spawnFixture(s, 'fixture.um_seep_wall', 12, 10);
    const p = getComp(s.entities, wall, 'pos')!;
    const at = { x: p.x / 256, y: p.y / 256 - 8 };
    elementHitsWorld(s, 'ember', at);
    elementHitsWorld(s, 'stone', at);
    expect(open(s, wall)).toBe(false);
    elementHitsWorld(s, 'tide', at);
    expect(open(s, wall)).toBe(true);
    void dungeonSystem;
  });
});

describe('the Millrace Eel', () => {
  const eelDen = () => {
    const w = world();
    const sp = createSpawner(w.s, 'spawner.um_eel', 40 * 16, 40 * 16);
    w.run(2);
    const id = getComp(w.s.entities, sp, 'spawner')!.members[0]!;
    return { ...w, id };
  };

  it('is a boss of the Undermill with a gate until the low-water sluice, and a kept-out route', () => {
    const b = BOSSES['boss.millrace_eel']!;
    expect(b.dungeon).toBe('dungeon.undermill');
    expect(b.phases[0]!.gate).toEqual({ holdHpPct: 60, until: 'fixture.um_sluice_c' });
    expect(b.objective?.steps.map((x) => x.id)).toEqual(['low', 'weir']);
  });

  it('cannot be hurt below 60% until the low-water sluice is thrown', () => {
    const d = eelDen();
    const pools = getComp(d.s.entities, d.id, 'pools')!;
    pools.hp = Math.floor(pools.hpMax * 0.3);
    d.run(2);
    expect(pools.hp).toBeGreaterThanOrEqual(Math.ceil(pools.hpMax * 0.6));
    const c = spawnFixture(d.s, 'fixture.um_sluice_c', 12, 10);
    flip(d.s, d.me, c);
    // The boss system reads the switch event the tick it happens.
    bossSystem(d.s);
    pools.hp = Math.floor(pools.hpMax * 0.3);
    d.run(2);
    expect(pools.hp).toBeLessThan(Math.ceil(pools.hpMax * 0.6));
  });

  it('is kept out, with the same reward, when both sluices are thrown in order', () => {
    const d = eelDen();
    const c = spawnFixture(d.s, 'fixture.um_sluice_c', 12, 10);
    const e = spawnFixture(d.s, 'fixture.um_sluice_d', 14, 10);
    flip(d.s, d.me, c);
    d.run(3);
    flip(d.s, d.me, e);
    d.run(3);
    expect(getComp(d.s.entities, d.id, 'boss')?.resolved).toBe('objective');
    expect(query(d.s.entities, 'boss').length).toBeGreaterThan(0);
  });
});
