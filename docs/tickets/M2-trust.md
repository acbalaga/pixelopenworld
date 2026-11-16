# M2 Trust: save security and PWA

**Result:** saves are encrypted on the device, signed by the Worker, exportable and importable as sealed files, and the game installs and plays offline.

**Gate G2:** editing a save file by hand cannot produce a Verified save. Offline play for a week, then reconnecting, works and stays Verified for honest play.

Every executor on this milestone reads tech/02-save-security in full first.

---

### POW-M2-01 Save envelope and local encryption
Size: L      Depends: M1-09      Status: READY
Refs: tech/02-save-security (Save anatomy, Local storage, Trust states)

Goal: local saves are compressed, encrypted with a device-bound key, and chained.

Scope:
- Device key: AES-256-GCM `CryptoKey` generated non-extractable, stored in IndexedDB. Created on first run.
- Save path: canonical bytes, gzip via `CompressionStream`, AES-GCM with a fresh random 96-bit IV per save, store `{ iv, ciphertext, seq, savedAt, signature? }`.
- Load path: decrypt, decompress, validate schema, verify `prevHash` chain between snapshots when both are present.
- Hash chain: `prevHash` is SHA-256 of the previous `SavePlain` canonical bytes. Keep a bounded list of hashes since the last signed checkpoint.
- Migration from M1's unencrypted saves (schema bump, fixture, test).
- Emergency slot for the crash handler. Recover screen that explains what was loaded.
- Fallback when `CompressionStream` or non-extractable keys are unavailable: detect at boot and show a clear unsupported-browser message. Do not silently store plaintext.
- Serialization off the main thread or sliced to stay inside the 50 ms budget.

Acceptance:
- Unit: round trip is exact. A flipped byte in ciphertext or IV fails authentication and triggers snapshot fallback with a user-visible notice.
- Unit: the stored key reports `extractable === false` and `exportKey` rejects.
- The IndexedDB record contains no readable game strings (test searches the stored bytes for known item ids).
- Save time measured under budget with a synthetic 200-hour-sized state.
- M1 fixture migrates.

---

### POW-M2-02 Worker API skeleton
Size: M      Depends: M0-03      Status: READY
Refs: tech/02-save-security (Worker hardening, Privacy, D1 schema), tech/01-architecture (Networking)

Goal: a hardened request pipeline that the save endpoints plug into.

Scope:
- Check current Cloudflare docs for D1, the rate limiting binding, and the Workers Vitest pool before writing config. Name the pages in the PR.
- Router with an explicit route table. Method, `Content-Type`, `Origin`, and body size enforcement before parsing.
- Strict schema validation helper for request bodies (hand-written validators in `shared/` so client and Worker share them, unknown fields rejected).
- Error model: `{ error: { code } }` with a fixed list of codes. No internals in responses.
- Rate limiting per IP and per `saveId` with the limits from tech/02.
- D1 binding and the `save_lineage` migration. A small data access module.
- `GET /api/time` returning server epoch milliseconds.
- Logging helper that records only route, status, and reason code.
- Worker tests running in the Workers test pool.

**Owner action:** create the D1 database and rate limit configuration as described in an updated `docs/ops/deploy.md`.

Acceptance:
- Tests: wrong method 405, wrong content type 415, oversized body 413, unknown field 400, foreign `Origin` 403, over rate limit 429, unknown route 404.
- No response in any test contains a stack trace or binding name.
- `/api/time` responds and is `no-store`.

---

### POW-M2-03 Checkpoint signing
Size: L      Depends: M2-01, M2-02      Status: READY
Refs: tech/02-save-security (Checkpoints, Trust states, Threat model T3, T5, T8)

Goal: the Worker signs honest save checkpoints and the client verifies signatures offline.

Scope:
- Ed25519 key pair. Private key as a Worker secret, with a key id. Public keys (current and previous) bundled into the client build from a committed file.
- `POST /api/save/checkpoint`: validate body, load lineage, check `seq` is greater than the last signed, check hash chain continuity from the last signed hash through the provided chain to the new hash, call the plausibility module (stubbed to "pass" here, real rules in M2-04), sign `keyId | saveId | seq | hash | serverTime`, upsert lineage, return signature and server time.
- First checkpoint for an unknown `saveId` creates the lineage row (bounded by starting-state rules: play seconds and totals must be near a fresh save, or the save is recorded as Unverified).
- Client: checkpoint scheduler (after commit, throttled to 5 minutes, immediate on manual "Save and verify"), store the signature with the snapshot, verify signatures at load using Web Crypto.
- Trust state computation (Verified, Pending, Unverified) and the seal glyph in System and on the title screen, with a plain explanation on tap.
- A script in `tools/` to generate a key pair and print the `wrangler secret` commands.

