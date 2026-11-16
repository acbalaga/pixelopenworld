# M3 Core RPG systems

**Result:** the slice area now runs on the full rule set. All 36 skills, gear with quality, all seven crafts, shops, request boards, statuses and magic, Paths.

Starts only after Gate G1 passes. All tickets DRAFT until M3-01 merges.

---

### POW-M3-01 Refinement: M3 specs to READY
Size: M      Depends: Gate G1      Status: DRAFT (design authority)
Refs: all design docs, G1 playtest notes

Goal: turn every M3 ticket into a READY spec using what G1 taught.
Scope: fix the default control scheme. Write the full skill table (36 skills, XP sources, techniques per rank band). Define data shapes for items, recipes, statuses, Paths, requests. Adjust numbers the playtest contradicted.
Acceptance: owner approves the docs PR. Every M3 ticket is READY.

### POW-M3-02 Full skill framework
Size: L      Depends: M3-01      Status: DRAFT
Refs: design/03-progression

Goal: all 36 skills exist with XP sources, curves, and rank effects.
Scope: skill data for all six families. Event-to-XP mapping for every skill. Challenge multiplier and first-time bonus generalized. Family totals feeding attributes. Skills tab shows all, grouped, with next-Trial hint text.
Acceptance: every skill can gain XP from at least one implemented action (test enumerates skills). XP-per-hour report from scripted play is within the budget in design/10 for 3 sampled skills.

### POW-M3-03 Trials framework and first Trials
Size: L      Depends: M3-02      Status: DRAFT
Refs: design/03-progression (Mastery ranks and Trials)

Goal: mastery thresholds are gated by authored manual tests.
Scope: Trial definition format (giver, conditions, objective types: craft at quality, defeat under constraint, gather under conditions, perform, deliver, reach). XP banking at 15, 30, 50, 75, 100. Trial log in Skills tab. Author the rank 15 Trial for all 36 skills, placed in or near Hearthford.
Acceptance: banking and release tested per threshold. Each of the 36 Trials is completable in a scripted run. No Trial is completable by an automated worker (test attempts it through the Routine code path once M7 exists, flagged as a follow-up test).

### POW-M3-04 Techniques and loadouts
Size: L      Depends: M3-02      Status: DRAFT
Refs: design/03-progression (Techniques), design/04-combat

Goal: any technique from any skill can be slotted, and two loadouts swap.
Scope: technique data format (cost, cooldown, hit data, aim type, effects). Implement the first two rank bands of techniques for all Arms and Magic skills, plus actives for Stealth, Performance, Taming. Remaining weapon families (Heavy Arms, Archery, Unarmed) and Shieldcraft block and parry. Loadout save and swap with in-combat lockout.
Acceptance: each weapon family meets its described feel in a scenario test (reach, cadence, property). A mixed loadout (spell, weapon technique, song, command) works. Time-to-kill per family within 15% of each other at par.

### POW-M3-05 Items, equipment, quality, durability
Size: L      Depends: M3-01      Status: DRAFT
Refs: design/05-life-systems (Crafting)

Goal: the full item model.
Scope: quality tiers on crafted items. Maker's mark. Durability and repair. Up to two affix slots (applied later by Enchanting). Tool tiers. Tier 1 and 2 item set (about 120 items). Bag filters and sorting. Storage chests.
Acceptance: save migration from M1 items with fixture. Stat calculation tests across tier, quality, affix. Icons contact sheet.

### POW-M3-06 Gathering: nodes, tools, variants
Size: M      Depends: M3-05      Status: DRAFT
Refs: design/05-life-systems (Gathering)

Goal: Mining, Logging, Foraging, and Fishing spots work with tools, timing, respawn, and conditions.
Scope: node types and tiers. Tool requirement rules (slow, not blocked). Timing input per skill. Weather, season, and time-of-day variants hook (uses the clock from M2-07, weather arrives in M4). Fishing spot placeholder with a simple catch (full minigame in M6).
Acceptance: yield and quality tests for tool tier below, at, above node tier. Respawn timers persist across save and offline time.

