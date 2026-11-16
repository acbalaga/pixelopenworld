# M8 World II: regions 2 to 4

**Result:** Whisperwood, Saltreach, and Ironvale, each to the standard Dawnmeadow set.

Content production against stable systems. If a region needs a new system, that is a Design Query, not an improvisation.

## Region production template

Every region is produced by a "world" ticket and a "content" ticket.

**World ticket delivers:** region spec, stamps for the hub and three settlements, biome tile and prop art, landmarks, 6 Waystones, weather types new to the region, region day and night music, bake and region PNG.

**Content ticket delivers:** about 20 creatures plus the field boss, 4 dungeons (one pass dungeon with the regional boss and its non-combat resolution), 12 mini-dungeons, 30 POIs, about 15 NPCs with schedules and friendship content, 25 authored requests, 5 Threads, Trials hosted in the region, homestead plot, guild halls placed here, fragment placeholders, chat templates and Traveler activity hooks for the region, a festival if the region hosts one.

**Both must pass:** dungeon validator, chunk coverage check, pacing ledger at budget, fight-sim targets for the tier, frame budget in the hub, contact sheets and phone screenshots in the PR. Each ticket may be split into several PRs along natural seams (per dungeon, per settlement).

---

### POW-M8-01 Refinement: M8 specs to READY

Size: L Depends: M7 complete Status: DRAFT (design authority)

Goal: region design documents for Whisperwood, Saltreach, and Ironvale in `docs/design/regions/`, following the Dawnmeadow pattern, and READY specs for M8.
Acceptance: owner approves each region doc.

### POW-M8-02 Whisperwood: world

Size: L Depends: M8-01 Status: DRAFT
Refs: docs/design/regions/02-whisperwood.md, template above

Goal: tier 2 forest. Fog, giant roots, Mossgate tree village.
Scope: template. Region-specific: dense canopy overhead layers, fog weather, paths that are easy to lose (landmark design matters most here).
Acceptance: template.

### POW-M8-03 Whisperwood: content

Size: L Depends: M8-02 Status: DRAFT
Refs: region doc, template

Goal: template. Signature activities: Foraging, Taming, Archery. Trainers and rank 30 to 50 Trials for those skills live here.
Acceptance: template.

### POW-M8-04 Saltreach: world

Size: L Depends: M8-01 Status: DRAFT
Refs: docs/design/regions/03-saltreach.md, template

Goal: tier 3 coast. Cliffs, islands, Port Brine harbor city (largest hub, home of the Market).
Scope: template. Region-specific: sea tiles, tides as a daily cycle that opens and closes paths, storm weather.
Acceptance: template. Port Brine with a market-day crowd holds the frame budget.

### POW-M8-05 Boats and the sea

Size: L Depends: M8-04 Status: DRAFT
Refs: design/02-world (Travel)

Goal: sail between islands.
Scope: boat as a vehicle (board, steer, dock). Sea chunks and streaming at boat speed. Sea creatures and hazards. Sea fishing. Islands with secrets. Crafted boat tiers through Woodworking.
Acceptance: boarding and docking cannot strand the player (tests for every dock and beach rule). Streaming holds at boat speed.

### POW-M8-06 Saltreach: content

Size: L Depends: M8-04, M8-05 Status: DRAFT
Refs: region doc, template

Goal: template. Signature: Fishing, Bartering, sailing. The full Market hall. Market day event.
Acceptance: template.

### POW-M8-07 Ironvale: world

Size: L Depends: M8-01 Status: DRAFT
Refs: docs/design/regions/04-ironvale.md, template

Goal: tier 4 foothills. Mines, quarries, Anvil Rest.
Scope: template. Region-specific: multi-level mine interiors, minecart rails as a traversal toy.
Acceptance: template.

### POW-M8-08 Ironvale: content

Size: L Depends: M8-07 Status: DRAFT
Refs: region doc, template

Goal: template. Signature: Mining, Smithing, Tinkering. First large guild halls. Claimable mine shafts for Routines.
Acceptance: template.

### POW-M8-09 Tier 2 to 4 systems content

Size: L Depends: M8-01 Status: DRAFT
Refs: design/03-progression, design/05-life-systems, design/10-content-budget

Goal: the items, recipes, techniques, Trials, and Paths that tiers 2 to 4 need.
Scope: about 300 items, 120 recipes, third technique band for all active skills, Trials at 30 and 50 not hosted by a specific region ticket, 16 more Paths with counterparts, crops, fish, and tameables for these regions.
Acceptance: content validation clean. Fight-sim and bot reports for tiers 2 to 4 inside targets. Every new recipe is reachable.

### POW-M8-10 Integration and pacing check

Size: M Depends: M8-02 to M8-09 Status: DRAFT
Refs: design/10-content-budget, tech/04-quality

Goal: four regions that play as one world.
Scope: cross-region travel, Traveler distribution across regions, market items from new regions, rankings updated, chat templates referencing new places. Pacing ledger for regions 1 to 4. Soak test of a long bot run across all four. Save size check against budget. Fix defects only.
Acceptance: ledger at budget for each region. Soak shows no memory growth and no plausibility flags. Save size reported and within the trajectory for 500 KB at 200 hours.
