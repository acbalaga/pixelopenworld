# Tech 02 Saves and security

## Goal, stated honestly

The owner's requirement: an encrypted save that cannot be edited by hand.

What this design delivers:

- A save file on disk or in an export **cannot be read or edited** without detection. Editing a byte makes it fail to load as Verified.
- Export files are portable between devices and are sealed by a key that never leaves Cloudflare.
- Replaying an old checkpoint to the server, or forging one, is rejected.
- Gains that are impossible for the elapsed time are flagged.

What no browser game can deliver, and this design does not claim:

- Preventing a technical player from changing values **in the running game's memory** with developer tools. The code and its state are on their device. The control here is detection by plausibility, with the result being an Unverified mark. Because the game is single-player and free, that is proportionate.

## Threat model

| # | Threat | Control | Residual |
|---|---|---|---|
| T1 | Edit local save in IndexedDB | AES-GCM with a non-extractable device key. Any change fails authentication. | None for file edits |
| T2 | Edit an exported save file | Ciphertext sealed by a Worker-held key, plus Ed25519 signature | None without the Worker secret |
| T3 | Craft a save from scratch | Cannot produce a valid signature | None |
| T4 | Copy someone else's export | Allowed. It is a backup feature. Lineage is recorded. | Accepted |
| T5 | Roll back to an older local snapshot to redo a roll | Sequence numbers and hash chain. Worker tracks highest signed sequence per save id. Older sequence loads as Unverified unless it arrives through the import flow. | Offline rollback before next sync is detected at sync |
| T6 | Change device clock to farm offline gains | Trusted time from the Worker. Monotonic guard offline. Cap on offline accumulation. | Bounded to one cap period per real sync |
| T7 | Modify live memory, then save | Plausibility rules on each checkpoint | Small edits inside plausible bounds pass. Accepted. |
| T8 | Call the API with forged digests | Digest is bound to save id, sequence, previous hash, and summary. Summary must pass plausibility against the previous signed summary. | Same as T7 |
| T9 | Abuse the API (flood, large bodies) | Rate limiting per IP and per save id, body size caps, strict schema validation | Cloudflare platform protections |
| T10 | Secret leakage | Secrets only in Worker secrets. Never in repo, client, or logs. Rotation procedure documented. | Operational |
| T11 | XSS or third-party script reads saves | Strict CSP, no third-party origins, no inline script, no `eval`. Clear text is rendered with `textContent`, never `innerHTML`. | Low |
| T12 | Browser evicts storage | Persistent storage request, export reminders, 3 rotating snapshots | Player may still lose data if they never export. UI says so. |

## Save anatomy

```
SavePlain = {
  schema: number,              // migration version
  saveId: string,              // random 128-bit id, created at avatar creation
  seq: number,                 // increments on every committed save
  prevHash: string,            // SHA-256 of the previous SavePlain's canonical bytes
  createdAt, trustedNow, playSeconds,
  sim: SimState,               // everything
  summary: SaveSummary         // compact numbers used for plausibility
}
```

`SaveSummary` is a small, fixed-shape object: play seconds, total skill points, per-skill ranks, coin, lifetime coin earned, counts of bosses resolved, fragments, chunks mapped, worker count, Routine assignments with their rates, last settlement time. It is derived from `sim` by a function in `shared/`.

### Local storage

1. Serialize `SavePlain` canonically (stable key order). Binary-pack the sim state.
2. Compress (`CompressionStream('gzip')`).
3. Encrypt with AES-256-GCM. The key is generated once per device with `crypto.subtle.generateKey(..., extractable = false)` and the `CryptoKey` object is stored in IndexedDB. The raw key bytes are never available to script.
4. Store `{ iv, ciphertext, seq, savedAt, signature? }` in IndexedDB.

Three rotating snapshots per save (latest, previous, and one from at least 30 minutes of play earlier), plus a separate emergency slot written by the crash handler. If the latest fails to decrypt, the loader falls back in order and tells the player what happened.

Autosave: on a timer (every 60 seconds of play), on entering or leaving buildings and dungeons, on Trial completion, on rare drops, on `visibilitychange` hidden, and on `pagehide`. Saves are written in a transaction so a killed tab cannot leave a half-written latest snapshot.

### Checkpoints (signing)

When online, after a save commits (throttled to at most once every 5 minutes, and always on manual "Save and verify"):

1. Client sends `{ saveId, seq, prevHash, hash, summary, clientTime }` to `POST /api/save/checkpoint`. The full save is not sent.
2. Worker loads the lineage row for `saveId` from D1: last signed `seq`, `hash`, `summary`, server time.
3. Worker checks: schema valid, `seq` greater than last, chain continuity (the client includes the chain of hashes since the last signed one, bounded length), and **plausibility** of `summary` against the last signed summary and the server-measured elapsed time.
4. If it passes, Worker signs `saveId | seq | hash | serverTime` with Ed25519, stores the new lineage row, returns the signature.
5. Client stores the signature with the snapshot. The public key is bundled with the client so signatures can be verified offline at load.

If plausibility fails, the Worker returns a reason code. The client marks the save Unverified and keeps playing. An Unverified save stays Unverified for good. It is never blocked or deleted (decision A7).

### Trust states

| State | Meaning | Shown as |
|---|---|---|
| Verified | Latest snapshot matches a valid signature | Solid seal glyph |
| Pending | Valid signed ancestor exists, newer unsigned saves made offline or between throttled checkpoints | Hollow seal |
| Unverified | A check failed, or the save has no valid signed ancestor | Cracked seal, with a plain explanation on tap |

Unverified has no gameplay effect. It is a visible, permanent, honest mark.

### Plausibility rules