### POW-M3-07 Crafting: stations, recipes, experimentation
Size: L      Depends: M3-05, M3-06      Status: DRAFT
Refs: design/05-life-systems (Crafting)

Goal: all seven crafts are playable through tier 2.
Scope: station types. Recipe data and the experiment flow generalized. The manual step per craft (hammer timing, stir rhythm, stitch trace, and so on, each a small one-thumb input). Quality roll rule. Enchanting applies affixes. Tinkering makes gadgets and (later) golem parts. About 80 recipes.
Acceptance: quality distribution tests against skill and material inputs. Experimenting with a valid unknown combination discovers the recipe once. Each manual step is playable one-handed (screenshots plus input tests).

### POW-M3-08 Paths and deeds
Size: L      Depends: M3-02      Status: DRAFT
Refs: design/03-progression (Paths)

Goal: the world recognizes what the player has become.
Scope: deed counters fed by sim events. Path definition format (requirements, gifts, address forms). Worn Paths (three) swapped at beds. Title over the avatar. NPC address-form substitution in dialogue. Author the first 16 Paths reachable with tier 1 to 2 content, each with a counterpart that plays opposite. Path earned banner. Hidden requirements stay hidden.
Acceptance: each of the 16 Paths is earned in a scripted run. Gifts apply only while worn. Dialogue uses the worn title.

### POW-M3-09 Statuses, elements, reactions, magic
Size: L      Depends: M3-04      Status: DRAFT
Refs: design/04-combat (Magic, Reactions, Statuses)

Goal: the six schools and the reaction table work on enemies, the player, and the environment.
Scope: status system (one rule each, max four shown). Element tags on tiles and objects (flammable, wet, frozen). Reactions table as data. World interactions per school (burn brush, douse fire, grow crops, raise platforms). Food buffs move onto the status system.
Acceptance: a test per reaction. A test per world interaction. Statuses on the player follow the same rules as on enemies.

### POW-M3-10 Economy: coin, shops, bartering
Size: M      Depends: M3-05      Status: DRAFT
Refs: design/05-life-systems (Economy)

Goal: stable NPC trade with a skill behind it.
Scope: shop inventories with restock on the world clock. Regional price modifiers. Bartering skill: a short offer and counter-offer exchange that shifts price within bounds. Buyback. Repair service. Coin sinks listed in design/05 that exist so far.
Acceptance: price bounds tested (Bartering can never produce a buy-below-sell loop). Restock survives offline time.

### POW-M3-11 Requests engine, boards, dialogue v2
Size: L      Depends: M3-08, M3-10      Status: DRAFT
Refs: design/05-life-systems (Requests), design/01-experience (No main quest), design/02-world (Secrets and discovery)

Goal: boards post jobs, and jobs accept more than one solution.
Scope: request data format with objective graph, alternative solutions, and rewards. Standing request generator from templates and sim state. Board UI. Request log in the asker's words, one pinnable. Rumor marks on the map with deliberate imprecision. Dialogue conditions and effects extended (Paths, Renown, time, weather). Renown per region. 20 authored requests for the Hearthford area, at least 6 with a non-combat solution.
Acceptance: each authored request completes in a scripted run by each of its solutions. No objective arrow or auto-path exists in the build. Generator never posts an impossible request (property test).

### POW-M3-12 Balance harness
Size: L      Depends: M3-04, M3-07      Status: DRAFT
Refs: tech/04-quality (Balance workflow), design/10-content-budget (Verification)

Goal: numbers are checked by machines.
Scope: `tools/fight-sim` runs data-defined fights headless and reports time-to-kill, damage taken, resource use by tier and build. `tools/sim-bot` v1 plays simple policies (gather loop, fight loop, craft loop, request loop) and reports XP per hour, coin per hour, and summary sequences for the plausibility harness. Reports written as markdown to `reports/`. CI job that runs a short version and fails on regression past thresholds.
Acceptance: reports generated for tier 1 and 2. Time-to-kill targets from design/04 met or the deviations listed. Bot summaries pass plausibility with zero flags.
