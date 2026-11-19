import { afterAll, describe, expect, it } from 'vitest';
import { TEMPERAMENT as TB } from '../../src/content/balance/temperament';
import { CREATURES } from '../../src/content/creatures';
import type { CreatureDef, Temperament } from '../../src/content/creatures/types';
import { without } from '../support/temperament';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { provenTier, provoke, stepUp, temperamentNow } from '../../src/sim/combat/temperament';
import { px } from '../../src/sim/kernel/fixed';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { dayPhase } from '../../src/sim/time';

const OPEN = {
  solidAt: (tx: number, ty: number): number => (tx < 0 || ty < 0 || tx > 80 || ty > 80 ? 1 : 0),
};
const ME = { x: 30 * 16 + 8, y: 30 * 16 + 14 };

/** Clones of the Mossling with one temperament each, so a scenario tests one rule. */
const BASE = CREATURES['creature.mossling'] as CreatureDef;
const made: string[] = [];
function make(name: string, patch: Partial<CreatureDef>): string {
  const id = `creature.t_${name}`;
  (CREATURES as Record<string, CreatureDef>)[id] = {
    ...without(BASE, 'night', 'fleeHpPct'),
    id,
    name,
    ...patch,
  };
  made.push(id);
  return id;
}
afterAll(() => {
  for (const id of made) delete (CREATURES as Record<string, CreatureDef>)[id];
});

const HOSTILE = make('hostile', { temperament: 'hostile' });
const TERR = make('terr', {
  temperament: 'territorial',
  territory: { radius: 70, warnTicks: 36 },
});
const DEFENSIVE = make('def', { temperament: 'defensive' });
const SKITTISH = make('skit', { temperament: 'skittish', fleeHpPct: 20 });
const PASSIVE = make('pas', { temperament: 'passive' });
const CURIOUS = make('cur', { temperament: 'curious', approach: 40 });
const PACKED = make('pack', { temperament: 'defensive', pack: { id: 'ram', radius: 50 } });
const NIGHTLY = make('night', {
  temperament: 'curious',
  approach: 40,
  night: 'territorial',
  territory: { radius: 70, warnTicks: 36 },
});

interface Arena {
  s: SimState;
  me: number;
  events: SimEvent[];
  /** In-game ticks added to the tick count, to start a scenario at night. */
  clock: number;
  run: (n: number, ...cmds: { type: 'attack' }[]) => void;
}
function arena(): Arena {
  const s = createDemoState(11, 0);
  s.world = OPEN;
  const f = feetAt(30, 30);
  const me = createAvatar(s, f.x, f.y);
  s.entities.comps.avatar[me]!.facing = 2;
  const a: Arena = {
    s,
    me,
    events: [],
    clock: 0,
    run: (n, ...cmds) => {
      for (let i = 0; i < n; i++) {
        stepWorld(s, me, { commands: i === 0 ? cmds : [], worldTick: a.clock + s.tick });
        a.events.push(...s.events.list);
      }
    },
  };
  return a;
}
const of = <T extends SimEvent['type']>(a: Arena, t: T) =>
  a.events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);
const ai = (a: Arena, id: number) => a.s.entities.comps.ai[id]!;
const dist = (a: Arena, id: number): number => {
  const p = a.s.entities.comps.pos[id]!;
  const m = a.s.entities.comps.pos[a.me]!;
  return Math.hypot(p.x - m.x, p.y - m.y) / 256;
};
const attacked = (a: Arena, id: number): boolean => of(a, 'attackStarted').some((e) => e.id === id);

describe('hostile', () => {
  it('chases on notice and attacks', () => {
    const a = arena();
    const m = spawnCreature(a.s, HOSTILE, ME.x + 60, ME.y);
    a.run(150);
    expect(of(a, 'noticed')).toHaveLength(1);
    expect(attacked(a, m)).toBe(true);
    expect(of(a, 'temperamentSeen')[0]?.temperament).toBe('hostile');
  });
});

describe('territorial', () => {
  it('warns first, then chases only after warnTicks inside the territory', () => {
    const a = arena();
    const m = spawnCreature(a.s, TERR, ME.x + 60, ME.y);
    a.run(1);
    expect(ai(a, m).state).toBe('warn');
    expect(of(a, 'creatureWarn')).toHaveLength(1);
    a.run(30);
    expect(of(a, 'noticed')).toHaveLength(0);
    expect(attacked(a, m)).toBe(false);
    a.run(20);
    expect(of(a, 'noticed')).toHaveLength(1);
    a.run(100);
    expect(attacked(a, m)).toBe(true);
  });

  it('a step back out of the territory cancels the warning', () => {
    const a = arena();
    const m = spawnCreature(a.s, TERR, ME.x + 60, ME.y);
    a.run(12);
    expect(ai(a, m).state).toBe('warn');
    a.s.entities.comps.pos[a.me]!.x = px(ME.x - 40);
    a.run(120);
    expect(ai(a, m).state).not.toBe('warn');
    expect(of(a, 'noticed')).toHaveLength(0);
    expect(attacked(a, m)).toBe(false);
  });
});

