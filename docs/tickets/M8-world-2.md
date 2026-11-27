# M8 World II: regions 2 to 4

**Result:** Whisperwood, Saltreach, and Ironvale, each to the standard Dawnmeadow set.

Content production against stable systems. If a region needs a new system, that is a Design Query, not an improvisation.

## Region production template

Every region is produced by a "world" ticket and a "content" ticket.

**World ticket delivers:** region spec, stamps for the hub and three settlements, biome tile and prop art, landmarks, 6 Waystones, weather types new to the region, region day and night music, bake and region PNG.

**Content ticket delivers:** about 20 creatures plus the field boss, 4 dungeons (one pass dungeon with the regional boss and its non-combat resolution), 12 mini-dungeons, 30 POIs, about 15 NPCs with schedules and friendship content, 25 authored requests, 5 Threads, Trials hosted in the region, homestead plot, guild halls placed here, fragment placeholders, chat templates and Traveler activity hooks for the region, a festival if the region hosts one.

**Both must pass:** dungeon validator, chunk coverage check, pacing ledger at budget, fight-sim targets for the tier, frame budget in the hub, contact sheets and phone screenshots in the PR. Each ticket may be split into several PRs along natural seams (per dungeon, per settlement).

---

### POW-M8-00 Region content loads with its region

