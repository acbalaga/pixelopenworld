# M7 Automation

**Result:** mastery earns Routines, Tactics, and Patrol. Coming back after time away feels like coming home to a full storehouse.

**Gate G7:** does automation feel earned, and is the game still worth playing by hand?

Every executor on this milestone reads design/06-automation in full.

---

### POW-M7-01 Refinement: M7 specs to READY
Size: M      Depends: M6 complete      Status: DRAFT (design authority)

Goal: READY specs, with final numbers for rates, caps, wages, and slot counts based on measured manual rates from the sim bot.
Acceptance: owner approves.

### POW-M7-02 Routine framework and measured rates
Size: L      Depends: M7-01      Status: DRAFT
Refs: design/06-automation (Requirements, Yields)

Goal: the core model of a worker repeating an activity.
Scope: record the player's manual rate per activity (rolling best-sustained measure, robust to idle time). Requirement checks (Expert rank, proof counts, worker, place). Routine state machine: running, waiting for inputs, storage full, unpaid, idle at cap. Yield formula with the 60 to 80% rate, 25% XP, quality cap. Input consumption and tool wear. Everything in abstract sim, online and offline through one code path.
Acceptance: unit tests for each requirement and each stop reason. Yield over time equals the formula exactly. XP from Routines banks at thresholds and cannot pass a Trial.

### POW-M7-03 Workers
Size: L      Depends: M7-02      Status: DRAFT
Refs: design/06-automation (A worker)

Goal: hired hands, companions, and golems.
Scope: hiring through Leadership and Renown, daily wages. Companion assignment by role. Golem crafting through Tinkering, fuel. Worker slots from 1 to 8 and their unlock sources. Worker upgrades that raise rate and offline efficiency. Workers visible at their posts when the player is near.
Acceptance: slot unlocks tested. An unpaid hand stops. A visible worker's animation matches its Routine state.

### POW-M7-04 Routine activities
Size: L      Depends: M7-03      Status: DRAFT
Refs: design/06-automation, design/05-life-systems

Goal: every automatable loop is wired up.
Scope: gathering at claimed sites (claim mechanic for a mine shaft, grove, fishing pier). Farming (plant, water, harvest, replant). Husbandry care. Crafting queues from stored inputs. Selling through the player's shop. Each with its proof requirement and place.
Acceptance: each activity runs for a simulated day with correct inputs, outputs, and stops. None can produce an excluded result (firsts, Masterwork, legendaries, fragments), verified by property tests.

### POW-M7-05 Tactics engine and editor
Size: L      Depends: M7-01      Status: DRAFT
Refs: design/06-automation (Tactics)

Goal: rule-based combat control.
Scope: condition and action vocabulary. Top-to-bottom evaluation. Rule slots from 3 to 10 and condition unlocks by skill ranks. Reaction delay that shrinks with Evasion and never reaches zero. Editor UI (DOM, large touch targets, drag to reorder). Assist toggle for normal play, interrupted by any input. Refused in dungeons and boss fights.
Acceptance: evaluation order tests. A Tactics-driven avatar performs worse than scripted competent input by a stated margin in the fight sim. Editor usable one-handed (screenshots).

### POW-M7-06 Patrol
Size: M      Depends: M7-05      Status: DRAFT
Refs: design/06-automation (Patrol)

Goal: auto-fight in zones you have truly cleared.
Scope: requirement checks (boss resolved, bestiary complete at 10 each, gear tier, saved Tactics). Online Patrol runs the real fights visibly. Offline Patrol is settled by formula from fight-sim-derived rates. Common tables only. No risk.
Acceptance: Patrol unavailable until every requirement holds (test each). Online and offline yields agree within tolerance.

### POW-M7-07 Offline settlement and welcome-back
Size: L      Depends: M7-04, M7-06, M2-04      Status: DRAFT
Refs: design/06-automation (Offline gains), tech/02-save-security (Trusted time)

Goal: correct, bounded gains for time away, presented well.
Scope: settlement function in `sim/settle/`: pure, idempotent, keyed to last settled trusted time. Cap (8 to 12 hours) and efficiency (50 to 75%). Limits by inputs, storage, wages. Integrates crops, animals, market sales, mail, Traveler catch-up. One-cap-per-sync rule. Welcome-back panel with per-worker results, stop reasons, Collect all.
Acceptance: settlement unit tests across gaps of 5 minutes, 8 hours, 3 days, and a backwards clock. Running settlement twice yields nothing the second time. Panel screenshot.

### POW-M7-08 Integrity rules for automation
Size: M      Depends: M7-07, M2-02      Status: DRAFT
Refs: tech/02-save-security (Integrity validator), design/06-automation (Abuse limits)

Goal: the integrity validator can bound automated gains.
Scope: summary gains Routine assignments, rates, worker counts, last settlement time. Ledger entries for Routine output. New rules bounding gains by recorded Routines and elapsed trusted time. Recorded sessions with heavy automation added to the zero-flag suite.
Acceptance: legitimate automated sessions produce zero flags. An edited Routine rate is flagged.

### POW-M7-09 Routines UI and Gate G7
Size: M      Depends: M7-07      Status: DRAFT
Refs: design/06-automation (Interface), design/09-ui-ux

Goal: three taps to assign, and a build to judge.
Scope: Routines tab with worker cards, assign flow, cap bar, Tactics entry. Tuning pass using bot reports comparing manual and automated income and XP. `docs/ops/gate-g7.md` owner checklist (earn a Routine from scratch, leave overnight, judge the return).
Acceptance: assign flow in three taps (e2e). Report shows automation below manual in every activity. Owner action: G7.
