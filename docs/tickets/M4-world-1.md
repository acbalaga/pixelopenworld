# M4 World I: playtest fixes, world tech and Dawnmeadow

**Result:** the owner's M3 playtest is answered (docs/ops/playtest-m3.md), then the whole first region is built, streamed seamlessly, with its hub, dungeons, bosses, weather, map, Waystones and first Singulars. This is the template every later region copies.

**Gate G4:** does Dawnmeadow deliver its hours budget (about 6 hours first pass, about 20 hours to regional 100%), and does the first hour now start poor, outside town, and read clearly (playtest F1 to F8)? If not, region counts are re-planned before M8. Checklist: `docs/ops/gate-g4.md` (written by POW-M4-12).

Read first: `docs/ops/playtest-m3.md` and `docs/design/regions/01-dawnmeadow.md`. Decisions D16 to D23 in the master plan.

## Order of work

Ticket ids 02 to 12 keep their numbers from the draft so references elsewhere stay valid. The playtest tickets are 13 to 21.

| Wave | Tickets                            | Runs on       | Notes                                                                             |
| ---- | ---------------------------------- | ------------- | --------------------------------------------------------------------------------- |
| A    | 13, 14, 15, 16, 17, then 18 and 19 | The slice map | Playtest fixes. 13, 14, 15, 16, 17 can run in parallel. 18 needs 17. 19 needs 14. |
| B    | 02, then 03, 08, 09, 10            | Tech          | Can start alongside wave A.                                                       |
| C    | 04, 05, 06, 07, 21, 11, 20, 12     | Dawnmeadow    | Content on the new tech. Follow Depends.                                          |

**Save schema bumps serialize.** Tickets 14, 15, 19 and 20, and POW-M4-23 parts A and C, each bump the schema. Whichever merges later rebases, takes the next number, and re-exports its fixture from main as it stands then. Each migration stays a separate step.

---

### POW-M4-01 Refinement: M4 specs to READY

Size: M Depends: M3 complete Status: READY (design authority, delivered by the planning PR that wrote this file)

Goal: READY specs for M4, the playtest answers, and the Dawnmeadow design document.
Scope: this file. `docs/design/regions/01-dawnmeadow.md`. `docs/ops/playtest-m3.md`. Master plan D16 to D23. Design updates in 01, 02, 03, 04, 09, 10 and 11.
Acceptance: owner approves the PR. The Dawnmeadow doc is the pattern for regions 2 to 8.

---

## Wave A: playtest fixes

### POW-M4-13 Action meter over the work

Size: M Depends: none in M4 Status: READY
Refs: design/09-ui-ux (Action meter), docs/ops/playtest-m3.md (F1), tech/03-asset-pipeline (Sprites)

Goal: when the avatar gathers, crafts or fishes, the timing meter sits over the avatar and the avatar visibly works.

Scope:

