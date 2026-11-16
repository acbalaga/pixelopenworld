# M1 First Login (vertical slice)

**Result:** 20 minutes of the real game in a small area outside Hearthford. Create an avatar, walk, fight three kinds of creature, forage, cook, talk to an NPC, buy something, enter a cave, beat a miniboss, save and reload.

**Gate G1:** is one-thumb combat fun for 20 minutes? This is the most important gate in the project. Art direction is also reviewed here.

The slice uses simplified versions of systems. M3 generalizes them. Build them so that generalizing is extension, not rewrite: data-driven from the start, even when there are only four skills.

---

### POW-M1-01 Player avatar: movement, animation, paper doll

Size: L Depends: M0 complete Status: READY
Refs: design/04-combat (Control schemes), tech/03-asset-pipeline (Paper dolls, rules), design/09-ui-ux (Portrait layout)

Goal: a player character that moves well under the thumb and wears what it is given.

Scope:

- Avatar entity with position, facing (4 directions), velocity, collision box (10x8 at the feet).
- Movement system: stick vector to velocity with short acceleration and deceleration ramps (tunable), 8-directional movement, sprint (hold stick at full extent for 0.5 s, or toggle, costs Stamina), collision with tiles and solid entities.
- Paper-doll layers: body, skin tone swap, hair (4 styles), hair color swap, outfit (3), main hand, off hand. Idle 2 frames, walk 4 frames, attack 3 frames, hurt 1, dodge 2, in 4 directions with mirroring.
- Camera follows per M0-05 with the portrait offset.
- Context button appears when an interactable is within reach and facing.
- Movement tunables in `content/balance/movement.ts`.

Acceptance:

- Movement unit tests: reaches top speed in the specified ticks, stops in the specified ticks, diagonal speed is not faster than cardinal, no wall sticking.
- Screenshot grid of 6 different avatars from parts. Contact sheet attached.
- On an emulated phone, walking the test area feels responsive: input to motion within 2 ticks.

---

### POW-M1-02 Combat core

Size: L Depends: M1-01 Status: READY
Refs: design/04-combat (all), tech/01-architecture (Entities)

Goal: hitting, getting hit, dodging, and dying work and feel good.

Scope:

- Pools: Health, Stamina, Focus with regeneration rules from design/04.
- Hitboxes and hurtboxes per attack frame as data. Attack arcs for sword (Blades) and a second weapon, spear (Polearms), to prove families differ.
- Damage formula from design/04 with coefficients in `content/balance/combat.ts`. Crits. Damage numbers.
- **Both control schemes:** Flow (auto basic attack on cadence when a target is in reach and arc, tap to lock, flick dodge) and Classic (manual 3-hit combo, dodge button). Switchable in settings.
- Dodge with invulnerable frames and Stamina cost. Perfect-dodge detection (dodge within a window before impact) emits an event.
- Stagger bar on enemies. Staggered state with bonus damage.
- Hit feedback: hit pause, flash, knockback, small shake (scaled by reduced motion), sound, haptic tick where supported.
- Target lock frame (name, health, stagger).
- Death and respawn at the Waystone with the Echo rule (10% coin left behind, recoverable).
- Two techniques to prove the slot system: a Blades lunge (Stamina) and a ranged Ember bolt (Focus, hold to aim).

Out of scope: statuses, reactions, shields, the other weapon families, companions (M3 and later).

Acceptance:

- Sim scenario tests: time-to-kill for a par common enemy is inside 4 to 8 seconds under a scripted competent input. Dodge i-frames prevent damage. Stamina at zero prevents dodge. Stagger triggers at the threshold. Death moves the avatar and creates the Echo.
- Flow and Classic produce time-to-kill within 15% of each other under scripted play.
- A short screen recording or a sequence of screenshots of a fight in each scheme is in the PR.

---

### POW-M1-03 Enemy AI v1

Size: L Depends: M1-02 Status: READY
Refs: design/04-combat (Enemies)

Goal: three creatures that are fun to fight and are built from reusable archetypes.

Scope:

