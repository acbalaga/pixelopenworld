# M11 The Unwritten: frontier and postgame

**Result:** past the edge of the Continent the world never ends, and there is always something not yet found.

Executors on M11-05 read design/08-lore-SPOILERS (sections "The truth" and "Clue families", Drafts).

---

### POW-M11-01 Refinement: M11 specs to READY

Size: M Depends: M10 complete Status: DRAFT (design authority)

Goal: READY specs. Frontier biome list, tier scaling curve past 8, POI grammar, Draft catalogue, outpost rules.
Acceptance: owner approves.

### POW-M11-02 Frontier generator

Size: L Depends: M11-01 Status: DRAFT
Refs: design/02-world (The Unwritten), tech/01-architecture (World streaming)

Goal: endless, seeded, seamless land.
Scope: per-chunk generation in a Web Worker from the world seed and chunk coordinates (same output regardless of generation order). Biome field from layered noise, elevation, rivers, coasts. Reuses the fill generators and autotile from the bake. Joins the Continent's edges without a seam. Coordinates far from origin remain exact (integer math).
Acceptance: the same chunk generated in any order is byte-identical. Generation under 30 ms per chunk off the main thread. Walking 500 chunks outward holds the frame budget and memory budget.

### POW-M11-03 Frontier difficulty and creatures

Size: L Depends: M11-02 Status: DRAFT

Goal: the further out, the harder and stranger.
Scope: tier as a function of distance, beyond tier 8. Creature variants generated from continental bases (stat scaling, palette, added quirk) plus 12 frontier-only creatures. Material and gear tiers past 8 with diminishing steps. Field bosses.
Acceptance: fight-sim confirms a smooth curve with no cliff. Rewards never make continental content obsolete for 100% purposes.

### POW-M11-04 Procedural places

Size: L Depends: M11-02, M4-08 Status: DRAFT

Goal: camps, ruins, and mini-dungeons that are worth entering.
Scope: POI grammar assembling stamps into sites. Procedural mini-dungeons from room stamps with the dungeon validator run at generation time (regenerate on failure). Guaranteed density: something discoverable within every 3x3 chunk block.
Acceptance: 10,000 generated dungeons all pass the validator (batch test). Density rule holds over a sampled area.

### POW-M11-05 Drafts

Size: M Depends: M11-04 Status: DRAFT
Refs: design/08-lore-SPOILERS

Goal: rare half-made landmarks.
Scope: Draft catalogue (flat-color tiles, repeated props, geometry that stops, a house with no door). Rarity curve. After the Keeper meeting, Drafts improve in quality and some carry a short note. Rare frontier Travelers with their specific behaviors.
Acceptance: Drafts appear at the specified rate. Post-meeting flag changes what generates from then on without altering already-visited chunks.

### POW-M11-06 Planted Waystones and outposts

Size: M Depends: M11-02, M6-08 Status: DRAFT

Goal: make a place of your own out there.
Scope: craftable Waystones (limited count, raised by Paths). Outpost plots using the homestead building system. Outposts host Routines under the same rules.
Acceptance: planted Waystones persist and work with fast travel. Limits enforced.

### POW-M11-07 Chunk deltas and save size at scale

Size: M Depends: M11-02 Status: DRAFT
Refs: tech/04-quality (budgets), tech/01-architecture (World streaming)

Goal: an endless world does not mean an endless save.
Scope: delta storage for player-changed frontier chunks with compaction. Fog storage for the frontier as coarse visited regions rather than per-tile. Respawned resources drop their deltas. A save size monitor in System. Integrity rules for frontier counters.
Acceptance: a bot campaign of 300 simulated hours including heavy frontier exploration stays inside a stated save size ceiling and save time budget.

### POW-M11-08 Endless activities and soak

Size: M Depends: M11-03, M11-04 Status: DRAFT

Goal: reasons to keep going.
Scope: frontier bounties on hub boards. Expedition journal (furthest distance, biomes seen, Drafts found, as a "beyond" Chronicle page). Frontier rankings against Travelers. Long soak across the whole game.
Acceptance: soak run clean (memory, flags, save size). Journal counts are correct.