describe('defensive', () => {
  it('ignores the avatar until hit, fights, and resets at its leash', () => {
    const a = arena();
    const m = spawnCreature(a.s, DEFENSIVE, ME.x + 60, ME.y);
    a.run(150);
    expect(of(a, 'noticed')).toHaveLength(0);
    expect(attacked(a, m)).toBe(false);
    // Walk up and swing.
    a.s.entities.comps.pos[a.me]!.x = a.s.entities.comps.pos[m]!.x - px(16);
    a.run(1, { type: 'attack' });
    a.run(40);
    expect(ai(a, m).provoked).toBe(true);
    a.run(120);
    expect(of(a, 'noticed').length).toBeGreaterThan(0);
    expect(attacked(a, m)).toBe(true);
    // Pulled far away it gives up, walks home, and is calm again.
    a.s.entities.comps.pos[a.me]!.x = px(ME.x + 600);
    for (let i = 0; i < 500 && of(a, 'leashReset').length === 0; i++) a.run(1);
    expect(of(a, 'leashReset')).toHaveLength(1);
    expect(ai(a, m).provoked).toBe(false);
  });
});

describe('skittish', () => {
  it('flees on notice', () => {
    const a = arena();
    const m = spawnCreature(a.s, SKITTISH, ME.x + 50, ME.y);
    a.run(2);
    expect(ai(a, m).state).toBe('flee');
    const d0 = dist(a, m);
    a.run(30);
    expect(dist(a, m)).toBeGreaterThan(d0);
    expect(attacked(a, m)).toBe(false);
  });

  it('fights when cornered', () => {
    const a = arena();
    // Against the east wall, with the avatar to its west: there is nowhere to run.
    const m = spawnCreature(a.s, SKITTISH, 81 * 16 - 8, ME.y);
    a.s.entities.comps.pos[a.me]!.x = px(81 * 16 - 8 - 50);
    a.run(120);
    expect(ai(a, m).provoked).toBe(true);
    expect(attacked(a, m)).toBe(true);
  });

  it('fights below its flee Health', () => {
    const a = arena();
    const m = spawnCreature(a.s, SKITTISH, ME.x + 50, ME.y);
    a.s.entities.comps.pools[m]!.hp = 10;
    a.run(120);
    expect(attacked(a, m)).toBe(true);
  });
});

describe('passive', () => {
  it('never acquires and never fights back, even when hit', () => {
    const a = arena();
    const m = spawnCreature(a.s, PASSIVE, ME.x + 16, ME.y);
    a.run(60);
    a.run(1, { type: 'attack' });
    a.run(200);
    expect(a.s.entities.comps.pools[m]!.hp).toBeLessThan(BASE.hp);
    expect(of(a, 'noticed')).toHaveLength(0);
    expect(attacked(a, m)).toBe(false);
  });
});

describe('curious', () => {
  it('follows to its approach distance and turns only when hit', () => {
    const a = arena();
    const m = spawnCreature(a.s, CURIOUS, ME.x + 90, ME.y);
    a.run(200);
    expect(ai(a, m).state).toBe('follow');
    expect(dist(a, m)).toBeLessThan(48);
    expect(dist(a, m)).toBeGreaterThan(30);
    expect(attacked(a, m)).toBe(false);
    // Hit it from where it stands: it turns hostile.
    a.s.entities.comps.pos[a.me]!.x = a.s.entities.comps.pos[m]!.x - px(16);
    a.run(1, { type: 'attack' });
    a.run(150);
    expect(ai(a, m).provoked).toBe(true);
    expect(attacked(a, m)).toBe(true);
  });
});

describe('pack', () => {
  it('provokes packmates within the pack radius and not beyond it', () => {
    const a = arena();
    const hit = spawnCreature(a.s, PACKED, ME.x + 16, ME.y);
    const near = spawnCreature(a.s, PACKED, ME.x + 16, ME.y + 36);
    const far = spawnCreature(a.s, PACKED, ME.x + 16, ME.y - 120);
    a.run(1, { type: 'attack' });
    a.run(40);
    expect(ai(a, hit).provoked).toBe(true);
    expect(ai(a, near).provoked).toBe(true);
    expect(ai(a, far).provoked).not.toBe(true);
  });
});