- Archetype behaviors as small state machines driven by data: Chaser, Shooter, Charger. States: idle, wander, notice, approach, telegraph, attack, recover, leash, flee.
- Telegraphs: wind-up flash for melee, ground marker for area and charge paths. Timings from data, minimum 350 ms at tier 1.
- Engagement cap (max 6 attackers, others circle), leash and reset.
- Three tier 1 creatures with art, sounds, drops: a Chaser (Mossling), a Shooter (Spitbloom, a plant that lobs seeds), a Charger (Bramble Boar). One miniboss for the cave: a large Charger variant with a second phase that adds a ground-marker slam.
- Spawners with population caps and respawn timers, placed in map data.
- Creature definitions in `content/creatures/` with schema.
- Simple local avoidance so enemies do not stack on one tile.

Acceptance:

- Scenario tests per archetype: notices at range, telegraphs for the configured time before any damaging frame, leashes at distance, resets health after leash.
- No attack in the creature data has a telegraph under 350 ms (content validation rule).
- Contact sheets for all four creatures. Screenshot of each telegraph.

---

### POW-M1-04 Skill framework v1

Size: M Depends: M1-02 Status: READY
Refs: design/03-progression (Skills, Earning skill XP, Mastery ranks, Attributes)

Goal: skills grow by use, with the real rules, for a first set of skills.

Scope:

- Skill definitions as data. Implement Blades, Polearms, Ember, Evasion, Foraging, Cooking, Athletics. The system must not know how many skills exist.
- XP grants from sim events (damage dealt with a weapon family, successful dodge, node gathered, dish cooked, distance sprinted) through a mapping table in data.
- Challenge multiplier by target tier against rank. First-time bonus.
- XP curve from `content/balance/skills.ts`.
- Rank thresholds with XP banking at 15 (the slice only reaches the first threshold). One Trial to prove the mechanism: the Foraging Trial at 15, given by an NPC, asking for a specific herb gathered at dawn or dusk.
- Attributes derived from skills (Health, Stamina, Focus maxima).
- Rank-up banner and the small XP tick on the HUD.

Out of scope: the other 29 skills, techniques beyond the two from M1-02, Paths.

Acceptance:

- Unit tests: XP mapping, challenge multiplier at below, par, and above, first-time bonus fires once, banking at threshold holds XP until the Trial flag is set, attributes recompute on rank change.
- Adding a new skill is a data-only change (demonstrated by a test that registers a fake skill).

---

### POW-M1-05 Items and inventory v1

Size: M Depends: M1-01 Status: READY
Refs: design/05-life-systems (Gathering, Crafting), design/09-ui-ux (The Menu)

Goal: things can be picked up, carried, worn, eaten, and dropped by enemies.

Scope:

- Item definitions as data with schema: id, name key, description key, icon sprite, category, stack size, tier, value, and per-category fields (weapon stats, food effects).
- Inventory as slots with stacking. Starting capacity from balance data.
- Equipment slots: main hand, off hand, head, body, legs, accessory. Equipping changes paper-doll layers and combat stats.
- Loot: drop tables on creatures, world pickups with a small magnet radius, loot pop animation and sound.
- Gathering nodes v1: herb patch and berry bush with respawn timers and the timing sweet-spot input from design/05.
- Consumables: eating food restores pools and applies a Fed buff with a timer.
- Cooking v1 at a camp pot: 4 recipes, the experiment flow (combine ingredients without a recipe, discover result, recipe is then known).
- About 30 items for the slice (2 swords, 1 spear, 3 outfits, herbs, berries, meat, 6 dishes, coin, misc).

Out of scope: quality tiers, durability, affixes, other crafts (M3).

Acceptance:

- Unit tests: stacking and overflow, equip and unequip stat changes, drop table distribution over 10,000 rolls within tolerance, node respawn, Fed buff replaces not stacks, experiment discovers a recipe exactly once.
- Icons contact sheet attached.

---

### POW-M1-06 HUD and Menu shell v1

Size: L Depends: M1-02, M1-04, M1-05 Status: READY
Refs: design/09-ui-ux (all)

Goal: the real HUD, and a Menu with the tabs the slice needs.

