import { describe, expect, it } from 'vitest';
import { SKILLS_BALANCE as SB } from '../../src/content/balance/skills';
import { TECHNIQUES, type TechniqueDef } from '../../src/content/combat/techniques';
import { DIALOGUES } from '../../src/content/dialogue';
import { ITEMS } from '../../src/content/items';
import { MANUALS } from '../../src/content/items/manuals';
import { PENDING_SKILLS } from '../../src/content/skills';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature, spawnEnemy } from '../../src/sim/combat/enemy';
import { knows } from '../../src/sim/combat/techniques';
import { give } from '../../src/sim/items';
import type { Command } from '../../src/sim/kernel/commands';
import { emit, type SimEvent } from '../../src/sim/kernel/events';
import { awaken, isAwake } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { mapSystem } from '../../src/sim/systems/map';
import { skillsSystem } from '../../src/sim/systems/skills';
import { spawnNpc } from '../../src/sim/systems/npcs';

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...c: Command[]) => void;
}

function rig(): Rig {
  const s = createDemoState(13, 0);
  s.world = { solidAt: () => 0 };
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  // Cartography wakes on the first uncovered ground, so uncover it before these tests count wakings.
  mapSystem(s);
  s.events.list.length = 0;
  const events: SimEvent[] = [];
  const tick = (...c: Command[]): void => {
    stepWorld(s, me, { commands: c });
    events.push(...s.events.list);
  };
  tick({ type: 'scheme', scheme: 'classic' });
  events.length = 0;
  return { s, me, events, tick };
}

const skills = (r: Rig) => r.s.entities.comps.skills[r.me]!;
const journal = (r: Rig) => r.s.entities.comps.journal[r.me]!;
const slots = (r: Rig) => r.s.entities.comps.fighter[r.me]!.slots;
const tech = (id: string): TechniqueDef => TECHNIQUES[id]!;

/** Feeds the skills system `n` copies of an event, as the sim would on `n` separate ticks. */
function feed(r: Rig, n: number, make: () => SimEvent): void {
  for (let i = 0; i < n; i++) {
    r.s.events.list.length = 0;
    emit(r.s.events, make());
    skillsSystem(r.s);
    r.events.push(...r.s.events.list);
  }
}

/** One counted use of the technique's insight event, for the skill's own weapon or element. */
function use(r: Rig, t: TechniqueDef, foe: number): SimEvent {
  const ev = t.insight!.event;
  if (ev === 'damage')
    return {
      type: 'damageDealt',
      src: r.me,
      dst: foe,
      amount: 3,
      crit: false,
      bonus: false,
      heavy: false,
      tag: t.insight!.tag!,
    };
  if (ev === 'block')
    return { type: 'blocked', src: foe, who: r.me, dst: r.me } as unknown as SimEvent;
  return { type: 'perfectDodge', id: r.me, src: foe };
}

describe('a new character', () => {
  it('has every skill dormant and knows no technique', () => {
    const r = rig();
    expect(skills(r).awake).toEqual([]);
    for (const id of Object.keys(SB.insight)) expect(knows(r.s, r.me, tech(id)), id).toBe(false);
  });

  it('holding a weapon awakens nothing, and the first hit awakens its skill', () => {
    const r = rig();
    expect(isAwake(skills(r), 'skill.blades')).toBe(false);
    const foe = spawnCreature(r.s, 'creature.mossling', 20 * 16 + 8, 20 * 16 + 14 + 14, -1);
    // A real dagger hit: face the foe and attack until it lands.
    for (let i = 0; i < 90 && !isAwake(skills(r), 'skill.blades'); i++) r.tick({ type: 'attack' });
    expect(foe).toBeGreaterThan(-1);
    expect(isAwake(skills(r), 'skill.blades')).toBe(true);
    expect(r.events.some((e) => e.type === 'skillAwakened' && e.skill === 'skill.blades')).toBe(
      true,
    );
    // Awakening happens once.
    expect(
      r.events.filter((e) => e.type === 'skillAwakened' && e.skill === 'skill.blades'),
    ).toHaveLength(1);
  });

  it('skills with no XP source yet never awaken', () => {
    const r = rig();
    for (const id of PENDING_SKILLS) expect(awaken(r.s, r.me, id), id).toBe(false);
    expect(skills(r).awake).toEqual([]);
  });
});

