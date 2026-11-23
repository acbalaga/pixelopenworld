# Ticket drafts for the planning agent: endurance-bot findings F1 to F5

**Adopted.** The planning PR for POW-M4-23 moved these drafts into `docs/tickets/M4-world-1.md` with the owner's decisions and corrections from the code. That spec wins. This file is kept as the evidence trail.

From the executor, for the design authority. Executors do not edit `docs/tickets/` (CLAUDE.md, "Changing a ticket"), so these are drafts. They follow the format in `docs/tickets/README.md`. The planning agent should adopt, change or reject them in a planning PR to `docs/tickets/M4-world-1.md`. They are numbered as the next M4 ticket because they fix region 1 before M5. Renumber them if M5 refinement absorbs them instead.

Evidence: `reports/endurance-bot.md`, tools in `tools/endurance-bot/`, branch `claude/epic-goldberg-gcysb3`, build `626be6f`.

Corrections to the first report, made while writing these:

- The "unreachable" iron vein is inside the Rootway (141, 423). The route model did not path through portals, so it marked the vein unreachable. The vein can be reached, but only through the dungeon.
- The six tier 2 foraging nodes are Whisperwood supply by design (`src/content/items/recipes.ts`, "placed by that region's map"). They are not a gap.

---

### POW-M4-23 Endurance-bot findings: Cartography XP, fishing, Survival, iron, Deciphering

Size: 5 PRs (parts A to E). A is S, B to E are S to M. Depends: see each part. Status: A READY once its Design Query is answered. B to E DRAFT (each needs a balance decision from the owner).
Refs: design/03-progression (Curve, Mastery ranks and Trials), design/10-content-budget, design/11-skill-table, regions/01-dawnmeadow (sections 9 and 14), tech/02-save-security (part A only), tech/04-quality, `reports/endurance-bot.md`

Goal: every skill that has a rank 15 Trial in Dawnmeadow can reach that Trial in Dawnmeadow, and within the pacing bands, and the map pays the XP it says it does.

**How to run this ticket.** One PR per part. Title: `POW-M4-23<letter> <part title>`. Part A first: it is a live bug and changes the save. B to E do not depend on each other and can run in parallel after their decisions are recorded here. Every part that changes a rate must rerun `npx tsx tools/endurance-bot/skills.ts` and `npm run sim-bot`, and paste the before and after rows into its PR.

**Findings this ticket answers.**

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Part |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| E1  | Walking never pays Cartography. `mapSystem` runs after `skillsSystem` in `WORLD_SYSTEMS` (`src/sim/step.ts`, lines 85 to 89), and `tick()` clears events at the start of each tick (`src/sim/kernel/scheduler.ts`), so the `revealed` event is never read. `tests/sim/map.test.ts` calls `mapSystem` then `skillsSystem` by hand, so it passes. Map bot, same 24.5-minute walk: shipped order gives Cartography 0 and 0 XP; map before skills gives 14 points and 8,951 XP. | A    |
| E2  | Dawnmeadow has one `node.fishing_spot` (238, 170), 3-minute respawn, 20 XP per catch. Rank 15 takes about 29 h of play. Every other gathering skill reaches 15 in 0.1 to 2.7 h.                                                                                                                                                                                                                                                                                             | B    |
| E3  | Survival pays 30 XP per in-game night hour outdoors (10 of every 48 real minutes are night), plus 8 per raw food eaten. Rank 15 takes about 10.6 h. The design/10 target for a focused skill is about 27 minutes.                                                                                                                                                                                                                                                           | C    |
| E4  | Iron supply: one surface vein (quarry, 185, 75) on an 8-minute respawn, about 0.2 iron ore a minute. The second vein is in the Rootway. No shop sells iron ore or ingots. Stonecrop Deeps holds one 4-ore chest. 15 smithing recipes need iron ingots at 2 ore each, so an iron sword is about 20 minutes of standing at one vein. Tier 2 mining XP is 0.13 gathers a minute.                                                                                               | D    |
| E5  | Deciphering pays 100 XP once per tablet kind. Dawnmeadow has 7 tablets of 6 kinds, 600 XP in total, so the most anyone can reach is 3 points. Its rank 15 Trial exists and cannot be reached.                                                                                                                                                                                                                                                                               | E    |

---

#### Part A. The map pays Cartography (E1)

Depends: none. Size: S.

Decisions (settled here, do not reopen):

- `mapSystem` moves ahead of `skillsSystem` in `WORLD_SYSTEMS`. Nothing else in the order changes. A comment at the list says why: a system that emits an XP event must run before `skillsSystem`.
- A guard test fails if any system after `skillsSystem` emits an event type that `skillsSystem` reads. This makes the class of bug impossible to reintroduce, not only this case.

