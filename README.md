# Pixel Open World

A mobile, browser-based, open world pixel RPG where you become whatever you decide to be. You log into a world that feels like a living online game, full of other "players" with their own lives. Nobody tells you what the world is. You find out, or you don't.

**Status:** in active development. Milestones M0 to M4 are built (engine, first region, saves, core RPG systems). M5, the simulated MMO crowd, is in progress. See [docs/tickets/](docs/tickets/README.md) for the full roadmap.

> **Spoiler warning.** This repository contains the whole design, including the hidden layer the game is built around. `docs/design/08-lore-SPOILERS.md` and `docs/tickets/M10-hidden-layer.md` give the mystery away. Other design docs, content data under `src/content/`, and tests can hint at it too. If you want to play the game the way it is meant to be played, play first and read later.

## Giving feedback

Input is welcome, through issues and discussions rather than code.

- **Found a bug?** Open a [bug report](../../issues/new?template=bug_report.yml).
- **Played it and have thoughts?** Open a [playtest note](../../issues/new?template=playtest_feedback.yml). What confused you, what felt slow, what you wanted to do and couldn't.
- **Have an idea or a design critique?** Open a [design idea](../../issues/new?template=design_idea.yml), or start a thread in Discussions.

Code pull requests are not accepted for now. See [CONTRIBUTING.md](CONTRIBUTING.md) for why and for what makes feedback most useful.

## Running it locally

Needs Node 22 (see `.nvmrc`).

```bash
npm ci
npm run dev
```

`npm run verify` runs lint, typecheck, unit tests, the build and the release checks. `npm run e2e` runs the Playwright smoke tests.

## How this repo is built

The game is built ticket by ticket from a fixed plan in `docs/`. Most implementation is done by AI coding agents working one ticket per pull request under the rules in [CLAUDE.md](CLAUDE.md). The owner sets direction, playtests at each gate, and approves every merge.

| If you are               | Read                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Curious about the game   | [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)                                          |
| Curious about the design | [docs/design/](docs/design/) (`08-lore-SPOILERS.md` spoils the whole game)          |
| Curious about the tech   | [docs/tech/](docs/tech/)                                                            |
| An implementing agent    | [CLAUDE.md](CLAUDE.md), then your ticket in [docs/tickets/](docs/tickets/README.md) |

## Fixed decisions

- Portrait-first, one-thumb play. Landscape and desktop supported.
- Top-down real-time action combat.
- Single-player with a simulated MMO population. No real multiplayer.
- Classless. Skills grow by use. Identity emerges from play.
- Handcrafted continent plus an endless procedural frontier.
- All art and audio generated from data in this repo. No external asset packs.
- Deployed on Cloudflare (Worker with static assets). Free. No ads, no purchases, no accounts, no analytics.
- Saves are encrypted on device and integrity-checked on load. Export files are sealed. Everything is client-side. The save scheme deters casual editing; it is not meant to stop a determined programmer (see [docs/ops/security-review.md](docs/ops/security-review.md)).

## License

No license is granted. The source is published so people can read it and give feedback. All rights are reserved by the owner. You may not copy, modify, redistribute or host the code, art data or game content without written permission.
