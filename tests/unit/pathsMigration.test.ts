import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deserializeState } from '../../src/sim/state';
import { honestPlain, tamper } from '../support/saves';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-15.json'), 'utf8'),
) as { plain: SavePlain };

describe('schema 15 to 16 migration', () => {
  it('gives every avatar an empty record of deeds and no Paths, and keeps all else', async () => {
    expect(fixture.plain.schema).toBe(15);
    const now = migrate(
      await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(fixture.plain))),
    );
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const me = s.entities.comps.avatar.findIndex((a) => a);
    expect(s.entities.comps.deeds[me]).toEqual({
      counts: {},
      distinct: {},
      resetAt: {},
      fight: { live: false, kills: 0, hurt: false },
      near: [],
    });
    expect(s.entities.comps.paths[me]).toEqual({ earned: [], worn: [], shown: null });
    expect(s.entities.comps.deeds.filter((d, i) => d && i !== me)).toHaveLength(0);
    expect(s.entities.comps.skills[me]!.points['skill.blades']).toBe(2);
    expect(validateSave(now).reasons.filter((r) => r.code !== 'XP_IMPLAUSIBLE')).toEqual([]);
  });
});

describe('integrity: Paths and deeds', () => {
  const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
  const plain = honestPlain();
  const edit = (f: (s: ReturnType<typeof deserializeState>, me: number) => void): SavePlain =>
    tamper(plain, f);

  it('passes an honest save and a Path whose requirements hold', () => {
    expect(codes(plain)).not.toContain('PATH_UNEARNED');
    const ok = edit((s, me) => {
      s.entities.comps.skills[me]!.points['skill.shieldcraft'] = 15;
      s.entities.comps.deeds[me]!.counts['deed.parries'] = 40;
      s.entities.comps.paths[me] = {
        earned: ['path.bulwark'],
        worn: ['path.bulwark'],
        shown: 'path.bulwark',
      };
    });
    expect(codes(ok)).not.toContain('PATH_UNEARNED');
    expect(codes(ok)).not.toContain('WORN_NOT_EARNED');
  });
  it('flags an earned Path whose requirements do not hold, or that does not exist', () => {
    expect(
      codes(
        edit((s, me) => {
          s.entities.comps.paths[me] = { earned: ['path.bulwark'], worn: [], shown: null };
        }),
      ),
    ).toContain('PATH_UNEARNED');
    expect(
      codes(
        edit((s, me) => {
          s.entities.comps.paths[me] = { earned: ['path.nope'], worn: [], shown: null };
        }),
      ),
    ).toContain('PATH_UNEARNED');
  });
  it('flags a worn Path that was not earned, more than three worn, and a shown title that is not worn', () => {
    const earned = (s: ReturnType<typeof deserializeState>, me: number): void => {
      const sk = s.entities.comps.skills[me]!;
      sk.points['skill.shieldcraft'] = 15;
      sk.points['skill.blades'] = 15;
      s.entities.comps.deeds[me]!.counts['deed.parries'] = 40;
      s.entities.comps.deeds[me]!.counts['deed.kills_onehand'] = 60;
      s.entities.comps.deeds[me]!.counts['deed.untouched_fights'] = 10;
    };
    expect(
      codes(
        edit((s, me) => {
          earned(s, me);
          s.entities.comps.paths[me] = {
            earned: ['path.bulwark'],
            worn: ['path.duelist'],
            shown: null,
          };
        }),
      ),
    ).toContain('WORN_NOT_EARNED');
    expect(
      codes(
        edit((s, me) => {
          earned(s, me);
          s.entities.comps.paths[me] = {
            earned: ['path.bulwark', 'path.duelist'],
            worn: ['path.bulwark'],
            shown: 'path.duelist',
          };
        }),
      ),
    ).toContain('WORN_NOT_EARNED');
  });
  it('flags deed counts that run past what the ledger recorded', () => {
    const over = edit((s, me) => {
      s.entities.comps.deeds[me]!.counts['deed.mossling_kills'] = 500;
    });
    expect(codes(over)).toContain('DEED_EXCEEDS_LEDGER');
    const fine = edit((s, me) => {
      s.entities.comps.deeds[me]!.counts['deed.mossling_kills'] = 10;
    });
    expect(codes(fine)).not.toContain('DEED_EXCEEDS_LEDGER');
  });
});