**Design Query (owner): existing saves.** Saves made before this fix have fog revealed and no Cartography XP for it.

- Option 1: no backfill. The XP for those blocks is lost.
- Option 2 (recommended): a migration grants 1 Cartography XP per revealed block, per region, through `addXp` (so it banks at 14 with a full bar, pending the Trial). It is recorded in the XP ledger under a `migration` source, so the integrity rules balance. This bumps the save schema version and ships a fixture test.

Scope:

- `src/sim/step.ts`: reorder, plus the comment.
- `tests/sim/map.test.ts`: a new test that drives `stepWorld` (not the systems by hand). It walks an avatar across ground it has not seen and expects Cartography XP equal to the blocks revealed.
- A guard test (for example `tests/sim/systemOrder.test.ts`) that runs a scripted tick and checks that no event `skillsSystem` reads is emitted by a later system.
- If option 2: the save migration, the schema bump, the ledger source, and a fixture test from the previous schema version.

Out of scope: the reveal radius table, XP per block, the Cartography Trial.

Acceptance:

- A `stepWorld` test walks 40 tiles over unseen ground and Cartography XP equals blocks revealed times `MAP_BALANCE.xpPerBlock`.
- The guard test fails if `mapSystem` is moved back after `skillsSystem` (show the red run in the PR).
- `npx tsx tools/endurance-bot/map.ts --cap 60` (shipped order) reports Cartography at least 14, with XP equal to blocks revealed.
- If option 2: a save fixture from the previous schema loads, migrates, and has Cartography XP equal to its revealed blocks, with the seal intact.
- `npm run verify` passes.

---

#### Part B. Fishing that can be trained (E2)

Depends: none. Size: M.

**Decision needed (owner).** The target is Fishing in the slow band with Foraging and Cooking, 35 to 70 minutes to rank 15 (`tools/balance-thresholds.json`, `timeTo15Slow`). The model (`tools/endurance-bot/skills.ts`, real curve and falloff, tier 1) gives minutes to rank 15 by XP per catch and catches per minute:

| XP per catch      | 1 a minute | 2 a minute | 4 a minute |
| ----------------- | ---------- | ---------- | ---------- |
| 20 (now)          | 575        | 288        | 144        |
| 60                | 192        | 96         | 48         |
| 150 (as Foraging) | 77         | **38**     | 19         |

- Option 1 (recommended): Fishing pays as Foraging does (base 150, first time 150), and Dawnmeadow gets 6 to 8 fishing spots on the river, the lake shore, Reedmouth and the coast, on the current 3-minute respawn. That is about 2 catches a minute for a player walking a short stretch of river, so about 40 to 60 minutes to rank 15. It also gives a fishing reason to visit Reedmouth.
- Option 2: more spots only, base stays 20. This needs about 8 catches a minute to reach the band, which means spots on every bank.
- Option 3: fish from any water edge (a new gathering mode). This is a larger change, and better suited to M6 life systems.

Scope (option 1): `src/content/items/recipes.ts` (no change to the node), `src/content/skills/index.ts` (Fishing source base and first-time), `src/content/world/regions/dawnmeadow/spec.ts` (new `at('node.fishing_spot', ...)` placements, each on a water-edge tile a player can stand next to), rebake, and a Fishing policy in `tools/sim-bot/policies.ts` with a `timeTo15Slow` check. The new spots count in the pacing ledger if the ledger counts nodes.

Out of scope: new fish, new fishing mechanics, the Fishing Trial.

Acceptance:

- Every new spot passes the bake validator, stands next to open ground, and is reachable from Hearthford without a portal.
- `npm run sim-bot` has a Fishing loop and its time to rank 15 is inside `timeTo15Slow`.
- `tools/endurance-bot/skills.ts` reports Fishing to rank 15 under 70 minutes on the real map.
- The Fishing Trial (three river fish) is still passable at rank 14.

---

#### Part C. Survival paced like a skill (E3)

Depends: none. Size: S to M.

**Decision needed (owner).** Survival is the one skill whose main source is passive (time at night outdoors). Raising the night pay alone does not fix it. At 120 XP per night hour it is still about 3.6 h to rank 15, because night is only 10 of 48 minutes.

- Option 1 (recommended): add active sources the design already implies (design/03 Hermit Path counts "nights outdoors"). Resting at a campfire or rest spot outdoors (the 8 `rest` fixtures and the camp pot) pays per minute, at any hour. Eating a dish cooked outdoors pays a small amount. Keep night outdoors as the bonus, raised to 60. The target is the slow band, 35 to 70 minutes to rank 15, for a player who camps on purpose.
- Option 2: raise night outdoors to about 150 and eat raw to about 20. This is simple, but Survival stays something that happens to you rather than something you do.
- Option 3: accept a slow Survival and move its Trial out of Dawnmeadow. That contradicts regions/01 section 9.

