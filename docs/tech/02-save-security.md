# Tech 02 Saves and security

## Goal, stated honestly

The owner's requirement: an encrypted save that is not easy to crack and cannot be edited by hand, with no secrets to manage and no server-side save service.

This is a **client-only** scheme. Everything runs in the browser. There are no signing keys, no database, and no owner setup.

What it delivers:

- A save on the device or in an export file is compressed binary under AES-256-GCM. Opening it in a text or hex editor shows noise. Changing one byte makes it fail to load.
- A save that is decrypted, edited, and re-sealed by someone who has rebuilt the tooling still has to pass an integrity validator that cross-checks the state against itself and against what is possible in the recorded play time.
- Generic save editors and casual tinkering do not work.

What it does not deliver, and nothing client-only can:

- Protection against someone who reads the game's code, extracts the export key derivation, and writes their own tool. The key material ships with the game. That takes real effort and programming skill, which is the bar the owner asked for.
- Protection against editing values in the running game's memory with developer tools. The integrity validator catches the implausible cases.

Because the game is single-player and free, this is proportionate. A failed check marks the save. It never deletes or blocks it (decision A7).

## Threat model

| # | Threat | Control | Residual |
|---|---|---|---|
| T1 | Edit the local save in IndexedDB | AES-GCM with a non-extractable device key. Any change fails authentication. | None for file edits |
| T2 | Edit an export file in a hex or text editor | AES-GCM over a compressed binary payload, header bound as authenticated data | None for blind edits |
| T3 | Decrypt, edit, and re-seal an export | Key is derived at runtime from material split across the code, never stored whole. Integrity validator on every load. | Possible for a programmer who studies the bundle. Accepted. |
| T4 | Copy someone else's export | Allowed. It is a backup feature. | Accepted |
| T5 | Roll back to an older snapshot to redo a roll | Hash chain across local snapshots detects a broken sequence. Importing an older export is a legitimate restore. | Accepted |
| T6 | Change the device clock to farm offline gains | Trusted time from `/api/time` when online, monotonic guard offline, one cap period of accrual between time syncs | Bounded to one cap period |
| T7 | Modify live memory, then save | Integrity validator: internal consistency, ledgers, plausibility against play time | Small edits inside plausible bounds pass. Accepted. |
| T8 | XSS or a third-party script reads or alters saves | Strict CSP, no third-party origins, no inline script, no `eval`. Clear text rendered with `textContent`. | Low |
| T9 | Browser evicts storage | Persistent storage request, export reminders, 3 rotating snapshots | The player can still lose data if they never export. The UI says so. |

## Save anatomy

```
SavePlain = {
  schema: number,              // migration version
  saveId: string,              // random 128-bit id, created at avatar creation
  seq: number,                 // increments on every committed save
  prevHash: string,            // SHA-256 of the previous SavePlain's canonical bytes
  createdAt, trustedNow, playSeconds,
  sim: SimState,               // everything
  summary: SaveSummary,        // compact numbers used by the validator
  ledger: SaveLedger           // running lifetime totals
}
```

`SaveSummary` is a small fixed-shape object derived from `sim` by one function: play seconds, total skill points, per-skill ranks, coin, counts of bosses resolved, fragments, chunks mapped, worker count, Routine assignments with their rates, last settlement time.

`SaveLedger` holds lifetime totals that only ever grow and are updated by the sim as things happen: coin earned and coin spent by source, XP earned per skill, items created by source, kills, crafts. Current state must reconcile with the ledger (coin held equals earned minus spent).

The payload is a packed binary encoding of `SavePlain`, not JSON. Field names do not appear in the bytes.

### Local storage

1. Encode `SavePlain` to canonical binary.
2. Compress (`CompressionStream('gzip')`).
3. Encrypt with AES-256-GCM and a fresh random 96-bit IV. The key is generated once per device with `crypto.subtle.generateKey(..., extractable = false)` and the `CryptoKey` object is stored in IndexedDB. The raw key bytes are never available to script, so the local save cannot be decrypted outside this browser profile.
4. Store `{ iv, ciphertext, seq, savedAt }` in IndexedDB.

Three rotating snapshots per save (latest, previous, and one from at least 30 minutes of play earlier), plus an emergency slot written by the crash handler. If the latest fails to decrypt, the loader falls back in order and tells the player what happened.

Autosave: every 60 seconds of play, on entering or leaving buildings and dungeons, on Trial completion, on rare drops, on `visibilitychange` hidden, and on `pagehide`. Writes are transactional so a killed tab cannot leave a half-written latest snapshot.

### Integrity validator

One module, `src/save/integrity/`, run on every load (local or imported) and in dev builds on every save. Pure functions over `SavePlain`. Three layers:

1. **Consistency.** The stored summary equals the summary recomputed from `sim`. Derived values match their sources (pool maxima follow skill ranks, rank follows XP, banked XP sits at a threshold only if that Trial is unpassed). Every id exists in content. Counts are inside hard caps (stack sizes, worker slots, worn Paths).
2. **Ledger.** Current state reconciles with lifetime totals. Coin held equals earned minus spent. XP held never exceeds XP earned. Items that can only come from one source (boss drops, Trial rewards, Masterwork crafts) have a matching ledger entry and the matching flag (boss resolved, Trial passed).
3. **Plausibility.** Totals are possible in the recorded play time and trusted elapsed time: skill points against maximum XP rates, lifetime coin against earn ceilings, chunks mapped against travel speed, Routine output against recorded assignments and elapsed time.

