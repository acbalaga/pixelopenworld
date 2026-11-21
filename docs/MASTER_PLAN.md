# Pixel Open World: Master Plan

This is the controlling document. Design docs give the detail. Tickets give the work. If two documents disagree, this one wins, then the design and tech docs, then the tickets.

## 1. The game in one paragraph

You log into Pixel Open World, a fantasy world that behaves like a living online game. Other "players" (called Travelers) log in and out on their own schedules, form parties, argue in chat, climb rankings, and sell on the market. You have no class and no assigned story. You get better at what you do, and the world starts treating you as what you have become: a spellblade, a master chef, a beast warden, a merchant with three shops, a hermit cartographer. Under the cozy surface there is a truth about what this world is. The game never tells you. The evidence is there for players who look.

## 2. Pillars

Every design and scope argument is settled against these, in order.

1. **Become, don't pick.** Identity comes from what the player does. No class select, no locked builds, non-combat lives are complete lives.
2. **A world that lives without you.** Travelers, markets, seasons, and events move whether or not the player is watching.
3. **Found, not told.** Lore, secrets, and systems depth are discovered. The game does not explain its mystery and does not gate play behind it.
4. **Respect the thumb and the clock.** One-thumb portrait play. Sessions of 3 minutes and 3 hours both make progress. Mastery earns automation.
5. **Readable pixels.** Pixel art everywhere it reads well. Where it does not, use crisp text. Legibility beats purity.

## 3. Decision log

Decisions made with the owner on 2026-11-16. Changing one needs a planning PR.

