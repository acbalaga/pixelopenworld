# M12 Release

**Result:** version 1.0 on the production URL.

No new features in this milestone. Anything that looks like a feature is a Design Query.

---

### POW-M12-01 Refinement: M12 specs to READY

Size: M Depends: M11 complete Status: DRAFT (design authority)

Goal: READY specs built from the accumulated follow-ups, known issues, and gate notes. A prioritized defect list.
Acceptance: owner approves.

### POW-M12-02 Accessibility pass

Size: L Depends: M12-01 Status: DRAFT
Refs: design/09-ui-ux (Accessibility)

Goal: every item in the accessibility section is true.
Scope: audit each line. Colorblind presets checked with simulation screenshots. Screen-reader walkthrough of all Menu and dialogue UI. Flash audit. Captions for meaningful sounds. Assist options verified. Help text documents what is and is not accessible.
Acceptance: a checklist in the PR with evidence per item. Zero information conveyed by color alone (audit list).

### POW-M12-03 Balance pass

Size: L Depends: M12-01 Status: DRAFT
Refs: tech/04-quality (Balance workflow), design/10-content-budget

Goal: curves hold from hour 1 to hour 200.
Scope: full bot campaign. Reports for time-to-kill by tier, XP per hour per skill, coin per hour per activity, automation against manual, market stability, hours per region. Tuning in `content/balance/` only. Plausibility bounds re-derived from final numbers, zero-flag suite re-run.
Acceptance: before and after reports. Every target in design/04, design/06, and design/10 met or the deviation approved by the owner.

### POW-M12-04 Performance pass

Size: L Depends: M12-01 Status: DRAFT
Refs: tech/04-quality (budgets)

Goal: every budget met on the device matrix.
Scope: profile worst scenes (Port Brine market day, field raid, storm, festival, deep frontier). Fix hot paths. Boot size and first-playable time. Battery check. 30 fps cap option verified. 120 Hz verified.
Acceptance: budget table with measured numbers per device class.

### POW-M12-05 First hour polish

Size: M Depends: M12-01 Status: DRAFT
Refs: design/01-experience (The first hour)

Goal: the first hour matches its beat table.
Scope: timing and pacing of the opening against the table. Hint wording. The first Traveler encounter. The first odd thing. Remove any modal the player did not open.
Acceptance: three fresh-profile recorded runs hit each beat inside its window.

### POW-M12-06 Audio pass

Size: M Depends: M12-01 Status: DRAFT
Refs: tech/03-asset-pipeline (Audio)

Goal: complete, mixed, pleasant on a phone speaker.
Scope: coverage audit (every event that should sound does). Mix levels across buses. Loop seams. Day and night variations for all regions. Ducking. Repetition fatigue check on the most frequent effects.
Acceptance: coverage list with zero gaps. Track list matches the budget in design/10.

### POW-M12-07 Art consistency pass

Size: L Depends: M12-01 Status: DRAFT
Refs: tech/03-asset-pipeline (Art bible)

Goal: it looks like one game.
Scope: review every contact sheet against the art bible. Redraw outliers (owner supplies a list at the M12-01 review, plus executor findings). Silhouette collisions resolved. UI icon set unified. App icon and splash final.
Acceptance: before and after sheets for every redrawn asset. Owner sign-off.

### POW-M12-08 Device matrix QA

Size: L Depends: M12-02 to M12-07 Status: DRAFT
Refs: tech/04-quality (Device matrix)

Goal: it works on the phones people have.
Scope: `docs/ops/qa-matrix.md` test script covering install, offline, audio interruption, storage persistence, rotation, safe areas, back gesture, low power mode, tab discard and restore, long session. Fix what the owner's run finds.
Acceptance: owner action: run the matrix. All blocking findings fixed and re-verified.

### POW-M12-09 Save safety drills

Size: M Depends: M12-01 Status: DRAFT
Refs: tech/02-save-security

Goal: no path loses a player's save.
Scope: migration test from every prior schema fixture to final. Recovery drills: corrupted latest, corrupted all local with a valid export, storage evicted, crash mid-save, import over existing. Seal version rotation rehearsal (old exports still import). Integrity validator zero-flag suite on final balance. Export reminder and storage persistence messaging reviewed for clarity. Ops runbooks final.
Acceptance: every drill documented with its result. Zero known save-loss defects.

### POW-M12-10 Release 1.0

Size: M Depends: all Status: DRAFT
Refs: tech/04-quality (Release criteria)

Goal: ship.
Scope: release checklist: gates passed, budgets met, accessibility done, audit-100 clean, security review re-run, privacy note accurate, version stamped, in-game credits, a short public README, production deploy, post-deploy smoke test on the live URL, tag `v1.0.0`. A plan for post-release patches that respects save compatibility.
Acceptance: checklist complete with links to evidence. Live smoke test passes.