describe('night', () => {
  it('swaps the temperament from dusk to dawn', () => {
    let night = 0;
    while (dayPhase(night) !== 'night') night += 30;
    const day = arena();
    const dm = spawnCreature(day.s, NIGHTLY, ME.x + 60, ME.y);
    day.run(3);
    expect(ai(day, dm).state).toBe('follow');
    const dark = arena();
    dark.clock = night;
    const nm = spawnCreature(dark.s, NIGHTLY, ME.x + 60, ME.y);
    dark.run(3);
    expect(ai(dark, nm).state).toBe('warn');
  });

  it('the shipped Mossling is curious by day and territorial at night', () => {
    const m = CREATURES['creature.mossling']!;
    expect(temperamentNow(m, 0, 1)).toBe('curious');
    let night = 0;
    while (dayPhase(night) !== 'night') night += 30;
    expect(temperamentNow(m, night, 1)).toBe('territorial');
  });
});

describe('tier gap', () => {
  it('steps each rung up and leaves the rest', () => {
    const rungs: [Temperament, Temperament][] = [
      ['defensive', 'territorial'],
      ['curious', 'territorial'],
      ['territorial', 'hostile'],
      ['hostile', 'hostile'],
      ['passive', 'passive'],
      ['skittish', 'skittish'],
    ];
    for (const [from, to] of rungs) {
      const def = { ...BASE, tier: 3, temperament: from } as CreatureDef;
      expect(temperamentNow(def, 0, 1), `${from} two tiers up`).toBe(to);
      expect(temperamentNow({ ...def, tier: 2 }, 0, 1), `${from} one tier up`).toBe(from);
      expect(stepUp(from)).toBe(to);
    }
  });

  it('proven tier comes from passed rank Trials and beaten bosses', () => {
    expect(provenTier([], [])).toBe(0);
    expect(provenTier(['skill.blades@15'], [])).toBe(1);
    expect(provenTier(['skill.blades@15', 'skill.crafting@30'], [])).toBe(2);
    expect(provenTier([], ['boss:creature.thornling'])).toBe(CREATURES['creature.thornling']!.tier);
    expect(provenTier(['skill.blades@15'], ['unrelated'])).toBe(1);
    expect(TB.tierGap).toBe(2);
  });

  it('a tier 2 territorial creature attacks a fresh avatar without a warning, and warns a proven one', () => {
    const t2 = make('t2', {
      temperament: 'territorial',
      territory: { radius: 70, warnTicks: 36 },
      tier: 2,
    });
    const fresh = arena();
    spawnCreature(fresh.s, t2, ME.x + 60, ME.y);
    fresh.run(15);
    expect(of(fresh, 'noticed')).toHaveLength(1);
    expect(of(fresh, 'creatureWarn')).toHaveLength(0);
    const proven = arena();
    proven.s.entities.comps.skills[proven.me]!.passed.push('skill.blades@15');
    spawnCreature(proven.s, t2, ME.x + 60, ME.y);
    proven.run(15);
    expect(of(proven, 'creatureWarn')).toHaveLength(1);
    expect(of(proven, 'noticed')).toHaveLength(0);
  });
});

describe('Hide, Pacifist and Mossfriend act before temperament', () => {
  it('provoke on a passive creature does nothing', () => {
    const a = arena();
    const m = spawnCreature(a.s, PASSIVE, ME.x + 16, ME.y);
    provoke(a.s, m, a.me);
    expect(ai(a, m).provoked).toBeUndefined();
  });
});

describe('the shipped roster', () => {
  it('carries the temperaments the playtest asked for', () => {
    const t = (id: string): string => CREATURES[`creature.${id}`]!.temperament;
    expect(t('mossling')).toBe('curious');
    expect(CREATURES['creature.mossling']!.night).toBe('territorial');
    expect(t('spitbloom')).toBe('territorial');
    expect(t('bramble_boar')).toBe('territorial');
    expect(CREATURES['creature.bramble_boar']!.night).toBe('hostile');
    expect(t('old_bramblehide')).toBe('territorial');
    expect(t('training_dummy')).toBe('passive');
    expect(t('thornling')).toBe('hostile');
    expect(t('fogcap')).toBe('territorial');
    expect(t('cinderback_boar')).toBe('hostile');
  });
});
