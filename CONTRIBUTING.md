# Contributing

Thanks for looking. This project takes feedback, not code. Here is why, and how to make your input count.

## Why no pull requests

The game is built from a fixed plan in `docs/`, one ticket per pull request, mostly by AI coding agents under the rules in [CLAUDE.md](CLAUDE.md). Every change is checked against that plan, its tests and its performance budgets. An outside pull request would sit outside that loop, so it will be closed with thanks. If the idea in it is good, it gets turned into a ticket.

## What helps most

**Playtest notes.** The most valuable input. Play for a session and tell us what happened.

- What device and browser, portrait or landscape.
- What you were trying to do.
- Where you got stuck, bored or confused, and roughly how long in.
- What you expected to happen instead.

**Bug reports.** Steps to reproduce, what you expected, what happened. A screenshot or screen recording helps. If the game showed an error or a save warning, include the exact text.

**Design critique.** Push back on the plan in `docs/design/`. The strongest critique names the pillar it tests (see section 2 of [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)), the failure mode you expect, and what you would do instead. Decisions in the master plan's decision log were made with the owner. They can be reopened, but say what has changed.

## Spoilers

The repository holds the whole design, hidden layer included. When you write an issue or discussion that touches lore, put **[spoiler]** in the title so others can skip it. Do not post lore details in issues about unrelated bugs.

## Saves and security

Saves are client-side by design and the scheme deters casual editing rather than stopping a determined programmer. That trade-off is stated in [docs/ops/security-review.md](docs/ops/security-review.md). A working save editor is not a vulnerability. If you find something that could harm a player (data loss, a crafted save file that breaks a device, script injection), report it privately as described in [SECURITY.md](SECURITY.md), not in a public issue.

## Conduct

Be decent. Critique the work, not the people. Harassment, slurs and spam get removed and the account blocked.
