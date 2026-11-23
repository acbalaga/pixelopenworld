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

/** The base XP of a skill's first source, so tuning it does not break the tests. */
const baseOf = (skill: string): number => (SKILLS[skill]?.sources[0] as { base: number }).base;
const COOK_BASE = baseOf('skill.cooking');
const COOK_LUMP = (SKILLS['skill.cooking']?.sources[0] as { firstTime: number }).firstTime;

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

  it('list 4 pending skills: the late ones whose system has not merged', () => {
    expect(PENDING_SKILLS).toHaveLength(4);
    for (const id of PENDING_SKILLS) expect(SKILLS[id], id).toBeDefined();
    for (const late of ['farming', 'husbandry', 'leadership', 'taming'])
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
      feed(s, { type: 'gathered', id: me, tag: 'foraging', item: 'item.sunwort', tier: 1, qty: 1 }),
    'skill.mining': (s, me) =>
      feed(s, {
        type: 'gathered',
        id: me,
        tag: 'mining',
        item: 'item.copper_ore',
        tier: 1,
        qty: 1,
      }),
    'skill.logging': (s, me) =>
      feed(s, { type: 'gathered', id: me, tag: 'logging', item: 'item.oak_log', tier: 1, qty: 1 }),
    'skill.fishing': (s, me) =>
      feed(s, {
        type: 'gathered',
        id: me,
        tag: 'fishing',
        item: 'item.fish_river',
        tier: 1,
        qty: 1,
      }),
    'skill.smithing': (s, me) =>
      feed(s, {
        type: 'crafted',
        id: me,
        tag: 'smithing',
        recipe: 'recipe.copper_ingot',
        tier: 1,
        item: 'item.copper_ingot',
        qty: 1,
        quality: 0,
        source: 'manual',
      }),
    'skill.woodworking': (s, me) =>
      feed(s, {
        type: 'crafted',
        id: me,
        tag: 'woodworking',
        recipe: 'recipe.oak_plank',
        tier: 1,
        item: 'item.oak_plank',
        qty: 2,
        quality: 0,
        source: 'manual',
      }),
    'skill.cooking': (s, me) =>
      feed(s, {
        type: 'crafted',
        id: me,
        tag: 'cooking',
        recipe: 'recipe.herb_tea',
        tier: 1,
        item: 'item.herb_tea',
        qty: 1,
        quality: 0,
        source: 'manual',
      }),
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
    'skill.tailoring': (s, me) =>
      feed(s, {
        type: 'crafted',
        id: me,
        tag: 'tailoring',
        recipe: 'recipe.cap_wool',
        tier: 1,
        item: 'item.cap_wool',
        qty: 1,
        quality: 0,
        source: 'manual',
      }),
    'skill.alchemy': (s, me) =>
      feed(s, {
        type: 'crafted',
        id: me,
        tag: 'alchemy',
        recipe: 'recipe.potion_health_s',
        tier: 1,
        item: 'item.potion_health_s',
        qty: 1,
        quality: 0,
        source: 'manual',
      }),
    'skill.enchanting': (s, me) =>
      feed(s, {
        type: 'crafted',
        id: me,
        tag: 'enchanting',
        recipe: 'recipe.enchant_power_1',
        tier: 1,
        item: 'item.sword_rusty',
        qty: 1,
        quality: 0,
        source: 'manual',
      }),
    'skill.tinkering': (s, me) =>
      feed(s, {
        type: 'crafted',
        id: me,
        tag: 'tinkering',
        recipe: 'recipe.spark_flint',
        tier: 1,
        item: 'item.spark_flint',
        qty: 1,
        quality: 0,
        source: 'manual',
      }),
    'skill.tide': (s, me) => hit(s, me, 'tide'),
    'skill.gale': (s, me) => hit(s, me, 'gale'),
    'skill.stone': (s, me) => hit(s, me, 'stone'),
    'skill.mending': (s, me) =>
      feed(s, { type: 'healed', id: me, src: me, amount: 3, tag: 'mending' }),
    'skill.performance': (s, me) =>
      feed(s, { type: 'perform', who: me, technique: 'technique.performance_hum' }),
    'skill.stealth': (s, me) => {
      const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
      feed(s, { type: 'sneak', who: me, creature: foe });
    },
    'skill.bartering': (s, me) =>
      feed(s, { type: 'haggleWon', who: me, shop: 'shop.brin', item: 'item.dish_bread', price: 2 }),
    'skill.hexing': (s, me) => {
      const foe = spawnEnemy(s, 'creature.mossling', 400, 300);
      feed(s, { type: 'statusApplied', id: foe, status: 'hexed', src: me, refreshed: false });
    },
    'skill.delving': (s, me) =>
      feed(s, { type: 'delved', who: me, dungeon: 'dungeon.sample', room: 'dungeon.sample.b' }),
    'skill.cartography': (s, me) => {
      feed(s, { type: 'revealed', who: me, blocks: 5 });
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

  it('has 32 skills with a system after M4-06', () => {
    expect(active).toHaveLength(32);
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
  it('pays a tablet once for its placement and band, and a second tablet of the kind on its own', () => {
    const { s, me } = world();
    const a = spawnFixture(s, 'fixture.tablet', 22, 20);
    const b = spawnFixture(s, 'fixture.tablet', 24, 20);
    const lump = SKILLS['skill.deciphering']!.sources[0]!.firstTime!;
    feed(s, { type: 'tabletRead', id: a, who: me });
    expect(earned(s, me, 'skill.deciphering')).toBe(lump);
    feed(s, { type: 'tabletRead', id: a, who: me });
    expect(earned(s, me, 'skill.deciphering')).toBe(lump);
    feed(s, { type: 'tabletRead', id: b, who: me });
    expect(earned(s, me, 'skill.deciphering')).toBe(2 * lump);
  });
});

describe('Cooking pays as craft:cooking', () => {
  it('pays through the crafted event as craft:cooking, with a first-time lump per recipe', () => {
    const { s, me } = world();
    const ev = (recipe: string): SimEvent => ({
      type: 'crafted',
      id: me,
      tag: 'cooking',
      recipe,
      tier: 1,
      item: 'item.herb_tea',
      qty: 1,
      quality: 0,
      source: 'manual',
    });
    feed(s, ev('recipe.herb_tea'));
    expect(earned(s, me, 'skill.cooking')).toBe(COOK_BASE + COOK_LUMP);
    feed(s, ev('recipe.herb_tea'));
    // The same recipe again pays the plain rate, no lump. It is at most the base, since the rate
    // falls as the skill rises past a tier 1 target.
    const again = earned(s, me, 'skill.cooking') - (COOK_BASE + COOK_LUMP);
    expect(again).toBeGreaterThan(0);
    expect(again).toBeLessThanOrEqual(COOK_BASE);
    expect(s.entities.comps.skills[me]!.seen).toContain('skill.cooking:craft:recipe.herb_tea');
  });
});