One module in `src/shared/plausibility/`, imported by both client (to predict and to avoid false alarms) and Worker (authoritative). Rules are pure functions over `(previousSummary, nextSummary, elapsedTrustedSeconds)`.

Examples:
- `playSeconds` cannot grow by more than elapsed real seconds plus a small tolerance.
- Total skill points gained cannot exceed the maximum manual XP rate times play seconds, plus the Routine XP ceiling times elapsed.
- Coin gained cannot exceed the bound from kills, sales ceilings, and request rewards available in that time.
- Counts that only go up (bosses, fragments, chunks) cannot go down, and cannot rise faster than a physical ceiling (for example chunks mapped per minute at mount speed).
- Worker count and Routine rates must be consistent with skill ranks.

Bounds are generous (target: a legitimate player never trips one). Every bound is a named constant with a comment giving its derivation. A test suite replays recorded legitimate sessions and bot runs through the rules and requires zero flags.

Rules have a version. The Worker accepts the current and previous rule version so a client that has not updated yet is not flagged.

## Export and import

**Export** (`POST /api/save/export`, online only):

1. Client sends the compressed plaintext save over TLS along with its latest checkpoint signature.
2. Worker verifies the signature and that the save hashes to the signed hash.
3. Worker derives a per-save key with HKDF from the master export secret and `saveId`, encrypts with AES-256-GCM, and signs the envelope.
4. Returns a file: `pow-<handle>-<date>.powsave`. Format: magic bytes, format version, `saveId`, `seq`, trust state, iv, ciphertext, signature.

**Import** (`POST /api/save/import`, online only):

1. Client uploads the file.
2. Worker verifies the signature, decrypts, checks schema, and returns the plaintext save plus a fresh checkpoint signature. The lineage row records the import (an import of an older sequence is a legitimate restore and resets the lineage head to that sequence).
3. Client re-encrypts with the local device key and stores it.

An Unverified save can be exported and imported. It stays Unverified. The file carries the state inside the signed envelope.

Offline, export is unavailable and the UI says why. The local rotating snapshots cover offline safety.

Body cap: 4 MB compressed. The save design target is under 500 KB compressed at 200 hours.

## Trusted time

- `GET /api/time` returns server time. Client keeps `offset = serverTime - Date.now()` and the `performance.now()` at sync.
- The sim receives `trustedNow`. While the page is alive, it advances by `performance.now()` (monotonic), not by `Date`.
- Across sessions offline: `trustedNow = max(lastTrustedNow, Date.now() + lastOffset)`. If the device clock went backwards, elapsed is zero.
- Offline settlement accrues at most one cap period (8 to 12 hours) in total between two successful time syncs. A player offline for a week gets one cap period, not seven days' worth and not seven separate ones.

## Worker hardening

- Routes are an explicit allowlist. Unknown `/api/*` paths return 404.
- Methods enforced. `Content-Type` enforced. Body size checked before parsing.
- Every request body validated against a strict schema. Unknown fields rejected.
- Rate limits: per IP and per `saveId`, using Cloudflare's rate limiting binding. Checkpoint: 12 per hour per save. Export and import: 6 per hour per IP.
- Same-origin only. No CORS headers are sent. `Origin` is checked on POST.
- Responses carry `Cache-Control: no-store`.
- Errors return a short code. No stack traces, no internals.
- Logging: reason codes and counts only. No save contents, no IPs written to storage.
- Secrets (`SIGNING_KEY_ED25519`, `EXPORT_MASTER_KEY`) set with `wrangler secret`. A `docs/ops/secrets.md` runbook (written in POW-M2-09) covers generation, rotation with a key id field in envelopes so old files keep working, and what to do on suspected leak.

## Client hardening

Sent as headers on every static response:

- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` denying everything unused, `Cross-Origin-Opener-Policy: same-origin`, HSTS.

(If any style must be set dynamically, use CSSOM properties, not inline style attributes, so `style-src 'self'` holds.)

In code:
- No `innerHTML`, `eval`, `new Function`, or string timers. Lint rules enforce it.
- No third-party origins of any kind. Fonts are system fonts.
- Dependencies pinned with a lockfile. `npm audit` runs in CI. New dev dependencies need justification (see CLAUDE.md).
- Production builds strip `src/dev/`. Source maps are not deployed.

Obfuscation is not used. It adds no real protection and makes bugs harder to diagnose.

## Privacy

- No accounts, no names, no email, no analytics, no cookies.
- The only identifier is the random `saveId`. D1 holds, per save id: last sequence, last hash, last summary, timestamps, rule version, flags.
- Lineage rows untouched for 18 months are purged by a scheduled Worker.
- A short plain-language privacy note in System > Help says exactly this.

## D1 schema (initial)

```sql
CREATE TABLE save_lineage (
  save_id      TEXT PRIMARY KEY,
  seq          INTEGER NOT NULL,
  hash         TEXT NOT NULL,
  summary      TEXT NOT NULL,      -- JSON
  rule_version INTEGER NOT NULL,
  state        TEXT NOT NULL,      -- 'verified' | 'unverified'
  flags        TEXT,               -- JSON array of reason codes
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX idx_lineage_updated ON save_lineage(updated_at);
```

## Tests that must exist (POW-M2-09)

- Flip one byte in a local snapshot: load falls back to the previous snapshot and reports it.
- Flip one byte in an export: import is rejected.
- Replay an old checkpoint: rejected.
- Submit an implausible summary: flagged with the right reason code, save becomes Unverified, game continues.
- Move the device clock back and forward: settlement yields are bounded as specified.
- Kill the tab mid-save: latest or previous snapshot loads cleanly.
- Recorded legitimate sessions: zero flags.