- New `src/render/actionMeter.ts`: `meterRect(anchor, viewport, kind)` returns the meter's rect in logical px. `anchor` is the avatar's head point on screen. `kind` is `'track'` (sweep, rhythm, timing, fishing) or `'panel'` (trace, hold). Placement: centered above the anchor with the gap from `UI_BALANCE.meter`; if the rect would cross the top of the world view or the status row, it flips below the feet; it is clamped horizontally inside the safe area minus 4 px; it never enters the thumb zone (`computeLayout`'s zone top). Pure function, unit tested.
- Move the gather sweep drawing out of `src/demo/world.ts` into `drawGatherMeter` in the same file, drawn at `meterRect(..., 'track')`. Width and height from `UI_BALANCE.meter` (track at least 72 x 7, panel up to 120 x 120).
- `drawCraftStep` takes the rect from `meterRect` instead of `stepRect`. `stepRect` is removed. The trace and hold pointer mapping in `world.ts` (`stepGeom`) reads the same rect, so input and drawing cannot disagree (test: a sample at the rect center grades as the path center).
- Work animations as sprite data in `src/content/sprites/core` (the avatar doll anim set): `work_swing` (Logging, Mining, Smithing), `work_reach` (Foraging), `work_stir` (Cooking, Alchemy), `work_hands` (Tailoring, Enchanting, Tinkering, Woodworking), `work_cast` (Fishing). Four frames each, all four facings, through the doll pipeline. Which anim a node or station uses is a field on its data (`workAnim`).
- The node or station being worked gets a 1 px highlight outline (render only).
- A hit spawns a small spark at the node, and the existing hit sound plays there. Reduced motion turns the spark off.
- Balance: `UI_BALANCE.meter = { gapPx, trackW, trackH, panelMax, flipMarginPx }` in `src/content/balance/ui.ts`.

Out of scope: changing how steps are graded, timed or input.

Save: none. Integrity: none.

Acceptance:

- `meterRect` unit tests: normal placement, flip at the top edge, clamp at both side edges, never below the thumb zone top, at 180 and 239 px logical width.
- Trace input test: fed pointer samples grade the same as before the move.
- Phone screenshots (360 x 800) of the meter while felling a tree, mining a vein, cooking at the pot, tracing at the loom and fishing, in Flow portrait, and one in Classic landscape. The avatar's work frame is visible in each.
- A screenshot with the avatar at the top edge of a room showing the flipped meter.

### POW-M4-14 Fresh start: wake points and the bare kit

Size: M Depends: none in M4 Status: READY
Refs: design/01-experience (The first hour), regions/01-dawnmeadow (Wake points), tech/02-save-security (Ledger, Integrity), docs/ops/playtest-m3.md (F4)

Goal: a new character wakes somewhere outside town with one bread, a wooden dagger and ragged clothes, and nothing else.

Scope:

- Per-character seed. The front end draws a 32-bit creation seed with `crypto.getRandomValues` (platform layer, outside `sim/`) and passes it to `createDemoState`. Today every new game uses seed 1. Existing saves keep their seed.
- Wake points as map objects: `wake.w1` to `wake.w8`. On the slice map (until POW-M4-04) place eight in the outdoor area, all outside the square fence, each at least 25 tiles from the Waystone, with no spawner within 12 tiles. List the coordinates in the PR. Region positions come later from the region doc.
- `chooseWake(state, allowed)` in `src/sim/world/wake.ts`: picks one of the allowed wake ids with a new rng stream `start` (appended to `STREAM_NAMES`, so no other stream shifts). `allowed` defaults to all eight (the origin filter arrives with POW-M4-19). The avatar is created at the chosen point, facing the nearest Hearthford landmark, and `avatar.respawn` is set there.
- Respawn moves to a Waystone on first touch and to a bed on first sleep (both exist as rules; confirm the order in a test).
- Starter kit v2 in `src/content/balance/items.ts`: `starter.equipment = { main: 'item.dagger_wood', body: 'item.outfit_ragged' }`, `starter.bag = [{ item: 'item.dish_bread', qty: 1 }]`, `starter.techniques = []`.
- New items: `item.dagger_wood` (Blades family, the lowest weapon power in the game, durability as a tier 0 weapon, sell value 1, craftable at the workbench for 2 wood so it can be replaced) and `item.outfit_ragged` (body armor slot, defense 0, no durability loss, sell value 0, a doll look in the player's two "own" colors). Names, descriptions and doll parts as content.
- Remove the demo scaffold in `src/demo/world.ts` that adds an iron sword, leather outfit, wooden shield and raw meat to a new bag. Dev builds keep a `?kit=dev` flag that adds them and records them as `seed`, so screenshots and tests still have a quick path.
- Integrity: `START_KIT_MISMATCH` checks against the kit version the save was started with. A new ledger field `startKit: 1 | 2` (1 for every save before this ticket via the migration, 2 for new characters). Kit 1 stays defined in balance as `starterV1` for the check only.
- Hints: none added. Nothing on screen says where the town is. The landmarks do that.

Out of scope: origins and their wake subsets (POW-M4-19). Region placement (POW-M4-04).

Save: schema bump. Ledger gains `startKit`. Migration sets 1. Fixture from the previous schema loads and passes integrity.
Integrity: as above. A kit-2 save holding a rusty sword from `start` fails `START_KIT_MISMATCH` (test). A kit-1 save holding one does not.

Acceptance:

- Over 1,000 seeds, every wake point is chosen, none more than twice as often as another (test).
- A new character holds exactly one bread, the wooden dagger and ragged clothes, and knows no technique except the dagger's basic swing (test, with POW-M4-15 merged or not).
- Dying before touching a Waystone or bed respawns at the wake point (scenario test).
- The previous fixture loads, migrates, and passes integrity.
- Phone screenshots of three different wake points on first frame, each with a town landmark or the square fence in view.

### POW-M4-15 Skill awakening and technique sources

Size: L Depends: none in M4 Status: READY
Refs: design/03-progression (Awakening and sources), design/11-skill-table (Sources), docs/ops/playtest-m3.md (F2)

Goal: a new character knows nothing it has not done, and every technique comes from a source the player can find.

Scope:

- Skills component gains `awake: string[]` (skill ids, ascending insertion) and `insight: Record<string, number>` (technique id to count). `addXp` in `src/sim/skills.ts` awakens a skill on its first XP and emits `skillAwakened`. A skill also awakens when a manual for it is read or a person teaches it.
- Technique data gains `source: 'innate' | 'insight' | 'taught' | 'manual' | 'trial'` and, for insight, `insight: { event: XpEvent; count: number }`. The `taught?: true` field is replaced by `source: 'taught'`. Every entry follows the table in design/11 "Sources". Insight counts live in `src/content/balance/skills.ts` under `insight`, keyed by technique id.
- `knows()` in `src/sim/combat/techniques.ts` becomes: the skill is awake, points reach the band, and the source is satisfied (`innate`: the weapon or off-hand of that family is held; `insight`: `insight[id] >= count`, then the learned flag is written; `taught` and `manual`: the learned flag; `trial`: the rank's Trial is passed).
- The insight counter rises on the named XP event for that skill. The training dummy counts until the skill has 5 points (rule in `src/sim/systems/skills.ts`). Reaching the count writes `learned.<id>`, emits `techniqueLearned` with `via: 'insight'`, and auto-slots as `learnTechnique` does today.
- Manuals: a new item kind `manual` (`src/content/items/misc.ts` or a new `manuals.ts`): `{ id, technique, skill }`. Use from the bag reads it: consumes it, awakens the skill, writes the flag, emits `techniqueLearned` with `via: 'manual'`. Reading a manual whose technique is already known does not consume it and shows a notice. Author the manuals in design/11 "Sources" (Lunge, Palm, Light Feet, the five spell manuals, Road Songs, Hide). Place each at a stand-in spot on the slice map (a chest or a pickup) and list the spots in the PR. POW-M4-11 and POW-M4-21 move them to their region places.
- Teachers: the existing Wren lines teach the six spells as today. Add teaching lines for Tobin (Overhead), Orla (Polearm Lunge, Aimed Shot, Bash), Hesper (Hum of Courage) and the Pilgrim (Hide). Each is one dialogue choice with a small ask (coin, an item, or "show me" after the skill is awake), authored in `src/content/dialogue`.
- UI: the Skills tab and Techniques list read only awake skills (today they hide skills under 1 point; awake replaces that rule so a skill shows at 0 once awake). A technique row shows its source state: "Known", "Insight 18 of 30", "Someone in Hearthford teaches this", "Written down somewhere", "Comes with the rank 15 Trial". Strings in `src/content/strings/skills.ts`. The awakening banner uses the existing banner queue ("Foraging awakens").
- Remove `B.starter.techniques` from `createAvatar` (it is empty already; the field goes).

Out of scope: the Menu's new look (POW-M4-18 restyles these rows). New teachers (POW-M4-12).

Save: schema bump. Migration: `awake` = every skill with points above 0 or xp above 0; for every technique the old rule says is known, write `learned.<id>` so nothing is lost; `insight` empty. Fixture from the previous schema.
Integrity: `TECHNIQUE_UNKNOWN` uses the new `knows`. New rule `MANUAL_READ_UNSOURCED`: a `learned.<id>` flag with `via: 'manual'` (recorded in the journal) needs a manual item made from a source that can hold it. Manuals come from `found` (placed pickups and chests), bounded by placements.

Acceptance:

- A new character's Skills tab is empty with the empty-state line, and its Techniques list shows nothing (screenshot and test).
- First hit with the wooden dagger awakens Blades; 30 hits teach Lunge by insight (scenario test). Training dummy hits stop counting at Blades 5 (test).
- Every technique in design/11 "Sources" is learnable by both of its listed sources (one scenario test per technique, table-driven).
- Reading a manual awakens its skill, teaches the technique, consumes the manual (test). Reading a known one does not consume it (test).
- The previous fixture loads, keeps every technique it knew, and passes integrity.
- `PENDING_SKILLS` behavior unchanged: pending skills never awaken.

### POW-M4-16 Creature temperaments

Size: M Depends: none in M4 Status: READY
Refs: design/04-combat (Temperament, Enemies), regions/01-dawnmeadow (Zones and spawn ramp), docs/ops/playtest-m3.md (F6)

Goal: whether and when a creature attacks follows its nature.

Scope:

- `CreatureDef` (`src/content/creatures/types.ts`) gains `temperament: Temperament`, optional `night?: Temperament`, `pack?: { id: string; radius: number }`, `territory?: { radius: number; warnTicks: number }` and `approach?: number` (curious stop distance, px). `Temperament = 'hostile' | 'territorial' | 'defensive' | 'skittish' | 'passive' | 'curious'`. Schema in `schema.ts`: `territory` is required for territorial, `approach` for curious, `fleeHpPct` for skittish.
- AI (`src/sim/systems/ai.ts`) reads the temperament before `acquire` can start a chase:
  - hostile: as today.
  - territorial: entering `territory.radius` from its home starts a warn state (pose, `creatureWarn` event, edge marker data on the creature). Still inside after `warnTicks` (at least 30 at tier 1, from balance): chase. Leaving cancels.
  - defensive: never acquires on its own. Being hit, or a packmate within `pack.radius` being hit, sets a provoked flag and it acts as hostile until it resets at its leash.
  - skittish: on notice, flee for `FLEE_TICKS`; fights only when cornered (no flee step possible) or under `fleeHpPct`.
  - passive: never acquires, never fights back.
  - curious: on notice, approach to `approach` px and follow while the target stays within notice; being hit makes it hostile until reset.
  - `night` swaps the temperament from dusk to dawn (`src/sim/time.ts`).
- Tier gap: a creature at least two tiers above the avatar's proven tier steps one rung more aggressive (passive and skittish excepted). Proven tier = highest tier with a passed rank 15 Trial or a beaten field or regional boss (a pure helper, tested). Rung order: defensive or curious to territorial, territorial to hostile.
- Hide, Pacifist and Mossfriend keep working through `acquire` (they act before temperament).
- Re-tag the roster: Mossling curious by day, territorial at night (Mossfriend's gift still means "never attacks first" in both); Spitbloom territorial; Bramble Boar territorial by day, hostile at night; Old Bramblehide territorial; training dummy passive; Thornling hostile; Fogcap territorial; Cinderback Boar hostile.
- Render: the warn pose and a ground edge marker drawn from the warn state; a "!" over a creature that commits to a chase. Sounds: `sfx.creature_warn` as data.
- Bestiary hook: emit `temperamentSeen` the first time the player sees a creature act on its temperament (stored by POW-M4-05).
- Update `tools/fight-sim` so a scenario can start a fight from each temperament (not only "already engaged").

Save: if the `ai` component gains saved fields (warn timer, provoked flag), schema bump with defaults in the migration. If they live in tick-only state, none.
Integrity: none new.

Acceptance:

- One scenario test per temperament: hostile chases on notice; territorial warns, then chases only after `warnTicks` inside, and a step back cancels; defensive ignores until hit, then fights, then resets at leash; skittish flees and fights when cornered; passive never fights; curious follows and turns only when hit.
- Pack test: hitting one Downs-Ram-like test creature provokes its pack within radius, not outside it.
- Night swap test with the in-game clock.
- Tier gap test for each rung.
- A short screen capture (or frames) of a territorial warning in game.

### POW-M4-17 Message lanes

Size: M Depends: none in M4 Status: READY
Refs: design/09-ui-ux (Message lanes, The text rule), design/07-simulated-mmo (Chat), docs/ops/playtest-m3.md (F7)

Goal: every transient message has one place, nothing overlaps, and nothing is lost.

Scope:

- New `src/ui/messages/` with one router, `MessageRouter`, that every producer calls with `{ lane, text, key?, icon? }`. Lanes: `floater`, `tick`, `notice`, `banner`, `chat`, `hint` (as design/09). It owns timing, merging (same `key` within the merge window adds a count), queueing while a panel is open, and the System log.
- Producers move to the router: `Notices.toast` (becomes `notice`), the skill feed's banner (becomes `banner`, the tick stays in `src/ui/hud/skillFeed.ts`), hints (become `hint` in the notice lane), the chat ticker in `src/ui/dom/ambient.ts` (becomes the chat lane), pickups (new `floater` text over the avatar, pixel text, 24 characters max).
- Layout: notice lane and banner under the clock, chat lane left above the thumb zone, floaters over the avatar. Positions computed from the same layout the HUD uses (`computeLayout`), so the action meter (POW-M4-13), the lanes and the thumb zone never overlap (a pure overlap test over portrait and landscape sizes).
- Timing and limits in `src/content/balance/ui.ts` under `messages`: notice base ms, per-character ms, cap ms, max visible, merge window, banner ms, floater stack.
- Chat lane: two lines, newest at the bottom, a collapse button that leaves an unread count glyph, tap opens the chat sheet. The chat sheet: half height, channel tabs (World, Local, Party, Guild, Whisper, System), System is the log. Channels with no content yet are hidden.
- Collapse state and the last chat tab are UI settings (outside the save).
- Accessibility: notices and banners keep `role="status"`; the chat sheet is a labelled region; text scale applies.

Out of scope: chat content and Traveler lines (M5-05). The Menu (POW-M4-18).

Save: none. Integrity: none.

Acceptance:

- Router unit tests: merge within the window, queue while a panel is open and release after, banner one at a time, notice cap, log keeps everything since login.
- Overlap test: for 360 x 800, 390 x 844, 412 x 915 portrait and 915 x 412 landscape, no two lane rects, the meter rect and the thumb zone intersect.
- Phone screenshots: a pickup floater, two notices stacked, a banner, the chat lane collapsed and open, the chat sheet's System tab.
- No new console warnings in the e2e smoke run.

### POW-M4-18 Menu revamp

Size: L Depends: POW-M4-17 Status: READY
Refs: design/09-ui-ux (The Menu, Touch rules, Art direction for UI), docs/ops/playtest-m3.md (F7)

Goal: the Menu reads as one game system window, built from shared parts, with the same touch behavior everywhere.

Scope:

- Shared parts in `src/ui/dom/parts/`: `header`, `section` (collapsible, remembers state in UI settings), `row`, `gridCell`, `detailSheet` (60% height, three actions max, swipe down or back closes), `emptyState`. Each is a plain function that returns elements, with no framework. CSS in `src/style.css` under a `pow-part-` prefix, from the 6-color UI subset.
- Rebuild the four enabled tabs on them (`src/ui/dom/menu.ts`): Character (doll at 2x center with gear slots around it, pools, worn Path chips, two loadouts), Skills (awake skills by family as sections, detail sheet with XP, Trial and techniques with source state; assigning to a slot happens from the sheet), Bag (grid of cells, filters in the header, detail sheet with use, equip, drop as hold-to-confirm), System (as today, restyled).
- The tab bar: 16 px icon plus short label, badge dot for new content, hidden tabs for systems not built yet (`ENABLED_TABS` stays the switch).
- Navigation rules from design/09: one sheet deep, back closes the sheet then the Menu, the Menu reopens on the last tab and scroll position (UI settings).
- Shop, storage, crafting station panels and the request board use the same parts where they show lists (row, detail sheet). Their logic does not change.
- The view models in `src/ui/menu/model.ts` stay the single source of what is shown. Add fields only where a part needs them (an icon id, a badge).

Out of scope: tabs whose systems arrive later (Map in POW-M4-06, Chronicle bestiary in POW-M4-05). New game rules.

Save: none. UI settings gain the remembered states (outside the save).
Integrity: none.

Acceptance:

- Every row and cell is at least 48 CSS px tall at 100% text scale and reflows at 160% with nothing truncated (screenshots at both).
- Keyboard and screen reader: tabs are a `tablist`, sheets are dialogs with a label, focus returns to the row that opened a sheet (test).
- Back closes the sheet first, then the Menu (e2e).
- Before and after screenshots of each tab and one detail sheet in 360 x 800 portrait and 915 x 412 landscape.
- Opening the Menu stays under 100 ms to first paint on the 4x CPU throttle (trace).

### POW-M4-19 Avatar setup v2 and origins

Size: M Depends: POW-M4-14 Status: READY
Refs: design/09-ui-ux (Avatar setup), regions/01-dawnmeadow (Wake points), tech/03-asset-pipeline (Doll), docs/ops/playtest-m3.md (F8)

Goal: more ways to look like yourself, and an origin that is flavor only.

Scope:

- `DollSpec` (`src/content/dolls/parts.ts`) gains `height: 'short' | 'mid' | 'tall'`, `eyes`, `brows`, `mouth`, `mark` and `markColor`, `hairStyle2Color` (tips or streaks, optional), `facial` (none, stubble, short, full), `accessory` (none, headband, scarf, earring, eyepatch, flower), `ownColors: [ClothColor, ClothColor]`. Counts per design/09: 8 eyes, 6 brows, 5 mouths, 5 marks, 12 hair styles (6 new), 11 hair colors (2 new), 6 skin tones (3 new). All parts are doll layer data, recolored through ramps like the existing ones.
- Height changes leg length by one pixel either way. Hitboxes do not change (body box is sim data, unchanged).
- Setup screen (`src/ui/dom/frontEnd.ts`) rebuilt on the POW-M4-18 parts if merged, otherwise in the current style: groups with small dice per group, one Randomize, a turning preview on a patch of the origin's ground.
- Origins as data in `src/content/world/origins.ts`: `{ id, nameKey, blurbKey, wakes: string[], firstLineKey }`. Six: Unremembered (all eight wake points), Farmhand, Road-weary, Hunter's ward, River-found, Pilgrim's child, with the subsets in regions/01-dawnmeadow section 5. Strings in `src/content/strings/origins.ts`. Origins give nothing else: no item, stat, XP, technique, coin or reputation (a test asserts the new character's state is identical across origins apart from position, look and the origin id).
- Creation passes the origin's `wakes` to `chooseWake` (POW-M4-14). The first contextual line on waking is the origin's `firstLineKey`, shown in the notice lane.
- The inn mirror (a fixture, placed in the square until POW-M4-04 builds the inn) opens the same editor minus origin. Free in M4.

Save: schema bump. `look` gains the new fields with defaults for old saves (current look kept, new parts set to their neutral entry). The avatar component gains `origin: string` (`'origin.unremembered'` for old saves).
Integrity: none new. `origin` is not trusted for anything but flavor.

Acceptance:

- Contact sheet of every new part on both bodies and all three heights.
- Over 1,000 seeds per origin, only its subset of wake points is chosen (test).
- Origin equality test above.
- Setup screen screenshots in portrait and landscape, at 100% and 160% text scale.
- The previous fixture loads with its look unchanged on screen (screenshot) and passes integrity.

---

## Wave B: world tech

### POW-M4-02 World bake

Size: L Depends: POW-M4-01 Status: READY
Refs: design/02-world (Authoring model), tech/01-architecture (World streaming), tech/03-asset-pipeline

Goal: region specs and stamps become chunk files, deterministically.

Scope:

- Region spec format in `src/content/world/regions/<id>/spec.ts` (typed, zod-validated at build): size in chunks, biome mask (a coarse grid of biome ids, one per 8 x 8 tiles, as ASCII rows with a legend), elevation bands (same grid), road graph (nodes with tile coordinates, edges with width and surface), river paths (polylines with width), placements (`{ kind, x, y, stamp?, variant?, rotate? }`), spawn zones (polygons with zone id and roster id), interiors (dungeons and cellars, see below).
- Stamp format v2 (`src/sim/world/stamp.ts` grows, v0 stays readable for the slice map until POW-M4-04 retires it): multi-layer ASCII (ground, detail, object, overhead, each as rows) sharing one legend, an anchor character, named variants (alternate rows), rotation rules (`none`, `90`, `mirror`), object placements in stamp coordinates, and door markers that join an interior.
- Fill generators in `tools/bake-world/fill/`: terrain from the biome mask, scatter (trees, flowers, rocks) by biome tables with seeded density, cliffs from elevation through autotile (`src/content/world/autotile.ts`). Fill never overwrites a stamp cell or a road.
- Road and river carving along their polylines, with banks and bridges where roads cross rivers.
- Interiors: a dungeon or cellar is a separate chunk set with its own id (`interior.<id>`), baked from a room graph (format in POW-M4-08) and entered through a portal object. Interior chunks are numbered in their own space.
- Output: one binary file per chunk in `baked/world/<region>/` (format extended from today's `chunk-*.bin`, version byte first), plus a region manifest (`manifest.json`: chunk list, hashes, interiors, landmark list, wake points, Waystones).
- `tools/bake-world/index.ts`, `npm run bake:world` and `bake:world:check`. `tools/render-map.ts` renders a whole-region PNG.
- CI drift check: a bake on CI must match the committed bytes.

Acceptance: identical bytes on a repeat bake (test). Bake errors name the spec or stamp, the layer, and the tile coordinate (test per error kind). A sample region (a 2 x 2 chunk fixture) and its PNG attached.

### POW-M4-03 Chunk streaming and caching

Size: L Depends: POW-M4-02 Status: READY
Refs: tech/01-architecture (World streaming, Levels of detail), tech/04-quality (Performance budgets)

Goal: walking across a region never hitches or shows a loading screen.

Scope:

- 3 x 3 active and 5 x 5 loaded windows around the avatar's chunk. Chunks load one ring ahead in the direction of travel.
- Fetch and decode in a Web Worker (`src/platform/world/chunkWorker.ts`). Offscreen layer canvases built a slice per frame (budget in `src/content/balance/world.ts`, default 2 ms).
- IndexedDB chunk cache keyed by region, chunk and bake hash. A new bake invalidates by hash.
- Region prefetch (current and adjacent) and pinning, with a setting.
- Entity activation and freezing at the active window edge (creatures frozen in loaded chunks, nothing simulated outside).
- Chunk deltas in the save: `world.deltas[chunkKey]` (felled trees with respawn ticks, opened chests, broken walls). Applied on load of a chunk.
- Service worker: cache-first for chunk files, versioned by manifest hash.

Save: schema bump for `world.deltas` (the slice map's current per-object state migrates into deltas).
Acceptance: crossing the region at sprint speed with 4x CPU throttle holds 60 fps with no frame over 32 ms (trace attached). Offline play of a pinned region works (e2e with network off). Deltas persist across reload (test). The previous fixture loads.

### POW-M4-08 Dungeon and boss framework

Size: L Depends: POW-M4-02, M3-09 Status: READY
Refs: design/02-world (Dungeons), design/04-combat (Bosses)

Goal: reusable parts for every dungeon and boss in the game.

Scope:

- Room graph format (`src/content/world/dungeons/<id>.ts`): rooms (each a stamp v2 with doors), edges (door pairs, one-way drops, locked doors with key ids, shortcut gates that open from one side), and per-room blocks.
- Building blocks as fixtures with rules in `src/sim/systems/dungeon.ts`: locks and keys, switches, plates (held by avatar, creature, block, or a Stone wall), pushable blocks and stumps, light and dark (a dark room hides everything but telegraph markers until lit by a light source or Ember), timed gates, breakable walls (by hit kind: heavy, stone, ember), drops, element puzzles (burn, freeze, grow, conduct), arenas (doors close on entry, open when waves clear), shortcuts.
- Persistence: solved stays solved (stored as chunk deltas from POW-M4-03), enemies respawn daily at in-game dawn.
- Validator `tools/bake-world/validateDungeon.ts`: path-checks every room and key from the entrance with only tier-appropriate skills (a declared skill set per dungeon), flags soft locks (a block pushed into a corner that seals a plate, a one-way drop with no way back to the exit), and fails the bake.
- Boss framework (`src/content/creatures/bosses/`): phases (enter at Health percent or event), scripted attack patterns as data (sequences with timings), arena hazards (marked tiles with telegraphs), health gates. Non-combat resolution: an alternate objective graph (steps that are world actions) that ends the encounter with the same reward table and a different title line.
- Delving wired: `delve` XP on first entry of a room, on solving a block, and on a dungeon clear. Remove Delving from `PENDING_SKILLS`.

Acceptance: unit test per block. Validator rejects a dungeon with an unreachable key and one with a soft-lock block (tests). A sample boss with three phases and a non-combat resolution passes scenario tests both ways.

### POW-M4-09 Time, weather, seasons, lighting

Size: L Depends: POW-M4-03 Status: READY
Refs: design/02-world (Time, seasons, weather), tech/03-asset-pipeline (Palette)

Goal: the day turns, the weather changes, the seasons pass.

Scope: color grading lookup per phase (dawn, day, dusk, night) as palette ramps. Point lights at night (torches, windows, lantern, the Waystone column). Weather per region per day from a seeded table in `src/content/world/weather.ts`: clear, rain, storm, fog. Weather particles and ambience as data. Seasonal tile palettes and crop calendar hooks (data only, M6 reads them). Gameplay effects listed in design/02 (spawns, fishing tables, visibility, Ember and Tide strength). Calendar UI in the System tab. Creature `night` temperaments read the same phase helper (POW-M4-16).
Acceptance: screenshots of the same spot at four times of day and in rain and fog. Weather sequence is deterministic from the seed and day (test). Frame budget holds in a storm on the 4x throttle (trace).

### POW-M4-10 Dev map viewer and stamp editor

Size: M Depends: POW-M4-02 Status: READY
Refs: design/02-world (Authoring model)

Goal: the owner and agents can inspect and adjust the world.

Scope: dev-only page under `src/dev/`: pan and zoom the baked world and interiors, toggle layers, collision, spawn zones (with temperament colors and glyphs), POIs, wake points, Waystones. Open a stamp, paint tiles, export the stamp source text to paste into a PR. Teleport the player to a clicked location in dev builds.
Acceptance: a stamp edited in the tool and exported bakes to the same result shown in the tool (test). Not present in production builds (`check:dev`).

---

## Wave C: Dawnmeadow

### POW-M4-04 Dawnmeadow terrain and Hearthford

Size: L Depends: POW-M4-02 Status: READY
Refs: regions/01-dawnmeadow (sections 2, 4, 5, 6, 7), design/02-world (Hub layout, Freedom of route), docs/ops/playtest-m3.md (F3)

Goal: the region's land and a hub that looks like a town.

Scope:

- The region spec for Dawnmeadow (`src/content/world/regions/dawnmeadow/`), 12 x 12 chunks, following the map sketch. Roads, the Lark, biome and elevation masks.
- Hearthford as district stamps by the hub rules (design/02): square, craft row with five workshops, rune house, inn (with cellar door, bed, storage, cook pot, mirror), guard yard, market street, eight homes, four gates, low walls. Streets at least 3 tiles wide.
- Move every M3 square fixture as listed in regions/01-dawnmeadow section 4. Station ids, dialogue and request references are unchanged; only positions move.
- Millbrook, Reedmouth and Stonecrop stamps. Farms, landmarks (mill sails, bell tower, quarry crane, the Waystone light), visible from at least two chunks away.
- Wake points W1 to W8 at the region positions, replacing the slice map stand-ins from POW-M4-14. Waystone placements (attunement arrives in POW-M4-07).
- The three above-tier sights and the Fernside climb route (section 7), with its ledges and rest points as fixtures.
- Tile and prop art for the biome. Hearthford day and night look (with POW-M4-09 if merged).
- The slice area from M1 is absorbed: the slice map file stays for tests only; the game boots into Dawnmeadow. Old saves on the slice map are moved by the migration to the equivalent place (their position near the old square maps to the new square; inside the old cave maps to the Rootway entrance outside).

Save: schema bump for the position remap.
Acceptance: region PNG and phone screenshots of every settlement and district. Every landmark is visible from at least two chunks away (bake check). No crafting station, bed or shop counter sits in the square (bake check against the district rule). Art contact sheets. The previous fixture loads and lands on walkable ground in Hearthford.

### POW-M4-05 Dawnmeadow creatures and spawns

Size: L Depends: POW-M4-04, POW-M4-16 Status: READY
Refs: regions/01-dawnmeadow (section 3), design/04-combat (Enemies, Temperament)

Goal: the tier 1 roster, each with its nature.

Scope: remaining archetypes needed (Skirmisher, Guard, Swarm, Flyer, Burrower) in `src/sim/systems/ai.ts` with scenario tests. The 17 new creatures in section 3, each with temperament data, telegraphs, drops, sprites and sounds. Spawn zones with the a, b, c ramp (balance multipliers). Day and night rosters. Non-combat interactions (feed, soothe, scare) as data with effects. Hollowhorn as the roaming field boss on a daily route. Bestiary entries in a first Chronicle tab (bestiary only, built on the POW-M4-18 parts), filled on first kill or first befriend, with temperament shown once seen.
Acceptance: archetype scenario tests. Fight-sim report for the roster against time-to-kill targets. Spawn check: no hostile or territorial spawn within 12 tiles of a wake point, road or wall (bake check). Contact sheets.

### POW-M4-06 Map, fog, Cartography

Size: M Depends: POW-M4-03 Status: READY
Refs: design/02-world (Secrets and discovery), design/09-ui-ux

Goal: the map draws itself as the player explores.

Scope: per-tile-block fog (4 x 4 tile blocks, one bit each) stored compactly in the save. Minimap and full map tab (pan, pinch zoom). Map rendered in a hand-drawn pixel style from chunk data. Cartography XP from revealing, reveal radius by rank. Player notes. Rumor marks (moved here from M3-11): a location an NPC or Traveler told the player about appears as a hand-drawn mark offset from the true spot by a seeded amount that shrinks with Cartography. Landmark icons appear only once seen. Wake points are never marked. Remove Cartography from `PENDING_SKILLS`.
Save: schema bump for fog and notes.
Acceptance: fog storage for a fully explored continent stays under 40 KB compressed (8% of the save budget). Map opens in under 200 ms. The previous fixture loads.

### POW-M4-07 Waystones and fast travel

Size: S Depends: POW-M4-06 Status: READY
Refs: design/02-world (Travel), regions/01-dawnmeadow (section 6)

Goal: six Waystones in the region, attune and travel.
Scope: attune interaction and effect. Travel UI from the map and at stones. Arrival effect. Respawn binding (overrides the wake point, POW-M4-14). Blocked in dungeons and combat.
Acceptance: travel between any attuned pair works across chunk streaming with no hitch over 500 ms. Cannot travel to an unattuned stone (test). First touch moves respawn from the wake point (test).

### POW-M4-21 The Rootway

Size: M Depends: POW-M4-02, POW-M4-08, POW-M4-16 Status: READY
Refs: regions/01-dawnmeadow (section 8, The Rootway), design/02-world (Dungeons), docs/ops/playtest-m3.md (F5)

Goal: the first cave is a real challenge for the first levels.

Scope:

- The Rootway as an interior room graph (R1 to R9) in `src/content/world/dungeons/rootway.ts`, built from the M4-08 blocks, replacing the M1 cave rooms. Entrance portal on the slice map where the old cave mouth was, and at the great oak on Hollow Downs once POW-M4-04 has merged.
- Rooms and their blocks exactly as the region doc lists: the fork with two routes, the dark gallery with Glowcaps, the snare chamber arena, the stump puzzle and Root Key, the R7 shortcut to R1, the two-phase Old Bramblehide, the R9 secret behind a heavy-hit root wall.
- New creatures for it: Root Grub (burrower, hostile) and Glowcap (shooter, territorial, dark rooms). If POW-M4-05 has not merged, the burrower archetype is added here.
- The Hide manual in R3b and the Unarmed manual in R9 (moved from their POW-M4-15 stand-in spots). Fragment slot DM-F07 in R9 as an empty marker.
- The M3 satchel request (r8 in the region doc) points at the Rootway.
- Fight-sim scenarios: the bare kit (wooden dagger, rags, one bread) and the target loadout (any weapon at 8, crafted tier 1 armor, three dishes) through R5 and R8.

Save: none needed. The slice-to-Dawnmeadow migration (schema 23) already dropped the old cave's state, so nothing carries to R6 (planning decision on PR #106).
Acceptance: dungeon validator passes. Scripted clears by both routes (R3a and R3b). Fight-sim win rate under 20% for the bare kit and 65 to 80% for the target loadout through R8 (report in the PR), read as R5 and R8 with a rest at R7. The 12 to 18 minute first clear is a playtest target for a person, checked at Gate G4, not a bot time (planning decision on PR #106). Phone screenshots of R2, R4 unlit and lit, R5 with the gate down, and R8 phase 2.

### POW-M4-11 Dawnmeadow dungeons, bosses, points of interest

Size: L (split per dungeon if needed) Depends: POW-M4-05, POW-M4-08 Status: READY
Refs: regions/01-dawnmeadow (sections 7, 8, 12, 13), design/02-world (Freedom of route)

Goal: the region's authored challenges.
Scope: the Undermill, Stonecrop Deeps and Thornwall Pass (the Rootway is POW-M4-21), 12 mini-dungeons, 30 POIs, the Hedge Warden with the Keeper's Bells resolution, each dungeon's return-visit secret, the six region secrets, the badger tunnel route west. The remaining manuals move from their POW-M4-15 stand-in spots to their region places. Bake check: every land chunk has at least one discoverable (POI, node cluster, secret, vista or settlement), build fails otherwise. Bake check: at least a fifth of the region's secrets list a non-combat skill route. Lore fragment slots DM-F01 to DM-F18 as empty markers at the positions listed (content arrives in M10).

Done in part 1 (PR #111): POI data in `src/content/pois/`, the eight manual places, the discoverable bake check with a pending list (`src/content/pois/pending.ts`) that may only shrink.

Also in scope (planning decisions on PRs #109 to #111):

- **Node clusters.** Every land chunk still on the pending list gets a cluster of two or more gathering nodes of kinds that suit its biome, as placements in the region spec. The pending list is empty when the ticket is done.
- **The requests and Thread that wait on this ticket's places** (POW-M4-12 authored the rest): r2 Rats in the Cellar (m1), r6 Grist and Sluice (the Undermill), r12 Wasps in the Orchard (m11), r13 Nessa's Net, r15 Cart Wheels, r17 Readings for Wren, r18 The Bell Tower Clock, r20 The Pilgrim's Errand, r21 Barrow Lights, r22 Stock for the Stalls, and t4 Wren's Missing Pages. New objective kinds `sell` (r22) and `carry` (r20), written once in `advanceTracked`. Each lands in the part that builds what it needs.
- **Tighten the Threads told with stand-ins** once their places exist: the Mill's sluice stage goes through the Undermill, and the Quarry Strike's last stage is the Deeps (the Engine, or the Tinkering 15 jam). Same ids, so no save change.
- **The inn songsheet** moves from the inn yard into m1 (the inn cellar) when m1 is built.
- **The firebrick stand-ins** (POW-M4-20) move to the Undermill and the Deeps when they are built.
- `estMinutes` on the two harder routes west (Fernside climb, badger tunnels: 15 each), counted under the ledger's last line.

Acceptance: dungeon validator passes for all. Scripted clears for each dungeon. The Hedge Warden beaten both ways in scenario tests. Both harder routes west (Fernside climb, badger tunnels) reach Whisperwood's edge in scripted runs. Coverage checks pass, with the pending discoverable list empty. Every request and the Thread above completes in a scenario test.

### POW-M4-20 Singulars framework and Dawnmeadow's first three

Size: M Depends: POW-M4-04, POW-M4-15 Status: READY
Refs: design/03-progression (Singulars), regions/01-dawnmeadow (section 11), design/08-lore-SPOILERS (Delivery rules only)

Goal: rare hidden questlines that start from odd actions, and the first three of them.

Scope:

- Data in `src/content/singulars/`: `{ id, trigger, steps[], reward }`. A trigger and each step are predicates over sim state and events (deed counts, place, time of day, day count, weather, held item, a fixture used), from a small typed vocabulary in `src/content/singulars/types.ts`, so no step is code.
- Sim in `src/sim/systems/singulars.ts`: checks triggers on the events they name (never every tick), tracks progress in the journal (`journal.singulars[id] = { step, counters, startedDay, done }`), emits `singularStep` and `singularDone`. No UI string names a Singular before its trigger fires. After it fires, the Skills and Character tabs show nothing; only a banner per step and a Chronicle line once done.
- The three in regions/01-dawnmeadow section 11: The Crow's Due, Eight Beds of Straw, The Cold Oven. Their items (crow feather trinket, Wayfarer's Cloak, Baker's Peel and its recipe) and the Hex manual as content. The firebricks placed in the Rootway R9, the Deeps and the Undermill (stand-ins on the slice map if those dungeons are not merged, listed in the PR).
- World first: a `worldFirst` event on done, read by the banner now and by M5 chat later.
- Never missable: no trigger has an end date; time and weather triggers recur (validator over the data: every time predicate has a recurring window).

Save: schema bump for `journal.singulars`.
Integrity: ledger source `singular` for reward items, bounded by done Singulars (rule `SINGULAR_REWARD_UNEARNED`).

Acceptance: each of the three completes in a scripted run. Triggers fire only on their conditions (one negative test each). The text check: no string in `src/content/strings` for a Singular is reachable from a UI path before its trigger (test over the string keys). The previous fixture loads.

### POW-M4-12 Dawnmeadow people and requests, pacing ledger

Size: L Depends: POW-M4-04, M3-11 Status: READY
Refs: regions/01-dawnmeadow (sections 9, 10, 14), design/05-life-systems (Requests, Relationships), design/10-content-budget (Verification)

Goal: the region is inhabited, and its hours are counted.
Scope: the 16 named people in section 9 with schedules (day, night, weather), homes and likes (friendship itself arrives in M6, the data is authored now). 25 authored requests and 5 Threads from section 10, at least 8 with a non-combat solution. The rank 15 Trials for every wired skill: 32 in all (done in PRs #110 and #111). Rank 30 Trials are not in this ticket; the trainers of the M8 regions set them. Move the M3 slice givers (Orla, Wren, Hesper, Brin, the Pilgrim) into their districts without breaking their Trials, requests or teaching lines (POW-M4-15). `estMinutes` on every authored content item, including Singulars, dungeons and POIs. `tools/pacing-ledger` sums by category and region, writes a report, and fails CI under budget. **Schedule movement:** an NPC whose schedule slot changes moves to its new place the next time neither spot is on screen. No walking. Shops, Trials, requests and teaching stay reachable (an NPC is found at its place for the current phase and weather). Each named place in `content/people/places.ts` gets a tile rectangle in the region spec (Millbrook, Reedmouth, Stonecrop, Cairnmoor; the well and shelter on Cairnmoor are placed with m9). `docs/ops/gate-g4.md` owner checklist, including a replay of every playtest finding (F1 to F8) on the phone, and these tuning checks carried from PRs #106 to #111: the Rootway first clear (12 to 18 minutes for a person), the Athletics run (50 s), the Cartography Trial (120 blocks), request coin against shop prices, and how far the Millbrook, Reedmouth, Stonecrop and Cairnmoor givers sit from town.
Acceptance: ledger report shows Dawnmeadow at or above budget, and the PR that finishes this ticket and POW-M4-11 switches `enforceBudget` on for Dawnmeadow. NPC schedule tests, including one that an NPC never moves while on screen and one that each giver is found at its scheduled place. Every M3 Trial and request still completes after the move (scenario tests). Owner action: play G4 with the checklist.

---

## Gate G4 findings

The owner's G4 playtest (November 2026) and the planning agent's own pass on a 360 x 800 phone viewport. Earlier G4 fixes shipped as POW-M5-20 to M5-22 and the "G4 playtest" commits on main. What is left is one ticket in parts.

### POW-M4-22 G4 findings: the journal, crafting, giver marks, gathering counts, icons

Size: 6 PRs (parts A to F, each S to M, F is L) Depends: see each part Status: READY
Refs: design/09-ui-ux (The Menu, Shared parts, HUD, Art direction for UI), design/05-life-systems (Requests), design/02-world (Secrets and discovery), tech/03-asset-pipeline (Sprites), tech/02-save-security (only if a part finds it must change saved state)

Goal: finished work leaves the way, the journal holds what the player has done and knows, a station fits on one phone screen, the player can see who has work for them, a request counts what the player carries, and every item and gatherable plant can be told apart at a glance.

**How to run this ticket.** One PR per part. Title: `POW-M4-22<letter> <part title>`, for example `POW-M4-22A Requests count what you carry`. Merge order: A first, then B and D (both need A). C, E and F can run in parallel with anything. E and F both rebake the atlases: whichever merges second rebases and runs `npm run bake` again. Do not start a part whose dependency is not merged.

**Findings this ticket answers.**

| #   | Finding                                                                                                                                                                                                                                                                                                | Part |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| G1  | Finished requests stay in the Character tab at full size, under the gear and loadouts. The list grows with every job done.                                                                                                                                                                             | B    |
| G2  | Known recipes are only visible at the station that makes them. There is no list to plan from.                                                                                                                                                                                                          | B    |
| G3  | The station panel is about two screens tall on a phone (1210 px of content in a 634 px sheet). The whole bag is listed one button per row, gear and ores included at the camp pot. The ingredient tray and Craft button sit between the recipes and the bag, so every craft is a scroll up and down.   | C    |
| G4  | Items and plants look alike. 89 of 173 item icons are within 20% pixel distance of another icon (`copper_ore`, `iron_ore`, `coal` and `essence_stone` at 4%; `mushroom_soup` and `sunwort_porridge` at 4%; every salve, oil and draught at 14%). 14 items share one scroll icon, 4 share one key.      | F    |
| G5  | Gatherable plants in the world are drawn with the 12 x 12 bag icon of what they yield (the herb patch is a sunwort icon, the silk web is a bolt of cloth, the river bank is a clay cone) and every spent node is the moss tuft icon. The decor `prop.bush_berry` looks like a berry bush you can pick. | E    |
| G6  | Nothing tells the player which people have a Trial or request for them, or which are waiting for a hand-in.                                                                                                                                                                                            | D    |
| G7  | A gather step counts gather actions, not items. One swing that yields 3 ore counts as 1. Items already in the bag never count. The standing ask says "Bring 7 to the board", but nothing is handed over.                                                                                               | A    |
| G8  | The board posted two "Gather Blue Berries" jobs at once.                                                                                                                                                                                                                                               | A    |
| G9  | The standing gather ask says "from wherever it grows" for Coal and ores.                                                                                                                                                                                                                               | A    |
| G10 | A one-step standing request repeats its title as its only step line ("Gather 7 Blue Berries" twice).                                                                                                                                                                                                   | B    |
| G11 | Two different items share a display name ("Stamina Tonic" is both `potion_stamina` and `potion_stamina_m`).                                                                                                                                                                                            | F    |

---

#### Part A. Requests count what you carry (G7, G8, G9)

Depends: none. Size: M.

Decisions (settled here, do not reopen):

- **A gather step counts items, not actions.** The `gathered` event gains `qty` (the number given by that gather). `onGathered` in `src/sim/systems/trials.ts` adds `e.qty`, not 1. This applies to Trials and to authored requests alike, so it is written once.
- **A standing "gather" job is a hand-in at the board.** The board posts it as a `deliver` step whose `to` is the board id (for example `board.square`). Items already in the bag count. The items are taken at hand-in. There is no new objective kind, so the stored request shape does not change.
- **Trials stay gather objectives** (they test the skill, so the items are not taken), and their words stop saying "bring".

Scope:

- `src/sim/kernel/events.ts`: `gathered` gets `qty: number`. `src/sim/gathering.ts` emits it with the qty passed to `give`. Update every emitter and test fixture that builds the event.
- `src/sim/systems/trials.ts` `onGathered`: `p.n += e.qty`. `finish` already clamps at the count; confirm with a test that an overshoot (count 4, one gather of 5) completes once.
- `src/sim/requestGen.ts` `make('gather', ...)`: emit `steps: [{ kind: 'deliver', item, qty: n, to: boardId }]`. The ask string is picked by the node tag that yields the item: `request.standing.gather.ask.foraging` ("...from wherever it grows"), `.mining` ("...dug from wherever you find it"), `.logging` ("...cut from wherever it stands"), `.fishing` ("...landed from wherever they bite"). Title becomes `Bring {n} {what}`, way `Bring them to the board`. Strings live in `src/content/strings/requests.ts`. Which tag yields an item comes from `NODES` (first node that yields it, sorted by id, so the pick is deterministic).
- `src/sim/requestGen.ts` (or wherever a board picks its posts, `generateStanding`): a board never posts two standing requests that name the same item, or the same creature, on the same day. Reroll up to `REQUEST_BALANCE.standing.dedupeTries` times (new tunable, value 6), then post fewer.
- `src/sim/systems/requests.ts`: new `handInAtBoard(state, who, rid)`. It runs `deliverTracked(state, who, boardId, trackersOf(...))` for that request, then calls the existing board turn-in if the request is now `ready`. The board's existing turn-in command calls this. `boardReady` in `src/sim/requestLog.ts` also returns a board request whose current step is a deliver to this board that the bag can satisfy now.
- `src/sim/requestLog.ts` `objectiveText`: a deliver step whose `to` starts with `board.` reads `Bring {n} {what} to the board` (`request.step.deliver.board`).
- `src/sim/requestLog.ts` `waysOf`: the current step of an active request, when it is a `deliver`, gets status `{n} of {max} in your bag` (`request.step.inBag`), from the avatar's inventory, counting quality as `deliverTracked` does. Words only; this module still returns no position.
- Trial words in `src/content/skills/dawnmeadowTrials.ts`: the mining intro becomes "Stone gives up what it holds, but only to someone who keeps hitting it. Mine three iron ore and I will know." The logging intro becomes "A tree falls where you tell it or where it likes. Fell four oak logs for me, cleanly." Hints unchanged. Check `src/content/strings/skills.ts` for any other gather Trial text that says "bring" or "hand" and fix it the same way; list each one in the PR.
- Board UI (`src/ui/dom/board.ts`): a taken board request that can be handed in shows the existing hand-in button. One that cannot yet shows its `in your bag` line instead of the button.

Out of scope: changing reward values, counts or which items are picked. Authored requests that already use `deliver` to a person.

Save: no schema bump. The stored request shape is unchanged: a `deliver` step with a board id is the same type as one with a person's id. A request taken before this change keeps its stored `gather` step and finishes under the new item count. If you find anything that does change the stored shape, stop and raise a Design Query.
Integrity: the deliver removes items through `removeItem`, as person deliveries do, so the ledger needs no new source. Confirm the existing request-reward rule still holds with a test.

Acceptance:

- Unit: one gather that yields 3 advances a gather step by 3, for a Trial and for an authored request. Overshoot completes once.
- Unit: a posted standing gather job is a deliver to the board. With 5 of 7 in the bag the log reads `5 of 7 in your bag` and the board offers no hand-in. With 7 the board hands in, 7 are removed, the reward is paid once.
- Unit: over 200 seeded days on Dawnmeadow's boards, no day posts two standing jobs naming the same item or creature.
- Unit: the ask for a mined item says "dug", for a foraged one says "grows".
- Save: load the latest committed fixture (schema 27) with an active standing gather request in it (add one to a copy of the fixture if none has it, and say so in the PR), gather once with qty 3, and see its progress rise by 3.
- e2e `tests/e2e/requests.spec.ts` still passes, with the hand-in flow added: take a gather job, `__pow.giveItem` the items, hand in at the board.

#### Part B. The Chronicle is the journal (G1, G2, G10)

Depends: Part A. Size: M.

Decision: the tab keeps its name, **Chronicle**, as design/09 names it. Requests and Trials move into it. The Character tab no longer lists requests. The Skills tab no longer lists the Trials under way at its top; its per-skill detail sheet keeps the Trial hint and progress (design/09).

Scope:

- `src/ui/dom/menu.ts` `renderChronicle`: sections built from the shared Section part (collapsible, count, remembered open or closed), in this order:
  1. **Under way** (open by default): the request rows that `renderRequests` draws today (active and ready, pinned first) followed by the Trials under way (`trialLog`). Pin buttons stay.
  2. **Finished** (closed by default): one compact Row per finished request (title at left, giver name as the state line) and per passed Trial (`<Skill> Trial` at left, the rank threshold and the giver as the state line). Requests newest first by `doneDay`, then by title. Trials by skill name, then threshold. Tapping a row opens the shared detail sheet with the asker's words and the reward line (requests) or the intro (Trials). Passed Trials are read from `skills.passed` (`skill@threshold`) matched to `TRIALS` by skill and threshold; a passed key with no matching Trial is skipped.
  3. **Recipes** (closed by default): every recipe in `inventory.recipes`, grouped by craft in this order: Cooking, Smithing, Woodworking, Tailoring, Alchemy, Enchanting, Tinkering. A craft with none known is not shown. Row: result icon, recipe name (the same `recipeName` the station uses; move it into a shared module such as `src/ui/menu/recipeModel.ts`), and the ingredient line ("2 Sunwort, 1 Dewmint") as the state line. Unknown recipes never appear and no total is shown, so discovery is not given away.
  4. **Bestiary**: as today.
  5. **Your story**: the Singular lines (`chronicleLines`) as today, under a heading.
- The view logic goes in pure functions next to the others in `src/ui/menu/` (`journalModel.ts`: `underWay`, `finished`, `knownRecipes`), unit tested. `requestLog` gains nothing that leaks a position.
- `src/sim/requestLog.ts` `waysOf` or the menu row: when a request has one way with one step and that step's text equals the title, the step line is not drawn; its status (count or `in your bag`) moves onto the title row's right side.
- Request rows get the shared Row look: one border between rows, the Pin button as a small right-side action, not a full-width block.
- Character tab: remove the Requests section. Skills tab: remove the Trial list at the top. Strings stay in `src/content/strings/ui.ts` and `requests.ts`; new keys for the section titles: `Under way`, `Finished`, `Recipes`, `Your story`.
- Empty state for the tab when all five are empty: the existing `chronicleEmpty` line.
- design/09 table row for the Chronicle already lists recipes; this planning PR adds requests and Trials to it.

Out of scope: a "new" badge on the tab (design/09 mentions it; it is a follow-up). Fish, fragments and the Theory Board (later milestones).

Save: none. Integrity: none.

Acceptance:

- Unit tests for `underWay`, `finished`, `knownRecipes`: ordering, a passed key with no Trial skipped, an unknown recipe never listed, a repeatable request done twice listed once.
- e2e (update `tests/e2e/requests.spec.ts` and `menu.spec.ts`): the request log is found in the Chronicle, not the Character tab. Finish one request; it moves from Under way to Finished.
- Phone screenshots (360 x 800): Chronicle with Under way open and three requests; Finished open with at least three requests and two Trials; Recipes open with at least two crafts. Character tab bottom ends at the loadouts.

#### Part C. One-screen station (G3)

Depends: none. Size: M.

Decision: the station sheet is a fixed tray on top and one switchable list below it, so the Craft button never scrolls away.

Scope (`src/ui/dom/talk.ts` `renderStation`, styles in `src/style.css`):

- Top to bottom: header (station name, Close). The **tray**: four Grid cells (48 px, the shared part) in one row, one per ingredient slot, empty ones dashed. Tapping a filled cell takes that ingredient out. To the right of the tray, or under it when the width is under 300 px, **Craft** (primary, thumb side) and **Clear**. Then one line: the step hint, or the result card when a craft just finished (the result card replaces the hint, it does not add height).
- Under that, a two-way (three at the anvil) segmented switch: **Recipes**, **Bag**, and **Repair** at the anvil only. One list is visible at a time, and only that list scrolls. The switch remembers its choice per station kind for the session (UI state, not saved). It opens on Recipes when any recipe of this station is known, else on Bag.
- **Recipes list:** a Row per known recipe of this station: result icon, name, then the ingredient icons each with `have/need` (for example `2/2`, `0/1`). Rows the bag can make come first, then the rest, each group by name. Tapping a makeable row fills the tray. Tapping one that is short writes "Missing: 1 Dewmint" in the station message line and fills nothing.
- **Bag list:** a grid of Grid cells (icon, quantity corner showing what is left after the tray), five per row at 360 px. It shows only items that can be ingredients: category `material` or `consumable`, plus any item that is an ingredient of any recipe in `RECIPES` (a set computed once from data, not per station, so it says nothing about this station). Gear, tools, keys, manuals and coin are not shown. Long-press shows the name (the shared tooltip). Cells keep `data-key="add-<item id>"`.
- **Repair list (anvil):** as today, as Rows.
- Keep the existing `data-key` values (`recipe-<id>`, `add-<item>`, `picked-<i>`, `craft-go`, `repair-<slot>`) so e2e flows keep working.

Out of scope: how crafting is graded or what a recipe needs. Experimenting stays possible: any ingredient can still go in the tray.

Save: none. Integrity: none.

Acceptance:

- e2e at 360 x 800 with 20 different ingredient items and 10 known recipes at the camp pot: the tray and Craft are inside the viewport with the sheet scrolled to the top and with the list scrolled to its end. The sheet itself does not scroll.
- e2e: the cook flow in `tests/e2e/sliceRun.spec.ts` passes unchanged or with only selector changes.
- e2e: a short recipe tapped shows the Missing line and leaves the tray empty.
- Unit: the ingredient-item set includes every item named in any recipe, and excludes a weapon, a tool and a key.
- Phone screenshots: camp pot on Recipes, on Bag, and the anvil on Repair. A landscape screenshot.

#### Part D. Who has work for you (G6)

Depends: Part A. Size: M.

Decisions:

- A person who would give you a Trial or request right now shows **"?"** over their head. A person waiting for something you can hand in now shows a **gold tick**. Hand-in wins when both apply. "!" stays the creature-chase mark and is not used for people.
- The mark is drawn only over a person who is on screen. It never appears on the minimap, the map or the screen edge, and no arrow points to anyone. This is a person in front of you showing they want to talk, not an objective marker (design/02 is clarified in this planning PR).
- A System setting **Show who has work** turns marks off. Default on. It is a UI setting outside the save, like the quick-slot pins.

Scope:

- New pure module `src/sim/giverMarks.ts`: `giverMarks(state, who): Map<npcId, 'offer' | 'ready'>`. For each person with a dialogue: start at `startNode`, walk the nodes reachable through `next` and through choices whose `if` holds (no node twice, depth at most `UI_BALANCE.giverMarkDepth`, new tunable, value 8). It is an **offer** if a reachable node or choice has `offerTrial` for a Trial that `offerTrial` would accept now (not offered, not passed), or `startRequest` for a request that `startRequest` would accept now (not taken or repeat cooldown passed, `requires` hold). Do not check the active-request cap; a full log still shows who has work. It is **ready** if a reachable `turnIn` names a request in state `ready`, or a request or Trial under way has a current `deliver` step to this person that the bag satisfies now. Teaching (`learnTechnique`), shops and flags alone never make a mark. Reuse `holds`, `startNode`, and the acceptance checks inside `offerTrial` and `startRequest` by extracting them to `canOfferTrial` and `canStartRequest`, so the rules are written once. No DOM, no clock, no random.
- Render: in `src/render/renderer.ts` (or a new `src/render/giverMark.ts`), draw the mark centered 2 px above the top of the person's doll, on the world layer above actors. Recompute the map at most every `UI_BALANCE.giverMarkRecheckTicks` (new tunable, value 30) and at once on `requestStarted`, `requestReady`, `trialOffered`, `trialPassed` and when a talk closes. Hidden over the person you are talking to. A 1 px bob on a 1 s cycle, off under reduced motion.
- Sprites in `src/content/sprites/ui` (generated, no external art): `ui.mark_offer` (a 7 x 9 speech bubble with "?" in it, light fill, darkest neutral outline) and `ui.mark_ready` (the same bubble in gold with a tick). Readable at 1x on a phone.
- Setting: `showGiverMarks` in `src/platform/settings.ts` and its storage, a toggle in the System tab, string `Show who has work`.

Out of scope: marks for Travelers (M5 proper), teachers or shops. Any off-screen indicator.

Save: none. Integrity: none.

Acceptance:

- Unit (`tests/unit/giverMarks.test.ts`): offer for a Trial giver whose Trial is open; none once offered; none once passed. Offer for an authored request with `requires` met; none when not met; none once taken; offer again when a repeat's cooldown has passed. Ready when a request is `ready` and its giver has a reachable `turnIn`. Ready when the bag holds a deliver step's items, not when it holds one fewer. A choice guarded by a phase shows the mark only in that phase. A teacher with only `learnTechnique` shows nothing.
- Scenario test over Dawnmeadow: for every person who gives any authored request or Trial, in a state where the mark is `offer`, running the dialogue by the choices the walk found reaches the offer. (The mark never lies.)
- Purity: `src/sim/giverMarks.ts` passes the sim-purity lint.
- Perf: the frame budget in tech/04 holds in Hearthford square with all marks on (report the frame time from the dev overlay before and after).
- Phone screenshots: the square with at least one "?" and one gold tick; the same with the setting off.

#### Part E. Plants look like plants (G5)

Depends: none. Size: M.

Decision: a gatherable node is drawn with its own world sprite, never with an item icon. Anything that looks gatherable is gatherable: decor never copies a node's look.

Scope:

- New world sprites, generated in `src/content/sprites/gen/nature.ts` (or a new `gen/nodes.ts`), 16 x 16 unless noted, each with a `ready` and a `spent` frame. The spent frame is the same plant stripped (no berries, cut stalks, torn web), never the moss tuft:
  - `node.herb_patch`: a low leafy clump with small yellow sunwort heads and pale green dewmint sprigs mixed, so both yields show.
  - `node.berry_bush`: a round bush with clear red and blue berry clusters (3 to 4 px each) on the leaves.
  - `node.nightshade_bush`: a darker, taller bush with drooping purple berries.
  - `node.glowcap_cluster`: two or three mushroom caps of different heights. Night variant with a lit rim if the lighting pass already supports emissive pixels; otherwise skip and note it.
  - `node.flax_patch`: tall thin stalks with small blue flowers.
  - `node.briar_tuft`: a thorny bramble with white wool caught on it.
  - `node.river_bank`: a wet clay mound with two pebbles at its foot.
  - `node.silk_web`: a web strung between two twigs.
- `NODES[*].sprite` in `src/content/items/recipes.ts` points to these. The vein, tree and fishing nodes keep their existing world sprites.
- Decor: `prop.bush_berry` is redrawn without berries or removed from the region spec scatter (say which in the PR). The four `prop.flower_*` decor sprites grow a clearer head (at least 3 x 3 px of petal color) so they read as flowers, and none uses sunwort yellow plus dewmint green together.
- The look-alike check from Part F, run over every node `ready` sprite against every decor prop sprite, at the same 0.20 threshold. If F has not merged, this part adds the check tool and F extends it to items.
- Rebake (`npm run bake`, `npm run bake:world`).

Out of scope: new node types, yields or respawn times.

Save: none. Integrity: none.

Acceptance:

- Validator: no `NODES` entry's sprite id starts with `icon.`.
- Look-alike check passes for nodes against decor.
- A contact sheet committed to `docs/ops/evidence/pow-m4-22e/` showing every node ready and spent, next to every bush and flower decor prop, on grass.
- Phone screenshots of a meadow with a herb patch, a berry bush and decor bushes and flowers in one frame, by day.

#### Part F. Every item its own icon (G4, G11)

Depends: none. Size: L. If it grows past one session, split by family into F1 (gear and tools), F2 (materials and food), F3 (potions, misc, manuals), each its own PR in that order.

Decision: every item has its own drawn icon. Tier variants of one weapon or tool may share a silhouette but must differ in metal or wood color and in one detail (guard, binding or head shape).

Scope:

- `src/content/sprites/gen/items.ts`: draw a distinct icon for every item. Families to redraw first (from the look-alike report, not exhaustive):
  - Manuals and letters (14 on one scroll): each manual gets a cover with an emblem for its skill (blade, open palm, footprints, flame, wave, wind swirl, fist on stone, mending stitch, lute, closed eye, hex knot), the Pilgrim's letter is a folded sheet with a wax seal, Wren's page is a torn sheet, the iron sword recipe scroll keeps the scroll. The Dawnmeadow notes and book items get book or sheet shapes that differ from each other. An icon shows only what the thing is (a book, a rubbing on stone, a page of notes), never a symbol that hints at what it says.
  - Keys (4 on one): different bows and metals (old brass key, foreman's iron key, mill key with a wooden grip, root key twisted like a root).
  - Ores and stone: copper ore (grey lump, orange flecks), iron ore (darker lump, rust flecks), coal (black faceted lumps, two pieces), stone essence (smooth orb, not a lump).
  - Bowls: herb tea in a cup, compote in a bowl with berries on top, stew with chunks, chowder with a fish tail, mushroom soup with a cap floating, porridge with a sunwort flower.
  - Bottles: one silhouette per effect family. Health a round flask, stamina a tall vial, focus a square bottle, cures (antidote, warming draught) a stoppered jar, salves (fire salve) a flat tin, oils (oil of keenness) a cruet with a spout, ward, swift, clarity and vigor each a different stopper or bottle shape. Minor and full versions share the shape and differ in size.
  - Wood: oak log (dark bark, ringed end) and ash log (pale grey bark); oak and ash planks by color and grain; the cart wheel as a wheel.
  - The other shared icons: fishing net as a mesh, wayfarer's cloak as a cloak, baker's peel as a peel, firebrick as a brick, crow feather charm as a feather on a cord, baker's loaf against bread, burnt mess against river pebble, dew vial against water flask.
- Each item's `icon` in `src/content/items/*` points to its own sprite.
- New check in `tools/bake-assets/` (run by `npm run validate` and so by `npm run verify`):
  - No two `ItemDef`s share an `icon` id.
  - For every pair of item icons, `d` = pixels whose palette index differs (transparent counts as its own index) divided by 144. Every pair needs `d >= 0.20`, except pairs listed in `ICON_VARIANT_GROUPS` (new data, next to the generator: one group per tier line, for example the four swords, the four spears, the two picks, axes, sickles, hammers, rods), which need `d >= 0.10` and a different most-common non-outline ramp.
  - No two items share a display name.
  - Thresholds live in the tool's config with a comment, not in `balance/` (they are not gameplay numbers).
  - The tool prints the failing pairs with their `d`, so a failure says what to redraw.
- Names: `item.potion_stamina_m.name` becomes `Strong Stamina Tonic`. If the name check finds others, rename by the same pattern (`Strong ...` for the `_m` version) and list them in the PR.
- Rebake. The contact sheet `baked/contact-items.png` shows the new set.

Out of scope: icon size (stays 12 x 12), the bag UI, item stats.

Save: none (icons and names are not saved). Integrity: none.

Acceptance:

- The look-alike check passes and is part of `npm run verify`. A test feeds it two identical icons and sees it fail.
- The PR shows the before and after count of pairs under 0.20 (before: 180 pairs, 89 items).
- A grouped contact sheet (by category, name under each icon, at 4x) committed to `docs/ops/evidence/pow-m4-22f/`.
- Phone screenshot of a Bag holding all the potions and salves, and one holding the four ores and coal.

#### Owner action (after all parts merge)

Replay on the phone: take a standing gather job holding some of the items already; find the "?" people in the square; craft three dishes at the camp pot without scrolling; open the Chronicle and find a finished request, a passed Trial and a recipe; tell the potions apart in the Bag; pick a herb patch and a berry bush out of a meadow by sight.

#### Follow-ups noted, not in this ticket

- A "new" badge on the Chronicle tab when a request finishes or a recipe is learned (design/09 already asks for badge dots).
- The dev overlay covers the minimap and the top of the screen in `?kit=dev` screenshots. Dev only, so low priority.

---

## Endurance-bot findings

The executor's endurance bots (`tools/endurance-bot/`, report `reports/endurance-bot.md`, build `626be6f`) played every Dawnmeadow skill against the real map and curve. Five skills with a rank 15 Trial in Dawnmeadow cannot reach it, or reach it far outside the pacing bands. The executor's drafts are in `reports/endurance-tickets.md`. This ticket supersedes them. Where the two differ, this spec wins.

### POW-M4-23 Endurance-bot findings: Cartography XP, fishing, Survival, iron, Deciphering

Size: 5 PRs (parts A to E: A, D and E are S, B and C are M) Depends: see each part Status: READY
Refs: design/03-progression (Curve, Mastery ranks and Trials), design/10-content-budget, design/11-skill-table, regions/01-dawnmeadow (sections 9 and 14), tech/02-save-security (parts A, C and D), tech/04-quality, `reports/endurance-bot.md`

Goal: every skill with a rank 15 Trial in Dawnmeadow can reach that Trial in Dawnmeadow, inside its pacing band, and the map pays the XP it says it does.

**How to run this ticket.** One PR per part. Title: `POW-M4-23<letter> <part title>`, for example `POW-M4-23A The map pays Cartography`. Part A first: it is a live bug and changes the save. B to E do not depend on each other and can run in parallel once A merges. Parts A and C each bump the save schema, and the "Save schema bumps serialize" rule at the top of this file applies: whichever merges later rebases and takes the next number. Parts B and D both rebake the world: whichever merges second rebases and runs `npm run bake` again. Every part that changes a rate reruns `npx tsx tools/endurance-bot/skills.ts` and `npm run sim-bot` and pastes the before and after rows for its skill into the PR.

**Findings this ticket answers.**

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                      | Part |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| E1  | Walking never pays Cartography. `mapSystem` runs after `skillsSystem` in `WORLD_SYSTEMS` (`src/sim/step.ts`), and `tick()` clears events at the start of each tick (`src/sim/kernel/scheduler.ts`), so the `revealed` event is never read. `tests/sim/map.test.ts` calls the two systems by hand in the right order, so it passes. Map bot, same 24.5-minute walk: shipped order gives 0 XP; map before skills gives 8,951 XP and 14 points. | A    |
| E2  | Dawnmeadow has one `node.fishing_spot` (238, 170), 3-minute respawn, 20 XP a catch. Rank 15 takes about 29 h of play. Every other gathering skill reaches 15 in 0.1 to 2.7 h.                                                                                                                                                                                                                                                                | B    |
| E3  | Survival pays 30 XP per in-game night hour outdoors (10 of every 48 real minutes are night), plus 8 per raw food eaten. Rank 15 takes about 10.6 h. The slow band is 35 to 70 minutes.                                                                                                                                                                                                                                                       | C    |
| E4  | One surface iron vein (quarry, 185, 75) on an 8-minute respawn, about 0.2 ore a minute. The second vein is inside the Rootway. No shop sells iron. 15 smithing recipes need iron ingots at 2 ore each.                                                                                                                                                                                                                                       | D    |
| E5  | Deciphering pays 100 XP once per tablet kind. Dawnmeadow has 7 tablets of 6 kinds, 600 XP in total, so 3 points at most. Rank 15 needs 4,378. Its Trial exists and cannot be reached.                                                                                                                                                                                                                                                        | E    |

**Owner decisions (November 2026), settled here, do not reopen.** A: backfill existing saves. B: Fishing pays as Foraging does, and the river and coast get more spots. C: real camps, active Survival. D: iron is a region 1 goal. E: tablets pay per placement and again at each Deciphering band.

---

#### Part A. The map pays Cartography (E1)

Depends: none. Size: S.

Scope:

- `src/sim/step.ts`: move `mapSystem` ahead of `wearSystem, trialsSystem, skillsSystem`. Nothing else in the order changes. Replace the comment above that block with one that says why: a system that emits an event `skillsSystem` or `trialsSystem` reads must run before them. Cartography's reveal radius then reads the points from the end of the previous tick. That one-tick lag is accepted.
- A guard test, `tests/sim/systemOrder.test.ts`. It lists the event types `skillsSystem` and `trialsSystem` read (export the list from `src/sim/systems/skills.ts` and `trials.ts` so the test cannot drift from the code), then checks every system after them in `WORLD_SYSTEMS` (`deedsSystem`, `pathsSystem`, `singularsSystem`, `bestiarySystem` today) by running each alone on a scripted state and asserting it emits none of those types. If one of them already does, stop and raise a Design Query. Do not reorder it in this PR.
- `tests/sim/map.test.ts`: a new test that drives `stepWorld`, not the systems by hand.
- Save migration, `CURRENT_SCHEMA` 27 to 28 (or the next free number). For each avatar, count the revealed blocks in every region in `map.fog` (`countRevealed` in `src/sim/world/fog.ts`). Grant `blocks * MAP_BALANCE.xpPerBlock` minus any Cartography XP the ledger already records (never less than 0). Grant it through the sim's XP path, so the skill awakens, the XP banks at a pending Trial (14 with a full bar), and `ledger.xpEarned['skill.cartography']` records it. The Rested bonus does not apply: use a variant of `addXp` that skips `statusMods`, or clear the bonus for the call. The grant is exact.
- Ledger note: `ledger.xpEarned` is keyed by skill, not by source. There is no per-source ledger entry to add. The plausibility ceiling for Cartography (`xpCeiling`, from `REVEAL_EVENTS_PER_SECOND`) already covers XP equal to blocks revealed in the save's play time, because those blocks were revealed in that time. The fixture test proves it.
- A fixture from schema 27 (export from main as it stands, `tests/fixtures/saves/schema-27.json`) and its migration test.

Out of scope: the reveal radius table, XP per block, the Cartography Trial.

Acceptance:

- A `stepWorld` test walks 40 tiles over unseen ground and Cartography XP equals blocks revealed times `MAP_BALANCE.xpPerBlock`.
- The guard test fails with `mapSystem` moved back after `skillsSystem`. Paste the red run in the PR.
- `npx tsx tools/endurance-bot/map.ts --cap 60` on the shipped order reports Cartography at least 14, with XP equal to blocks revealed.
- The schema 27 fixture loads, migrates, has Cartography XP equal to its revealed blocks, and passes every integrity layer with the seal intact.
- A migrated save that already holds Cartography XP is not paid twice (unit test).
- `npm run verify` passes.

---

#### Part B. Fishing that can be trained (E2)

Depends: POW-M4-23A. Size: M.

Decision: Fishing pays as Foraging does (base 150, first time 150), and Dawnmeadow gets 6 to 8 more `node.fishing_spot` placements on the river, the lake shore, Reedmouth and the coast, on the current 3-minute respawn. The model in `reports/endurance-tickets.md` puts that at about 2 catches a minute on a short stretch of river, 40 to 60 minutes to rank 15.

Scope:

- `src/content/skills/index.ts`: the Fishing source row becomes `{ on: 'gather', tag: 'fishing', base: 150, firstTime: 150 }`.
- `src/content/world/regions/dawnmeadow/spec.ts`: the new `at('node.fishing_spot', x, y)` placements. Each sits on a water-edge tile with open, walkable ground next to it. At least 3 are within one river stretch a player can walk between in under a minute. At least one is in or beside Reedmouth. List the coordinates in the PR.
- Rebake (`npm run bake`).
- A Fishing policy in `tools/sim-bot/policies.ts`, checked against `timeTo15Slow` in `tools/balance-thresholds.json`, and added to the `balance:ci` run.
- If `GATHER_ITEMS_PER_SECOND` or the gather XP ceiling in `src/save/integrity/bounds.ts` no longer covers the new rate, raise it and say why in the PR.

Out of scope: new fish, new fishing mechanics, the Fishing Trial (three river fish).

Acceptance:

- Every new spot passes the bake validator, stands next to walkable ground, and is reachable from Hearthford without a portal (the endurance bot's route model, `tools/endurance-bot/world.ts`, confirms it).
- `npm run sim-bot` has a Fishing loop and its time to rank 15 is inside `timeTo15Slow`.
- `npx tsx tools/endurance-bot/skills.ts` reports Fishing to rank 15 under 70 minutes on the real map.
- The Fishing Trial is still passable at rank 14 (unit test or sim-bot row).
- `npm run verify` and `npm run balance:ci` pass.

---

#### Part C. Survival paced like a skill: real camps (E3)

Depends: POW-M4-23A. Size: M.

Decision: Survival becomes something the player does. Rest points outdoors become camps. A player who stands still at one outside a settlement earns Survival per minute, at any hour, up to a daily cap per camp, so training it means moving between camps. Sleeping outdoors pays a small lump. Night outdoors stays as a bonus, raised to 60. Raw food stays at 8.

What the code holds today (read before starting): `fixture.rest_point` (`src/content/world/fixtures.ts`, type `rest`) has no body and no interactable. Two stand on the surface (`src/content/world/stamps/dawnmeadow.ts`). The rest are in dungeon rooms, which are not outdoors. `sleepOutdoors` in `src/sim/systems/fixtures.ts` already exists and emits `sleptOutdoors`.

Rules:

- **Camping.** The avatar is camping while all of these hold: it is alive and its fighter state is idle, it issued no move or attack command this tick, it is within `SKILLS_BALANCE.survival.campRadius` tiles of a `rest` fixture, the tile is outdoors by the same test `outdoorsNight` uses, and it is outside every settlement rectangle (Hearthford's, from `TOWN_ORIGIN` and `TOWN_SIZE`, and the other settlement stamps placed in `spec.ts`). Any move, attack, hit taken or death ends it and drops the partial minute.
- **Camp pay.** Each full minute of camping pays `campXpPerMinute` Survival XP. Each camp pays at most `campMinutesPerDay` minutes per in-game day per avatar. The day boundary is the in-game day from `src/content/balance/time.ts`. Camping at a camp that has used its minutes pays nothing and shows nothing new.
- **Sleeping outdoors.** Each `sleptOutdoors` event pays `sleepOutdoorsXp`, at most once per in-game hour.
- **Night outdoors.** Raised from 30 to 60 per in-game hour. Unchanged otherwise.
- **The player sees it.** When camping starts, one message-lane notice from `src/content/strings/` ("You settle in by the camp." or close). When a camp's minutes for the day run out, one notice ("This camp has nothing more to teach you today." or close). No other new UI.

Scope:

- New `XpEvent` values `camp` and `sleepOutdoors` (`src/content/skills/types.ts`), their source rows on Survival (`src/content/skills/index.ts`), and their rates in `RATES` (`src/save/integrity/bounds.ts`: camping is one event a minute, sleeping one an in-game hour).
- The camping accumulator, the per-camp minutes used today and the last sleep pay hour on the avatar's `Skills` component (`src/sim/state.ts`). This changes saved state: bump the schema, migrate old saves with empty values, and ship the fixture test.
- The emitter in `src/sim/systems/skills.ts` (next to `outdoorsNight`), keyed on the camp's home tile so each camp is tracked apart.
- Tunables in `src/content/balance/skills.ts` under `survival`: `campRadius`, `campXpPerMinute`, `campMinutesPerDay`, `sleepOutdoorsXp`, `nightXpPerHour`. Tune them so a player walking a camp circuit lands inside `timeTo15Slow`.
- 6 more `fixture.rest_point` placements on the Dawnmeadow surface, outside settlements, spread across at least four map regions (meadow, woods edge, river, quarry road, coast). Each gets a campfire or bedroll look already in the atlas. List them in the PR.
- A Survival loop in `tools/sim-bot/policies.ts` that walks a camp circuit, checked against `timeTo15Slow`, added to `balance:ci`.

Out of scope: new fixture kinds, new sprites, weather damage, the Hermit Path, cooked-food provenance (the draft's "eat a dish cooked outdoors" source is dropped: items do not record where they were cooked, and adding that would change every saved stack).

Acceptance:

- Sim tests: camping outdoors by day pays per minute; the same stand indoors, in Hearthford, or while dead pays nothing; a move drops the partial minute; a camp stops paying at `campMinutesPerDay` and pays again the next in-game day; a second sleep within the same in-game hour pays nothing.
- The sim-bot Survival loop reaches rank 15 inside `timeTo15Slow`.
- The previous-schema fixture loads, migrates and passes every integrity layer with the seal intact.
- The Survival Trial (sleep outdoors twice) still passes at rank 14.
- `npm run verify` and `npm run balance:ci` pass.

---

#### Part D. Enough iron for Dawnmeadow's iron recipes (E4)

Depends: POW-M4-23A. Size: S.

Decision: iron is a region 1 goal. More surface veins, and Brin sells iron ore at a price that makes buying possible but mining cheaper.

Scope:

- `src/content/world/regions/dawnmeadow/spec.ts`: 4 more `at('node.iron_vein', x, y)` placements in the quarry and on the Stonecrop approach, tier 2, on the current 8-minute respawn, each reachable without a portal. List them in the PR. Rebake.
- `src/content/dialogue/index.ts`, `shop.brin` stock: `{ item: 'item.iron_ore', max: <n> }`, with `max` in `src/content/balance/shop.ts`.
- **Price rule.** One bought ore costs more coin than the fight loop earns in the time it takes to mine one ore from the surface veins. Measure both from the sim-bot (fight coin per minute) and the endurance bot (surface tier 2 ore per minute). Use the shop's existing price path. If it cannot meet the rule, add a per-stock buy price in `src/content/balance/shop.ts`. Do not raise `item.iron_ore`'s value in `src/content/items/materials.ts`: that raises its sell price too. Buy must stay above sell as `src/content/balance/shop.ts` requires.
- A balance test that asserts the price rule from the measured numbers, so a later change to fight coin or vein count fails it.
- Ledger: shop stock already counts as an item source (`src/save/integrity/sources.ts`). Confirm with the save round trip below. No new rule is expected. If one is needed, add it and say why.

Out of scope: new ores, the iron recipes themselves, other shops.

Acceptance:

- `npx tsx tools/endurance-bot/gather.ts` shows tier 2 mining at least 0.8 a minute on surface nodes.
- Every new vein passes the bake validator and is reachable without a portal.
- Buy ore, smelt, craft an iron sword, save, reload: the seal stays intact and every integrity layer passes (e2e or sim test).
- The price rule test passes, with the numbers it used in the PR.
- `npm run verify` and `npm run balance:ci` pass.

---

#### Part E. Deciphering can reach its Trial (E5)

Depends: POW-M4-23A. Size: S.

Decision: reading pays per placement, not per kind, and pays again at each Deciphering band. Manuals pay once each. No new readable content.

What the code holds today: tablets are fixtures of type `tablet` (`fixture.tablet`, `fixture.tw_order`, the mini-dungeon tablets). `skillsSystem` keys the first-time lump on the fixture kind, so two tablets of one kind pay once. First-time bonuses are kept in `Skills.seen` as `skill:event:subject` strings. Manuals emit `manualRead` and pay no Deciphering today.

Rules:

- **Tablets.** The subject becomes the tablet's placement and the reader's band: `<kind>@<homeX>,<homeY>#<band>`, where `band = floor(points / SKILLS_BALANCE.deciphering.bandSize)`. Each subject pays `tabletXp` once. A tablet read again in the same band pays nothing. Reaching a new band makes every tablet pay again once. Re-reads pay the same as a first read, not less: with 7 tablets, less would leave rank 15 out of reach.
- **Manuals.** A new `XpEvent` `manualRead` pays Deciphering `manualXp` as a first-time lump, subject the manual item id. A manual is consumed when read, so it pays once.
- **Numbers.** Count the tablets and manuals in the bake first and put the counts in the PR. Then set `bandSize`, `tabletXp` and `manualXp` in `src/content/balance/skills.ts` so a player who reads every tablet at every band up to 14, and every manual, reaches 14 with a full bar, in about 60 to 90 minutes of reading and travel by the endurance bot's route model.
- **Old saves.** `seen` holds strings, so the shape does not change and no schema bump is needed. A save that already read a tablet kind under the old key gets paid once more for each tablet at its current band. That is at most 7 payments, accepted, and it does not need a migration. Say so in the PR.

Scope: the source rows in `src/content/skills/index.ts`, `manualRead` in `src/content/skills/types.ts`, the subject keys in `src/sim/systems/skills.ts`, the `RATES` entry and the first-time subject count in `src/save/integrity/bounds.ts` (`FIRST_TIME_SUBJECTS` must cover tablet placements times bands plus manuals), the tunables, tests, and an endurance-bot rerun.

Out of scope: new lore text, new readables, signs. Any of those needs its own ticket under design/08 "Delivery rules".

Acceptance:

- A sim test reads every tablet on the real map (a list taken from the bake) at every band, and every manual, and Deciphering reaches 14 with a full bar.
- A sim test: a tablet read twice in the same band pays once; the same tablet pays again after the reader crosses a band.
- The plausibility layer passes a save that has read everything (fixture or generated).
- No player-facing string is added. The Deciphering Trial (`readManual`) is unchanged.
- `npm run verify` passes.

---

#### Owner action (after all parts merge)

One short session on the phone: walk out of Hearthford and watch the Cartography bar move; fish a stretch of river for five minutes; sit at two camps; buy one iron ore from Brin and price it against a fight; read a tablet, gain a Deciphering band, read it again.

#### Follow-ups noted, not in this ticket

- F6 (the map is fog-cleared in about 25 sim minutes) and F7 (tier 2 foes make combat skills very fast) are pacing notes for M5 refinement, not defects.
- Rank 15 to 29 in Dawnmeadow runs at the 10% floor for most skills (about 530 h to the region ceiling in total). Expected while region 1 has only rank 15 Trials. Confirm before Whisperwood is planned.
- `tools/endurance-bot/` could become `npm run endurance` inside `balance:ci` once these parts land, so its rows gate the bands as the sim bot does.
