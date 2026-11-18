# 10 Content budget and playtime

The owner's requirement: 100% completion takes at least as long as a large Zelda or comparable RPG, without forcing it. Reference point used for planning: completionist runs of the largest Zelda games sit in the 150 to 200 hour range, with the critical path around 40 to 60.

## Targets

| Playstyle                                                   | Target hours                                          |
| ----------------------------------------------------------- | ----------------------------------------------------- |
| Reach and resolve the 8th regional boss, light side content | 40 to 55                                              |
| A satisfying "I lived a life here" playthrough              | 80 to 120                                             |
| 100% Chronicle                                              | 160 to 220                                            |
| Beyond                                                      | Unbounded (the Unwritten, rankings, market, building) |

These are planning estimates. They are checked, not assumed (see Verification).

## What 100% means

The Chronicle tracks ten categories. 100% is all ten complete. The Unwritten is excluded.

| #   | Category  | Count                                               | Complete when                                                |
| --- | --------- | --------------------------------------------------- | ------------------------------------------------------------ |
| 1   | Map       | About 1,150 land chunks                             | Every continental and Undercroft chunk visited               |
| 2   | Waystones | 48 continental + 12 Undercroft                      | All attuned                                                  |
| 3   | Dungeons  | 32 dungeons, 96 mini-dungeons, 10 Undercroft depths | All cleared, each dungeon's return-visit secret found        |
| 4   | Bestiary  | 160 creatures, 46 bosses                            | Each defeated or befriended, entry filled                    |
| 5   | Skills    | 36                                                  | All at Master (75). Grandmaster is beyond 100%.              |
| 6   | Crafting  | 900 items, 200 dishes, 96 fish                      | Each made or obtained once                                   |
| 7   | Requests  | 200 authored requests, 40 Threads                   | All finished                                                 |
| 8   | People    | 120 NPCs, 12 guilds                                 | Every NPC at 3 hearts, visited every guild hall              |
| 9   | Paths     | 48 standard                                         | All earned. The 12 hidden Paths and 6 Forms are beyond 100%. |
| 10  | Lore      | 144 fragments, 8 Truths                             | All found and linked                                         |

Skills at 75 and standard Paths only are deliberate. The last stretch of any completion list should not be the worst part of the game. Grandmaster ranks, hidden Paths, Forms, Singulars (design/03), rankings first place, and legendary fish are "beyond 100%" and marked with a separate star. Their `estMinutes` still count toward a region's hours in the pacing ledger, because players do find them.

## Hours model

| Source                                | Basis                                                    | Hours             |
| ------------------------------------- | -------------------------------------------------------- | ----------------- |
| Regions, first pass                   | 8 regions x about 6 h (explore, hub, pass dungeon, boss) | 48                |
| Remaining dungeons                    | 24 x 30 min                                              | 12                |
| Mini-dungeons                         | 96 x 8 min                                               | 13                |
| Undercroft                            | 10 depths x 1.5 h                                        | 15                |
| Authored requests                     | 200 x 10 min                                             | 33                |
| Threads                               | 40 x 45 min                                              | 30                |
| POIs and map completion               | 240 POIs x 4 min, plus sweep                             | 22                |
| Skills to Master                      | See below                                                | 35                |
| Crafting, fishing, cooking completion | Net of what the above already produced                   | 15                |
| People                                | Net of requests                                          | 8                 |
| Paths                                 | Net of skills and deeds                                  | 8                 |
| Lore                                  | Fragments mostly found in passing, Truth locations       | 10                |
| **Total**                             |                                                          | **About 250 raw** |

Overlap (activities that advance several categories at once) is estimated at 20 to 30%, giving 175 to 200 hours. That sits inside the target.

### Skills to Master, and why this is not 36 x 9 hours

- Manual cost to 75 in one skill is about 9 hours of focused use.
- About 12 skills reach 50+ as a by-product of the content above (the player's main weapons, Evasion, Athletics, Cartography, Foraging, Cooking, and so on).
- From Expert (50), Routines contribute 25% XP in the background, and the first-time bonus makes breadth (new recipes, new species) worth more than repetition.
- Trials at 15, 30, 50, and 75 are authored content: 36 x 4 = 144 Trials at about 6 minutes each, already about 14 hours of real play that is not grind.
- Net additional focused time for the remaining skills: about 35 hours.

Automation is what makes this pleasant, which is the point of the automation pillar. It cannot shortcut the Trials.

## Production counts (what must be authored)

| Asset type                            | Count                          | Produced in                  |
| ------------------------------------- | ------------------------------ | ---------------------------- |
| Regions                               | 8 + Undercroft                 | M4, M8, M9                   |
| Stamps (buildings, rooms, set pieces) | About 1,200                    | M4, M8, M9                   |
| Creatures                             | 160 + 46 bosses                | M3 to M9                     |
| Items                                 | 900                            | M3 to M9                     |
| Techniques                            | About 220                      | M3, M8, M9                   |
| Trials                                | 144 + 36 Grandmaster           | M3, M6, M8, M9               |
| NPCs                                  | 120                            | M4, M8, M9                   |
| Travelers                             | 240 (generated), 24 hand-tuned | M5                           |
| Authored requests and Threads         | 200 + 40                       | M4, M8, M9                   |
| Lore fragments                        | 144                            | M10 (placed), written in M10 |
| Chat templates                        | About 1,500                    | M5, extended per region      |
| Music tracks                          | About 40                       | M4 to M12                    |
| Sound effects                         | About 300                      | M0 onward                    |

Per-region share is one eighth of the regional numbers. M4 produces region 1 in full and is the test of whether these counts are affordable (Gate G4).

## Verification

Hours are measured three ways:

1. **Pacing ledger.** Every authored piece of content carries an `estMinutes` field. A build script sums by category and region and fails CI if a region drops under its budget. (POW-M4-12)
2. **Bot runs.** A headless sim bot with simple policies plays requests, fights, and gathers to measure real time-to-complete for systemic content and skill curves. (POW-M3-12, POW-M12-03)
3. **Owner playtests** at Gates G1, G4, G7, G10.

## Cut order

If scope must shrink, cut in this order. Each cut keeps the pillars intact.

1. Caravans and civic life (office, town projects).
2. Forms beyond three.
3. Traveler count from 240 to 160 (keep memory and voice depth).
4. Mini-dungeons from 12 to 8 per region.
5. Region 6 or 7 merged into one.
6. Boats and open sea (islands become bridges and ferries).

Never cut: non-combat boss resolutions, Trials, the text rule, save trust, the Keeper.
