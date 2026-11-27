# Tech 04 Quality

## Performance budgets

Reference device: a mid-range Android phone from about 2021 (4 GB RAM class) in Chrome, and an iPhone of similar age in Safari. Budgets are checked on real devices at gates and by automated proxies in CI.

| Metric         | Budget                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Frame rate     | 60 fps render in a busy hub (30 entities, weather, UI open). Never below 45.                                           |
| Sim tick cost  | Under 6 ms average, under 12 ms worst case at 30 Hz                                                                    |
| Render cost    | Under 8 ms per frame                                                                                                   |
| Garbage        | No allocations in per-frame hot paths. No GC pause over 10 ms during play.                                             |
| Memory         | Under 150 MB total in a long session. No growth over a 60 minute soak.                                                 |
| Boot JS        | Under 450 KB gzip for shell plus core game (raised from 300 KB by the owner on 2026-11-27; see POW-M8-00)              |
| First playable | Under 2 MB transferred. Under 4 seconds on a mid-range phone on a 4G-class connection, repeat visit under 1.5 seconds. |
| Region pack    | Under 1.5 MB compressed each                                                                                           |
| Save size      | Under 500 KB compressed at 200 hours                                                                                   |
| Save time      | Under 50 ms on the main thread (serialize in slices or in a Web Worker)                                                |
| Input latency  | Touch to visible response under 100 ms                                                                                 |
| Battery        | 30 minutes of play uses under 8% on the reference device. Frame rate cap option (30 fps) in settings.                  |

CI enforces bundle size and runs a headless sim benchmark (tick cost over a recorded busy scene) with a regression threshold.

## Testing

| Level     | Tool                                         | What it covers                                                                                                                                                                                    |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | Vitest                                       | Pure functions: formulas, integrity rules, settlement, migrations, text rule, RNG                                                                                                                 |
| Sim       | Vitest                                       | Scripted scenarios run headless: a fight plays out as expected, a Routine yields the right amount, a Traveler schedule holds. Determinism test: same seed and commands give identical state hash. |
| Content   | `tools/validate-content`                     | Schema and cross-reference integrity for all data                                                                                                                                                 |
| Save      | Vitest                                       | Encryption round trips, seal and import, every integrity rule, the tamper cases in tech/02                                                                                                        |
| E2E smoke | Playwright, mobile viewport, touch emulation | Boot, log in, move, fight, open Menu, save, reload, state persists. Runs against the built site with the Worker.                                                                                  |
| Visual    | Playwright screenshots                       | Key screens captured and attached to PRs. Not pixel-diff gated early on. From M12, golden images for UI panels.                                                                                   |
| Soak      | Sim bot                                      | Hours of simulated play for memory growth, save size growth, plausibility false positives, pacing numbers                                                                                         |

Rules:

- A new sim system ships with scenario tests for its rules.
- A bug fix ships with a test that failed before the fix.
- Tests never depend on wall-clock time or real randomness.
- Save migrations are tested against committed fixtures of every prior schema version.

## CI (GitHub Actions)

On every PR:

1. Install with the lockfile (`npm ci`).
2. Lint (including sim purity and banned API rules).
3. Typecheck.
4. Validate content.
5. Bake, then fail if `baked/` differs from the commit.
6. Unit, sim, and save tests.
7. Build. Check bundle budgets.
8. E2E smoke with screenshots uploaded as artifacts.
9. `npm audit` at high severity.

Deployment is not done by GitHub Actions. Cloudflare's Git integration builds and deploys `main` to production and gives each PR branch a preview URL. No Cloudflare credentials are stored in GitHub.

## Device matrix

Checked by the owner at gates. Minimum set:

| Device class                 | Browser                              |
| ---------------------------- | ------------------------------------ |
| Recent iPhone                | Safari, and installed to home screen |
| Older iPhone (about 5 years) | Safari                               |
| Mid-range Android            | Chrome, and installed                |
| Low-end Android              | Chrome                               |
| Tablet                       | Either                               |
| Desktop                      | Chrome, Firefox, Safari              |

Known platform hazards to test explicitly: iOS audio unlock and interruption, iOS storage eviction for sites not installed to the home screen, safe-area insets, address bar resize, 120 Hz displays (the loop must not assume 60), back gesture and swipe navigation conflicts, low power mode throttling timers, tab discard and restore.

## Code standards

- TypeScript strict. No `any` without a comment explaining why.
- Small modules with one job. A system file over about 400 lines is a sign to split.
- Names from the design docs. If the doc says Routine, the code says `Routine`.
- Comments explain why, not what.
- No dead code, no commented-out code.
- Public functions in `shared/` and `sim/kernel/` have doc comments, since both client and Worker rely on them.

## Balance workflow

- All numbers in `content/balance/`.
- The sim bot and the fight simulator report against targets (time-to-kill per tier, XP per hour per skill, coin per hour per activity, hours per region).
- Balance changes are their own PRs with before and after reports. They do not ride along with feature work.

## Release criteria for 1.0

Listed in ticket POW-M12-10. In short: all gates passed, zero known save-loss bugs, budgets met on the device matrix, accessibility checklist complete, 100% reachable and verified by the audit tool, a clean migration from every earlier public save schema.
