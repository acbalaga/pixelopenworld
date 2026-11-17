# M4 World I: world tech and Dawnmeadow

**Result:** the whole first region, streamed seamlessly, with its hub, dungeons, bosses, weather, map, and Waystones. This is the template every later region copies.

**Gate G4:** does Dawnmeadow deliver its hours budget (about 6 hours first pass, about 20 hours to regional 100%)? If not, region counts are re-planned before M8.

---

### POW-M4-01 Refinement: M4 specs to READY

Size: M Depends: M3 complete Status: DRAFT (design authority)

Goal: READY specs for M4, including the region spec format, the stamp format, and the Dawnmeadow design document (`docs/design/regions/01-dawnmeadow.md`: map sketch, zones, settlements, dungeon ideas, boss, NPC list, request list, secrets).
Acceptance: owner approves. The Dawnmeadow doc is the pattern for regions 2 to 8.

### POW-M4-02 World bake

Size: L Depends: M4-01 Status: DRAFT
Refs: design/02-world (Authoring model), tech/01-architecture (World streaming)

Goal: region specs and stamps become chunk files, deterministically.
Scope: region spec format (masks, elevation, roads, rivers, placements, spawn zones). Stamp format v2 (multi-layer ASCII with legend, anchors, variants, rotation rules). Fill generators (terrain, scatter, cliffs through autotile). Road and river carving. Bake to binary chunks and a region manifest in `baked/`. Whole-region PNG render for review. CI drift check.
Acceptance: identical bytes on repeat bake. Bake errors name the spec, stamp, and coordinate. Region PNG attached.

### POW-M4-03 Chunk streaming and caching

Size: L Depends: M4-02 Status: DRAFT
Refs: tech/01-architecture (World streaming, Levels of detail)

Goal: walking across a region never hitches or shows a loading screen.
Scope: 3x3 active and 5x5 loaded windows. Async fetch, decode off the main thread, offscreen layer build spread across frames. IndexedDB chunk cache with versioning. Region prefetch and pinning. Entity activation and freezing at window edges. Chunk deltas in the save (felled trees, opened chests). Service worker integration.
Acceptance: crossing the region at mount speed with 4x CPU throttle holds 60 fps with no frame over 32 ms (trace attached). Offline play of a pinned region works. Deltas persist.

### POW-M4-04 Dawnmeadow terrain and Hearthford

Size: L Depends: M4-02 Status: DRAFT
Refs: docs/design/regions/01-dawnmeadow.md

Goal: the region's land and its hub, authored.
Scope: region spec. Stamps for Hearthford (square, inn, shops, smithy, homes, request board, guild notice wall, market terminal placeholder), three smaller settlements, farms, landmarks visible from afar. Tile and prop art for the biome. Hearthford day and night look. The slice area from M1 is absorbed into the region, including the M3 square fixtures (crafting stations, request board, storage chest, bed), which move to the smithy, inn and square.
Acceptance: region PNG and phone screenshots of every settlement. Every landmark is visible from at least two chunks away. Art contact sheets.

### POW-M4-05 Dawnmeadow creatures and spawns

Size: L Depends: M4-04 Status: DRAFT
Refs: design/04-combat (Enemies)

Goal: the tier 1 roster.
Scope: remaining archetypes needed (Skirmisher, Guard, Swarm, Flyer, Burrower). About 20 tier 1 creatures including day and night rosters and non-hostile wildlife. Non-combat interactions (feed, soothe, scare). Spawn zones with a difficulty ramp. One roaming field boss. Bestiary entries in the Chronicle (first version of the Chronicle tab, bestiary only).
Acceptance: archetype scenario tests. Fight-sim report for the roster against time-to-kill targets. Contact sheets.

### POW-M4-06 Map, fog, Cartography

Size: M Depends: M4-03 Status: DRAFT
Refs: design/02-world (Secrets and discovery), design/09-ui-ux

Goal: the map draws itself as the player explores.
Scope: per-tile-block fog stored compactly in the save. Minimap and full map (pan, pinch zoom). Map rendered in a hand-drawn pixel style from chunk data. Cartography XP from revealing, reveal radius by rank. Player notes. Rumor marks (moved here from M3-11): a location an NPC or Traveler told the player about appears as a hand-drawn mark offset from the true spot by a seeded amount that shrinks with Cartography. Landmark icons appear only once seen.
Acceptance: fog storage for a fully explored continent stays under the save budget share (state the number). Map opens in under 200 ms.

### POW-M4-07 Waystones and fast travel