describe('insight', () => {
  it('30 blade hits teach the Lunge, which then sits in slot 1 with a blade held', () => {
    const r = rig();
    const lunge = tech('technique.blades_lunge');
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    feed(r, SB.insight['technique.blades_lunge']! - 1, () => use(r, lunge, foe));
    expect(knows(r.s, r.me, lunge)).toBe(false);
    expect(skills(r).insight['technique.blades_lunge']).toBe(29);
    expect(slots(r)[0]).toBeNull();
    feed(r, 1, () => use(r, lunge, foe));
    expect(knows(r.s, r.me, lunge)).toBe(true);
    expect(journal(r).flags).toContain('learned.technique.blades_lunge');
    expect(r.events).toContainEqual({
      type: 'techniqueLearned',
      who: r.me,
      technique: lunge.id,
      via: 'insight',
    });
    expect(slots(r)[0]).toBe('technique.blades_lunge');
  });

  it('counts stop once the technique is known', () => {
    const r = rig();
    const lunge = tech('technique.blades_lunge');
    const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
    feed(r, 40, () => use(r, lunge, foe));
    expect(skills(r).insight['technique.blades_lunge']).toBe(30);
  });

  it('training dummy hits count only until the skill has 5 points', () => {
    const r = rig();
    const lunge = tech('technique.blades_lunge');
    const dummy = spawnEnemy(r.s, 'creature.training_dummy', 400, 300);
    feed(r, 10, () => use(r, lunge, dummy));
    expect(skills(r).insight['technique.blades_lunge']).toBe(10);
    skills(r).points['skill.blades'] = SB.dummyInsightUntil;
    feed(r, 10, () => use(r, lunge, dummy));
    expect(skills(r).insight['technique.blades_lunge']).toBe(10);
    // A real creature still counts.
    const mossling = spawnEnemy(r.s, 'creature.mossling', 420, 300);
    feed(r, 1, () => use(r, lunge, mossling));
    expect(skills(r).insight['technique.blades_lunge']).toBe(11);
  });
});

/** Every band 0 technique in design/11 Sources, with its two ways in. */
const SOURCES: {
  id: string;
  first: 'insight' | 'taught';
  second: 'manual' | { npc: string; node: string };
}[] = [
  { id: 'technique.blades_lunge', first: 'insight', second: 'manual' },
  {
    id: 'technique.heavy_overhead',
    first: 'insight',
    second: { npc: 'npc.smith', node: 'lesson' },
  },
  {
    id: 'technique.polearms_lunge',
    first: 'insight',
    second: { npc: 'npc.guard', node: 'lessons' },
  },
  {
    id: 'technique.archery_aimed',
    first: 'insight',
    second: { npc: 'npc.guard', node: 'lessons' },
  },
  { id: 'technique.unarmed_palm', first: 'insight', second: 'manual' },
  {
    id: 'technique.shieldcraft_bash',
    first: 'insight',
    second: { npc: 'npc.guard', node: 'lessons' },
  },
  { id: 'technique.evasion_light_feet', first: 'insight', second: 'manual' },
  { id: 'technique.ember_bolt', first: 'taught', second: 'manual' },
  { id: 'technique.tide_splash', first: 'taught', second: 'manual' },
  { id: 'technique.gale_gust', first: 'taught', second: 'manual' },
  { id: 'technique.stone_fist', first: 'taught', second: 'manual' },
  { id: 'technique.mending_mend', first: 'taught', second: 'manual' },
  { id: 'technique.performance_hum', first: 'taught', second: 'manual' },
  { id: 'technique.stealth_hide', first: 'taught', second: 'manual' },
];

/** The teacher's lesson for a technique: the node and choice that teach it, and who teaches. */
function lessonFor(id: string): { npc: string; node: string; choice: number } {
  for (const [npc, d] of Object.entries(DIALOGUES))
    for (const [node, n] of Object.entries(d.nodes)) {
      const choice = (n.choices ?? []).findIndex((c) =>
        (c.do ?? []).some((e) => 'learnTechnique' in e && e.learnTechnique === id),
      );
      if (choice >= 0) return { npc, node, choice };
    }
  throw new Error(`nobody teaches ${id}`);
}

