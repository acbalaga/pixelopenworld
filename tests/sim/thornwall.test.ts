import { describe, expect, it } from 'vitest';
import { BOSSES } from '../../src/content/creatures/bosses';
import { THORNWALL_BUILT } from '../../src/content/world/dungeons/thornwall';
import { BELL_ORDER } from '../../src/content/world/dungeons/west';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { hitFixtures } from '../../src/sim/systems/dungeon';
import { bossSystem } from '../../src/sim/systems/boss';
import { getComp } from '../../src/sim/kernel/entities';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { interactFixture, spawnFixture } from '../../src/sim/systems/fixtures';
import { createSpawner } from '../../src/sim/systems/spawner';
import { elementHitsWorld } from '../../src/sim/elements';
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
const at = (id: number, s: SimState) => {
  const p = getComp(s.entities, id, 'pos')!;
  return { x: p.x / 256, y: p.y / 256 - 8 };
};

describe('Thornwall Pass', () => {
  it('passes the dungeon validator', () => {
    expect(validateDungeon(THORNWALL_BUILT.def)).toEqual([]);
  });

  it('has seven rooms, the upper room reached from outside only, and a guarded way out', () => {
    expect(THORNWALL_BUILT.def.rooms.map((r) => r.id)).toEqual([
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
      't7',
    ]);
    expect(THORNWALL_BUILT.def.rooms.find((r) => r.id === 't7')?.outsideOnly).toBe(true);
    expect(THORNWALL_BUILT.def.edges.some((e) => e.to === 't7' || e.from === 't7')).toBe(false);
    const doors = THORNWALL_BUILT.fixtures().filter((f) => f.kind === 'fixture.tw_out');
    expect(doors[0]?.unlockedBy).toBe('creature.hedge_warden');
  });

  it('cuts or burns the briar, and a Mending hit grows the root aside', () => {
    const { s } = world();
    const a = spawnFixture(s, 'fixture.tw_briar', 12, 10);
    const b = spawnFixture(s, 'fixture.tw_briar', 14, 10);
    const vine = spawnFixture(s, 'fixture.tw_vine', 16, 10);
    elementHitsWorld(s, 'tide', at(a, s));
    expect(open(s, a)).toBe(false);
    hitFixtures(s, 'heavy', at(a, s));
    expect(open(s, a)).toBe(true);
    elementHitsWorld(s, 'ember', at(b, s));
    expect(open(s, b)).toBe(true);
    elementHitsWorld(s, 'mending', at(vine, s));
    expect(open(s, vine)).toBe(true);
  });
});

describe('the Hedge Warden', () => {
  const den = () => {
    const w = world();
    const sp = createSpawner(w.s, 'spawner.tw_warden', 40 * 16, 40 * 16);
    w.run(2);
    return { ...w, id: getComp(w.s.entities, sp, 'spawner')!.members[0]! };
  };

  it('has three phases, the last holding Health until the bloom is burnt or cut', () => {
    const b = BOSSES['boss.hedge_warden']!;
    expect(b.phases).toHaveLength(3);
    expect(b.phases[2]!.gate).toEqual({ holdHpPct: 25, until: 'fixture.tw_bloom' });
    expect(b.dungeon).toBe('dungeon.thornwall');
  });

  it('cannot be hurt below a quarter until the bloom breaks, in the last phase', () => {
    const d = den();
    const pools = getComp(d.s.entities, d.id, 'pools')!;
    pools.hp = Math.floor(pools.hpMax * 0.3);
    d.run(2);
    pools.hp = Math.floor(pools.hpMax * 0.1);
    d.run(2);
    expect(pools.hp).toBeGreaterThanOrEqual(Math.ceil(pools.hpMax * 0.25));
    const bloom = spawnFixture(d.s, 'fixture.tw_bloom', 12, 10);
    hitFixtures(d.s, 'ember', at(bloom, d.s));
    bossSystem(d.s);
    pools.hp = Math.floor(pools.hpMax * 0.1);
    d.run(2);
    expect(pools.hp).toBeLessThan(Math.ceil(pools.hpMax * 0.25));
  });

  it('sleeps, with the same reward, when the bells are rung in order and the root is sung', () => {
    const d = den();
    const bells = [1, 2, 3].map((n) => spawnFixture(d.s, `fixture.tw_bell_${n}`, 10 + n * 3, 12));
    const root = spawnFixture(d.s, 'fixture.tw_root', 30, 12);
    // Out of turn first: nothing stays rung.
    flip(d.s, d.me, bells[BELL_ORDER[2]! - 1]!);
    expect(bells.some((b) => open(d.s, b))).toBe(false);
    for (const n of BELL_ORDER) flip(d.s, d.me, bells[n - 1]!);
    // Without the song, not yet.
    flip(d.s, d.me, root);
    d.run(2);
    expect(getComp(d.s.entities, d.id, 'boss')?.resolved).toBeUndefined();
    getComp(d.s.entities, d.me, 'skills')!.points['skill.performance'] = 30;
    flip(d.s, d.me, root);
    d.run(3);
    expect(getComp(d.s.entities, d.id, 'boss')?.resolved).toBe('objective');
  });
});
