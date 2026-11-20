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

**Save schema bumps serialize.** Tickets 14, 15, 19 and 20 each bump the schema. Whichever merges later rebases, takes the next number, and re-exports its fixture from main as it stands then. Each migration stays a separate step.

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