**Owner action:** generate and set `SIGNING_KEY_ED25519`.

Acceptance:
- Worker tests: valid checkpoint signs. Replayed old `seq` is rejected. Broken chain is rejected. Signature verifies with the public key and fails if any signed field changes.
- Client tests: a snapshot with a valid signature loads as Verified. Newer unsigned snapshots load as Pending. A signature that does not verify loads as Unverified.
- E2E against the local Worker: play, checkpoint, reload, Verified.

---

### POW-M2-04 Plausibility engine
Size: L      Depends: M2-03      Status: READY
Refs: tech/02-save-security (Plausibility rules, Threat model T7), design/06-automation (Abuse limits)

Goal: impossible progress is flagged, honest progress never is.

Scope:
- `shared/plausibility/`: pure rule functions over `(prevSummary, nextSummary, elapsedTrustedSeconds, ruleVersion)` returning pass or a list of reason codes.
- Rules for everything that exists after M1: play seconds against elapsed, skill points per play second (per skill and total), coin delta against earn ceilings, monotonic counters, inventory value sanity, attribute maxima consistent with skill ranks.
- Every bound is a named constant with a derivation comment tied to `content/balance/` values. Where possible bounds are computed from balance data so they cannot drift.
- Rule versioning: Worker accepts current and previous version.
- Worker integration: on failure, mark the lineage row Unverified with flags and return the reason codes with HTTP 200 and `state: 'unverified'`. Client marks the save and continues.
- Client-side pre-check (same module) used only in dev builds to warn developers when a legitimate change would trip a rule.
- A recorded-session harness: the sim bot (or scripted runs) produces summary sequences that are replayed through the rules.

Acceptance:
- Unit tests per rule: just inside the bound passes, just outside flags with the right code.
- Recorded legitimate sessions (at least 3 scripted runs of 30+ simulated minutes, including an offline gap) produce zero flags.
- A hand-edited summary (coin plus one million) is flagged. The game keeps running and shows the cracked seal.
- A doc comment at the top of the module tells future executors how to add a rule when they add a system.

---

### POW-M2-05 Export and import
Size: L      Depends: M2-03      Status: READY
Refs: tech/02-save-security (Export and import, Threat model T2, T4)

Goal: a player can back up to a sealed file and restore on any device.

Scope:
- `EXPORT_MASTER_KEY` Worker secret with a key id. HKDF-SHA-256 per-save key derivation with `saveId` as info.
- `POST /api/save/export`: verify checkpoint signature and that the uploaded save hashes to it (or that the save is Unverified and say so in the envelope), encrypt with AES-256-GCM, build the `.powsave` envelope (magic, format version, key ids, `saveId`, `seq`, trust state, iv, ciphertext), sign the envelope, return it.
- `POST /api/save/import`: parse envelope strictly, verify signature, decrypt, validate schema, record the import in lineage (reset head to the imported `seq`), return the plaintext save and a fresh checkpoint signature.
- Client UI in System: Export (downloads the file via an object URL), Import (file picker, confirmation that names the handle, play time, and date inside the file before replacing the current save, current save is kept as a snapshot).
- Export reminder after 5 hours of play since the last export, dismissible.
- Offline: both actions disabled with an explanation.
- Body cap 4 MB.

**Owner action:** generate and set `EXPORT_MASTER_KEY`.

Acceptance:
- Worker tests: round trip export then import returns the identical save. One flipped byte anywhere in the file is rejected. A file signed with an unknown key id is rejected. An Unverified save round-trips as Unverified.
- The export file contains no readable game strings.
- E2E: export in one browser profile, import in a fresh profile, state hash matches and the save is Verified.
- Importing never destroys the current save without an explicit confirm, and the replaced save remains recoverable from a snapshot.

---

### POW-M2-06 Offline queue and reconnect
Size: M      Depends: M2-03, M2-04      Status: READY
Refs: tech/02-save-security (Checkpoints, Trust states)

Goal: playing offline is normal, and verification catches up cleanly afterward.

Scope:
- `platform/network.ts`: online state from actual request outcomes (not only `navigator.onLine`), exponential backoff with jitter, a single in-flight checkpoint at a time.
- While offline: saves continue locally, hash chain accumulates (bounded, with a documented behavior when the bound is exceeded: the chain is summarized by intermediate signed-less anchors and the Worker falls back to summary plausibility over the whole gap).
- On reconnect: time sync first, then one checkpoint covering the gap.
- Trust glyph shows Pending during the gap and returns to Verified after.
- No error dialogs for network failure. A small offline glyph in System only.