| #   | Topic             | Decision                                                                                                                                                                                                                                                            |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Multiplayer       | Single-player. Simulated MMO population. No real multiplayer.                                                                                                                                                                                                       |
| D2  | Camera and combat | Top-down, real-time action.                                                                                                                                                                                                                                         |
| D3  | World             | Hybrid. Handcrafted continent plus endless procedural frontier.                                                                                                                                                                                                     |
| D4  | Assets            | All art and audio generated from data in the repo.                                                                                                                                                                                                                  |
| D5  | Progression       | Classless, learn by doing. Emergent Paths and titles.                                                                                                                                                                                                               |
| D6  | Automation        | In-world automation earned through mastery. Offline gains, capped.                                                                                                                                                                                                  |
| D7  | Hosting           | Cloudflare Worker with static assets, deployed through Cloudflare's own Git integration. No deploy tokens stored in GitHub.                                                                                                                                         |
| D8  | Saves             | Client-only. Encrypted on device, sealed export files, integrity-checked on load. Not hand-editable and not easy to crack. No accounts, no secrets, no server-side save service. (Revised 2026-11-16: the owner declined Worker signing to avoid managing secrets.) |
| D9  | Setting           | Fantasy game-world with a discoverable hidden layer.                                                                                                                                                                                                                |
| D10 | Orientation       | Portrait first, one-thumb. Landscape and desktop supported.                                                                                                                                                                                                         |
| D11 | Business model    | Free. No ads, purchases, accounts, or analytics.                                                                                                                                                                                                                    |
| D12 | Tickets           | Specs in the repo. GitHub issues opened per milestone as it becomes active.                                                                                                                                                                                         |
| D13 | Default controls  | Decided at Gate G1 (2026-11-17): Flow in portrait, Classic in landscape and on gamepad or keyboard. Flow dodges with the dodge button; flick dodge is removed.                                                                                                      |
| D14 | Gate G2           | Passed 2026-11-17 with the multi-day offline step still running. M3 starts in parallel; the residual risk is recorded in `docs/ops/security-review.md`.                                                                                                             |
| D15 | M3 scope          | M3 builds the engines with a proving set of content on the slice map. The remaining rank 15 Trials and the Hearthford requests move to M4-12. Skills with no system yet are defined but earn no XP until their milestone (`PENDING_SKILLS`).                        |
| D16 | Action meter      | Owner playtest 2026-11-18 (docs/ops/playtest-m3.md). Every timed step (gather, craft, fish) is drawn above the avatar in the world view, never in the thumb zone. The avatar shows a work animation.                                                                |
| D17 | Skill awakening   | Skills are dormant and invisible until first real use. Band 0 techniques have a source (innate, taught, manual, insight). A new character knows only the basic swing of the weapon held. Existing characters keep what they know.                                   |
| D18 | Hub layout        | Hubs are districts joined by streets. The square holds civic things only. Each crafting station lives in its own workshop.                                                                                                                                          |
| D19 | Fresh start       | A new character wakes at one of eight wake points outside Hearthford, chosen by its own seed, with one bread, a wooden dagger and ragged clothes. Replaces "appear at the Waystone in the square".                                                                  |
| D20 | Temperament       | Every creature has a temperament (hostile, territorial, defensive, skittish, passive, curious) that decides whether and when it attacks.                                                                                                                            |
| D21 | Messages and Menu | One message layout with fixed lanes. The Menu is rebuilt on shared panel components. Both before M5 adds chat volume.                                                                                                                                               |
| D22 | Avatar setup      | Deeper cosmetic options plus an origin that only narrows the wake points and sets the first line. No stat, item or XP effect.                                                                                                                                       |
| D23 | Inspirations      | Two principles from the owner's reference anime, never their content: Singulars (rare hidden questlines started by odd actions) and freedom of route (every gate has more than one way past it). Playtest fixes run first in M4, then the region work.              |
| D24 | M5 timing         | Decided 2026-11-21 during the Gate G4 playtest. The M5 refinement is drafted while G4 runs and merges only after the G4 verdict, with G4 findings added as an M5 Wave A.                                                                                            |
| D25 | Traveler homes    | All 240 Travelers are generated in M5 with their final home region stored. Until a home region is baked, its Travelers play in Dawnmeadow and move when M8 and M9 bake their regions. Chat never names an unbaked place.                                            |
| D26 | Chat glyphs       | No OS emoji. Emoji-style voices use plain text emoticons plus about 12 in-house pixel glyphs drawn from repo data.                                                                                                                                                  |
| D27 | Gate G5a          | An owner crowd check runs after POW-M5-04 and POW-M5-05 merge. Parties, guilds, duels, mail and the market do not start until it passes.                                                                                                                            |

Decisions made by the design authority (owner may overrule):

| #   | Topic              | Decision                                                                                                 | Why                                                                                                                                                                                         |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Engine             | Custom TypeScript engine on Canvas 2D. No game framework.                                                | Internal resolution is about 180 px wide, so Canvas 2D is fast enough. A pure deterministic sim is required for offline settlement and save plausibility checks, and frameworks fight that. |
| A2  | Sim rate           | Fixed 30 Hz simulation, interpolated rendering.                                                          | Halves CPU on phones. Pixel-art motion does not benefit from 60 Hz logic.                                                                                                                   |
| A3  | No character level | Power comes from skills, gear, and food. Regions have fixed difficulty tiers.                            | Level scaling kills the feeling of becoming strong. Fixed tiers make the map itself the difficulty curve.                                                                                   |
| A4  | Traveler chat      | Template-driven from real sim events. Player replies with choice chips. No free text, no language model. | Runs offline, costs nothing, cannot say anything unsafe, and every line is tied to something that actually happened in the sim.                                                             |
| A5  | World authoring    | Regions are spec files plus hand-authored stamps, baked at build time.                                   | Agents cannot paint maps in an editor. Specs and stamps are reviewable in a diff and deterministic.                                                                                         |
| A6  | Time               | One in-game day is 48 real minutes. A season is 7 days. A year is 28 days (about 22 hours of play).      | Short enough that a session sees dawn and dusk. Long enough that seasons matter.                                                                                                            |
| A7  | Failed integrity   | A save that fails the integrity check is marked Flagged. It is never deleted or blocked.                 | Single-player and free. Punishing false positives would cost more than cheating does.                                                                                                       |

