# M2 Trust: save security and PWA

**Result:** saves are encrypted on the device, checked for integrity on every load, exportable and importable as sealed files, and the game installs and plays offline. Everything is client-side. No secrets, no database, no owner setup.

**Gate G2:** opening or editing a save file by hand does not work. Offline play for a week loads cleanly and stays Intact for honest play.

Every executor on this milestone reads tech/02-save-security in full first.

---

### POW-M2-01 Save envelope and local encryption

Size: L Depends: M1-09 Status: READY
Refs: tech/02-save-security (Save anatomy, Local storage, Trust states)

Goal: local saves are packed binary, compressed, encrypted with a device-bound key, and chained.

Scope:

- Binary encoding of `SavePlain` (schema-driven, no field names in the output). Round-trip exact. Replaces M1's serialization behind the same interface.
- Device key: AES-256-GCM `CryptoKey` generated non-extractable, stored in IndexedDB. Created on first run.
- Save path: encode, gzip via `CompressionStream`, AES-GCM with a fresh random 96-bit IV per save, store `{ iv, ciphertext, seq, savedAt }`.
- Load path: decrypt, decompress, validate schema, verify the `prevHash` chain between snapshots when both are present.
- `SaveLedger` added to the save, with the sim updating it for the value sources that exist after M1 (coin by source, XP per skill, items by source, kills, crafts).
- Migration from M1's unencrypted saves (schema bump, fixture, test). The ledger for a migrated save is seeded from current state.
- Emergency slot for the crash handler. Recover screen that explains what was loaded.
- When `CompressionStream` or non-extractable keys are unavailable: detect at boot and show a clear unsupported-browser message. Never silently store plaintext.
- Serialization off the main thread or sliced to stay inside the 50 ms budget.

Acceptance:

- Unit: round trip is exact. A flipped byte in ciphertext or IV fails authentication and triggers snapshot fallback with a user-visible notice.
- Unit: the stored key reports `extractable === false` and `exportKey` rejects.
- The IndexedDB record contains no readable game strings (test searches the stored bytes for known item ids and field names).
- Save time measured under budget with a synthetic 200-hour-sized state.
- The M1 fixture migrates.

---

### POW-M2-02 Integrity validator

Size: L Depends: M2-01 Status: READY
Refs: tech/02-save-security (Integrity validator, Trust states, Threat model T3, T5, T7), design/06-automation (Abuse limits)

Goal: an edited save is recognized, an honest save never is.

Scope:

- `src/save/integrity/`: pure functions over `SavePlain` returning pass or a list of reason codes. Three layers per tech/02: consistency, ledger, plausibility.
- Rules for everything that exists after M1: summary equals recomputed summary, pools follow ranks, rank follows XP, banked XP rules, ids exist, hard caps, coin reconciles with the ledger, XP held against XP earned, source-locked items have their ledger entry and flag, skill points and lifetime coin against play time, play seconds against trusted elapsed time.
- Every bound is a named constant with a derivation comment. Compute bounds from `content/balance/` values where possible.
- Run on every load and every import. In dev builds also run on every save and warn loudly, so developers find out when a legitimate change would trip a rule.
- Trust state (Intact, Flagged) stored inside the save, permanent once Flagged. Seal glyph in System and on the title screen, with a plain explanation on tap. No gameplay effect.
- Snapshot hash-chain break sets Flagged.
- A recorded-session harness: scripted runs produce saves at intervals that are replayed through the validator.
- A doc comment at the top of the module tells future executors how to add ledger entries and rules when they add a system that creates value.

Acceptance:

- Unit tests per rule: just inside the bound passes, just outside flags with the right code.
- Recorded legitimate sessions (at least 3 scripted runs of 30+ simulated minutes, including an offline gap) produce zero flags.
- Hand-edited states are flagged: coin plus one million, a skill set to 100, an item that only a boss drops with no boss flag, a summary that disagrees with the sim.
- A Flagged save loads, plays, saves, and stays Flagged.

---

### POW-M2-03 Sealed export and import

Size: L Depends: M2-02 Status: READY
Refs: tech/02-save-security (Export and import, Threat model T2, T3, T4)

Goal: a player can back up to a sealed file and restore on any device, offline.

Scope:

- `tools/gen-seal-material`: generates the seal fragments for a `sealVersion` and writes them into separate modules under `src/save/seal/`. Run once, output committed.
- Seal key derivation per tech/02: fragments combined through HKDF-SHA-256 at the moment of use, then PBKDF2-SHA-256 (at least 150,000 iterations) with a random 16-byte per-file salt. The combined material and the derived key are never stored in a variable that outlives the operation, and never appear as a literal.
- `.powsave` binary format: magic, format version, seal version, salt, IV, ciphertext. Header bound as additional authenticated data. Strict parser that rejects anything unexpected, with a 4 MB cap.
- Export: download through an object URL. Import: file picker, decrypt, decompress, schema validate, migrate, run the integrity validator, confirmation that names the handle, play time, date, and trust state inside the file. The replaced save is kept as a snapshot.
- Support for multiple seal versions on import. A second version is generated in a test to prove old files still open.
- Export reminder after 5 hours of play since the last export, dismissible.
- Key derivation runs off the main thread or shows progress, since PBKDF2 takes a noticeable moment on phones.
- Off-by-default build switch that reads seal material from a build variable instead of the committed modules (tech/02, optional hardening). Documented in `docs/ops/deploy.md`.