Size: L (two parts) Depends: none (M5 done) Status: READY (refined 2026-11-27, owner decision in the PR #180 follow-up; `slice` decision at the M5 closeout)
Refs: tech/01-architecture (Sim purity, World streaming, PWA), tech/03-asset-pipeline, tech/04-quality (Boot JS), CLAUDE.md (Sim purity, Content is data)
Must merge before: POW-M8-03, POW-M8-06, POW-M8-08 (the first region content tickets). POW-M8-01 does not need to wait for it.

Goal: boot JS stays under budget as regions 2 to 8 arrive.
Context: after M5 the boot bundle was 391 KB gzip against a 300 KB budget. The owner raised the budget to 450 KB on 2026-11-27 (`tools/budgets.json`) on the condition that region growth does not land in it. Today every region's creatures, requests, dialogue, people, POIs and chat templates are imported statically into the one boot bundle (about 31 imports from `src/sim` alone, for example `CREATURES` in `src/sim/combat/enemy.ts` and `src/sim/travelers/crowd.ts`). The sim needs content synchronously from its first tick. The service worker already precaches every code chunk on install (`vite.config.ts`, `src/platform/pwa/sw.js`), so a dynamic-import chunk is offline-safe with no new caching code. `src/save/seal/registry.ts` is the in-repo precedent for a dynamic import.

**How to run this ticket.** Two PRs, A then B. Title: `POW-M8-00<letter> <part title>`. Neither part changes saved state or content ids, so neither bumps the save schema.

#### Part A. Content lookups go through a registry

Scope:

- New `src/content/registry.ts`: per-kind tables (creatures, spawners, requests, threads, people, places, POIs, dialogue, region chat templates and rumors), `registerPack(pack: RegionPack)`, `hasPack(region)`, and typed lookups (`creatureDef(id)`, `requestDef(id)`, and so on). A lookup of an id whose pack is not registered throws with the id and region. It never returns a default. `RegionPack` is a typed record: `{ region, creatures, spawners, requests, threads, people, places, pois, dialogue, chat }`.
- Registering the same region twice is a no-op. Registering two packs that define the same id fails (test).
- Every read of region content in `src/sim/`, `src/ui/` and `src/render/` goes through the registry. The static barrels (`content/creatures/index.ts` and the rest) stop exporting merged region tables, and keep only shared content and types.
- **Region index** (stays in boot): per region, the ids, display names and tiers of its creatures, bosses, places and POIs, and nothing else. The abstract crowd (Travelers in a region the player is not in) and World-channel chat about other regions read only the index, never a pack. A test fails if `src/sim/travelers/` or `src/sim/chat/` calls a pack lookup for a region other than the player's current one.
- In Part A every pack is still imported statically and registered at boot (`src/content/packs.ts`), so nothing about loading changes yet. Test setup registers packs the same way.
- **The `slice` region** (decided at the M5 closeout, 2026-11-27) becomes a pack like any other (`slice-map.ts`, its `rooms.ts` entries and its content), registered only in dev and test builds. Production never registers it, so `?region=slice` does nothing there. Remove every `state.region ?? 'slice'` default in `src/sim/`: a state with no region is an error in tests, not a quiet fallback. The e2e specs and the sim-bot keep using it.

Acceptance:

- All existing unit, sim and e2e tests pass unchanged, apart from setup that registers packs.
- Unit test: a lookup before its pack is registered throws, naming the id and region.
- Unit test: duplicate ids across two packs fail registration.
- Determinism: `npm run sim-bot` and `balance:ci` give the same results as `main` (paste both).
- `npm run verify` passes.

#### Part B. Packs load with their region

Scope:

- Region content moves under `src/content/regions/<region>/` (Dawnmeadow's dungeons Rootway, Undermill, Deeps and Thornwall go into Dawnmeadow's pack). Each region exports one `RegionPack` from `src/content/regions/<region>/pack.ts`.
- `src/platform/world/packs.ts` loads a pack with a dynamic `import()` and calls `registerPack`. It is the only module that imports a pack. Vite emits each pack as its own hashed chunk. No pack is in `index.html` as a script or `modulepreload`.
- **Loading gate.** A chunk does not count as loaded until its region's pack is registered. The loader starts the pack fetch when the 5 x 5 loaded window first touches a region, so walking across a border waits on the pack the same way it waits on a chunk. Waystone travel and boot load the target region's pack before the first tick there.
- **Offline settlement.** Settlement for a region reads its pack from the precache. If a pack cannot be loaded (it should not happen once the service worker is installed), settlement for that region is deferred to the next session where it loads, and a line goes to the System log. It is never guessed and never dropped.
- Shared content stays in boot: items, skills, balance, paths, sprites and dolls, base chat templates, voices, names, glyphs, the region index. The `slice` pack is never in a production chunk (`check-packs` also fails if it is).
- New build check `tools/check-packs.ts`, run by `npm run verify`: from the Vite manifest, fails if any module under `src/content/regions/` is part of a boot chunk, or if any module outside `src/platform/world/packs.ts` imports a pack.
- `tools/check-bundle.mjs` also prints each pack's gzip size. A pack over 120 KB gzip fails (new `regionPackJsGzipBytes` in `tools/budgets.json`).

Out of scope: moving shared items or skills into packs, changing the chunk format, the region download UI.
Acceptance:

- Boot JS with Dawnmeadow in a pack: before and after sizes in the PR, and after is under 450 KB gzip.
- A stub region pack (`tests/fixtures/regions/stub`, 20 creatures, 25 requests, 15 people) grows boot JS by no more than 5 KB gzip. That is its index entry only (measured in the PR).
- `check-packs` fails on a deliberate static import of a pack from `src/sim/` (test or a recorded run).
- e2e, offline: install, go offline, reload, play in Dawnmeadow with its pack from the precache. Leave the tab hidden 10 minutes and come back: settlement runs and its results match the online run for the same seed.
- e2e: walking across a region border with throttled network waits at the edge and never shows a missing creature or a thrown lookup. No console errors.
- First playable stays under 2 MB transferred and 4 s on the reference profile (tech/04).
- `npm run verify` passes.

### POW-M8-01 Refinement: M8 specs to READY

Size: L Depends: M7 complete Status: DRAFT (design authority)

Goal: region design documents for Whisperwood, Saltreach, and Ironvale in `docs/design/regions/`, following the Dawnmeadow pattern, and READY specs for M8.
Scope note: Dawnmeadow sets no rank 30 Trials (planning decision on PR #111). Across the three regions and POW-M8-09, every wired skill gets a rank 30 Trial giver. Each region doc's people table names which, and its pacing table has a rank 30 line.
Acceptance: owner approves each region doc. A check over the Trial data: every wired skill has a rank 30 Trial.

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
