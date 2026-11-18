import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SKILLS } from '../../src/content/skills';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import type { SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import type { SimEvent } from '../../src/sim/kernel/events';
import { addXp, pointsOf, xpToNext } from '../../src/sim/skills';
import { createDemoState, deserializeState, type SimState } from '../../src/sim/state';
import { skillsSystem } from '../../src/sim/systems/skills';
import { skillsView } from '../../src/ui/menu/model';
import { CURRENT_SCHEMA } from '../../src/save/types';
import { tamper } from '../support/saves';

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

describe('Skills tab model', () => {
  it('keeps a skill hidden until it first ranks up, then lists it in table order', () => {
    const { s, me } = world();
    expect(skillsView(s, me)).toEqual([]);
    for (const id of ['skill.polearms', 'skill.blades']) addXp(s, me, id, xpToNext(0));
    const fams = skillsView(s, me);
    expect(fams.map((f) => f.family)).toEqual(['arms']);
    expect(fams[0]!.rows.map((r) => r.id)).toEqual(['skill.blades', 'skill.polearms']);
  });

  it('shows the Trial hint line one point short of a threshold and while XP is banked', () => {
    const { s, me } = world();
    s.entities.comps.skills[me]!.points['skill.foraging'] = 13;
    const row = () => skillsView(s, me).flatMap((f) => f.rows)[0]!;
    expect(row().trialHint).toBeNull();
    addXp(s, me, 'skill.foraging', xpToNext(13));
    expect(pointsOf(s, me, 'skill.foraging')).toBe(14);
    // Foraging has an authored Trial, so its hint names the giver.
    expect(row().trialHint).toBe('Hesper wants sunwort picked at the turn of the day.');
    addXp(s, me, 'skill.foraging', xpToNext(14) + 5);
    expect(row().trial).toBe('ready');
    expect(row().trialHint).toBe('Hesper wants sunwort picked at the turn of the day.');
  });
});

describe('schema 5 to 6 migration', () => {
  const fixture = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-5.json'), 'utf8'),
  ) as { expectedHash: string; plain: SavePlain };

  async function migrated(): Promise<SavePlain> {
    const bytes = new TextEncoder().encode(JSON.stringify(fixture.plain));
    return migrate(await new JsonCodec().decode(bytes));
  }

  it('rewrites a cooking first-time key so the bonus is not paid twice', async () => {
    expect(fixture.plain.schema).toBe(5);
    expect(
      deserializeState(fixture.plain.sim).entities.comps.skills.find((x) => x)!.seen,
    ).toContain('skill.cooking:cook:recipe.herb_tea');
    const now = await migrated();
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const me = findAvatar(s)!;
    const sk = s.entities.comps.skills[me]!;
    expect(sk.seen).toContain('skill.cooking:craft:recipe.herb_tea');
    expect(sk.seen.some((k) => k.includes(':cook:'))).toBe(false);
    expect(sk.nightAcc).toBe(0);
    const before = earned(s, me, 'skill.cooking');
    s.world = OPEN;
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
    });
    // Only the base. The 100 lump was paid before the upgrade.
    expect(earned(s, me, 'skill.cooking') - before).toBe(
      (SKILLS['skill.cooking']?.sources[0] as { base: number }).base,
    );
  });

  it('validates clean after the upgrade', async () => {
    expect(validateSave(await migrated()).reasons).toEqual([]);
  });
});

describe('integrity: SKILL_UNKNOWN', () => {
  it('flags points or XP in a skill that does not exist', async () => {
    const fixture = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-5.json'), 'utf8'),
    ) as { plain: SavePlain };
    const base = migrate(fixture.plain);
    const bad = tamper(base, (s, me) => {
      s.entities.comps.skills[me]!.points['skill.not_real'] = 3;
    });
    expect(validateSave(bad).reasons.map((r) => r.code)).toContain('SKILL_UNKNOWN');
    const bad2 = tamper(base, (s, me) => {
      s.entities.comps.skills[me]!.xp['skill.not_real'] = 3;
    });
    expect(validateSave(bad2).reasons.map((r) => r.code)).toContain('SKILL_UNKNOWN');
  });
});
