# M3 Core RPG systems

**Result:** the slice area runs on the full rule set. All 36 skills exist and 30 can be raised. Five weapon families plus shields, 29 techniques, two loadouts. Gear with quality, durability and affixes. All seven crafts. Statuses, elements and reactions. Shops with restock and haggling. Trials, Paths, and a request board whose jobs can be solved more than one way.

Refined to READY by POW-M3-01 on 2026-11-17, after Gate G1 passed. Read **Rules for every M3 ticket** before starting any ticket.

## What G1 settled

- **Controls.** Flow is the portrait default. Classic is the default in landscape and on gamepad or keyboard. Flow dodges with the dodge button. Flick dodge was removed during the G1 playtest fixes and stays removed (design/04 updated). No M3 ticket changes movement or dodge feel.
- **Numbers.** The owner's G1 playtest raised no numbers to change. M3 starts from the tunables in `src/content/balance/` as they are on `main`.
- **Content scope.** M3 builds the engines and a proving set of content on the slice map. Rank 15 Trials beyond the eight authored here, and the 20 Hearthford requests, move to M4-12 where Hearthford's people live. Item and recipe data are authored at full tier 1 to 2 count in M3.
- **Late skills.** Six skills are defined in M3 but earn no XP until their system ships (design/11 lists them).

## Order of work

```
02 skills ──┬── 03 Trials
            ├── 09 statuses ──┐
            └── 04 weapons ───┴── 13 techniques
05 items ───┬── 06 gathering ── 07 crafting I ── 14 crafting II (also needs 09)
            └── 10 economy
08 Paths (needs 02, 07, 10, 13, 14) ── 11 requests (needs 03, 08, 10) ── 12 balance harness
```

Two tracks can run in parallel from the start: 02 and 05. Ticket ids keep their draft numbers so references from M4 stay valid. Two L tickets from the draft were split: POW-M3-13 (from 04) and POW-M3-14 (from 07).

## Rules for every M3 ticket

These hold for every ticket below. A ticket's own lines add to them.

1. **Schema bumps.** `main` is at save schema 5 when M3 starts. A ticket that changes saved state bumps `CURRENT_SCHEMA` by one, takes the next free number when it rebases (two M3 branches must never both ship the same number), adds `MIGRATIONS[n - 1]`, and commits `tests/fixtures/saves/schema-<n-1>.json` exported from `main` before its change. `tests/unit/save.test.ts` loads every committed fixture.
2. **Ledger and integrity.** A ticket that creates or removes coin, items or XP adds its ledger entries (`src/sim/ledger.ts`) and its validator rules (`src/save/integrity/`) in the same PR. Each ticket's **Integrity** line says which. `tests/unit/recordedSessions.test.ts` stays at zero flags, and each such ticket adds one recorded session that exercises its new source.
3. **RNG streams.** New randomness uses a named stream. Adding a stream to `STREAM_NAMES` (`src/sim/kernel/rng.ts`) changes saved state: the migration seeds the new stream from the save's `seed` with the same derivation `createStreams` uses.
4. **Events, not polling.** New happenings are new members of `SimEvent` (`src/sim/kernel/events.ts`). Skills, deeds, Trials and requests read events. They never read another system's internals.
5. **Content is data.** New content types get a zod schema and cross-reference checks in the content validation (`npm run validate`). Every player-facing string goes in `src/content/strings/`. No em dashes.
6. **Text rule.** Names up to 24 characters can be pixel text. Descriptions, hints, request text and dialogue are clear text (design/09).
7. **Pending skills.** `PENDING_SKILLS` (added by M3-02) lists the skills with no system yet. Never wire XP to a pending skill. Remove a skill from the list only in the ticket that adds its system.
8. **Modifiers.** Gear affixes, passives, Path gifts and statuses all change numbers through one function, `activeMods` in `src/sim/mods.ts` (added by M3-05). Do not add a second path for bonuses.
9. **Manual versus automated.** Any function that rolls quality, advances a Trial, or counts a deed takes the acting source. Only `manual` can roll Masterwork, advance a Trial, or earn a first-time bonus. M7 adds the `routine` source. M3 tests these rules with a synthetic `routine` call.

---

### POW-M3-01 Refinement: M3 specs to READY

Size: M Depends: Gate G1 Status: DONE when this planning PR merges (design authority)
Refs: all design docs, docs/ops/gate-g1.md

Goal: every M3 ticket is READY.
Scope: this file. New `docs/design/11-skill-table.md` (36 skills, XP sources, band 0 and band 15 grants, the 16 M3 Paths). design/04 updated for the G1 controls decision and the shield Guard button. G1 result recorded in `docs/ops/gate-g1.md`. G2 residual risk recorded in `docs/ops/security-review.md`. Master plan decision log and roadmap updated. M4 drafts updated for the work moved out of M3.
Acceptance: owner approves the docs PR. Every M3 ticket below is READY.

---

### POW-M3-02 Full skill framework

Size: M Depends: M3-01 Status: READY
Refs: design/03-progression, design/11-skill-table, design/10-content-budget (Skills to Master)

Goal: all 36 skills exist, the 30 with a system earn XP from it, and the Skills tab shows all of them.

Scope:

- `src/content/skills/index.ts`: a `SkillDef` for each of the 36 skills, ids `skill.<name>` in lower snake case (`skill.heavy_arms`). Sources as in design/11 for the skills wired by M1 or by this ticket. Skills wired by later M3 tickets get their sources in those tickets.
- `PENDING_SKILLS: readonly string[]` exported from the same file. At the end of this ticket it holds the six late skills plus every skill whose M3 ticket has not merged yet (Heavy Arms, Archery, Unarmed, Shieldcraft, Tide, Gale, Stone, Mending, Hexing, Mining, Logging, Fishing, Smithing, Woodworking, Tailoring, Alchemy, Enchanting, Tinkering, Bartering, Performance, Stealth). Each later ticket removes its own.
- `XpEvent` (`src/content/skills/types.ts`) becomes: `damage | dodge | block | parry | heal | statusApplied | gather | craft | repair | haggle | sale | perform | sneak | sprint | outdoorsNight | eatRaw | tabletRead`. The `practice` table in `src/sim/systems/skills.ts` maps sim events to these. Unused members are fine until their sender exists.
- Cooking moves from `cook` to `craft` with tag `cooking`. The `cooked` sim event stays and maps to `craft:cooking`.
- New XP this ticket wires:
  - **Survival.** `outdoorsNight`: one payment per in-game hour of the night phase spent in a room marked `outdoors: true` (add the flag to `src/content/world/rooms.ts`, true for `room.outdoors`). In-game hour length comes from `src/content/balance/time.ts`. `eatRaw`: eating an item whose `FoodDef` has `raw: true` (new optional field; true for the berries, sunwort and dewmint). Both unscaled.
  - **Deciphering.** `tabletRead`: first-time bonus only, keyed on the tablet fixture's entity kind. Reading a known tablet pays nothing.
