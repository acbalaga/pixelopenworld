# Working rules for implementing agents

This repo is built ticket by ticket from a fixed plan. The plan is in `docs/`. Your job is to execute one ticket well, not to redesign the game.

## Roles

- **Owner.** Fred. Approves design changes and merges PRs.
- **Design authority.** The planning agent that maintains `docs/`. Only planning PRs change design or tech docs.
- **Executor.** You. You implement tickets.

## The loop for every ticket

1. Read the ticket in `docs/tickets/M<n>-*.md`. Read every doc it lists under **Refs**. Do not read `docs/design/08-lore-SPOILERS.md` unless the ticket lists it.
2. Check **Depends**. If a dependency is not merged, stop and say so.
3. Check **Status**. Only `READY` tickets may be implemented. `DRAFT` tickets need a refinement pass first (see `docs/tickets/README.md`).
4. Branch: `ticket/<ticket-id-lowercase>-<short-slug>`, for example `ticket/pow-m0-04-sim-kernel`.
5. Implement the **Scope**. Nothing outside it. If you see adjacent work worth doing, note it in the PR under "Follow-ups". Do not do it.
6. Prove every **Acceptance** line. Tests where a test can prove it, a screenshot or recorded check where it is visual.
7. Run `npm run verify` (lint, typecheck, unit tests, build). It must pass.
8. Open one PR per ticket. Title: `<TICKET-ID> <ticket title>`. Body: what changed, how each acceptance line was verified, follow-ups, design queries.

## When the spec is unclear or wrong

Do not guess on anything that changes player-facing behavior, save format, or security. Write a **Design Query** in the PR body (or the ticket's GitHub issue): what is ambiguous, the options, your recommendation. For low-stakes gaps (a variable name, a file split), decide, and note it.

If the spec is wrong (contradiction between docs, impossible acceptance line), stop and report. Do not edit `docs/design/` or `docs/tech/` yourself.

## Hard rules

These exist because breaking them causes damage that is expensive to find later.

- **Sim purity.** Code under `src/sim/` never touches DOM, canvas, `Date`, `Math.random`, `fetch`, or storage. It takes inputs and a seeded RNG and returns state. This is what makes offline settlement, the plausibility checks, and the test suite possible.
- **Content is data.** Items, skills, creatures, recipes, dialogue, maps, sprites, and sounds live under `src/content/` as typed data validated at build time. No content literals inside systems.
- **Tunables are data.** Every balance number lives in `src/content/balance/`. Never inline a damage value or drop rate.
- **Zero runtime dependencies.** The shipped client has no npm runtime dependencies. Dev dependencies need a line of justification in the PR.
- **Save compatibility.** Any change to saved state bumps the save schema version and ships a migration with a test that loads a fixture from the previous version.
- **Never destroy player data.** A save that fails a check is marked, backed up, and recovered from. It is never deleted.
- **No secrets in the client.** Signing and export keys live only in Worker secrets.
- **Lore is found, not told.** No UI string, quest text, or NPC line explains the hidden layer. See `docs/design/08-lore-SPOILERS.md` section "Delivery rules" when a ticket touches lore.
- **Readable text.** Follow the text rules in `docs/design/09-ui-ux.md`. Long text never uses the bitmap font.
- **No em dashes** in player-facing strings or docs.
- **No external art or audio.** Everything is generated from data in this repo.

## Commands

These are defined by ticket POW-M0-01. Until it merges they do not exist.

```
npm run dev        # local dev server with the Worker
npm run verify     # lint + typecheck + unit tests + build
npm run test       # unit tests (Vitest)
npm run e2e        # Playwright smoke tests
npm run bake       # asset and world bake
```

## Definition of done

- Every acceptance line is demonstrated in the PR.
- `npm run verify` passes. CI is green.
- New systems have unit tests for their rules. New content passes schema validation.
- No new console errors or warnings in the e2e smoke run.
- Performance budgets in `docs/tech/04-quality.md` still hold.
- The ticket's GitHub issue (if one exists) is referenced with `Closes #<n>`.