## 4. Document map

**Design**

| Doc                                                      | Covers                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| [01-experience](design/01-experience.md)                 | Player fantasy, core loops, first hour, session shapes                 |
| [02-world](design/02-world.md)                           | Regions, structure, travel, time, weather, dungeons, the frontier      |
| [03-progression](design/03-progression.md)               | Skills, mastery, attributes, Paths, Forms                              |
| [04-combat](design/04-combat.md)                         | Controls, weapons, magic, enemies, bosses, death                       |
| [05-life-systems](design/05-life-systems.md)             | Gathering, crafting, farming, housing, economy, relationships          |
| [06-automation](design/06-automation.md)                 | Routines, Tactics, Patrol, offline gains                               |
| [07-simulated-mmo](design/07-simulated-mmo.md)           | Travelers, chat, parties, guilds, rankings, market, events             |
| [08-lore-SPOILERS](design/08-lore-SPOILERS.md)           | The hidden layer. Spoils everything.                                   |
| [09-ui-ux](design/09-ui-ux.md)                           | Screen layout, text rules, menus, accessibility                        |
| [10-content-budget](design/10-content-budget.md)         | Counts, playtime model, 100% definition                                |
| [11-skill-table](design/11-skill-table.md)               | The 36 skills: XP sources, band 0 and 15 grants, sources, the M3 Paths |
| [regions/01-dawnmeadow](design/regions/01-dawnmeadow.md) | Region 1 in full. The pattern for every region doc.                    |

**Tech**

| Doc                                            | Covers                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| [01-architecture](tech/01-architecture.md)     | Stack, layout, sim/render split, data, streaming                           |
| [02-save-security](tech/02-save-security.md)   | Save format, encryption, sealed exports, integrity validator, threat model |
| [03-asset-pipeline](tech/03-asset-pipeline.md) | Sprite, tile, and audio formats and the bake                               |
| [04-quality](tech/04-quality.md)               | Testing, performance budgets, CI, device matrix                            |

**Tickets:** [docs/tickets/README.md](tickets/README.md)

**Playtests:** [docs/ops/playtest-m3.md](ops/playtest-m3.md) (owner, after M3, the source of D16 to D23)

## 5. Roadmap

Thirteen milestones. Each ends with a playable build on the Cloudflare preview URL and an owner review. Milestones M0 to M4 are fully specified and READY. Later milestones are specified at ticket level and marked DRAFT. Each opens with a refinement ticket that turns DRAFT into READY using what the earlier milestones taught us.

| M   | Name             | Player-visible result                                                                   | Tickets |
| --- | ---------------- | --------------------------------------------------------------------------------------- | ------- |
| M0  | Foundation       | A character-less test map renders and scrolls on a phone, deployed.                     | 11      |
| M1  | First Login      | A 20 minute slice: create an avatar, fight, forage, cook, talk, save.                   | 11      |
| M2  | Trust            | Encrypted saves, integrity checks, sealed export and import, installable offline PWA.   | 6       |
| M3  | Core RPG         | All 36 skills, gear, crafting, shops, requests, Paths.                                  | 14      |
| M4  | World I          | Playtest fixes, chunk streaming, the full first region, map, dungeons, bosses, weather. | 21      |
| M5  | The Crowd        | Travelers, chat, parties, guilds, rankings, market, world events.                       | 12      |
| M6  | A Second Life    | Farming, housing, cooking, fishing, taming, relationships, festivals, shops.            | 11      |
| M7  | Automation       | Routines, Tactics, Patrol, offline gains.                                               | 9       |
| M8  | World II         | Regions 2 to 4.                                                                         | 10      |
| M9  | World III        | Regions 5 to 8 and the Undercroft.                                                      | 11      |
| M10 | The Hidden Layer | Lore fragments, cipher, Chronicle, anomalies, the Truths, Forms.                        | 10      |
| M11 | The Unwritten    | Endless procedural frontier and postgame.                                               | 8       |
| M12 | Release          | Accessibility, performance, balance, device QA, 1.0.                                    | 10      |