- First-time bonus subject, per event: damage keys on the creature kind at the kill, gather on the item, craft on the recipe, tabletRead on the tablet kind, perform on the technique, sneak on the creature kind, haggle on the shop. Other events have no first-time bonus.
- Skills tab (`src/ui/menu/model.ts`, `src/ui/dom/menu.ts`): six family headings in design/03 order, every skill listed in table order. A row shows name, points, mastery name and XP bar. A pending skill shows muted, with the clear-text line `skillPending` ("Not yet practiced anywhere."). Under a skill whose XP is banked, or that is within 1 point of a threshold, show the next-Trial hint: the `hint` string of the Trial for that threshold if one is authored, else `trialUnknown` ("No one here can test this yet."). Trial hint strings arrive in M3-03. Until then every skill shows `trialUnknown`.
- `tools/xp-report.ts` (`npm run xp-report`): drives the sim headless with the existing test bots (`tests/support/bots.ts`) for 30 minutes of sim time each on three loops (fight Mosslings with the sword, forage the herb patch, cook herb tea), and writes `reports/xp-rate.md` with XP per hour and projected time to 15 for Blades, Foraging and Cooking. The target time to 15 is derived, not typed: `4 h * xpTo(15) / xpTo(50)` from `xpToNext`, about 27 minutes on today's curve.

Out of scope: wiring XP for skills whose system is in a later ticket. Tuning base XP (M3-12 does it, with before and after reports).

Save: schema bump. Migration rewrites first-time keys `<skill>:cook:<recipe>` to `<skill>:craft:<recipe>` so no bonus is paid twice.
Integrity: `XP_EXCEEDS_EARNED` already covers new skills. Add consistency rule `SKILL_UNKNOWN`: every key in `skills.points` and `skills.xp` exists in `SKILLS`.

Acceptance:

- A test enumerates `SKILLS`: exactly 36, six families with the counts in design/03, ids unique.
- A test enumerates `SKILLS` minus `PENDING_SKILLS` and, for each, runs a scripted action that pays it XP. Adding a skill without a source or a pending entry fails the test.
- Pool maxima follow skill points for one skill in each family (test).
- The migration test loads `schema-5.json`, and a cooked recipe's first-time bonus is not paid again.
- `reports/xp-rate.md` is committed. Each of the three projected times to 15 is either between 20 and 40 minutes or listed in the PR as a deviation for M3-12.
- Screenshots of the Skills tab at 360 x 800 and 915 x 412, and at text scale 160%.

---

### POW-M3-03 Trials framework and first Trials

Size: L Depends: M3-02 Status: READY
Refs: design/03-progression (Mastery ranks and Trials), design/11-skill-table

Goal: thresholds are gated by authored manual tests with several objective types.

Scope:

- `TrialDef` v2 in `src/content/skills/types.ts`:

```ts
type Quality = 0 | 1 | 2 | 3; // Common, Fine, Superior, Masterwork (defined in M3-05; use a local alias until then)

interface TrialDef {
  id: string; // trial.<skill>.<threshold>
  skill: string;
  threshold: 15 | 30 | 50 | 75 | 100;
  giver: { npc: string } | { fixture: string };
  intro: string; // string key: what the giver says when offering
  hint: string; // string key: Skills tab line, names the giver and a clue
  objective: TrialObjective;
  estMinutes: number; // for the pacing ledger (M4-12)
}

type TrialObjective =
  | {
      kind: 'defeat';
      creature?: string;
      count: number;
      inARow?: boolean;
      only?: { weapon?: string; element?: string };
      untouched?: boolean;
      withinTicks?: number;
    }
  | { kind: 'gather'; item?: string; tag?: string; count: number; phases?: DayPhase[] }
  | {
      kind: 'perform';
      action: 'perfectDodge' | 'parry' | 'technique';
      technique?: string;
      count: number;
      inOneFight?: boolean;
    }
  | { kind: 'craft'; recipe: string; minQuality: Quality }
  | { kind: 'deliver'; item: string; qty: number; minQuality?: Quality; to: string }
  | { kind: 'reach'; room: string; from: string /* fixture kind */; withinTicks: number };
```

- A fight, for `inOneFight` and `untouched`: starts when the avatar deals or takes damage after `pools.lastCombat` was quiet for `hpRegenDelay` ticks, and ends after `hpRegenDelay` quiet ticks. Put the helper in `src/sim/fight.ts`. M3-08 reuses it.
- `src/sim/systems/trials.ts` (runs before `skillsSystem`): advances offered Trials from events. Progress in a new `skills.trial: Record<string, { n: number; t0: number }>`. `inARow` and `untouched` reset `n` to 0 when the avatar takes damage. `reach` starts its clock when the avatar touches the `from` fixture after the Trial is offered. Events from a non-manual source never advance a Trial (rule 9).
- Givers: NPC dialogue gets an `offerTrial` choice where a Trial is authored (the effect exists). A fixture giver offers on interact. `deliver` is turned in by talking to `to`.
- Trial log: a "Trials" section at the top of the Skills tab. Offered Trials show the giver's name, the intro line and `n / count`. Passed Trials show under each skill's row as a small seal glyph with the label "Trial passed" on long press.
- Author six rank 15 Trials on the slice map (strings in `src/content/strings/skills.ts`). Smithing and Cooking rank 15 Trials are authored in M3-07.