Scope:

- HUD per design/09: pool bars, status icons row, clock placeholder, technique buttons in the thumb arc, context button, menu and bag buttons, target frame, fade-when-idle behavior.
- Controls honor handedness, button size, and opacity settings.
- Menu sheet (DOM, clear text, pixel frames): Character (avatar preview, gear slots), Skills (list with rank and progress), Bag (grid, item detail, use, equip, drop with hold-to-confirm), System (settings, control scheme, Log Out). Other tabs appear disabled with their names.
- Swipe up from the bottom edge and the menu button both open it. Back gesture or swipe down closes it.
- Menu DOM has proper roles, labels, and focus order.
- All strings from `content/strings/`.

Acceptance:

- Screenshots of HUD and each tab at 360x800 and 412x915, and landscape.
- Every interactive element measures at least 44 px.
- With a screen reader simulated by the accessibility tree snapshot in Playwright, each Menu tab exposes named, ordered controls.
- Text scale 160% does not clip any Menu tab.

---

### POW-M1-07 Slice map: Hearthford outskirts

Size: L Depends: M0-07, M1-03, M1-05 Status: READY
Refs: design/02-world (Regions, Dungeons, Secrets and discovery), design/01-experience (The first hour)

Goal: a small, good-looking, hand-authored place to play in.

Scope:

- A 3x3 chunk outdoor area: a corner of Hearthford square (Waystone, request board prop, one shop front, a camp pot, a training dummy), a road out, meadow with gather nodes, a stream with a bridge, a wooded edge, a cave mouth.
- Cave interior: 5 rooms as a small graph. One locked door and key, one pressure-plate puzzle, one optional side room with a chest, the miniboss room, a shortcut back to the entrance.
- Tile and prop art needed for this: buildings (2 fronts), fences, bridge, signs, cave tiles, door, chest, plate, torch (animated).
- Spawner placement with a difficulty ramp from the square outward.
- A Waystone that sets the respawn point.
- One tablet in the cave side room showing a line of unreadable glyphs (placeholder glyph font is fine, the real cipher comes in M10). Interacting shows the glyphs and nothing else.
- Dungeon room transitions (fade, camera snap to room bounds).

Out of scope: region streaming, the rest of Dawnmeadow (M4).

Acceptance:

- Full-map image render (a tool that stitches chunks to one PNG) attached.
- A scripted bot can path from the square to the miniboss room and back through the shortcut.
- The puzzle cannot be soft-locked: leaving and re-entering the room resets movable parts unless solved.
- Screenshots at phone resolution of the square, the meadow, the bridge, and two cave rooms.

---

### POW-M1-08 NPCs and dialogue v1

Size: M Depends: M1-06 Status: READY
Refs: design/09-ui-ux (Dialogue), design/05-life-systems (Requests, Economy)

Goal: people to talk to, buy from, and take a job from.

Scope:

- Dialogue data format: nodes with speaker, text key, choices, conditions (flags, item counts, skill ranks), and effects (set flag, give item, start request). Validated at build.
- Dialogue sheet UI in clear text with pixel portrait, tap to advance, choice buttons, scrollable log.
- Three NPCs with portraits and idle behavior: a shopkeeper (buy and sell UI with coin), a cook who teaches a recipe and gives the Foraging Trial, a guard who gives a "clear the pests" request.
- Request tracking v1: accept, progress from sim events, turn in, reward. The pinned request line on the HUD.
- One training-dummy bystander placeholder for the future Traveler (static NPC with two lines written as chat-style text).
- Music ducks during dialogue.

Out of scope: schedules, friendship, the request board UI and generator (M3), Travelers (M5).

Acceptance:

- Content validation rejects a dialogue with a dangling node reference or a missing string key.
- Scenario test: accept request, kill the required creatures, turn in, reward granted once.
- Buying with insufficient coin is refused with a clear message. Selling works.
- Screenshots of the dialogue sheet and shop at 360x800.

---

### POW-M1-09 Local save v1

Size: M Depends: M1-04, M1-05 Status: READY
Refs: tech/02-save-security (Save anatomy, Local storage), tech/01-architecture (State and saves)