Sequencing logic: M0 to M2 remove the technical risks (render performance on phones, control feel, save trust). M3 to M7 build every system against one region, so systems are proven before content is multiplied. M8 and M9 are content production against stable systems. M10 lands the mystery once the world it hides in exists. M11 and M12 extend and finish.

## 6. Gates

A milestone does not close until its gate passes. Gates are owner decisions, made on the preview build.

| Gate          | Question                                                                                                                         | If no                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| G0 (end M0)   | Does the test map hold 60 fps on a mid-range phone?                                                                              | Fix renderer before any gameplay.                                               |
| G1 (end M1)   | Is one-thumb combat fun for 20 minutes?                                                                                          | Iterate controls. This gate matters most. Nothing downstream survives bad feel. |
| G2 (end M2)   | Can a save be opened or edited by hand? Does offline play survive a week?                                                        | Fix before systems multiply save complexity.                                    |
| G4 (end M4)   | Does one region deliver its hours budget (see content budget)? Are the M3 playtest findings resolved?                            | Re-plan region counts before M8.                                                |
| G5a (mid M5)  | After Travelers walk and talk (M5-04, M5-05): does Hearthford feel populated, and does chat read as people, at two times of day? | Fix the crowd before parties, guilds and the market build on it.                |
| G7 (end M7)   | Does automation feel earned, and does it leave the game worth playing by hand?                                                   | Retune gates and caps.                                                          |
| G10 (end M10) | Can a blind playtester find the first Truth with no prompts? Can they ignore it and still have a full game?                      | Adjust clue density.                                                            |

## 7. Top risks

| Risk                                                               | Consequence                                      | Control                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Text-authored pixel art looks amateur                              | The game is judged in the first screenshot       | Strict art bible, small master palette, procedural generators for tiles and variations, screenshot review in every art PR (tech/03). Owner art review at G1.                                                                                                                                                   |
| One-thumb real-time combat feels bad                               | Core loop fails                                  | Prototype in M1 with two control schemes, decided at G1 before more combat content.                                                                                                                                                                                                                            |
| Scope: 150+ hours of content                                       | Never ships                                      | Systems first on one region. Content is data produced from templates. Budget doc has a cut order. Every milestone ends playable.                                                                                                                                                                               |
| Save tampering                                                     | Owner asked for saves that are not easy to crack | Files are encrypted binary and fail to load if edited. A re-sealed edit must still pass the integrity validator. The scheme is client-only, so a programmer who studies the code can defeat it, and live memory edits cannot be prevented in any browser game. The threat model states this plainly (tech/02). |
| Simulated crowd feels fake                                         | The VRMMO fantasy fails                          | Chat lines come only from real sim events. Travelers persist, progress, and remember the player. Fewer, deeper Travelers beat many shallow ones.                                                                                                                                                               |
| Offline gains trivialize play                                      | Game plays itself                                | Automation needs manual mastery first, yields less than manual play, cannot produce firsts, rare drops, or rank-ups.                                                                                                                                                                                           |
| Mobile browser limits (storage eviction, audio unlock, iOS quirks) | Lost saves, silent game                          | Persistent storage request, export reminders, three rotating local snapshots, device matrix in M0 and M12.                                                                                                                                                                                                     |

## 8. What is deliberately out of scope

- Real multiplayer of any kind.
- Accounts, cloud sync, leaderboards against real people.
- Monetization, ads, analytics, tracking.
- Free-text chat and any language-model-generated content at runtime.
- Voice acting. Localization beyond English (strings are table-driven so it stays possible).
- Native app store builds.