| Trial                | Giver          | Objective                                                              |
| -------------------- | -------------- | ---------------------------------------------------------------------- |
| `trial.blades.15`    | Orla (guard)   | Defeat 3 Mosslings in a row, without taking damage, with a blade       |
| `trial.polearms.15`  | Orla           | Defeat 2 Bramble Boars with polearm hits only                          |
| `trial.evasion.15`   | Orla           | 5 perfect dodges in one fight                                          |
| `trial.ember.15`     | Wren (scholar) | Defeat 3 Spitblooms with Ember damage only                             |
| `trial.athletics.15` | the Pilgrim    | Reach the cave mouth from the square Waystone within 40 seconds        |
| `trial.foraging.15`  | Hesper (cook)  | Gather sunwort at dawn or dusk (the M1 Trial, moved to the new format) |

Out of scope: Trials for other skills and ranks (M3-07 adds two, M4-12 adds the rest of rank 15 and rank 30).

Save: schema bump. Migration: an offered `trial.foraging.15` gets `{ n: 0, t0: 0 }`.
Integrity: consistency rule `TRIAL_PROGRESS_ORPHAN`: progress exists only for offered, unpassed Trials, and `n` is at most the objective count.

Acceptance:

- Banking and release are tested at every threshold (15, 30, 50, 75, 100) with test Trials.
- A test enumerates `TRIALS` and requires a scripted run for each id. A Trial with no script fails the test.
- Each objective kind has a unit test, including the resets for `inARow` and `untouched`, and the `reach` clock.
- A `defeat` progress event marked as a routine source does not advance a Trial (test). The real Routine path test is a follow-up for M7.
- Screenshot of the Trials section with one offered and one passed Trial.

---

### POW-M3-04 Weapon families and Shieldcraft

Size: L Depends: M3-02 Status: READY
Refs: design/04-combat (Weapons, Stagger), design/11-skill-table (Arms)

Goal: all five weapon families and the shield feel distinct, and kill at par in about the same time.

Scope:

