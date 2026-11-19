import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { findAvatar } from '../../src/shared/summary';
import { deserializeState, hashState } from '../../src/sim/state';

describe('schema 23 to 24 migration (the Bestiary)', () => {
  it('loads the previous fixture, gains an empty bestiary and keeps everything else', async () => {
    const f = JSON.parse(
      readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-23.json'), 'utf8'),
    ) as { plain: SavePlain; expectedHash: string };
    expect(f.plain.schema).toBe(23);
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    const s = deserializeState(now.sim);
    const j = s.entities.comps.journal[findAvatar(s)!]!;
    expect(j.bestiary).toEqual({});
    // Nothing else changed: with the new field removed the old hash comes back.
    delete (j as { bestiary?: unknown }).bestiary;
    expect(hashState(s)).toBe(f.expectedHash);
    expect(validateSave(now).reasons).toEqual([]);
    expect(Object.keys(MIGRATIONS).map(Number)).toContain(23);
  });
});