Goal: progress persists across reloads. Unencrypted for now, shaped so M2 only adds the envelope.

Scope:

- `save/` module: `SavePlain` structure from tech/02 including `schema`, `saveId`, `seq`, `prevHash`, `summary`. Canonical serialization.
- `shared/summary.ts`: derive `SaveSummary` from `SimState`.
- IndexedDB storage with three rotating snapshots and transactional writes.
- Autosave triggers from tech/02 (timer, transitions, hidden, pagehide).
- Load on boot with fallback through snapshots.
- Migration framework: ordered migration functions by schema number, a fixture of schema 1 committed under `tests/fixtures/saves/`.
- Serialization, storage, and crypto calls behind an interface so M2 can swap in binary encoding, compression, and encryption without touching callers.
- Save indicator glyph (brief, unobtrusive).

Out of scope: encryption, integrity checks, export (M2).

Acceptance:

- E2E: play, gain an item and XP, reload the page, state is identical (`hashState` equal).
- Unit: a corrupted latest snapshot falls back to the previous one and reports it.
- Unit: a no-op migration from fixture schema 1 to current loads cleanly. The test pattern is documented for future migrations.
- Killing the page during a save (simulated aborted transaction) never leaves an unreadable latest snapshot.

---

### POW-M1-10 Login flow and avatar creation

Size: M Depends: M1-01, M1-09 Status: READY
Refs: design/01-experience (The first hour), design/09-ui-ux (Onboarding), design/07-simulated-mmo (Chat, as visual reference only)

Goal: the game opens as an online game would.

Scope:

- Title screen styled as a game launcher login: logo, a Log In button, a save status line, version. The first tap also unlocks audio.
- New save: avatar setup screen presented as the game's own character setup. Handle (validated: length, allowed characters, no free-text profanity list needed beyond a short blocklist), body, skin, hair style and color, outfit color. Live preview. A Randomize button.
- Existing save: Log In goes straight into the world with a short "connecting" beat (under 1 second, skippable).
- Arrival at the Hearthford Waystone with a brief materialize effect.
- A placeholder chat ticker on the HUD showing 6 to 8 scripted lines over the first few minutes, so the slice has the feel. Marked clearly in code as scaffolding to be replaced by M5.
- Contextual hint system: one-line hints triggered by first opportunity, dismissed by doing the action, never shown twice, stored in the save. Hints for move, lock, dodge, technique, gather, cook, menu.
- Log Out in the System tab saves and returns to the title screen.

Acceptance:

- E2E: fresh profile goes title, avatar setup, world. Second launch goes title, world, with the same avatar.
- No modal appears in the world that the player did not open.
- Each hint appears once and only when relevant (unit tests on the trigger logic).
- Screenshots of title, avatar setup, and arrival.

---

### POW-M1-11 Slice integration and Gate G1 build

Size: M Depends: M1-01 to M1-10 Status: READY
Refs: MASTER_PLAN (Gates), tech/04-quality (budgets), design/04-combat

Goal: a build the owner can judge, and the evidence to judge it with.

Scope:

- Play through the whole slice and fix integration defects (ordering, missing sounds, rough transitions). Fixes only. No new features.
- Tuning pass on movement, cadence, dodge window, telegraph times, enemy density, drop rates, using `content/balance/` only.
- E2E extended: a scripted run that creates an avatar, completes the guard's request, cooks a dish, and reloads.
- Performance check against tech/04 budgets on the slice. Report in the PR.
- `docs/ops/gate-g1.md`: the owner's playtest script. What to try in each control scheme, questions to answer (Which scheme felt better? Where did your thumb get tired? Did you ever lose track of the avatar? Was any text hard to read? Does the art look like one game?), and a short form for notes.
- A dev-only toggle to switch control scheme from the HUD during the playtest.

**Owner action:** play the G1 build on a phone and answer the script. The answers decide the default control scheme and feed the M3 refinement.

Acceptance:

- The scripted e2e run passes.
- Budgets met on the slice, with numbers.
- G1 script exists. Known issues are listed honestly in the PR.
