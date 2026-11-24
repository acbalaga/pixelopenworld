import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { migrate, MIGRATIONS } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deserializeState, hashState } from '../../src/sim/state';

const f = JSON.parse(
  readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-28.json'), 'utf8'),
) as { plain: SavePlain; expectedHash: string };

const decode = (): Promise<SavePlain> =>
  new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

describe('schema 28 to 29 migration (camps)', () => {
  it('loads the previous fixture with an empty camp record and nothing else changed', async () => {
    expect(f.plain.schema).toBe(28);
    const raw = JSON.parse(f.plain.sim) as { entities: { comps: { skills: object[] } } };
    expect(raw.entities.comps.skills.find((s) => s)).not.toHaveProperty('camp');
    const at29 = migrate(await decode(), MIGRATIONS, 29);
    expect(at29.schema).toBe(29);
    const s = deserializeState(at29.sim);
    for (const sk of s.entities.comps.skills) {
      if (!sk) continue;
      expect(sk.camp).toEqual({ at: null, acc: 0, used: {}, sleepHour: -1 });
      delete (sk as { camp?: unknown }).camp;
    }
    delete (s as { travelers?: unknown }).travelers;
    expect(hashState(s)).toBe(f.expectedHash);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });
});
