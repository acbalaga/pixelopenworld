import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { NO_FIGHT } from '../../src/sim/fight';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { offerTrial } from '../../src/sim/skills';
import { createDemoState, deserializeState } from '../../src/sim/state';
import { skillsView, trialLog } from '../../src/ui/menu/model';
import { tamper } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-7.json'), 'utf8'),
) as { plain: SavePlain };

const codes = (p: SavePlain): string[] =>
  validateSave(p)
    .reasons.map((r) => r.code)
    .filter((c) => c !== 'XP_IMPLAUSIBLE');

async function migrated(): Promise<SavePlain> {
  const bytes = new TextEncoder().encode(JSON.stringify(fixture.plain));
  return migrate(await new JsonCodec().decode(bytes));
}

describe('schema 7 to 8 migration', () => {
  it('gives an offered Trial empty progress and every avatar a fight record', async () => {
    expect(fixture.plain.schema).toBe(7);
    const now = await migrated();
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const sk = s.entities.comps.skills[findAvatar(s)!]!;
    expect(sk.offered).toEqual(['trial.foraging.15']);
    expect(sk.trial).toEqual({ 'trial.foraging.15': { n: 0, t0: 0 } });
    expect(sk.fight).toEqual({ id: 0, last: NO_FIGHT });
    expect(sk.points['skill.foraging']).toBe(14);
    // The fixture banked 4,000 XP in 100 s of play, which the plausibility layer rightly doubts.
    expect(codes(now)).toEqual([]);
  });
});

describe('TRIAL_PROGRESS_ORPHAN', () => {
  it('flags progress for a Trial that is not offered, unknown, or beyond its count', async () => {
    const base = await migrated();
    expect(codes(base)).toEqual([]);
    const orphan = tamper(base, (s, me) => {
      s.entities.comps.skills[me]!.trial['trial.blades.15'] = { n: 1, t0: 0 };
    });
    expect(codes(orphan)).toContain('TRIAL_PROGRESS_ORPHAN');
    const unknown = tamper(base, (s, me) => {
      s.entities.comps.skills[me]!.trial['trial.nope.15'] = { n: 0, t0: 0 };
    });
    expect(codes(unknown)).toContain('TRIAL_PROGRESS_ORPHAN');
    const over = tamper(base, (s, me) => {
      s.entities.comps.skills[me]!.trial['trial.foraging.15']!.n = 5;
    });
    expect(codes(over)).toContain('TRIAL_PROGRESS_ORPHAN');
  });
});

describe('Trial log', () => {
  it('shows the giver, the intro and progress for an offered Trial, and a seal once passed', () => {
    const s = createDemoState(2, 0);
    const f = feetAt(10, 10);
    const me = createAvatar(s, f.x, f.y);
    expect(trialLog(s, me)).toEqual([]);
    offerTrial(s, me, 'trial.blades.15');
    const [row] = trialLog(s, me);
    expect(row).toMatchObject({ giver: 'Orla', n: 0, count: 3, skill: 'Blades' });
    expect(row!.intro).toContain('Mosslings');
    expect(row!.label).toContain('0 of 3');
    // Passed: the seal shows under the skill's row.
    const sk = s.entities.comps.skills[me]!;
    sk.points['skill.blades'] = 15;
    sk.passed.push('skill.blades@15');
    const blades = skillsView(s, me)
      .flatMap((x) => x.rows)
      .find((r) => r.id === 'skill.blades')!;
    expect(blades.sealed).toEqual([15]);
  });
});