- `Family` in `src/content/combat/attacks.ts` gains `heavy` and `archery` (`unarmed` exists in the type). Basic attacks and Classic three-hit combos for Heavy Arms, Archery and Unarmed in the same file. Flow automatic attack works for all five. Archery's reach is its range.
- Built-in properties, each a rule in `src/sim/combat/` with its numbers in `src/content/balance/combat.ts`:
  - Blades: bonus damage when hitting from behind (the attacker is more than 120 degrees from the target's aim vector) and on staggered targets.
  - Heavy Arms: stagger multiplier on hit, and hits on a target that is blocking count as guard breaks (the target's block drops).
  - Polearms: reach two tiles deep and a knockback that keeps the target out of its own melee reach.
  - Archery: arrows are projectiles. Damage rises with ticks stood still before the shot, to a cap. No ammo.
  - Unarmed: every hit refunds Stamina.
- **Shieldcraft.** With a shield in the off hand, a Guard button appears next to dodge in both schemes (`src/platform/input/layout.ts`), with left-handed mirror. Holding Guard blocks: walk speed drops to the balance value, hits from the front 120 degrees deal reduced damage and cost Stamina per hit. A block begun within `parryWindow` ticks before an impact parries: no damage, and the attacker takes parry stagger. Flow allows hold or toggle through the existing hold-versus-toggle setting (design/09), so a Flow player never needs two touches to move while guarding. New events `blocked` and `parried`. Shieldcraft XP from both.
- One tier 1 weapon item per new family in `src/content/items/`: `item.maul_oak` (heavy), `item.bow_short` (archery), `item.wraps_cloth` (unarmed). `item.shield_wood` exists. Add all four to Brin's stock. Doll layers for the maul, the bow and the wraps in `src/content/sprites/gen/dolls.ts` and `src/content/dolls/parts.ts`.
- XP: tags `heavy`, `archery`, `unarmed` on `damage`. Remove Heavy Arms, Archery, Unarmed and Shieldcraft from `PENDING_SKILLS`.

Out of scope: techniques for the new families (M3-13). Item quality and durability (M3-05).

Save: no schema change unless the fighter component gains a field. If it does (a block state, for example), bump and migrate with defaults.
Integrity: none (no new value source).

Acceptance:

- One scenario test per family proves its property: blades behind and staggered bonus, heavy guard break, polearm two-tile reach and push, archery charge by standing still, unarmed Stamina refund.
- Block reduces frontal damage and not rear damage. A block begun inside the window parries and staggers the attacker. One test each.
- Time-to-kill test: each family's tier 1 weapon, skill 0, basic attacks only, against a tier 1 Mossling, takes a number of ticks within 15% of the others. Numbers written in the PR.
- Phone screenshots of each new weapon on the doll, and of the Guard button in Flow and Classic, with and without the mirror.

---

### POW-M3-05 Items, equipment, quality, durability

Size: L Depends: M3-01 Status: READY
Refs: design/05-life-systems (Crafting), design/04-combat (Death), docs/tech/03-asset-pipeline

Goal: the full item model and the tier 1 to 2 item set.

Scope:

- Item instances. `ItemStack` (`src/sim/state.ts`) becomes:

```ts
type Quality = 0 | 1 | 2 | 3; // Common, Fine, Superior, Masterwork. Export from src/content/items/types.ts
interface ItemStack {
  item: string;
  qty: number;
  q?: Quality; // absent means Common
  dur?: number; // gear and tools only
  mark?: 1; // crafted by this avatar: shows the avatar's handle
  affixes?: string[]; // at most the item's affixSlots
}
```

Two stacks merge only if every field except `qty` is equal. `Inventory.equipment` becomes `Record<EquipSlot, ItemStack | null>`.

- `ItemDef` gains: `quality?: true` (this item can carry quality), `durability?: number` (max), `affixSlots?: 0 | 1 | 2`, `tool?: { kind: 'pick' | 'axe' | 'sickle' | 'rod' | 'hammer' | 'needle'; tier: number }`, and `bag: 'gear' | 'tools' | 'food' | 'materials' | 'other'` for the filters.
- Affixes: `src/content/items/affixes.ts`, `AffixDef { id, nameKey, slots: EquipSlot[], tier, mods: Mod[] }`. Author six tier 1 affixes (power, defense, Stamina max, Focus max, crit chance, gather yield). Enchanting applies them in M3-14.
- Modifiers: `src/sim/mods.ts` with `Mod { stat: ModStat; add?: number; pct?: number }` and `activeMods(state, who): Mod[]`. M3-05 feeds it from equipped affixes. Later tickets add passives, Path gifts and statuses. `ModStat` starts with `power`, `defense`, `hpMax`, `staMax`, `focMax`, `critPct`, `gatherYield` and grows by ticket.
- Stats: `gearStats(def, stack)` in `src/sim/items.ts`. Power and defense are base times `qualityPct[q]`, times `brokenPct` at 0 durability, plus affix mods. Start values in `src/content/balance/items.ts`: `qualityPct: [100, 110, 120, 135]`, `brokenPct: 50`.
- Durability: weapons lose 1 per `wear.weaponHits` hits landed, armor 1 per `wear.armorHits` hits taken, tools 1 per `wear.toolUses` gathers, and every equipped item loses `wear.deathPct` of its max on death (design/04). At 0 the item is broken: half stats, a cracked glyph on its icon. It is never destroyed. Start values: 50, 50, 25, 10.
- Item set: about 120 tier 1 and tier 2 items as data in `src/content/items/` split by kind (`weapons.ts`, `armor.ts`, `tools.ts`, `materials.ts`, `food.ts`, `potions.ts`, `misc.ts`). The 33 existing items keep their ids. Target counts: weapons 22 (five families plus orb, two tiers, two variants where it reads), shields 4, armor 18 (cloth, leather, mail, for head, body and legs, at two tiers), accessories 6, tools 10 (pick, axe, sickle, rod and hammer at two tiers), materials 36 (ores, ingots, logs, planks, fibers, cloth, hides, leather, herbs, reagents, essences), food 14 (the 8 existing plus 6), potions 8, misc 4 (one is `item.flute_reed`, a tier 1 instrument for the off hand). Every icon is generated (`src/content/sprites/gen/items.ts`). Items with no source yet are fine. M3-12 checks reachability.
- Bag tab: filter chips (All, Gear, Tools, Food, Materials, Other) and sort (type, tier, value, newest). Quality shown by a corner glyph (design/09: never by color alone) and named in the long-press detail with durability and maker's mark.
- Storage chest: `fixture.storage` next to the square Waystone. 40 slots held in a new `storage` component on the avatar. A DOM panel moves stacks between bag and chest.

Out of scope: crafting quality rolls (M3-07). Applying affixes (M3-14). Repair (M3-07 self-repair, M3-10 service).

Save: schema bump. Migration turns every string in `equipment` into `{ item, qty: 1 }` with `dur` at max for gear, and adds an empty `storage`.
Integrity: held counts include storage. Consistency rules: `DUR_RANGE` (0 to max), `QUALITY_ON_PLAIN` (only `quality` items carry `q`), `AFFIX_OVERFLOW` (affixes at most `affixSlots`, every id known), `STACK_RULES` (gear qty is 1). Ledger: add `masterworks: Tally` and `marked: Tally` (filled by M3-07). Rule `MARK_WITHOUT_CRAFT`: marked items held at most `ledger.marked[item]`.

Acceptance:

- The migration test loads the previous schema fixture with equipped gear and a full bag. Nothing is lost.
- Stat tests across tier, quality, broken and two affixes.
- Merge rules tested (same item, different quality, does not merge).
- `baked/contact-items.png` contact sheet of every item icon, committed and attached to the PR.
- Screenshots of the Bag tab filtered and sorted, a long-press detail, and the storage panel.

---

### POW-M3-06 Gathering: nodes, tools, variants

Size: M Depends: M3-05 Status: READY
Refs: design/05-life-systems (Gathering), design/02-world (Time, seasons, weather)

Goal: Mining, Logging, Foraging and a placeholder Fishing work with tools, timing, respawn and conditions.

Scope:

- `NodeDef` v2 (`src/content/items/types.ts`): `{ id, tag, tier, tool?: ToolKind, yields: { item, weight, phases?: DayPhase[], seasons?: Season[], weather?: Weather[] }[], respawn, sweep?: Partial<SweepDef>, sprite }`. `respawn` is in world ticks.
- Tool rule (`src/sim/systems/items.ts`): no tool or a lower tier than the node means the sweep runs `toolSlowPct` slower and yields 1 less, never below 1. At node tier it is normal. Each tier above widens the sweet window by 1 tick. The best tool of the right kind in the bag is used, without equipping it.
- Gathered materials can carry quality: a sweet hit rolls Fine with a chance that rises with skill points (`gather.finePctPerPoint`). Uses the `loot` stream.
- Timing per skill: Foraging keeps the M1 sweep. Mining uses one sweep with a narrower window and a larger bonus. Logging takes three sweeps per tree, and each sweet hit adds yield. Fishing placeholder: cast with the context button, wait for a bite after 2 to 6 seconds (`world` stream), then tap within 15 ticks for a better catch. A miss still lands the common catch (never a fail state). The M6-05 minigame replaces it.
- `GatherNode.readyAt` is measured in `state.worldTick` so respawn continues while the game is closed.
- Variants hook: `yieldsFor(node, state)` filters yields by day phase, season (`src/sim/time.ts`) and `currentWeather(state)`, a new function that returns `'clear'` until M4-09 replaces it.
- Slice placements (`src/content/world/slice-map.ts`): copper veins (tier 1) in cave rooms A to C, one iron vein (tier 2) in room E, four oak trees (tier 1) and one ash tree (tier 2) in the meadow, one fishing spot on a water tile next to the square (add a small pond if the outdoor map has no water there). New materials come from M3-05's item set.
- Remove Mining, Logging and Fishing from `PENDING_SKILLS`. Ledger source `gather` covers all of them.

Out of scope: the fishing minigame (M6-05). Weather itself (M4-09).

Save: schema bump. Migration sets every node's `readyAt` to 0 (ready). One free respawn on upgrade is harmless.
Integrity: plausibility rule `GATHER_RATE`: items from `gather` at most `playSeconds` times the fastest possible gather rate, derived from the shortest sweep and the largest yield in content. Comment the derivation.

Acceptance:

- Yield and quality tests with tool tier below, at, and above the node tier.
- Respawn test: a node worked, the save exported and reloaded with the world clock moved past `respawn`, is ready on load.
- Variant test: a yield restricted to dusk appears only at dusk.
- Phone screenshots of each node type, ready and spent, and of the fishing placeholder.

---

### POW-M3-07 Crafting I: stations, quality, experiment, Smithing, Woodworking, Cooking

Size: L Depends: M3-05, M3-06 Status: READY
Refs: design/05-life-systems (Crafting, Cooking)

Goal: one crafting engine, proven on three crafts and two step kinds.

Scope:

- `StationDef` (`src/content/items/stations.ts`): `{ kind, craft, step: 'timing' | 'rhythm' | 'trace' | 'hold' }`. Fixtures `fixture.anvil` (Smithing, timing) and `fixture.workbench` (Woodworking, timing) in the square. The camp pot becomes `{ craft: 'cooking', step: 'rhythm' }`.
- `RecipeDef` v2: `{ id, craft, tier, station, ingredients: { item, qty }[], result, qty, learn: 'start' | 'teach' | 'buy' | 'find' | 'experiment' }`. Existing recipes move over with qty 1.
- Experiment flow, generalized from cooking: at a station, pick up to 4 bag stacks in a DOM panel and confirm. A known recipe crafts. An unknown recipe of this station's craft is discovered once (`recipeDiscovered`) and crafts. No match gives the craft's fail item (`item.burnt_mess` for cooking, `item.slag` and `item.wood_scraps` for the others) and consumes the ingredients, as cooking does today.
- Manual step. The sim grades the step from the ticks of `craftStep` commands, so the client cannot invent a grade. Timing: three strikes on a sweep, each perfect, good or miss. Rhythm: four beats at a fixed tempo, each tap perfect, good or miss by its distance from the beat. Grade = the sum, scaled to 0 to 30. Overlay drawn by `src/render/craftStep.ts`. Input is one tap anywhere in the lower zone. Windows in `src/content/balance/crafting.ts`.
- Quality roll (`rollQuality` in `src/sim/crafting.ts`, new `craft` stream): `score = clamp(skillPts - parRank[tier], -15, 15) * 2 + materialAvg * 10 + grade + roll(0..39)`. `materialAvg` is the mean quality of the ingredients that carry quality. Thresholds: 90 or more Masterwork (manual source only, otherwise Superior), 65 Superior, 40 Fine, else Common. All of these numbers live in `crafting.ts` balance as starting values.
- Maker's mark: crafted gear and tools get `mark: 1`.
- Self-repair at the anvil: costs one material of the item's tier, restores `repairPct` of max durability, and pays Smithing on `repair`.
- Recipes: 42 in this ticket. Smithing 16 (ingots, tier 1 and 2 weapons and mail, tools), Woodworking 12 (planks, bows, staves, shields, handles), Cooking 14 (the 4 existing plus 10). A set of 8 is `learn: 'start'`. The rest come from experimenting or from dialogue `learnRecipe`.
- Trials: `trial.smithing.15` (Brin: craft an iron sword at Fine or better) and `trial.cooking.15` (Hesper: deliver a Hearty Stew at Fine or better).
- Remove Smithing and Woodworking from `PENDING_SKILLS`.

Out of scope: trace and hold steps, Tailoring, Alchemy, Enchanting, Tinkering (M3-14). Buying recipes (M3-10).

Save: schema bump (new `craft` stream, recipe shape).
Integrity: ledger source `craft` for all crafted items (keep `cook` readable for old saves). `ledger.masterworks` and `ledger.marked` filled here. Rules: `MASTERWORK_WITHOUT_CRAFT` (Masterwork held at most `ledger.masterworks[item]`), crafted counts at most `ledger.crafts` times the recipe's qty.

Acceptance:

- Quality distribution test: 10,000 seeded rolls each at three skill levels and three material qualities. The share of each tier is written in the PR and moves the right way as each input rises.
- A `routine` source never rolls Masterwork, across 10,000 rolls (test).
- Experimenting with a valid unknown combination discovers the recipe once. The second time it just crafts (test).
- Both Trials complete in scripted runs.
- The timing and rhythm steps are one-handed. Input tests feed tap ticks and check the grade. Phone screenshots of each step in Flow portrait and Classic landscape.

---

### POW-M3-08 Paths and deeds

Size: L Depends: M3-02, M3-07, M3-10, M3-13, M3-14 Status: READY
Refs: design/03-progression (Paths), design/11-skill-table (Paths authored in M3)

Goal: the world recognizes what the player has become.

Scope:

- Deeds (`src/content/paths/deeds.ts`): `DeedDef { id, kind: 'count' | 'sum' | 'distinct' | 'countSinceReset', on: EventMatcher, field?: string, reset?: EventMatcher }`. `EventMatcher` names a `SimEvent` type and optional field values. `src/sim/systems/deeds.ts` counts deeds from events into a new `deeds` component: `{ counts: Record<string, number>; distinct: Record<string, string[]>; resetAt: Record<string, number> }`. Manual source only (rule 9). The fight helper from M3-03 provides "fights won untouched".
- Paths (`src/content/paths/index.ts`): `PathDef { id, nameKey, titleKey, addressKey, hidden, requires: { skills?: Record<string, number>; deeds?: Record<string, number>; daysSinceReset?: Record<string, number> }, gift: Mod[], opposite: string, hintKey?: string }`. The 16 Paths and their numbers from design/11 (numbers in `src/content/balance/paths.ts`). Validator: every Path has an opposite that points back, and titles are at most 16 characters.
- Earning: checked when a deed or skill point changes. Emits `pathEarned`. Banner (pixel title, clear-text gift line) and a chime from the existing audio sfx data.
- Paths state in a new `paths` component: `{ earned: string[]; worn: string[]; shown: string | null }`. At most three worn. `shown` picks the title over the avatar.
- The Rest panel on `fixture.bed` (placed by M3-09): sleep (M3-09), wear and unwear Paths, and choose the shown title.
- Gifts are mods from worn Paths only, through `activeMods`. Mod stats added here: `blockStaPct`, `fedTicksPct`, `rawFoodPct`, `buyPct`, `purseRegenPct`, `songTicksPct`, `hideSpeedPct`, `wetTicksPct`, `emberFocPct`, `durabilityLossPct`, `repairMaterialFree`, `noAggroCreature`, `tierDamagePct`, `dodgeRecoverTicks`.
- Title over the avatar: pixel text above the name (`src/render/`). It follows the text rule's 2 mm check.
- Dialogue address: strings may contain `{address}`, filled with the shown Path's address form, else the handle. New conditions `{ pathWorn: id }` and `{ pathEarned: id }`.
- Character tab "Paths" section: earned Paths with gift text, worn ones marked. An unearned standard Path appears only once one of its requirements is met, as its hint line with no numbers. Hidden Paths appear only when earned.

Save: schema bump (`deeds` and `paths` components, empty for old saves).
Integrity: consistency rule `PATH_UNEARNED`: every earned Path's requirements hold against the saved points and deeds. `WORN_NOT_EARNED`, and worn at most 3. Plausibility: deed counts that mirror the ledger (kills, crafts, gathers) never exceed their ledger totals.

Acceptance:

- Each of the 16 Paths is earned in a scripted run (test per Path).
- Gifts apply only while worn (test per mod stat).
- A dialogue line with `{address}` uses the shown title (test and screenshot).
- A hidden Path never appears in the UI model before it is earned (test).
- Screenshots of the banner, the Rest panel and the Paths section.

---

### POW-M3-09 Statuses, elements, reactions

Size: L Depends: M3-02 Status: READY
Refs: design/04-combat (Magic, Reactions, Statuses), design/02-world (Dungeons, element puzzles)

Goal: one status system for every unit, a reaction table as data, and element rules for the world.

Scope:

- `src/content/combat/statuses.ts`: the 11 statuses from design/04 (`burning`, `wet`, `chilled`, `staggered`, `poisoned`, `hexed`, `rooted`, `dazed`, `warded`, `fed`, `rested`). `StatusDef { id, iconKey, ticks, stacks: 'refresh' | 'none', mods?: Mod[], tickEffect?: { every, damage?, heal? }, rule: string /* string key, one sentence for Help */ }`. Each has one icon with a distinct shape (design/09: never color alone).
- `statuses` component on any fighter: `{ id, until, src }[]`. `applyStatus` and `clearStatus` in `src/sim/statuses.ts`. The same rules for the avatar and for creatures. Hexed extends the duration of statuses applied later by `hexedExtendPct`. At most four shown per unit, chosen by a fixed priority list.
- Reactions (`src/content/combat/reactions.ts`), checked when a status or element meets another: wet + ember gives steam (removes wet, a small area that blocks sight and deals light damage), wet + gale gives chilled, chilled + stone gives shatter (burst damage, removes chilled), burning + gale spreads burning to units in a radius. Data rows `{ a, b, result, removes, area?, damage? }`.
- Elements on attacks: `AttackDef.projectile.element` exists. Melee attacks may carry `element` too. A hit carrying an element applies its paired status from the table `ELEMENT_STATUS` (ember to burning, tide to wet, and so on) when the technique data says so (M3-13 sets it per technique).
- World elements: tileset flags `flammable`, `water`, `frozen` (`src/content/world/tileset.ts`). An ember hit on a flammable tile burns it to ash for `brushRegrowTicks` world ticks. Fixture element rules in `src/content/world/fixtures.ts`: `onElement: { ember?: Action; tide?: Action; ... }` with actions `open`, `close`, `toggle`, `reveal`, `grow`, `raise`. Slice set pieces for each school: a brush wall (ember burns it), a fire (tide douses it), a windmill gate (gale spins it open), a gap where a stone hit raises a step, a withered vine (mending grows it into a ladder), a hidden niche (hex reveals it). Place them in the slice outdoors and caves where no current route depends on them.
- Food: the `fed` component moves onto `fed` status, keeping one Fed at a time and pool maxima through mods.
- `fixture.bed`: a bedroll next to the square Waystone. Sleeping on it applies `rested`: skill XP +`restedXpPct` for `restedTicks`. M3-08 adds the Rest panel to the same fixture.
- XP: `statusApplied` events. Hexing pays on `statusApplied:hexed`.

Out of scope: spells for Tide, Gale, Stone, Mending and Hexing (M3-13). Tests register test-only attacks for each element.

Save: schema bump. Migration converts an active `fed` component into a `fed` status with the same `until`.
Integrity: none (no new value source). Consistency rule `STATUS_UNKNOWN`.

Acceptance:

- A test per reaction, on a creature and on the avatar.
- A test per world interaction set piece.
- Statuses on the avatar follow the same rules as on creatures (one parameterized test across all 11).
- Fed and Rested behave as before through the status system (existing food tests still pass).
- Screenshot of a unit with four statuses, and of each set piece before and after.

---

### POW-M3-10 Economy: coin, shops, bartering

Size: M Depends: M3-05 Status: READY
Refs: design/05-life-systems (Economy)

Goal: stable NPC trade with a skill behind it.

Scope:

- `ShopDef` v2 (`src/content/dialogue/types.ts`): `{ id, npc, region, stock: { item, max }[], buys: ItemDef['bag'][], purse, firmness }`. Restock to `max` at each in-game dawn, measured by `worldTick` day index, so it happens while the game is closed. Stock state in the `npc` component.
- Prices (`src/sim/economy.ts`, pure): buy = `value * buyPct * regionPct * qualityPct[q]`, sell = `value * sellPct * regionPct * qualityPct[q]`, rounded the way today's `buyPrice` does. `regionPct` table in `src/content/balance/shop.ts`, `dawnmeadow: 100` for now.
- Haggling: a Haggle choice in the shop panel for one item at a time. Up to `haggleRounds` exchanges (one more with Bartering's Read the Room). Each round the player picks Offer low, Offer fair or Accept. The shopkeeper accepts or counters. The chance to accept comes from Bartering points against `firmness` (new `trade` stream). The price moves at most `haggleMaxPct` from the opening price in the player's favor. A lost haggle keeps the opening price, and that shopkeeper will not haggle on that item again until dawn. Bartering pays on `haggle` (won) and `sale`. Strings are short NPC lines in clear text.
- Bound: for every item and quality, the lowest reachable buy price (all haggle, Haggler Path and quality effects) is above the highest reachable sell price. `shop.ts` gets an asserting comment and the test below.
- Buyback: the last 10 items sold to a shop can be bought back at the price paid for them until that shop's next restock.
- Repair service: Brin repairs gear in the bag or equipped. Cost = `value * (1 - dur / max) * repairPct`.
- Recipes for sale: recipe scrolls (`misc` items with `teaches: recipeId`) in Brin's stock. Reading one learns the recipe.
- Remove Bartering from `PENDING_SKILLS`.

Save: schema bump (`trade` stream, stock and buyback state).
Integrity: ledger sinks `repair`, `buyback`, `recipe`. New `ledger.itemsSold: Tally`. Item source `buyback`, with rule `BUYBACK_EXCEEDS_SOLD`. Plausibility rule `SALE_RATE`: lifetime sale coin at most the reachable ceiling for the play time (comment the derivation).

Acceptance:

- Property test over every item, quality and haggle outcome: no buy-below-sell loop exists.
- Restock test across a save and reload with the world clock moved past dawn.
- Haggle determinism: the same seed and choices give the same price (test).
- Screenshots of a haggle exchange, buyback and repair.

---

### POW-M3-11 Requests engine, board, dialogue v2

Size: L Depends: M3-03, M3-08, M3-10 Status: READY
Refs: design/05-life-systems (Requests), design/01-experience (No main quest), design/02-world (Secrets and discovery), design/03-progression (Renown)

Goal: a board posts jobs, and jobs accept more than one solution.

Scope:

- `RequestDef` v2 (`src/content/requests/`, moved out of dialogue):

```ts
interface RequestDef {
  id: string;
  giver: { npc: string } | { board: string };
  kind: 'authored' | 'standing';
  titleKey: string; // pixel-length title, at most 24 characters
  askKey: string; // the asker's own words, shown in the log
  solutions: { id: string; labelKey: string; steps: RequestObjective[] }[]; // any one completes
  reward: {
    coin: number;
    items: { item: string; qty: number }[];
    techniques?: string[];
    renown: number;
  };
  requires?: Cond[];
  repeat?: { cooldownDays: number };
  estMinutes: number;
}
type RequestObjective =
  | TrialObjective
  | { kind: 'talk'; npc: string }
  | { kind: 'flag'; flag: string };
```

Steps inside a solution run in order. The engine (`src/sim/systems/requests.ts`, replacing the request part of `npcs.ts`) reuses the Trial objective trackers from M3-03.

- Standing generator (`src/sim/requestGen.ts`, new `requests` stream): templates in `src/content/requests/templates.ts` (gather, deliver, defeat) with item and creature pools by tier, quantity ranges and a reward formula from balance. Inputs: shop stock that ran out (the shopkeeper asks for it), node kinds and spawner kinds present in the region. Posts 3 at each board at dawn.
- Board: `fixture.board` in the square. DOM panel of posted requests in clear text. Take one.
- Request log: a "Requests" section in the Character tab. Each request shows its asker's words and, per solution, which steps are done in plain words. No target positions. One request can be pinned. The pinned one shows on the HUD as a single line of the asker's words (design/09).
- Dialogue v2 conditions: `{ renown: { region, atLeast } }`, `{ phase: DayPhase[] }`, `{ season: Season[] }`, `{ weather: Weather[] }` (reads `currentWeather`). Effects: `{ renown: number }`, `{ takeItem: string; qty: number }`.
- Renown: `journal.renown: Record<string, number>`. Raised by request rewards, Trials passed (`renownPerTrial`), and trade (every `renownTradeCoin` coin of sales in a region gives 1).
- Author 6 requests on the slice map. The M1 request moves to the new format.

| Request                    | Giver   | Solutions                                                                                            |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| Pests in the meadow (M1)   | Orla    | Defeat 4 Mosslings                                                                                   |
| Oil for the old lamps      | Wren    | Deliver 2 lantern oil                                                                                |
| The boar by the cave       | Orla    | Defeat the Bramble Boar at the cave mouth, or Hide past it and fetch the dropped satchel from room A |
| Supper for the watch       | Hesper  | Deliver 3 Hearty Stews, or deliver 5 Herbed Skewers                                                  |
| Metal for the anvil        | Brin    | Deliver 6 copper ore, or deliver 2 copper ingots                                                     |
| Something in the deep room | Pilgrim | Defeat 3 Spitblooms in the caves, or finish Hum of Courage at the cave shrine                        |

Out of scope: rumor marks (moved to M4-06). The 20 Hearthford requests (moved to M4-12).

Save: schema bump. Migration moves `journal.requests` entries to the v2 shape with `solution: null` and step progress, keeping state and progress of the M1 request.
Integrity: coin source `request` exists. Add item source `request` checks against the reward table, rule `REQUEST_REWARD_UNMATCHED` (items from `request` at most the rewards of requests in state `done`, plus standing request rewards counted in a new `ledger.requestRewards`). Renown bounds: consistency rule `RENOWN_RANGE`.

Acceptance:

- Each authored request completes by each of its solutions in a scripted run (test per solution).
- No objective arrow or auto-path: the request API exposed to `ui/` and `render/` returns text only. A test asserts no positions leave it, and a lint rule or grep test asserts `render/` does not import the request engine.
- Generator property test over 1,000 seeds and generated region states: every posted request is satisfiable (its items have a source in the region, its creatures spawn there, its quantities are inside the caps).
- Screenshots of the board, the log, and the pinned line on the HUD.

---

### POW-M3-12 Balance harness

Size: L Depends: M3-11, M3-13, M3-14 Status: READY
Refs: tech/04-quality (Balance workflow), design/10-content-budget (Verification), design/04-combat (Damage model)

Goal: numbers are checked by machines.

Scope:

- `tools/fight-sim/` (`npm run fight-sim`): runs data-defined fights headless (build, creature, count) using the real sim, and reports time-to-kill, damage taken and resources used by tier and build. Builds are data in `tools/fight-sim/builds.ts` (one per weapon family plus three magic builds, each at the par rank for tiers 1 and 2).
- `tools/sim-bot/` (`npm run sim-bot`) v1 policies: gather loop, fight loop, craft loop, request loop. Reports XP per hour per skill, coin per hour per activity, and writes the save summary sequence. Every summary goes through the integrity validator.
- Reports as markdown in `reports/` (`fight-sim.md`, `sim-bot.md`), committed.
- Content reachability check in `npm run validate`: every tier 1 and 2 item has at least one source (drop, node, recipe, shop, chest, request or Trial reward), or is listed in an allowlist with a reason.
- CI job (`.github/workflows/`) runs a short version of both tools (fewer seeds, shorter runs) and fails past thresholds in `tools/balance-thresholds.json`.
- Tuning: adjust `src/content/balance/` so the targets below hold, with before and after numbers in the PR (tech/04: balance changes are shown as before and after).

Acceptance:

- Reports generated for tiers 1 and 2.
- Time-to-kill for common enemies at par is 4 to 8 seconds (design/04), or each deviation is listed with a reason.
- Time to 15 for Blades, Foraging and Cooking is within the M3-02 band.
- Bot summaries pass the integrity validator with zero flags.
- The reachability check passes.

---

### POW-M3-13 Techniques and loadouts

Size: L Depends: M3-04, M3-09 Status: READY
Refs: design/03-progression (Techniques), design/04-combat, design/11-skill-table

Goal: any technique from any skill can be slotted, and two loadouts swap.

Scope:

- `src/content/combat/techniques.ts`, separate from attacks:

```ts
interface TechniqueDef {
  id: string; // technique.<skill>_<name>
  skill: string;
  band: 0 | 15 | 30 | 50 | 75 | 100;
  nameKey: string;
  descKey: string;
  icon: string;
  kind: 'active' | 'passive';
  taught?: true; // also needs a learnTechnique effect, not only the rank
  cost?: { pool: 'sta' | 'foc'; amount: number };
  cooldown?: number;
  aim?: 'none' | 'cone' | 'line' | 'circle' | 'target' | 'self';
  attack?: string; // AttackDef id with the hit data
  requires?: { main?: Family; off?: 'shield' | 'instrument' | 'orb'; outOfCombat?: true };
  effects?: TechniqueEffect[]; // applyStatus, heal, pull, spawnFixture, selfMods
  passive?: Mod[];
  channel?: number; // ticks, for songs
}
```

The three existing techniques move here. Their cost and cooldown leave `AttackDef`.

- Author every band 0 and band 15 entry in design/11 for Arms, Magic, Stealth and Performance (29 actives, plus passives that have an effect). Magic band 0 spells are `taught` by Wren (one dialogue choice per school, as Ember Bolt is today).
- Known techniques: skill points at or above `band`, and the `taught` flag if set. Passives apply through `activeMods`.
- Stealth: Hide (out of combat, halves creature notice radius in `src/sim/systems/ai.ts`, 60% speed), and `sneak` events when a creature that would have noticed the avatar does not. Ambush crits on the first hit from Hide.
- Performance: songs channel for `channel` ticks and can be cancelled by moving. Hum of Courage applies a Stamina regen mod for its duration. Lullaby needs an instrument (`item.flute_reed` from M3-05) and dazes tier 2 or lower creatures in range. `perform` event on finish.
- Earth Wall: `spawnFixture` places a temporary solid fixture for its duration.
- Slots: slot 1 follows the main-hand family's band 0 technique (today's rule). Slots 2 to 4 hold anything known.
- Loadouts: a `loadouts` component, `{ active: 0 | 1; sets: [Loadout, Loadout] }`, `Loadout { main: number | null; off: number | null; slots: (string | null)[] }`, where main and off are bag slot indexes captured at save time and checked on swap. One tap on a HUD swap button. Out of combat the swap is instant. In combat (the fight helper from M3-03) it applies, and then all technique slots and the basic attack lock for `loadoutLockTicks`.
- Assigning: the Skills tab lists each skill's techniques. Tap a known active to assign it to slot 2, 3 or 4 of the active loadout.
- Remove Tide, Gale, Stone, Mending, Hexing, Performance and Stealth from `PENDING_SKILLS`.

Save: schema bump (`loadouts` component, technique ids unchanged). Migration copies the current slots into loadout 0 and leaves loadout 1 empty.
Integrity: consistency rule `TECHNIQUE_UNKNOWN`: every slotted technique is known by the rule above.

Acceptance:

- Each weapon family's two techniques meet their description in a scenario test (reach, cadence, property).
- A mixed loadout (a Tide spell, a Blades technique, Hum of Courage, Hide) works in one scripted run.
- Each technique that lists a status applies it (test per technique).
- Loadout swap: instant out of combat, locked for `loadoutLockTicks` in combat (test).
- Time-to-kill per family with techniques in use stays within 15% of each other at par (extends the M3-04 test).
- Phone screenshots of the technique list, a full loadout on the HUD in Flow and Classic, and the swap button.

---

### POW-M3-14 Crafting II: Tailoring, Alchemy, Enchanting, Tinkering

Size: L Depends: M3-07, M3-09 Status: READY
Refs: design/05-life-systems (Crafting), design/11-skill-table (Crafting)

Goal: all seven crafts are playable through tier 2.

Scope:

- Step kinds `trace` (drag along a drawn path; the sim grades by the share of sampled points inside the path width) and `hold` (hold to raise heat, release inside a band; graded by distance from the band center). Same rules as M3-07: one thumb, the sim grades, overlays in `src/render/craftStep.ts`.
- Stations in the square: `fixture.loom` (Tailoring, trace), `fixture.alchemy_table` (Alchemy, hold), `fixture.rune_stone` (Enchanting, trace), `fixture.tinker_bench` (Tinkering, timing).
- Recipes: 38. Tailoring 12 (cloth and leather head, body and legs at two tiers), Alchemy 10 (Health, Stamina and Focus tonics at two tiers, plus antidote, warming draught, fire salve and oil of keenness, each clearing or applying an M3-09 status), Enchanting 8 (one per affix from M3-05 plus two tier 2 variants), Tinkering 8 gadgets.
- Enchanting applies an affix to a chosen item with a free affix slot. The affix's strength rolls with the same quality rule. The number of slots that can be filled follows Enchanting's band (one at 0, two at 15, design/11).
- Gadgets, each a usable item: Spark Flint (ember on the tile ahead), Water Flask (tide on the tile ahead), Smoke Pellet (Hide even in combat, 3 seconds), Bell Charm (tier 1 creatures within 4 tiles flee for 3 seconds), Lantern (off-hand tool, lights dark rooms), Repair Kit (restores 30% durability to equipped gear), Snare (placed, roots the first creature to step on it), Grit Pouch (thrown, dazes for 1 second).
- Remove Tailoring, Alchemy, Enchanting and Tinkering from `PENDING_SKILLS`.

Save: schema bump only if a new component or stream is needed. Affixes use the M3-05 stack field.
Integrity: craft source covers new items. Rule `AFFIX_WITHOUT_ENCHANT`: affixes on held items at most the count of Enchanting crafts in `ledger.crafts`.

Acceptance:

- The trace and hold grades tested from fed input samples.
- Quality distribution for each new craft written in the PR.
- Each gadget's effect works in a scenario test, and the two element gadgets trigger their M3-09 set pieces.
- Each step is playable one-handed: phone screenshots in Flow portrait and Classic landscape.
