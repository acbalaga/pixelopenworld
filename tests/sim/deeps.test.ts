import { describe, expect, it } from 'vitest';
import { BOSSES } from '../../src/content/creatures/bosses';
import { DEEPS_BUILT } from '../../src/content/world/dungeons/deeps';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { getComp } from '../../src/sim/kernel/entities';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { interactFixture, spawnFixture } from '../../src/sim/systems/fixtures';
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

describe('Stonecrop Deeps', () => {
  it('passes the dungeon validator', () => {
    expect(validateDungeon(DEEPS_BUILT.def)).toEqual([]);
  });

  it('has six rooms, a locked way to the engine, a drop home and a Mining secret', () => {
    expect(DEEPS_BUILT.def.rooms.map((r) => r.id)).toEqual(['d1', 'd2', 'd3', 'd4', 'd5', 'd6']);
    const e = (a: string, b: string) =>
      DEEPS_BUILT.def.edges.find((x) => x.from === a && x.to === b);
    expect(e('d4', 'd5')).toMatchObject({ kind: 'locked', key: 'item.foreman_key' });
    expect(e('d5', 'd1')?.kind).toBe('oneWay');
    expect(e('d3', 'd6')?.skill).toBe('skill.mining');
  });

  it('holds a timed gate while the avatar stands on the weighing plate, and lets it go after', () => {
    const { s, me, run } = world();
    // The avatar stands at tile (10, 10).
    spawnFixture(s, 'fixture.sd_plate_c', 10, 10);
    const gate = spawnFixture(s, 'fixture.sd_gate_c', 14, 10);
    run(3);
    expect(open(s, gate)).toBe(true);
    // Off the plate, it stays open for its hold time and then shuts.
    s.entities.comps.pos[me] = { x: 60 * 16 * 256, y: 60 * 16 * 256 };
    run(100);
    expect(open(s, gate)).toBe(true);
    run(420);
    expect(open(s, gate)).toBe(false);
  });

  it('wants Mining 20 for the vein switch and Tinkering 15 for the gear box', () => {
    const { s, me } = world();
    const vein = spawnFixture(s, 'fixture.sd_vein_switch', 20, 10);
    const gear = spawnFixture(s, 'fixture.sd_gear_jam', 24, 10);
    const sk = getComp(s.entities, me, 'skills')!;
    flip(s, me, vein);
    flip(s, me, gear);
    expect([open(s, vein), open(s, gear)]).toEqual([false, false]);
    sk.points['skill.mining'] = 20;
    sk.points['skill.tinkering'] = 15;
    flip(s, me, vein);
    flip(s, me, gear);
    expect([open(s, vein), open(s, gear)]).toEqual([true, true]);
  });
});

describe("the Foreman's Engine", () => {
  it('has three phases that add rail, and a jam route', () => {
    const b = BOSSES['boss.foremans_engine']!;
    expect(b.phases).toHaveLength(3);
    expect(b.phases[1]!.hazards).toHaveLength(1);
    expect(b.phases[2]!.hazards).toHaveLength(2);
    expect(b.objective?.steps[0]!.done).toEqual({ fixtureOpen: 'fixture.sd_gear_jam' });
  });

  it('is jammed, with the same reward, when the gear box is thrown', () => {
    const { s, me, run } = world();
    const sp = createSpawner(s, 'spawner.sd_engine', 40 * 16, 40 * 16);
    run(2);
    const id = getComp(s.entities, sp, 'spawner')!.members[0]!;
    const gear = spawnFixture(s, 'fixture.sd_gear_jam', 12, 10);
    getComp(s.entities, me, 'skills')!.points['skill.tinkering'] = 15;
    flip(s, me, gear);
    run(3);
    expect(getComp(s.entities, id, 'boss')?.resolved).toBe('objective');
  });
});