Bounds are generous. A legitimate player must never trip one. Every bound is a named constant with a comment giving its derivation, computed from `content/balance/` where possible so bounds cannot drift from the game. A test suite replays recorded legitimate sessions and bot runs and requires zero flags.

When a system is added that creates value (a new income source, a new item source), its ticket adds the ledger entries and validator rules for it.

### Trust states

| State | Meaning | Shown as |
|---|---|---|
| Intact | Decrypted cleanly, hash chain continuous, validator passed | Solid seal glyph |
| Flagged | The validator failed, or the snapshot chain is broken | Cracked seal, with a plain explanation on tap |

Flagged has no gameplay effect. It is stored inside the save, it is permanent, and it travels with exports.

## Export and import

Both work offline. Export is how a save moves between devices, so it cannot use the device key.

**Seal key.** Derived at runtime, never stored as a literal:

- Seal material is a set of byte fragments that live in separate modules and are combined through HKDF-SHA-256 at the moment of use. Generated once by a tool in `tools/` and committed.
- Per file: a random 16-byte salt. PBKDF2-SHA-256 (at least 150,000 iterations) over the combined material and salt gives the AES-256-GCM key.
- A `sealVersion` in the file header selects the material. Rotating to new material keeps the old version available for import, so old backups always open.

**File format** (`pow-<handle>-<date>.powsave`, binary): magic bytes, format version, seal version, salt, IV, ciphertext. The header is bound as AES-GCM additional authenticated data. The plaintext is the same compressed binary `SavePlain` used locally.

**Export:** encode, compress, seal, download through an object URL.

**Import:** parse the header strictly, derive the key, decrypt, decompress, validate the schema, migrate if the schema is older, run the integrity validator, then show a confirmation naming the handle, play time, date, and trust state found inside the file. On confirm, the current save is kept as a snapshot and the imported save is re-encrypted under the device key.

Size cap on import: 4 MB. The design target is under 500 KB compressed at 200 hours.

**Optional hardening, not required.** The seal material can be injected at build time from a build variable instead of being read from the repo, so that it is absent from source control. The bundle still contains it. This is worth doing only if the repository is public and the owner wants to raise the bar slightly. It needs no code change beyond the build step, which the M2 ticket provides as an off-by-default switch.

## Trusted time

- `GET /api/time` returns server time. It is the only API the game uses, it needs no configuration, and the game works without it.
- When online, the client keeps `offset = serverTime - Date.now()` and the `performance.now()` at sync.
- The sim receives `trustedNow`. While the page is alive it advances by `performance.now()` (monotonic), not by `Date`.
- Across sessions offline: `trustedNow = max(lastTrustedNow, Date.now() + lastOffset)`. If the device clock went backwards, elapsed is zero.
- Offline settlement accrues at most one cap period (8 to 12 hours) in total between two successful time syncs. A player offline for a week gets one cap period.

## Client hardening

Sent as headers on every static response:

- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` denying everything unused, `Cross-Origin-Opener-Policy: same-origin`, HSTS.

(If any style must be set dynamically, use CSSOM properties, not inline style attributes, so `style-src 'self'` holds.)

In code:

- No `innerHTML`, `eval`, `new Function`, or string timers. Lint rules enforce it.
- No third-party origins of any kind. Fonts are system fonts.
- Dependencies pinned with a lockfile. `npm audit` runs in CI.
- Production builds are minified, strip `src/dev/`, and do not deploy source maps. Dev-only cheats and state editors do not exist in production code paths.
- Sim state is held in module scope, not on `window`. Nothing useful is reachable from the console by name.

Heavy code obfuscation is not used. It slows the game on phones and makes bugs harder to diagnose, for a small gain over minification.

## The Worker

One small Cloudflare Worker serves the static site and two routes: `GET /api/health` and `GET /api/time`. Unknown `/api/*` paths return 404. Responses carry `Cache-Control: no-store`. It has no secrets, no database, and no bindings beyond static assets.

## Privacy

- No accounts, no names, no email, no analytics, no cookies.
- Saves never leave the device unless the player exports a file.
- The server stores nothing about players.
- A short plain-language privacy note in System > Help says exactly this.

## Tests that must exist (POW-M2-06)

- Flip one byte in a local snapshot: load falls back to the previous snapshot and reports it.
- Flip one byte anywhere in an export (header, salt, IV, ciphertext): import is rejected.
- The stored local record and the export file contain no readable game strings.
- A save re-sealed with a correct key but an edited value (coin plus one million, a skill set to 100, a boss drop with no boss flag) loads as Flagged with the right reason code, and the game continues.
- Break the snapshot hash chain: Flagged.
- Move the device clock back and forward: settlement yields are bounded as specified.
- Kill the tab mid-save: latest or previous snapshot loads cleanly.
- An export sealed with an older `sealVersion` still imports.
- Recorded legitimate sessions: zero flags.
