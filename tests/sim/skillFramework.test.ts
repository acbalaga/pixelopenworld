import { describe, expect, it } from 'vitest';
import { COMBAT as C } from '../../src/content/balance/combat';
import { TIME } from '../../src/content/balance/time';
import { ITEMS } from '../../src/content/items';
import { PENDING_SKILLS, SKILLS, type SkillFamily } from '../../src/content/skills';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnEnemy } from '../../src/sim/combat/enemy';
import type { SimEvent } from '../../src/sim/kernel/events';
import { addXp, pointsOf, xpToNext } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { skillsSystem } from '../../src/sim/systems/skills';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 60 || ty > 60 ? 1 : 0),
};

function world(): { s: SimState; me: number } {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  return { s, me: createAvatar(s, f.x, f.y) };
}

function feed(s: SimState, ...evs: SimEvent[]): void {
  s.events.list.length = 0;
  s.events.list.push(...evs);
  skillsSystem(s);
}

/** Everything a skill has earned: XP spent on its points plus what is waiting. */
function earned(s: SimState, me: number, skill: string): number {
  let n = s.entities.comps.skills[me]!.xp[skill] ?? 0;
  for (let p = 0; p < pointsOf(s, me, skill); p++) n += xpToNext(p);
  return n;
}

const FAMILY_COUNTS: Record<SkillFamily, number> = {
  arms: 7,
  magic: 6,
  gathering: 6,
  crafting: 7,
  social: 5,
  exploration: 5,
};

describe('the 36 skills', () => {
  it('are exactly 36 in six families with the counts of design/03, ids unique and snake case', () => {
    const defs = Object.values(SKILLS);
    expect(defs).toHaveLength(36);
    expect(new Set(defs.map((d) => d.id)).size).toBe(36);
    const counts: Record<string, number> = {};
    for (const d of defs) {
      expect(d.id, d.id).toMatch(/^skill\.[a-z]+(_[a-z]+)*$/);
      expect(Object.keys(SKILLS).includes(d.id)).toBe(true);
      counts[d.family] = (counts[d.family] ?? 0) + 1;
    }
    expect(counts).toEqual(FAMILY_COUNTS);
  });

  it('are declared in design/03 family order, then table order', () => {
    const order = Object.values(SKILLS).map((d) => d.family);
    const fams = [...new Set(order)];
    expect(fams).toEqual(['arms', 'magic', 'gathering', 'crafting', 'social', 'exploration']);
    expect(order).toEqual([...order].sort((a, b) => fams.indexOf(a) - fams.indexOf(b)));
    expect(Object.keys(SKILLS).slice(0, 3)).toEqual([
      'skill.blades',
      'skill.heavy_arms',
      'skill.polearms',
    ]);
  });

  it('list 23 pending skills: the six late ones and the ones whose M3 ticket has not merged', () => {
    expect(PENDING_SKILLS).toHaveLength(23);
    for (const id of PENDING_SKILLS) expect(SKILLS[id], id).toBeDefined();
    for (const late of ['farming', 'husbandry', 'leadership', 'taming', 'cartography', 'delving'])
      expect(PENDING_SKILLS).toContain(`skill.${late}`);
  });
});

describe('every skill that is not pending earns XP', () => {
  /** One scripted action for each skill with a system. A skill with none fails the test below. */
  const SCRIPTS: Record<string, (s: SimState, me: number) => void> = {
    'skill.blades': (s, me) => hit(s, me, 'blades'),
    'skill.polearms': (s, me) => hit(s, me, 'polearms'),
    'skill.heavy_arms': (s, me) => hit(s, me, 'heavy'),
    'skill.archery': (s, me) => hit(s, me, 'archery'),
    'skill.unarmed': (s, me) => hit(s, me, 'unarmed'),
    'skill.shieldcraft': (s, me) => {
      const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
      feed(s, { type: 'blocked', who: me, src: foe, amount: 2 });
    },
    'skill.ember': (s, me) => hit(s, me, 'ember'),
    'skill.evasion': (s, me) => {
      const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
      feed(s, { type: 'dodged', src: foe, dst: me });
    },
    'skill.foraging': (s, me) =>
      feed(s, { type: 'gathered', id: me, tag: 'foraging', item: 'item.sunwort', tier: 1 }),
    'skill.cooking': (s, me) =>
      feed(s, { type: 'cooked', id: me, tag: 'cooking', recipe: 'recipe.herb_tea', tier: 1 }),
    'skill.survival': (s, me) => feed(s, { type: 'eaten', id: me, item: 'item.berry_red' }),
    'skill.athletics': (s, me) => {
      const p = s.entities.comps.pos[me]!;
      const a = s.entities.comps.avatar[me]!;
      feed(s);
      a.sprinting = true;
      for (let i = 0; i < 40; i++) {
        p.x += 4 * 256;
        feed(s);
      }
    },
    'skill.deciphering': (s, me) => {
      const tablet = spawnFixture(s, 'fixture.tablet', 22, 20);
      feed(s, { type: 'tabletRead', id: tablet, who: me });
    },
  };

  function hit(s: SimState, me: number, tag: string): void {
    const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
    feed(s, {
      type: 'damageDealt',
      src: me,
      dst: foe,
      amount: 5,
      crit: false,
      bonus: false,
      heavy: false,
      tag,
    });
  }

  const active = Object.keys(SKILLS).filter((id) => !PENDING_SKILLS.includes(id));

  it('has 13 skills with a system after M3-04', () => {
    expect(active).toHaveLength(13);
  });

  it.each(active)('%s is paid by its scripted action', (id) => {
    const script = SCRIPTS[id];
    expect(
      script,
      `${id} has no scripted action: add one, or list it in PENDING_SKILLS`,
    ).toBeDefined();
    const { s, me } = world();
    script!(s, me);
    expect(earned(s, me, id)).toBeGreaterThan(0);
  });

  it('pending skills earn nothing from any script', () => {
    const { s, me } = world();
    for (const id of active) SCRIPTS[id]!(s, me);
    for (const id of PENDING_SKILLS) expect(earned(s, me, id), id).toBe(0);
  });
});