Acceptance:

- Round trip export then import returns the identical save (state hash equal).
- One flipped byte anywhere in the file (header, salt, IV, ciphertext) is rejected with a clear message.
- The export file contains no readable game strings.
- A file sealed with version 1 imports after version 2 becomes current.
- The built bundle does not contain the combined seal material or the derived key as a contiguous byte or string literal (a build check searches for it).
- E2E: export in one browser profile, import in a fresh profile with the network blocked, state hash matches and the save is Intact.
- Importing never destroys the current save without an explicit confirm, and the replaced save remains recoverable.

---

### POW-M2-04 Trusted time

Size: M Depends: M0-03, M2-01 Status: READY
Refs: tech/02-save-security (Trusted time, The Worker, Threat model T6), design/06-automation (Offline gains), design/02-world (Time)

Goal: the world clock cannot be pushed around by the device clock.

Scope:

- Worker: `GET /api/time` returning server epoch milliseconds, `no-store`. No bindings, no secrets.
- `platform/clock.ts`: sync with `/api/time` when reachable, keep offset and a monotonic anchor, expose `trustedNow()`. Network failure is silent and normal.
- Cross-session rule: `max(lastTrustedNow, Date.now() + lastOffset)`. Backwards clock gives zero elapsed.
- Accrual budget: track "offline accrual used since last successful sync" in the save. At most one cap period accrues between syncs.
- The sim receives `trustedNow` through tick input only.
- The in-game clock (48 minute day) derives from trusted time and the save's epoch. Show the real in-game time on the HUD clock.
- Expose elapsed-since-last-session for the future settlement (M7). For now it drives only the world clock.

Acceptance:

- Unit tests with a fake `Date` and fake `performance`: forward jump, backward jump, sync after jump, multiple offline sessions between syncs respect the one-cap rule.
- In-game time of day continues correctly across a reload and across an offline period.
- The game boots and plays with `/api/time` unreachable.
- No call to `Date.now()` exists outside `platform/clock.ts` (lint rule).

---

### POW-M2-05 Installable offline PWA

Size: M Depends: M0-03, M2-01 Status: READY
Refs: tech/01-architecture (PWA), tech/03-asset-pipeline (Icons and PWA assets)

Goal: add to home screen, launch full screen, play with no connection.

Scope:

- Web app manifest (name, short name, portrait-primary preferred but not locked, display standalone, theme and background colors from the palette, icons including maskable) generated by the bake from the pixel emblem.
- Hand-written service worker: versioned precache of the app shell and core atlases, cache-first for hashed assets and chunk files, network-only for `/api/*`, navigation fallback to the cached shell.
- Update flow: new version installs in the background, activates on next launch, never mid-session. A small "updated" note on the title screen.
- `navigator.storage.persist()` requested at a sensible moment (after the first Trial or 15 minutes of play) with a one-line reason. Result shown in System.
- An install hint in System (platform-appropriate instructions, since iOS has no install prompt API).

Acceptance:

- Installability checklist passes (Lighthouse or equivalent manual list).
- E2E: load once online, go offline, reload, the game boots and a saved game loads.
- Deploying a new version while a session is open does not change code mid-session. Next launch runs the new version.
- Chunk and atlas requests are served from cache on repeat visits.

---

### POW-M2-06 Hardening and tamper test suite

Size: M Depends: M2-01 to M2-05 Status: READY
Refs: tech/02-save-security (all, especially Tests that must exist), tech/04-quality (CI)

Goal: the security claims are tested, documented, and reviewable.

Scope:

- Implement every test in "Tests that must exist" not already covered.
- `tools/tamper`: takes an export file and applies common hand-edit attempts (byte flips, truncation, header edits, splicing two files), showing each is rejected. Also re-seals a deliberately edited state with the real key to show the validator flags it.
- CSP and header verification test against the built site. A CSP violation reporter in dev builds that fails e2e on any violation.
- Production build checks: no source maps deployed, no `src/dev/` code, no sim state reachable from `window`.
- Dependency review: zero runtime dependencies, lockfile integrity, `npm audit` clean or exceptions documented.
- `docs/ops/gate-g2.md`: owner checklist. Open a save file in a text editor, try to edit it, try the clock trick, play offline for days, export and import across two devices.
- Privacy note text in System > Help, matching tech/02 "Privacy".
- A short written security review in the PR: each threat T1 to T9, the control, the test that proves it, residual risk stated plainly.

**Owner action:** run the G2 checklist.

Acceptance:

- All tamper tests pass in CI.
- The security review table is complete, with a test reference for every control that can be tested.
- The G2 checklist exists and is specific.
