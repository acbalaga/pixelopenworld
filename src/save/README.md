# src/save

Local saves (POW-M1-09). Shaped so M2 only adds the envelope: encoding, compression, encryption and the integrity check go behind `SaveCodec`, and callers never see them.

- `SaveManager` is the front door: `commit()` writes a snapshot, `load()` returns the newest one that reads cleanly.
- Three rotating snapshots: `latest`, `previous`, and `old` (the newest snapshot at least 30 minutes older than `latest`). A snapshot that fails to load is copied to `quarantine`, never deleted.
- Every write is one atomic `replaceAll` over all slots (one IndexedDB transaction), so a tab killed mid-save leaves the previous records.
- `SavePlain.sim` is the canonical text from `serializeState`, so `hashState` of a loaded state equals the saved one.
- Settings are not part of the save (tech/01).

## Changing saved state: migrations

Any change to what `serializeState` writes, or to `SavePlain`, is a schema change.

1. Bump `CURRENT_SCHEMA` in `types.ts`.
2. Add `MIGRATIONS[oldSchema] = (old) => ({ ...old, schema: oldSchema + 1, /* upgrade fields */ })` in `migrations.ts`.
3. Commit a fixture of the old schema under `tests/fixtures/saves/schema-N.json`. Do not regenerate old fixtures.
4. Add a case to `tests/unit/save.test.ts` that loads the fixture through `migrate`, then checks the upgraded fields and that `deserializeState` works on the result.
