# Tickets

One file per milestone. Each ticket is one PR.

| File                                       | Milestone                               | Status |
| ------------------------------------------ | --------------------------------------- | ------ |
| [M0-foundation.md](M0-foundation.md)       | Foundation                              | READY  |
| [M1-first-login.md](M1-first-login.md)     | First Login (vertical slice)            | READY  |
| [M2-trust.md](M2-trust.md)                 | Save security and PWA                   | READY  |
| [M3-core-rpg.md](M3-core-rpg.md)           | Core RPG systems                        | READY  |
| [M4-world-1.md](M4-world-1.md)             | Playtest fixes, world tech and region 1 | READY  |
| [M5-the-crowd.md](M5-the-crowd.md)         | Simulated MMO                           | DRAFT  |
| [M6-second-life.md](M6-second-life.md)     | Life systems                            | DRAFT  |
| [M7-automation.md](M7-automation.md)       | Automation                              | DRAFT  |
| [M8-world-2.md](M8-world-2.md)             | Regions 2 to 4                          | DRAFT  |
| [M9-world-3.md](M9-world-3.md)             | Regions 5 to 8, Undercroft              | DRAFT  |
| [M10-hidden-layer.md](M10-hidden-layer.md) | Lore and completion                     | DRAFT  |
| [M11-unwritten.md](M11-unwritten.md)       | Frontier                                | DRAFT  |
| [M12-release.md](M12-release.md)           | Polish and release                      | DRAFT  |

## Ticket format

```
### POW-M<n>-<nn> Title
Size: S | M | L      Depends: ticket ids      Status: READY | DRAFT
Refs: docs the executor must read

Goal: one sentence, the outcome.
Scope: what to build.
Out of scope: what to leave alone (when it is tempting).
Acceptance: checkable statements. Each must be demonstrated in the PR.
```

Sizes are relative effort for an implementing agent: S is a focused session, M is a full session, L is at the upper limit of one PR and should be split if it grows.

## READY and DRAFT

- **READY:** specified well enough to implement without design decisions. Execute as written.
- **DRAFT:** scope and acceptance are set at the level the plan can know today. Details depend on what earlier milestones teach.

Every DRAFT milestone starts with ticket `-01`, a **refinement ticket**. It is done by the design authority (the planning agent), not an executor. It rewrites that milestone's tickets to READY: exact file paths, data shapes, edge cases, tests, and any changes forced by what was learned. It is a docs-only PR that the owner approves. No DRAFT ticket is implemented before its milestone's refinement merges.

## Order of work

Within a milestone, follow **Depends**. Tickets with no dependency between them can run in parallel on separate branches. Milestones run in order. M3 does not start before Gate G1 passes. See the gates in the master plan.

## GitHub issues

Issues are opened for a milestone when it becomes active. Issue title: `[POW-M0-04] Sim kernel`. The issue body links to the ticket spec in this folder. The spec file is the source of truth. If an issue and a spec disagree, the spec wins and the issue gets corrected.

## Changing a ticket

Executors do not edit ticket specs. Raise a Design Query (see CLAUDE.md). The design authority updates the spec in a planning PR.

## Owner actions

Some tickets need something only the owner can do (connect the repo in the Cloudflare dashboard, approve art, play a build on a phone). These are marked **Owner action** inside the ticket. The executor prepares everything up to that point and lists the exact steps.
