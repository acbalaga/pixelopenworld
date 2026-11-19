import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { deserializeState, hashState, newMapState } from '../../src/sim/state';

describe('schema 23 to 24 migration (the map)', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-23.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };

  it('loads the previous fixture with an empty map and nothing else changed', async () => {
    expect(f.plain.schema).toBe(23);
    // The fixture was written before `map` existed.
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('map');
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const at24 = migrate(decoded, MIGRATIONS, 24);
    expect(at24.schema).toBe(24);
    const s = deserializeState(at24.sim);
    expect(s.map).toEqual(newMapState());
    // With the new field removed, the old hash comes back.
    delete (s as { map?: unknown }).map;
    expect(hashState(s)).toBe(f.expectedHash);
  });

  it('reaches the current schema and passes the integrity check', async () => {
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const now = migrate(decoded);
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons.map((r) => r.code)).not.toContain('MAP_STATE');
  });
});

describe('schema 24 to 25 migration (attuned Waystones)', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-24.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };

  it('loads the previous fixture with no stone attuned and nothing else changed', async () => {
    expect(f.plain.schema).toBe(24);
    expect(JSON.parse(f.plain.sim).map).not.toHaveProperty('waystones');
    const decoded = await new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));
    const at25 = migrate(decoded, MIGRATIONS, 25);
    expect(at25.schema).toBe(25);
    const s = deserializeState(at25.sim);
    expect(s.map.waystones).toEqual([]);
    delete (s.map as { waystones?: unknown }).waystones;
    expect(hashState(s)).toBe(f.expectedHash);
    expect(validateSave(migrate(decoded)).reasons.map((r) => r.code)).not.toContain('MAP_STATE');
  });
});
