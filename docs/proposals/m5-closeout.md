# M5 closeout: input for one planning session

**Audience:** the planning agent (design authority). **Written by:** an executor session, 2026-11-27, after PR #182 merged. **Purpose:** everything the planning agent needs to close M5 and open M6 in a single docs-only PR, with no archaeology. Nothing in `docs/design/` or `docs/tech/` was changed to produce this.

Sources: the merged PRs (#126 to #128, #130, #157 to #175, #182), `git log` on main at `7b8be39`, the ticket files, and a fresh run of `npm run crowd-report`.

## 1. Where M5 stands

Every M5 ticket is merged or withdrawn. M5-28 is the only one not built, and that is by decision (folded into M5-11). Save schema is 35. Boot JS is 391 KB gzip against a 450 KB budget (`node tools/check-bundle.mjs`).

What is missing is bookkeeping, not code:

- Twenty-one tickets still read READY in the file although they are merged (section 2).
- The master plan and README still call M5 "In progress", and the tickets README still says "READY (pending owner approval after G4)".
- Design docs lag the build in four places (section 4).
- Several Design Queries from PRs have no recorded answer (section 5).
- Nothing records that Gate G5a passed, or that a final M5 owner check was requested (section 3).

M6-01 lists "M5 complete" as its dependency. Doing sections 2 to 5 in one PR makes that statement true.

## 2. Ticket status: edits for `docs/tickets/M5-the-crowd.md`

PR column is the PR where the ticket's code merged. Where a PR holds several tickets it says so.

| Ticket                                | File says | Actual                           | PR                                     | Edit           |
| ------------------------------------- | --------- | -------------------------------- | -------------------------------------- | -------------- |
| M5-01 Refinement                      | READY     | merged                           | #130                                   | DONE (PR #130) |
| M5-02 Traveler model                  | READY     | merged, schema 30                | #157                                   | DONE (PR #157) |
| M5-03 Schedules and abstract sim      | READY     | merged                           | #158 and #159 (same commit, `cb96c60`) | DONE (PR #159) |
| M5-04 Travelers in the world          | READY     | merged                           | #160                                   | DONE (PR #160) |
| M5-14 Traveler behaviors              | READY     | merged                           | #161                                   | DONE (PR #161) |
| M5-05 Chat engine                     | READY     | merged                           | #162                                   | DONE (PR #162) |
| M5-15 Chat templates                  | READY     | merged                           | #163                                   | DONE (PR #163) |
| M5-13 Gate G5a checklist              | READY     | merged                           | #164                                   | DONE (PR #164) |
| M5-09 Rankings                        | READY     | merged                           | #165                                   | DONE (PR #165) |
| M5-26 Travelers rest at rest points   | READY     | merged                           | #169                                   | DONE (PR #169) |
| M5-27 Traveler humor, first pass      | READY     | merged                           | #170                                   | DONE (PR #170) |
| M5-06 Reply chips, friends, memory    | READY     | merged, no schema bump           | #171                                   | DONE (PR #171) |
| M5-31 Snoring AFK                     | READY     | merged                           | #172                                   | DONE (PR #172) |
| M5-29 The Pit: finding it             | READY     | merged, no schema bump (see 5.9) | #173                                   | DONE (PR #173) |
| M5-12 Duels, rivals, mail             | READY     | merged, schema 31                | #174                                   | DONE (PR #174) |
| M5-07 Parties and companion AI        | READY     | merged, session only             | #175                                   | DONE (PR #175) |
| M5-08 Guilds                          | READY     | merged, schema 32                | #175                                   | DONE (PR #175) |
| M5-30 The Pit: duels                  | READY     | merged, schema 33                | #175                                   | DONE (PR #175) |
| M5-10 Market simulation               | READY     | merged, schema 34                | #175                                   | DONE (PR #175) |
| M5-11 World events and calendar       | READY     | merged, schema 35                | #175                                   | DONE (PR #175) |
| M5-32 Fixtures win the context button | READY     | merged                           | #182                                   | DONE (PR #182) |
| M5-20, 21, 22, 23, 24, 25             | DONE      | correct                          | #126, #128, #127, #166, #167, #167     | none           |
| M5-28 Traveler raid parties           | WITHDRAWN | correct                          | none                                   | none           |

Also in that file:

- **Order of work table:** the "G5a findings" row says "26 now, 27 after 26...". Mark the row done.
- **"Save schema bumps serialize" paragraph:** it names tickets 02, 06, 08, 10 and 12. What shipped: 02 (29 to 30), 12 (31), 08 (32), 30 (33), 10 (34), 11 (35). M5-06 and M5-29 needed none. Rewrite it as a record of the numbers.
- **Process note:** #175 stacked five tickets in one PR, against the one-PR-per-ticket rule (the PR body explains: one pushable branch, owner away). Each commit passed verify on its own. No action, but worth a line in the milestone retrospective.

Other files:

- `docs/tickets/README.md` table: M5 row becomes DONE. M6 row stays DRAFT.
- `docs/MASTER_PLAN.md` roadmap table: M5 "In progress" becomes done. Confirm the M5 ticket count (the table says 12; the file now holds 28 numbered tickets: 27 delivered and 1 withdrawn).
- `README.md` (root) status table: M5 "In progress" becomes done.

## 3. Gates

- **G5a (D27).** The owner played Hearthford on 2026-11-25 (evening and early morning, phone). Per `docs/proposals/m5-g5a-feedback-plan.md`: the crowd "feels populated and fun", with findings that became M5-23 to M5-31. Wave C (parties, guilds, duels, mail, market) then started. Nothing in `docs/ops/gate-g5a.md` records a verdict. **Edit:** add a "Result" block (date, verdict: passed with findings, the ticket ids) so D27 shows as satisfied. The owner should confirm the wording.
- **"Gate G5b" / "Gate G5".** The proposal doc mentions G5b once (line 53). PR #175 ends with an "Owner action for G5": play the preview at two times of day and try the party finder, guild halls, the Pit, the market terminal and the calendar. The master plan has no G5b. **Decide:** either define a final M5 gate with a checklist (`docs/ops/gate-g5b.md`, same shape as G5a) or record that the milestone review is the owner's phone play of #175 and nothing more. Whether the owner has done that play is not recorded anywhere I can see. Ask.

## 4. Design and tech docs that lag the build

Already done in #181 (no action): Cartography 150-block rule (`03`, `11`), chat placement (`09`), boot budget (`tech/04`).

Still to do:

1. **`design/12` section 3.1, online curve.** It says "about 20 at the 05:00 trough, about 45 at the 21:00 weekday peak". PR #159 retuned the shapes (per-shape attendance, windows and shares, in `src/content/balance/travelers.ts`) and recommended updating the doc. Current `npm run crowd-report` (seed 1, tz 0): online min 20, max 46; weekday peak hour 20:00 at 43.0; weekday mean 28.1 for 03:00 to 07:00 and 41.0 for 20:00 to 23:00; weekend 25.5 and 38.1. So the peak still matches "about 45", but the early-morning level is about 28, not about 20 (only the single lowest hour reaches 20). Edit the sentence to match, or ask for a retune. The `gate-g5a.md` check "evening clearly higher than morning" holds (41 vs 28).
2. **`design/12` section 4.2, chat slots.** PR #162 added a `{rumor}` slot (answers only) to the twelve listed. Add it.
3. **`design/12` and `tech/01`, randomness.** The doc says all Traveler randomness comes from the `travelers` RNG stream. Chat uses its own hash dice and never that stream, so chat cannot change what the crowd does (PR #162, tests assert it). Record the exception: text is not simulation.
4. **Schema record.** If `tech/02` or `tech/01` lists schema versions or migrations, add 30 to 35 with their owners (list in section 2).

## 5. Open Design Queries (owner answers needed)

Each has the recommendation the executor gave. Where a later PR already acted on one, that is noted. None blocks M6-01, but 5.1 to 5.4 change player-visible text or rules and should be answered before the M6 guild and party work leans on them.

| #    | From | Question                                                                                                                                                                                                                                                                                       | Recommendation                                                                                                                            |
| ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | #175 | Guild 12 (Summit Club) wants "An Athletics Trial under par". Trials have no par time.                                                                                                                                                                                                          | Keep "has passed an Athletics Trial" until Trials have times.                                                                             |
| 5.2  | #175 | Guild 10 (Wardens of the Fog) wants Taming 15 or a tamed creature. Taming is a pending skill, so nobody can join until M6-06.                                                                                                                                                                  | Accept for now, or add Foraging 20 as a stopgap. Owner call. Folds into M6-06.                                                            |
| 5.3  | #175 | M5-30 says the honor shows on the player's profile card. The player has no profile card. It shows in the Character tab and on the Duels board.                                                                                                                                                 | Keep.                                                                                                                                     |
| 5.4  | #175 | Trials as a party activity: progress counts only the player's own kills.                                                                                                                                                                                                                       | Keep, so Trials stay personal.                                                                                                            |
| 5.5  | #175 | M5-10 "stalls by Traveler handle": listings are on the terminal sheet. Market-street crates are not separate stalls.                                                                                                                                                                           | Make stalls interactive with M6-11 player shops.                                                                                          |
| 5.6  | #165 | Fishing rank acceptance used a test-only learning curve (`RANKINGS.humanEfficiency`, 25% rising to 60% by 15 h). Asked the owner to confirm the numbers. Also the reference player sits above the top Fishing Traveler at 5 h (25 vs 20 to 22).                                                | Confirm 25% and 60%. The second point is an M5-03 tuning fact. Leave unless the owner wants it retuned.                                   |
| 5.7  | #167 | Is half a bedroll the right Rested at a camp? Should the rest mark always show, or follow the "show giver marks" setting?                                                                                                                                                                      | Keep half. Follow the setting.                                                                                                            |
| 5.8  | #160 | Frame budget could not be certified in headless Chromium (46 fps, 8.5 ms render in the Hearthford square before any crowd cost). Name labels too small for pixel text are skipped, not switched to clear text.                                                                                 | Needs a real-phone read. Put it in the gate. Decide on clear-text labels after that read.                                                 |
| 5.9  | #173 | M5-29 asked for a schema bump. None was needed (flags live in `journal.flags`, crate state in chunk deltas). The crates stand 6 tiles east of the crane, not behind it (solid quarry wall). A told rumor is not told again. "Heard" means said in chat, whether or not the player was looking. | Accept all four. Amend the ticket text to match what shipped.                                                                             |
| 5.10 | #174 | Rivals appear as chat plus a taunt line, not a body in the dungeon (Travelers do not enter dungeons yet). Letters are rendered when read, so template edits change old letters. Duels board value for Travelers is derived, not stored.                                                        | Keep all three. The Rival body can become a follow-up now that parties exist (#175).                                                      |
| 5.11 | #170 | The square has a well, not a fountain. Wishes use the well. The owner's "add a fountain" was answered on that wrong premise. Dummy "miss streak" has no miss animation. Scenes speak in Local.                                                                                                 | Ask whether a separate fountain prop is still wanted. Keep the rest.                                                                      |
| 5.12 | #171 | Chips are an overlay above the chat lane. Friending takes days of play by design (`REGARD.oncePerDay`).                                                                                                                                                                                        | Keep. Tune `balance/social.ts` if it feels slow. #180 reworked chip placement after owner feedback, so the first point is likely settled. |
| 5.13 | #172 | A collapsed chat lane shows no Reply cue. Poke is on the profile card only.                                                                                                                                                                                                                    | Add a cue to the collapsed badge only if the owner finds missed replies. Keep Poke.                                                       |
| 5.14 | #169 | Camp occupancy cap pulls the crowd off the square. The `chat-templates` own-lines test now passes at exactly its threshold (8 of 12 seeds).                                                                                                                                                    | Keep. If the margin matters, lower `CAMP.max`.                                                                                            |
| 5.15 | #159 | Time zone is read each session, not stored. `sessionsFor` also takes the world seed.                                                                                                                                                                                                           | Keep.                                                                                                                                     |
| 5.16 | #162 | Chat rate budget is per in-game minute: about one World line every 7 s at the evening peak.                                                                                                                                                                                                    | Keep.                                                                                                                                     |
| 5.17 | #163 | Rumor table is 97, not about 80. Pair exchanges weigh 6 vs 3.                                                                                                                                                                                                                                  | Keep.                                                                                                                                     |

## 6. Follow-ups not done (candidates for tickets, or explicit drops)

- Brags on common loot ("Got Rough Hide, the drop rates are kind today"): gate to rare drops in the chat engine (#163).
- Questions are about 2% of chat. Raising them is a tuning call (#163). Own-line and pair exchanges fire about twice a day per seed (`CHAT.exchangeChance`).
- Map-board passes are not announced: the sim needs the region size (#165).
- Dedicated sit, wave and bow doll frames need art (#161). Festival dance has a hook (`festivalDanceBoost`) for M6-10.
- A gathering Traveler does not deplete the node (#160). Travelers earn no Path titles yet.
- Sheets at posts (party, guild, Pit, market) use the standard 60% sheet height (#175).
- Market sales have no listing expiry (#175).
- A reload in the middle of a raid does not rebuild the parties (#175).
- Rivals could join a party now that parties exist (#175).
- Woods-edge rest point is outside the 80-tile ring (#169).
- `src/content/strings/dialogue.ts:92` still holds the old cook line and may be dead (#180).
- Travelers stuck inside buildings when crowded: no cause found in code, no repro. Needs a screenshot from the owner (#166).
- e2e: the 60 ms W holds in `stationSheet` and `actionMeter` passed 10 of 10 each; widen `stationSheet` first if CI flakes (#182).
- `docs/ops/evidence/pow-m5-04/frame-budget.md` failed `prettier --check` when #165 was written. Re-check.

## 7. Test fragility worth a planning decision

Three merged PRs (#171, #174, #175) record that seeded scenario tests moved when chat or social dice changed (`travelerScenes` dance and dummy, own-lines coverage, `travelerSnore`). #174 suggests rewriting them to stage their setups, as `travelerSnore` now does, and #180 added `__pow.sendTo` for the camp and scenes. Remaining seeded ones will break again at the next dice change (M6 adds farming and shop chatter). A small S ticket to finish the staging would remove that tax before M6. Recommend creating it.

## 8. Notes from reading POW-M8-00 (READY, refined 2026-11-27)

Read in full. It is consistent with the code as it stands. Checked:

- Boot is 391,490 B gzip and the budget is 460,800 B (450 KiB), as the ticket says.
- `src/save/seal/registry.ts` (dynamic-import precedent), `tools/check-bundle.mjs`, `tools/budgets.json` and `src/platform/pwa/sw.js` exist. `src/platform/world/packs.ts` and `src/content/registry.ts` do not, as expected.
- `balance:ci` already includes `sim-bot`, so the determinism check in Part A is one command.
- Static reads of region content from `src/sim`, `src/ui` and `src/render` number about 64 import lines (the ticket's "about 31 from src/sim alone" is the sim share). Part A is large; it should stay a single mechanical PR.
- `check:packs` is not in the `verify` script yet. Part B must add it to `npm run verify` and to CI.

Gaps for the planning agent to settle before an executor starts:

1. **The `slice` region.** `src/content/world/slice-map.ts` and `rooms.ts` still serve `?region=slice`, which many e2e specs and the sim-bot use, and several sim paths default `state.region ?? 'slice'`. The ticket's pack list names Dawnmeadow only. Say whether `slice` gets its own pack, stays in boot as shared content, or is test-only.
2. **Dependency line.** The ticket says "Depends: none" but its Context assumes M5 content (crowd, chat templates) is merged. True now. After this closeout, "none" is fine.
3. **Region index scope.** The Travelers in other regions only read the index. All 240 currently play in Dawnmeadow (D25), so the rule is untestable until M8-03. The "fails if travelers/chat calls a pack lookup for another region" test needs a second registered stub region to mean anything. The ticket's stub pack covers that. Keep it in Part A, not only Part B.
4. **Offline settlement deferral** writes a System log line. Check that wording against the player-text rules in `design/09` (no em dashes, no hidden-layer hints) when the ticket is executed.

## 9. Suggested order for the single planning session

1. Ticket file edits (section 2), plus README, MASTER_PLAN and root README status rows.
2. Gate G5a result block, and the G5b decision (section 3). Needs one owner answer.
3. The four design and tech edits (section 4). Item 1 needs an owner call (edit the doc or retune).
4. Record answers to section 5. Rows 5.1, 5.2, 5.6, 5.7 and 5.11 need the owner. The rest are "keep" and can be written as decided.
5. Turn section 6 into tickets or drops. Add the S ticket from section 7.
6. Settle the `slice` question for M8-00 (section 8).
7. Then start POW-M6-01.

Owner questions to ask up front: Did you play the #175 preview, and did it pass? Are 5.1, 5.2, 5.6, 5.7 and 5.11 fine as recommended? Is an early-morning crowd of about 28 acceptable, or should it be about 20?