Size: S Depends: M4-06 Status: DRAFT
Refs: design/02-world (Travel)

Goal: six Waystones in the region, attune and travel.
Scope: attune interaction and effect. Travel UI from the map and at stones. Arrival effect. Respawn binding. Blocked in dungeons and combat.
Acceptance: travel between any attuned pair works across chunk streaming with no hitch over 500 ms. Cannot travel to an unattuned stone.

### POW-M4-08 Dungeon and boss framework

Size: L Depends: M4-02, M3-09 Status: DRAFT
Refs: design/02-world (Dungeons), design/04-combat (Bosses)

Goal: reusable parts for every dungeon and boss in the game.
Scope: room graph format. Building blocks: locks and keys, switches, plates, pushable blocks, light and dark, timed gates, breakable walls, drops, element puzzles, arenas, shortcuts. Persistence rules (solved stays solved, daily enemy respawn). Soft-lock prevention rules and a validator that path-checks each dungeon. Boss framework: phases, scripted attack patterns as data, arena hazards, health gates. Non-combat resolution framework: an alternate objective graph that ends the encounter.
Acceptance: unit test per block. Validator rejects a dungeon with an unreachable key. A sample boss with three phases and a non-combat resolution passes scenario tests both ways.

### POW-M4-09 Time, weather, seasons, lighting

Size: L Depends: M4-03 Status: DRAFT
Refs: design/02-world (Time, seasons, weather), tech/03-asset-pipeline (Palette)

Goal: the day turns, the weather changes, the seasons pass.
Scope: color grading lookup for dawn, day, dusk, night. Point lights (torches, windows, lantern) at night. Weather per region per day from a seeded table: rain, storm, fog (others arrive with their regions). Weather particles and sound. Seasonal tile palettes and crop calendar hooks. Gameplay effects listed in design/02. Calendar UI.
Acceptance: screenshots of the same spot at four times of day and in rain and fog. Weather sequence is deterministic from the seed and day. Frame budget holds in a storm.

### POW-M4-10 Dev map viewer and stamp editor

Size: M Depends: M4-02 Status: DRAFT
Refs: design/02-world (Authoring model)

Goal: the owner and agents can inspect and adjust the world.
Scope: dev-only page: pan and zoom the baked world, toggle layers, collision, spawn zones, POIs. Open a stamp, paint tiles, export the stamp source text to paste into a PR. Teleport the player to a clicked location in dev builds.
Acceptance: a stamp edited in the tool and exported bakes to the same result shown in the tool. Not present in production builds.

### POW-M4-11 Dawnmeadow dungeons, bosses, points of interest

Size: L (split per dungeon if needed) Depends: M4-05, M4-08 Status: DRAFT
Refs: docs/design/regions/01-dawnmeadow.md, design/02-world

Goal: the region's authored challenges.
Scope: 4 dungeons (one is the pass dungeon), 12 mini-dungeons, 30 POIs, the regional boss with its non-combat resolution, each dungeon's return-visit secret. Bake check: every land chunk has at least one discoverable (POI, node cluster, secret, vista, or settlement), build fails otherwise. Lore fragment placeholders at the positions the region doc lists (content arrives in M10).
Acceptance: dungeon validator passes for all. Scripted clears for each dungeon. Boss beaten both ways in scenario tests. Coverage check passes.

### POW-M4-12 Dawnmeadow people and requests, pacing ledger

Size: L Depends: M4-04, M3-11 Status: DRAFT
Refs: design/05-life-systems (Requests, Relationships), design/10-content-budget (Verification)

Goal: the region is inhabited, and its hours are counted.
Scope: about 15 named NPCs with schedules, homes, and likes (friendship itself arrives in M6, the data is authored now). 25 authored requests (this absorbs the 20 Hearthford requests moved out of M3), 5 Threads, at least 8 with a non-combat solution. The rank 15 Trials for every wired skill that M3 did not author (M3 authored Blades, Polearms, Evasion, Ember, Athletics, Foraging, Smithing, Cooking), and rank 30 Trials for skills whose trainers live here. Move the M3 slice givers (Orla, Wren, Hesper, Brin, the Pilgrim) into Hearthford without breaking their Trials or requests. `estMinutes` on every authored content item. `tools/pacing-ledger` sums by category and region, writes a report, and fails CI under budget. `docs/ops/gate-g4.md` owner checklist.
Acceptance: ledger report shows Dawnmeadow at or above budget. NPC schedule tests. Owner action: play G4.
