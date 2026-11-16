# Pixel Open World

A mobile, browser-based, open world pixel RPG where you become whatever you decide to be. You log into a world that feels like a living online game, full of other "players" with their own lives. Nobody tells you what the world is. You find out, or you don't.

**Status:** planning complete, implementation not started.

## Start here

| If you are | Read |
|---|---|
| The owner | [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) |
| An implementing agent | [CLAUDE.md](CLAUDE.md), then the ticket you were assigned in [docs/tickets/](docs/tickets/README.md) |
| Curious about the design | [docs/design/](docs/design/) (note: `08-lore-SPOILERS.md` spoils the whole game) |

## Fixed decisions

- Portrait-first, one-thumb play. Landscape and desktop supported.
- Top-down real-time action combat.
- Single-player with a simulated MMO population. No real multiplayer.
- Classless. Skills grow by use. Identity emerges from play.
- Handcrafted continent plus an endless procedural frontier.
- All art and audio generated from data in this repo. No external asset packs.
- Deployed on Cloudflare (Worker with static assets). Free. No ads, no purchases, no accounts, no analytics.
- Saves are encrypted on device and signed by the Worker. Offline play works.