Scope (option 1): new XP event(s) in `src/sim/kernel/events.ts` and the emitter (`fixtures.ts` for rest spots), the source rows in `src/content/skills/index.ts`, the tunables in `src/content/balance/skills.ts`, tests, and a Survival loop in the sim bot.

Out of scope: new fixtures, weather damage, the Hermit Path.

Acceptance:

- A sim test pays Survival for resting outdoors by day and pays nothing for the same rest indoors.
- The sim-bot Survival loop reaches rank 15 inside `timeTo15Slow`.
- No new source pays while the avatar is dead, in a dungeon room marked indoors, or in town.

---

#### Part D. Enough iron for Dawnmeadow's iron recipes (E4)

Depends: none. Size: S.

**Decision needed (owner).** What iron is meant to feel like in region 1. 15 smithing recipes (pick, axe, swords, spears, shields, helm, cuirass, greaves, band, hammer, maul) need 2 to 4 iron ingots each, at 2 ore an ingot.

- Option 1 (recommended): iron is a region 1 goal, not a region 2 one. Place 4 more iron veins in the quarry and the Stonecrop approach (tier 2, 8-minute respawn), and have Brin's shop sell iron ore at a price above the coin rate of the fight loop, so buying is possible but mining is cheaper. That gives about 1 ore a minute on a short route: an iron sword in 4 to 5 minutes, a full iron set in about 25.
- Option 2: iron is meant to be scarce in region 1. Keep one vein, take the iron recipes that region 1 cannot supply out of `learn: 'start'`, and teach them in Whisperwood. That is honest scarcity, but it shrinks Dawnmeadow's crafting.
- Option 3: leave it. Players camp one vein. Record this as accepted.

Scope (option 1): `src/content/world/regions/dawnmeadow/spec.ts` placements, rebake, the shop stock and price in content and balance, and an endurance-bot rerun. If the shop sells ore, check the ledger rules for bought items (tech/02).

Out of scope: new ores, the iron recipes themselves.

Acceptance:

- `npx tsx tools/endurance-bot/gather.ts` shows tier 2 mining at least 0.8 a minute on surface nodes.
- Every new vein passes the bake validator and is reachable without a portal.
- If ore is sold: buy, smelt, craft and save, then reload. The seal stays intact and the ledger balances.

---

#### Part E. Deciphering can reach its Trial (E5)

Depends: none. Size: S to M.

**Decision needed (owner).** Deciphering pays once per tablet kind and Dawnmeadow holds 6 kinds, so 600 of the 4,378 XP rank 15 needs. Either the region holds more to read, or reading pays differently, or the Trial moves.

- Option 1 (recommended): give it a repeatable source with a natural cap. Every distinct readable pays once (signs with lore-free text, notes, manuals, tablets, the m9 notes). Each tablet pays again, smaller, when re-read with more Deciphering points (it "reads more"). Together that should put rank 15 within reach of a player who reads everything, in about 60 to 90 minutes of reading and travel. Check the counts against the bake before fixing the numbers.
- Option 2: add about 30 tablet kinds to Dawnmeadow. This is content-heavy, and it touches the lore delivery rules (design/08 "Delivery rules" applies, so the planning agent must read it, not the executor).
- Option 3: move the Deciphering rank 15 Trial to region 2 and say so in regions/01 section 9.

Scope (option 1): the source rows in `src/content/skills/index.ts`, the event or subject keys in `skillsSystem` (subject per fixture instance rather than per kind, where that is the decision), tests, and an endurance-bot rerun.

Out of scope: new lore text, which would need its own ticket under the lore delivery rules.

Acceptance:

- A sim test reads every readable on the real map once (a scripted list from the bake) and Deciphering reaches 14 with a full bar.
- No readable pays twice at the same Deciphering band.
- No player-facing string added by this part explains the hidden layer.

---

**Follow-ups noted, not ticketed here**

- F6 (the map is fog-cleared in about 25 sim minutes) and F7 (tier 2 foes make combat skills very fast) are pacing notes for G4 and M5 refinement, not defects.
- Rank 15 to 29 in Dawnmeadow runs at the 10% floor for most skills (about 530 h to the region ceiling in total). That is expected while region 1 only has rank 15 Trials, but someone should confirm it is intended before Whisperwood is planned.
- `tools/endurance-bot/` could become a `npm run endurance` check in `balance:ci` once these parts land. Its rows would then gate the bands the way `sim-bot` does.
