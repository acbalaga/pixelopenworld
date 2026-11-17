# src/save

Local saves (POW-M1-09), sealed on the device by POW-M2-01.

## The envelope (M2-01)

`SecureCodec` is the codec the game uses. A save goes: `packSave` (tagged binary, one string table, varints) to gzip (`CompressionStream`) to AES-256-GCM with a fresh random 96-bit IV. Stored bytes are `header | iv | ciphertext`, the header bound as authenticated data. `loadDeviceKey` makes the AES key once per browser profile with `extractable = false` and keeps the `CryptoKey` object in IndexedDB, so script can use it but never read it. `checkSaveSupport` runs at boot; a browser without IndexedDB, gzip streams or non-extractable keys gets a message and no save, never a plaintext one.

- `SaveLedger` (`src/sim/ledger.ts`) holds lifetime totals the sim updates as value is created: coin earned and spent by source, XP per skill, items made by source, kills, crafts. A system that creates value reports to the ledger in the same ticket that adds it.
- The loader order is `latest`, `previous`, `old`, then `emergency` (written once by the crash handler, never in rotation). `LoadReport.chain` says whether the `prevHash` chain between the loaded snapshot and the one before it holds.
- `SecureCodec(key, true)` also opens the plain JSON saves M1 wrote (schema 2 and earlier). They migrate on load and are written back sealed by the next save.
- `src/ui/dom/saveNotices.ts` is the recover screen and the unsupported-browser message.

## Local snapshots (M1-09)

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