Acceptance:
- E2E with network blocked: play, save several times, reload offline (still loads, Pending), unblock, checkpoint succeeds, Verified.
- Unit: backoff schedule, single-flight, chain bound behavior.
- A simulated week-long offline gap with plausible progress verifies. The same gap with implausible progress flags.

---

### POW-M2-07 Trusted time
Size: M      Depends: M2-02      Status: READY
Refs: tech/02-save-security (Trusted time, Threat model T6), design/06-automation (Offline gains), design/02-world (Time)

Goal: the world clock cannot be pushed around by the device clock.

Scope:
- `platform/clock.ts`: sync with `/api/time`, keep offset and a monotonic anchor, expose `trustedNow()`.
- Cross-session rule: `max(lastTrustedNow, Date.now() + lastOffset)`. Backwards clock gives zero elapsed.
- Accrual budget: track "offline accrual used since last successful sync" in the save. At most one cap period accrues between syncs.
- The sim receives `trustedNow` through tick input only.
- The in-game clock (48 minute day) derives from trusted time and the save's epoch. Show the real in-game time on the HUD clock.
- Expose elapsed-since-last-session for the future settlement (M7). For now it drives only the world clock.

Acceptance:
- Unit tests with a fake `Date` and fake `performance`: forward jump, backward jump, sync after jump, multiple offline sessions between syncs respect the one-cap rule.
- In-game time of day continues correctly across a reload and across an offline period.
- No call to `Date.now()` exists outside `platform/clock.ts` (lint rule).

---

### POW-M2-08 Installable offline PWA
Size: M      Depends: M0-03, M2-01      Status: READY
Refs: tech/01-architecture (PWA), tech/03-asset-pipeline (Icons and PWA assets)

Goal: add to home screen, launch full screen, play with no connection.

Scope:
- Web app manifest (name, short name, portrait-primary preferred but not locked, display standalone, theme and background colors from the palette, icons including maskable) generated by the bake from the pixel emblem.
- Hand-written service worker: versioned precache of the app shell and core atlases, cache-first for hashed assets and chunk files, network-only for `/api/*`, navigation fallback to the cached shell.
- Update flow: new version installs in the background, activates on next launch, never mid-session. A small "updated" note on the title screen.
- `navigator.storage.persist()` requested at a sensible moment (after the first Trial or 15 minutes of play) with a one-line reason. Result shown in System.
- An install hint in System (platform-appropriate instructions, since iOS has no install prompt API).
- CSP updated only as needed for the service worker (`worker-src 'self'`).

Acceptance:
- Lighthouse (or equivalent manual checklist) installability passes.
- E2E: load once online, go offline, reload, the game boots and a saved game loads.
- Deploying a new version while a session is open does not change code mid-session. Next launch runs the new version.
- Chunk and atlas requests are served from cache on repeat visits (evidence from the network panel or a test).

---

### POW-M2-09 Security hardening and tamper test suite
Size: M      Depends: M2-01 to M2-08      Status: READY
Refs: tech/02-save-security (all, especially Tests that must exist), tech/04-quality (CI)

Goal: the security claims are tested, documented, and reviewable.

Scope:
- Implement every test in "Tests that must exist" not already covered.
- A `tools/tamper` script for the owner: takes an export file or a local snapshot dump and applies common hand-edit attempts, showing each is rejected.
- CSP and header verification test against the built site. A CSP violation reporter in dev builds that fails e2e on any violation.
- Dependency review: confirm zero runtime dependencies, lockfile integrity, `npm audit` clean or exceptions documented.
- `docs/ops/secrets.md`: generating keys, setting secrets, rotation with key ids (old files keep working), what to do if a secret leaks.
- `docs/ops/gate-g2.md`: owner checklist. Try to edit a save, try the clock trick, play offline for days, export and import across two devices.
- Privacy note text in System > Help, matching tech/02 "Privacy".
- Scheduled Worker (cron) that purges lineage rows untouched for 18 months.
- A short written security review in the PR: each threat T1 to T12, the control, the test that proves it, residual risk.

**Owner action:** run the G2 checklist.

Acceptance:
- All tamper tests pass in CI.
- The security review table is complete, with a test reference for every control that can be tested.
- Ops docs exist and a rotation dry run on the local Worker succeeds (old export still imports after rotating to a new key id).
