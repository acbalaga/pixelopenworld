import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TECHNIQUE_LIST } from '../../src/content/combat/techniques';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { knows } from '../../src/sim/combat/techniques';
import { addXp, awaken } from '../../src/sim/skills';
import { createDemoState, deserializeState } from '../../src/sim/state';
import { skillsView, techniquesView } from '../../src/ui/menu/model';
import { honestPlain, tamper } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-18.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 18 to 19 migration (awakening and sources)', () => {
  it('keeps every technique the old rule knew, awakens their skills, and passes integrity', async () => {
    expect(fixture.plain.schema).toBe(18);
    const old = deserializeState(fixture.plain.sim);
    const me0 = findAvatar(old)!;
    const sk0 = old.entities.comps.skills[me0]!;
    const j0 = old.entities.comps.journal[me0]!;
    // The old rule: the band is reached, and a taught one needs its flag.
    const knewBefore = TECHNIQUE_LIST.filter(
      (t) =>
        (sk0.points[t.skill] ?? 0) >= t.band &&
        (t.source !== 'taught' || j0.flags.includes(`learned.${t.id}`)),
    ).map((t) => t.id);
    expect(knewBefore.length).toBeGreaterThan(5);

    const decoded = await new JsonCodec().decode(
      new TextEncoder().encode(JSON.stringify(fixture.plain)),
    );
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const me = findAvatar(s)!;
    const sk = s.entities.comps.skills[me]!;
    expect(sk.insight).toEqual({});
    expect(s.entities.comps.journal[me]!.learnedVia).toEqual({});
    expect(sk.awake).toContain('skill.blades');
    for (const id of knewBefore)
      expect(
        knows(
          s,
          me,
          TECHNIQUE_LIST.find((t) => t.id === id)!,
        ),
        id,
      ).toBe(true);
    expect(validateSave(now).reasons).toEqual([]);
  });
});

describe('MANUAL_READ_UNSOURCED', () => {
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  const read = (made: boolean): SavePlain =>
    tamper(honestPlain(), (s, me) => {
      s.entities.comps.skills[me]!.awake.push('skill.stealth');
      const j = s.entities.comps.journal[me]!;
      j.flags.push('learned.technique.stealth_hide');
      j.learnedVia['technique.stealth_hide'] = 'manual';
      if (made) s.ledger.itemsMade.chest = { ...s.ledger.itemsMade.chest, 'item.manual_hide': 1 };
    });

  it('flags a manual read with no copy ever found', () => {
    expect(codes(read(false))).toContain('MANUAL_READ_UNSOURCED');
  });
  it('passes when a copy came from a chest', () => {
    expect(codes(read(true))).not.toContain('MANUAL_READ_UNSOURCED');
  });
});

describe('the Skills tab and the Techniques list', () => {
  it('are empty for a new character, and show only awake skills with where each technique comes from', () => {
    const s = createDemoState(5, 0);
    const f = feetAt(20, 20);
    const me = createAvatar(s, f.x, f.y);
    expect(skillsView(s, me)).toEqual([]);
    expect(techniquesView(s, me).groups).toEqual([]);
    addXp(s, me, 'skill.blades', 5);
    expect(skillsView(s, me).flatMap((x) => x.rows.map((r) => r.id))).toEqual(['skill.blades']);
    const rows = techniquesView(s, me).groups.flatMap((g) => g.rows);
    expect(rows.find((r) => r.id === 'technique.blades_lunge')).toMatchObject({
      known: false,
      need: 'Insight 0 of 30',
    });
    expect(rows.find((r) => r.id === 'technique.blades_crosscut')?.need).toBe(
      'Reach Blades 15 to learn it.',
    );
    awaken(s, me, 'skill.performance');
    const hum = techniquesView(s, me)
      .groups.flatMap((g) => g.rows)
      .find((r) => r.id === 'technique.performance_hum');
    expect(hum?.need).toBe('Someone in Hearthford teaches this');
    awaken(s, me, 'skill.tide');
    expect(skillsView(s, me).flatMap((x) => x.rows.map((r) => r.id))).toContain('skill.tide');
  });
});
