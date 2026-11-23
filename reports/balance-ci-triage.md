# CI and balance:ci triage (draft ticket for the design authority)

Written by the executor after POW-M4-23, build `17911cf` (main at the merge of #151). This is an executor draft in the same place as `reports/endurance-tickets.md`: the design authority decides what becomes a ticket in `docs/tickets/` and where it goes. Nothing under `docs/` is changed here.

## Summary

CI on main has been red since at least 2026-11-21, and the cause is not the balance bands. It stops at `npm run test`, so `balance:ci`, the build checks, the tamper sample and the Playwright smoke run have not run in CI since. Running them by hand shows three more problems behind it. One of them can flag a real player's save.

| #   | Finding                                                                                                                   | Severity                              | Part |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---- |
| T1  | A debug line in `tests/sim/crafting.test.ts` writes to `/tmp/claude-0/quality.txt`, which only exists in agent sandboxes. | CI red on every recent merge          | A    |
| T2  | Board gather jobs now hand in as `deliver` steps with quantity up to 12. The integrity check caps `deliver` at 6.         | Live: a Flagged save for a normal job | B    |
| T3  | The sim-bot `request` policy was not updated for hand-in jobs, so it idles after its two chain requests.                  | `balance:ci` fails                    | C    |
| T4  | The fight sim has 7 cells outside the design/04 bands that are not listed, and 2 listed deviations that are now in band.  | `balance:ci` fails                    | D    |

## Evidence

**T1.** The failing step in CI run 45181546167 (main, #151) is `Run npm run test`, one failure of 1,851 tests: `tests/sim/crafting.test.ts > quality roll > 10,000 rolls ...: ENOENT: no such file or directory, open '/tmp/claude-0/quality.txt'`. The line is `appendFileSync('/tmp/claude-0/quality.txt', lines.join('\n') + '\n')` at `tests/sim/crafting.test.ts:217`. `git log -S` puts it in the merge of #93 (4d42750, 2026-11-19). The 30 most recent CI runs on main, from run 195 (2026-11-21) to run 256 (2026-11-23), all fail, and I checked the step list of the latest: steps after `test` (`balance:ci`, build, bundle check, `check:dev`, `check:seal`, `check:pwa`, `check:prod`, `check:deps`, tamper sample, Playwright, `npm audit`) are all skipped. Locally the test passes, because the agent sandboxes have `/tmp/claude-0`.

**T2.** POW-M4-22A (1ddf5c8) made a standing board gather job a hand-in: the generated step is `{ kind: 'deliver', item, qty, to: board }` with `qty` taken from the gather range (`RB.standing.gather.qty` 4 to 8, `maxQty` 12). `standingLooksRight` in `src/save/integrity/consistency.ts` still checks a `deliver` step against `RB.standing.deliver.maxQty` (6). A job of 7 or 8 (more if the range grows toward 12) fails with `REQUEST_STATE: standing.board.square.0.0 carries a definition the generator does not make`, and the save is marked Flagged.

Reproduced by the sim bot's own save: seed 14, the `request` policy, six steps, one `validateSave` call. The generated job is `standing.board.square.0.0`, a deliver of 8 Red Berries for 38 coin and 1 renown. Bisected by running the same script on both sides of the commit: clean on `1ddf5c8^`, flagged on `1ddf5c8`. All 19 flagged snapshots of the 20 minute sim-bot run, and all 59 of the full report, are this one reason from this one policy.

**T3.** `tools/sim-bot/policies.ts`, `REQUEST.step`, handles an active request step of kind `gather` (forages) or `defeat` (fights) and idles (`run.run(300)`) for anything else. After 22A a board gather job is `deliver`, so once Orla's and Wren's requests are done the loop does nothing. Top XP per hour reads 1,926 against the 3,000 to 12,000 band in `tools/balance-thresholds.json`.

**T4.** `npx tsx tools/fight-sim/index.ts --seeds 20 --check --no-write` reports `7 cells outside their time-to-kill band and not listed` and `listed deviations that are now in band: unarmed|creature.hollowhorn, heavy|creature.hollowhorn`. The committed `reports/fight-sim.md` (last written in fdb4da1, 2026-11-20) has 0 unlisted. The 7 cells now:

| Build    | Creature                   | Median s | p90 s | Target s |
| -------- | -------------------------- | -------- | ----- | -------- |
| Ember    | Hollowhorn (miniboss)      | 94.1     | 200.5 | 60 to 90 |
| Stone    | Hollowhorn (miniboss)      | 103.7    | 174.2 | 60 to 90 |
| Polearms | Old Bramblehide (miniboss) | 94.0     | 133.6 | 60 to 90 |
| Ember    | Old Bramblehide (miniboss) | 95.6     | 150.2 | 60 to 90 |
| Tide     | Downs Ram (common)         | 8.9      | 10.1  | 4 to 8   |
| Archery  | Fogcap (common)            | 8.8      | 10.2  | 4 to 8   |
| Ember    | Cinderback Boar (common)   | 9.1      | 13.9  | 4 to 8   |

I did not bisect T4. The creature content and the fight sim's inputs changed between that report and now (POW-M4-11 parts and POW-M5-22 touch `src/content/creatures` and `tools/fight-sim/targets.ts`), and a run takes about 65 seconds.

## Proposed parts

One PR each. A first, since it is one line and makes CI show the rest. B should not wait for the others.

### Part A. Remove the debug write that keeps CI red (T1)

Size: S. Depends: none.

Scope: delete the `appendFileSync` call and its import in `tests/sim/crafting.test.ts`. Keep the assertions. Add an ESLint `no-restricted-syntax` or `no-restricted-imports` rule (or a small test) so a test cannot write under `/tmp` outside `os.tmpdir()`.

Acceptance:

- `npm run test` passes on a clean checkout with no `/tmp/claude-0` directory (run it in a container, or with the directory removed).
- CI on the PR reaches `balance:ci` and the later steps. Whatever then fails is recorded in the PR, not fixed there.

### Part B. Standing hand-in jobs must pass the integrity check (T2)

Size: S. Depends: none. Design Query first: this is a security rule.

Options:

1. Check a standing `deliver` step against `max(deliver.maxQty, gather.maxQty)`. One line, and it also lets an ordinary deliver job exceed its own cap, up to 12.
2. Tell the two apart by the ask key (`request.standing.gather.ask.*` versus the deliver asks) and check each against its own cap. Tighter, and the generator already makes the key.
3. Make the generator clamp a gather hand-in to `deliver.maxQty` (6). Changes player-facing quantities.

Recommendation: option 2. It keeps both caps meaningful and changes nothing the player sees.

Acceptance:

- A unit test generates a standing gather job at every quantity in `RB.standing.gather.qty` and passes `validateSave` for each, with the seal intact.
- A test shows a deliver job above its own cap, and a gather job above `gather.maxQty`, are still flagged.
- No schema change is needed (the check only reads `r.gen`). If option 3 is chosen, jobs already taken keep their quantity, so the check must accept both until they are done.
- Run the sim-bot `request` policy: 0 flagged snapshots.

### Part C. Teach the `request` policy hand-in jobs (T3)

Size: S. Depends: Part B (so the loop's saves can pass).

Scope: in `tools/sim-bot/policies.ts`, a `deliver` step to a board forages the item, stands at the board and sends `turnInRequest` when the request is `ready`. Re-baseline the `request` XP and coin bands in `tools/balance-thresholds.json` only if the measured loop falls outside them after the fix, and say so in the PR with the before and after rows.

Acceptance: `npx tsx tools/sim-bot/index.ts --minutes 20 --cap 120 --check --no-write` prints `within thresholds`.

### Part D. Fight sim back inside the bands (T4)

Size: M. Depends: none. This is a balance decision, so the design authority owns the choices.

Scope:

1. Bisect between fdb4da1 and main to find which content change moved each cell, so the PR can say why.
2. For each of the 7 cells, either retune the creature (a step in `tools/fight-sim/targets.ts` terms, as 3a did) or add a listed deviation with the reason, as the existing 9 have. Bands are design/04 and the gap-between-builds rule is an owner decision, so list only what the owner accepts.
3. Remove the 2 listed deviations that are now in band (`unarmed|creature.hollowhorn`, `heavy|creature.hollowhorn`), or keep them if the owner wants the margin.
4. Regenerate `reports/fight-sim.md` with `npm run fight-sim`.

Acceptance: `npm run balance:ci` passes in CI.

## Not in scope

- The endurance bot as a CI gate (the POW-M4-23 follow-up). It needs `balance:ci` green first.
- The sim-bot pacing bands themselves.