describe('every technique in design/11 Sources is learnable both ways', () => {
  it.each(SOURCES)('$id: $first, and $second', ({ id, first, second }) => {
    const t = tech(id);
    expect(t.source).toBe(first);

    // Way one.
    {
      const r = rig();
      expect(knows(r.s, r.me, t)).toBe(false);
      if (first === 'insight') {
        const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
        feed(r, SB.insight[id]!, () => use(r, t, foe));
      } else {
        const l = lessonFor(id);
        spawnNpc(r.s, l.npc, 20, 19);
        giveAsk(r, l);
        r.tick({ type: 'talk', ...l });
      }
      expect(knows(r.s, r.me, t), 'first source').toBe(true);
    }

    // Way two.
    {
      const r = rig();
      expect(knows(r.s, r.me, t)).toBe(false);
      if (second === 'manual') {
        const m = MANUALS.find((x) => x.technique === id)!;
        expect(m, 'a manual exists').toBeDefined();
        give(r.s, r.me, m.id, 1, 'chest');
        r.tick({
          type: 'use',
          slot: r.s.entities.comps.inventory[r.me]!.slots.findIndex((s) => s?.item === m.id),
        });
      } else {
        const l = lessonFor(id);
        expect(l.npc).toBe(second.npc);
        spawnNpc(r.s, l.npc, 20, 19);
        giveAsk(r, l);
        r.tick({ type: 'talk', ...l });
      }
      expect(knows(r.s, r.me, t), 'second source').toBe(true);
    }
  });
});

/** Hands over what the lesson asks, or awakens the skill it wants shown. */
function giveAsk(r: Rig, l: { npc: string; node: string; choice: number }): void {
  const choice = DIALOGUES[l.npc]!.nodes[l.node]!.choices![l.choice]!;
  for (const c of choice.if ?? []) {
    if ('item' in c) give(r.s, r.me, c.item, c.atLeast, 'dialogue');
    if ('awake' in c) awaken(r.s, r.me, c.awake);
  }
}

describe('manuals', () => {
  it('reading one awakens its skill, teaches the technique and uses it up', () => {
    const r = rig();
    const m = MANUALS.find((x) => x.technique === 'technique.stealth_hide')!;
    give(r.s, r.me, m.id, 1, 'chest');
    const slot = r.s.entities.comps.inventory[r.me]!.slots.findIndex((s) => s?.item === m.id);
    expect(isAwake(skills(r), 'skill.stealth')).toBe(false);
    r.tick({ type: 'use', slot });
    expect(isAwake(skills(r), 'skill.stealth')).toBe(true);
    expect(knows(r.s, r.me, tech('technique.stealth_hide'))).toBe(true);
    expect(r.s.entities.comps.inventory[r.me]!.slots[slot]).toBeNull();
    expect(journal(r).learnedVia['technique.stealth_hide']).toBe('manual');
    expect(r.events.some((e) => e.type === 'manualRead')).toBe(true);
  });

  it('reading one whose technique is known keeps it and says so', () => {
    const r = rig();
    const m = MANUALS.find((x) => x.technique === 'technique.stealth_hide')!;
    give(r.s, r.me, m.id, 2, 'chest');
    const slot = r.s.entities.comps.inventory[r.me]!.slots.findIndex((s) => s?.item === m.id);
    r.tick({ type: 'use', slot });
    r.events.length = 0;
    r.tick({ type: 'use', slot });
    expect(r.s.entities.comps.inventory[r.me]!.slots[slot]?.qty).toBe(1);
    expect(r.events.some((e) => e.type === 'manualKnown')).toBe(true);
  });

  it('every manual teaches a technique that exists, of a skill that can awaken', () => {
    for (const m of MANUALS) {
      expect(ITEMS[m.id]?.manual).toEqual({ technique: m.technique, skill: m.skill });
      expect(tech(m.technique).skill).toBe(m.skill);
      expect(PENDING_SKILLS).not.toContain(m.skill);
    }
  });
});