describe('pool maxima follow skill points', () => {
  const pools = (s: SimState, me: number) => s.entities.comps.pools[me]!;
  const one: Record<SkillFamily, [string, 'hpMax' | 'staMax' | 'focMax', number]> = {
    arms: ['skill.shieldcraft', 'hpMax', C.pools.hpMax + 10],
    magic: ['skill.tide', 'focMax', C.pools.focMax + 50],
    gathering: ['skill.mining', 'staMax', C.pools.staMax + 50],
    crafting: ['skill.alchemy', 'focMax', C.pools.focMax + 50],
    social: ['skill.stealth', 'focMax', C.pools.focMax + 50],
    exploration: ['skill.survival', 'hpMax', C.pools.hpMax + 10],
  };
  it.each(Object.keys(one) as SkillFamily[])('one skill in %s raises its pool', (family) => {
    const [id, key, want] = one[family];
    expect(SKILLS[id]?.family).toBe(family);
    const { s, me } = world();
    for (let i = 0; i < 10; i++) addXp(s, me, id, xpToNext(i));
    // Pending skills earn no XP from the sim, but a save can hold points (and addXp is the door).
    expect(pointsOf(s, me, id)).toBe(10);
    expect(pools(s, me)[key]).toBe(want);
  });
});

describe('Survival', () => {
  const NIGHT = (30 + 4 + 4 - TIME.startMinute) * TIME.ticksPerMinute;

  it('an in-game hour is a 24th of the cycle', () => {
    const cycle = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;
    expect(TIME.hourTicks * 24).toBe(cycle);
  });

  it('pays once per in-game hour of night spent outdoors, and not by day', () => {
    const { s, me } = world();
    const pay = SKILLS['skill.survival']!.sources.find((x) => x.on === 'outdoorsNight')!.base;
    s.worldTick = 5 * TIME.ticksPerMinute;
    for (let i = 0; i < TIME.hourTicks * 2; i++) feed(s);
    expect(earned(s, me, 'skill.survival')).toBe(0);
    s.worldTick = NIGHT;
    for (let i = 0; i < TIME.hourTicks - 1; i++) feed(s);
    expect(earned(s, me, 'skill.survival')).toBe(0);
    feed(s);
    expect(earned(s, me, 'skill.survival')).toBe(pay);
    for (let i = 0; i < TIME.hourTicks; i++) feed(s);
    expect(earned(s, me, 'skill.survival')).toBe(pay * 2);
  });

  it('pays nothing at night inside a cave room', () => {
    const { s, me } = world();
    const f = feetAt(10, 105);
    s.entities.comps.pos[me]!.x = f.x;
    s.entities.comps.pos[me]!.y = f.y;
    s.worldTick = NIGHT;
    for (let i = 0; i < TIME.hourTicks * 2; i++) feed(s);
    expect(earned(s, me, 'skill.survival')).toBe(0);
  });

  it('pays for eating raw forage, not for cooked food, unscaled', () => {
    const { s, me } = world();
    const pay = SKILLS['skill.survival']!.sources.find((x) => x.on === 'eatRaw')!.base;
    feed(s, { type: 'eaten', id: me, item: 'item.herb_tea' });
    expect(earned(s, me, 'skill.survival')).toBe(0);
    for (const item of ['item.berry_red', 'item.berry_blue', 'item.sunwort', 'item.dewmint']) {
      expect(ITEMS[item]?.food?.raw, item).toBe(true);
      feed(s, { type: 'eaten', id: me, item });
    }
    expect(earned(s, me, 'skill.survival')).toBe(pay * 4);
  });
});

describe('Deciphering', () => {
  it('pays only the first-time lump for a tablet kind, then nothing', () => {
    const { s, me } = world();
    const a = spawnFixture(s, 'fixture.tablet', 22, 20);
    const b = spawnFixture(s, 'fixture.tablet', 24, 20);
    const lump = SKILLS['skill.deciphering']!.sources[0]!.firstTime!;
    feed(s, { type: 'tabletRead', id: a, who: me });
    expect(earned(s, me, 'skill.deciphering')).toBe(lump);
    feed(s, { type: 'tabletRead', id: a, who: me });
    feed(s, { type: 'tabletRead', id: b, who: me });
    expect(earned(s, me, 'skill.deciphering')).toBe(lump);
  });
});

describe('Cooking moved from cook to craft', () => {
  it('pays through the cooked event as craft:cooking, with a first-time lump per recipe', () => {
    const { s, me } = world();
    const ev = (recipe: string): SimEvent => ({
      type: 'cooked',
      id: me,
      tag: 'cooking',
      recipe,
      tier: 1,
    });
    feed(s, ev('recipe.herb_tea'));
    expect(earned(s, me, 'skill.cooking')).toBe(125);
    feed(s, ev('recipe.herb_tea'));
    expect(earned(s, me, 'skill.cooking')).toBe(150);
    expect(s.entities.comps.skills[me]!.seen).toContain('skill.cooking:craft:recipe.herb_tea');
  });
});
