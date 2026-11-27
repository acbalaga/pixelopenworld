# M6 A Second Life: life systems

**Result:** a player can live a full non-combat life: farm, raise animals, cook, fish, tame, own a home and a shop, make friends, attend the harvest fair.

**Gate G6a (mid M6, D30):** once POW-M6-02, 04, 05 and 07 merge, the owner plays over at least three real days on a phone: plant, leave, come back, cook what grew, fish, and set up the inn room. Is coming back to the field and the room worth it, and does offline growth read right? Wave C does not start until it passes. Checklist: `docs/ops/gate-g6a.md` (written by POW-M6-12).

Read first: `docs/design/05-life-systems.md` and `docs/design/13-life-content.md` (the content tables every M6 ticket builds from). Decisions D28 to D31 in the master plan.

## Order of work

| Wave | Tickets                                    | Notes                                                                                                     |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A    | 20, 21, 22, 23                             | M5 review findings. 20 merges before 02. The others run in parallel with wave B.                          |
| B    | 02, then 04. 05 and 07 in parallel with 02 | 04 needs 02's crops. 07 builds interiors, which 13 and 08 reuse.                                          |
| G6a  | 12, then the owner check                   | 12 needs 02, 04, 05 and 07.                                                                               |
| C    | 03, 13, 09, then 06, 08, 10, 11            | Starts after G6a passes. 06 needs 03 and 22. 08 needs 13 and 03. 10 needs 04, 05, 09 and 21. 11 needs 13. |

**Save schema bumps serialize.** M6 starts at schema 35. Tickets 02, 03, 05, 06, 07, 08, 09, 10, 11 and 13 each bump it. Whichever merges later rebases, takes the next number, and re-exports its fixture from main as it stands then. One migration per step. Record the numbers here when the milestone closes.

**Everything runs on the world clock.** The world clock comes from trusted time and keeps running while the game is closed (tech/02, `TickInput.worldTick`). Crops, animals, troughs, leases and the fair read `state.worldTick` and `weatherOn(state, tick)`. No M6 system keeps its own timer, and none reads `Date`. Offline time is a jump in `worldTick`, so each system's online and offline results come from the same formula, and a test proves it for each (one long step against many small ones gives the same state).

**Value creation has ledger entries.** Crops, animal goods, caught fish, shop income, fair tokens and fair prizes each get a ledger source and a bound in `src/save/integrity/` (tech/02, Ledger). Each ticket that creates one adds a test that edits the value up and is caught.

**Never destroy player data, in play too.** Neglect never removes a crop, an animal, a companion, a piece of furniture or a partner. An expired lease keeps everything in place and stops growth until it is paid again.

**Trials.** Dawnmeadow sets rank 15 Trials only (01-dawnmeadow section 9). M6 adds Farming 15 and Husbandry 15 (Tamsin) and Taming 15 (Old Fen). Rank 30 and 50 Trials for these and for Cooking come with the M8 and M9 trainers (POW-M8-01). This replaces "Trials at 30 and 50" in the earlier draft.

**D25 holds.** No template, rumor, letter or fair line names a fish, tameable or place from an unbaked region.

## Wave A: M5 review findings (D28)

Ids 20 and up hold the M5 milestone review findings and the M5 closeout follow-ups, the way M5 reserved 20 and up for Gate G4. They are READY and do not wait for anything.

## Decisions folded in (M5 closeout, 2026-11-27)

- Wardens of the Fog opens when Taming ships (POW-M6-06).
- A fountain in the Hearthford square, with wishes moved to it, and dedicated sit, wave and bow doll frames (POW-M6-10).
- Market-street stalls become interactive, and market listings expire (POW-M6-11).
- Explicit drops (reopen only if play shows a problem): questions stay at about 2% of chat; gathering Travelers do not deplete nodes; Travelers earn no Path titles before M10; map-board passes are not announced until M8; sheets at posts keep the 60% height; Rivals do not join parties; the 60 ms W holds in `stationSheet` and `actionMeter` are left alone unless CI flakes; Travelers stuck in buildings waits for an owner screenshot (PR #166).

---

### POW-M6-01 Refinement: M6 specs to READY

Size: M Depends: M5 complete Status: DONE (design authority, delivered by the planning PR that wrote this file)

Goal: READY specs for M6.
Scope: this file. `docs/design/13-life-content.md`. Master plan D30 and D31 and Gate G6a. Small edits to design/05 and design/11.
Acceptance: owner approves the PR.

### POW-M6-02 Farming

Size: L Depends: POW-M6-20 Status: READY
Refs: design/05-life-systems (Farming and husbandry), design/13-life-content (1, 2), design/11-skill-table (Farming), tech/02-save-security (Ledger, trusted time), tech/03-asset-pipeline (sprites from data)

Goal: plant, tend and harvest on the world clock, online or offline.
Scope:

- **Farming is wired.** Remove it from `PENDING_SKILLS`. New `harvest` XP event. Band 0 passive: can farm tier 1 crops. Band 15 passive **Green Thumb**: watering lasts 25% longer (design/11).
- **The reeve's field:** 6 plots outside Hearthford's east gate, baked into Dawnmeadow (re-bake). Edda leases plots: talk to her, pick how many, pay `lease.weekly` (12 coin per plot per in-game week of 7 days) for one to four weeks ahead. A lapsed lease keeps the crop in place and pauses its growth until paid. Nothing is removed.
- **Plot actions** by the context button with the needed tool: till (hoe, a new tier 1 tool, Woodworking or Brin), plant (seed from the Bag), water (watering can, a new tool, Tinkering or Brin, holds 10 waterings, refills at the well or the river), fertilize, harvest. Tilling is needed once per plot.
- **Crops:** all 30 crops of design/13 section 2 as data in `src/content/farming/crops.ts` (`CropDef`: id, tier, family, seasons, days, regrowDays, result item, seed item, giant flag). New items: every crop, every seed, compost, hoe, watering can. Seeds sold by the people in the table. "Market" seeds join the market model's item pool (POW-M5-10), so Travelers list them. Seeds the table gates behind hearts are also listed on the Market until POW-M6-09 adds the heart route, after which they stay on the Market at a higher price. Seed-pod planting per 13 section 2.
- **Growth** as a pure function in `src/sim/farming.ts`: `growthAt(plot, fromTick, toTick, weatherOn)` integrates the watered windows (one in-game day from a watering, or any rain or storm day) at rate 1 and the rest at `dryRate`. Stage thresholds at 0, 25%, 60%, 100%. Out-of-season time grows nothing. All numbers in `src/content/balance/farming.ts`.
- **Soil, rotation, fertilizer and quality** per 13 section 2.1. **Giant crops** per 2.2 (the merge check runs when the fourth plant ripens).
- **Rendering:** 4 stage sprites per crop plus the giant pumpkin and giant melon (2 x 2), generated from data in the art pipeline. Wet soil tint for a watered plot. A ripe crop shows a small sparkle when the player is near.
- **Travelers** whose archetype gathers or crafts mention crops in season: 5 to 10 new chat templates on a `season` trigger, naming only crops that exist. No new Traveler activity.
- **Farming Trial 15** with Tamsin: harvest 10 different crops, one of them at Fine or better.

Out of scope: animals (03), the homestead (08), the kitchen garden at a house (13), sprinklers (M7 Routines).
Save: plots (id, tilled, crop id, planted tick, growth so far, last watered tick, soil, fertilized), lease paid-until tick, known seeds. Schema bump with a migration and a fixture test.
Integrity: harvest is a ledger source. Bound: per plot, at most one harvest per crop cycle, so total crop units are bounded by plots, elapsed world time and the fastest crop. Test edits a crop stack up and is caught.
Acceptance:

- Test: growth over an offline gap equals the same span stepped one tick at a time, for 5 crops, with and without rain days in the gap.
- Test: a plot left for 30 in-game days keeps its ripe crop. A lapsed lease pauses growth and destroys nothing.
- Test: rotation and fertilizer change soil as specified, and soil changes yield and the quality roll as specified.
- Test: the giant merge happens only with four ripe plants in a square at soil 3, at the stated chance over 1000 seeded trials.
- Test: every crop's seed is obtainable (shop, person, Market or seed pod), and every crop is reachable in some season.
- Crop art contact sheet (all crops, all stages, both giants) in the PR.
- Phone screenshot of the field with crops at mixed stages.

### POW-M6-04 Cooking in full

Size: M Depends: POW-M6-02 Status: READY
Refs: design/05-life-systems (Cooking), design/13-life-content (2), design/11-skill-table (Cooking), POW-M5-07 (parties)

Goal: cooking becomes the social craft, with about 100 dishes.
Scope:

- **Recipe set** grows from 15 to 100 cooking recipes, tiers 1 to 4, in `src/content/items/recipes.ts` and `food.ts`. Split: tier 1 30, tier 2 30, tier 3 25, tier 4 15. Every crop from 13 section 2 is an ingredient in at least two dishes. Animal goods (egg, duck egg, milk, goat milk, truffle, from M6-03) appear in 10 recipes that M6-03 makes cookable: write those 10 now, with ingredients that M6-03 adds, and mark them `learn: 'experiment'`. They are simply unmakeable until 03 merges.
- Learn split: about 60% experiment, 20% taught (people at hearts, Hesper), 10% bought, 10% found (manuals, chests).
- **New stations:** oven (bread, pies, roasts) and the existing cook pot. Oven at the inn kitchen. Flour from wheat, milled by Aldo (a service: 2 wheat to 1 flour, small fee).
- **Camp meals:** at a camp or the camp pot, a dish cooked while in a party feeds every member within `campPx`. Each member gets the Fed buff. Travelers comment.
- **Gifting dishes:** a dish is a valid gift to people (M6-09 reads it) and to Travelers (regard, using the M5-06 gift path if it exists, else a chip "Share food").
- **Stall-ready flag** on dishes (M6-11 reads it).
- **Chronicle recipes page:** every known recipe with its ingredients, grouped by tier; unknown ones show as a silhouette count per tier.

Out of scope: Cooking Trials past 15 (M8). Festival cooking contest (10).
Save: known recipes already saved. If a new saved field is needed, bump with a migration. Expected: no bump.
Integrity: none new (crafting rules already cover cooking).
Acceptance:

- Test: a camp meal applies the Fed buff to every party member in range and to nobody out of range.
- Test: every dish is reachable by experiment or teaching (a reachability check over recipes, ingredients and sources).
- Test: every crop is used by at least two dishes.
- Content validator clean. Item sheet of the new dishes in the PR.

### POW-M6-05 Fishing

Size: M Depends: none Status: READY
Refs: design/05-life-systems (Fishing), design/13-life-content (4), design/11-skill-table (Fishing), design/09-ui-ux (one thumb)

Goal: a calm tension minigame and 14 Dawnmeadow fish plus a legend.
Scope:

- **Minigame** replacing the placeholder catch (`fishing: true` nodes): cast with the context button, wait for a bite (a ripple, a sound), then hold to reel. A marker drifts and the fish pulls it. Keep the marker inside the band to fill the catch bar. Band width and pull from the fish's difficulty and the rod tier. Letting go slackens. Losing the fish costs nothing but the bait. One thumb, no fail state beyond a lost bite.
- **Fish** per 13 section 4 (Dawnmeadow only) as data in `src/content/fishing/fish.ts` (`FishDef`: id, water, weight, size range, difficulty, phases, seasons, weather). Each fishing spot gets a water type (re-bake to tag the existing spots and add pond and marsh spots at Millbrook pond and the Reedmouth marsh).
- **Sizes:** each catch rolls a size in range. Records page in the Chronicle: biggest of each species and where.
- **Old Gnarl**, the legendary pike: Millbrook pond, dusk, autumn, Fishing 25, difficulty 5. Once per save. The catch goes on the trophy stand (M6-13) when one exists.
- **Bait:** minnow as bait raises bite chance (`baitBoost`). Optional.
- **Patient Line** (band 15) changes from "placeholder catch takes 20% less time" to "the band is 15% wider" (design/11, already updated).
- Travelers' Fishing club chatter (Quiet Hooks) names Dawnmeadow fish only.

Out of scope: crab pots and nets (Saltreach, M8). Regions 2 to 4 fish (M8).
Save: species caught and record sizes, Old Gnarl caught flag. Schema bump with a migration and a fixture test.
Integrity: caught fish already flow through gathering. Records: a test edits a record size beyond its species range and is caught.
Acceptance:

- Test: the minigame catch rate against difficulty is within the targets in `balance/fishing.ts` for a scripted player at three skill levels.
- Test: every fish can be caught (its spot, time, weather and season all occur).
- Test: Old Gnarl is caught once per save, never again after a reload.
- Phone recording or screenshots of a catch from cast to landing.

### POW-M6-07 Interiors and the inn room

Size: M Depends: none Status: READY
Refs: design/05-life-systems (Housing), design/13-life-content (1, 6), POW-M5-20 (doorways), POW-M6-21 (the Pit hall uses the same idea), tech/01-architecture (World streaming)

Goal: buildings can have insides, and the player has a room.
Scope:

- **Interior rooms:** a small, general way to define an interior (`src/content/world/interiors.ts`: id, size, door tile, outside door position, floor and wall style) and bake it into the region's `interiors` list (`spec.ts` holds `interiors: []` today). Doors use the portal and arch rules from POW-M5-20. The camera snaps to an interior like a dungeon room. Coordinate with POW-M6-21 if it merges first, and reuse what it built.
- **The inn room:** upstairs at the inn, reached by a stair door. 4 x 4 floor tiles, a bed and a chest from the start. The inn's existing bed moves inside. Sleeping here gives Rested as today.
- **Furniture placement** on an interior's grid: place, rotate, move, store, from a Home tab or a long press. The rules in 13 section 6. Pieces live in the Bag's "other" filter until placed.
- **First furniture:** 12 of the 60 pieces from 13 section 6: straw bed, small chest, stool, small table, candle, lantern, rug (2), potted fern, mirror, clock, wardrobe. Craftable at the carpentry or bought from Pell.

Out of scope: house plots and the rest of the furniture (13). Visitors (13). Shops (11).
Save: placed furniture per interior (piece id, x, y, rotation). Schema bump with a migration and a fixture test.
Integrity: none (furniture is crafted or bought through existing ledgers).
Acceptance:

- Tests: a piece never covers the door tile or the tile in front of it, never overlaps another, rugs go under pieces, wall pieces only on walls.
- Test: the room layout survives a reload and an export and import.
- Test: going in and out of the inn room keeps the chunk window and the camera correct, and nothing outside is simulated twice.
- Phone screenshots: the room empty, and furnished with all 12 pieces.

### POW-M6-12 Gate G6a checklist

Size: S Depends: POW-M6-02, POW-M6-04, POW-M6-05, POW-M6-07 Status: READY
Refs: docs/ops/gate-g5a.md (the shape to copy), design/13-life-content

Goal: a checklist the owner can run on a phone over three real days.
Scope: `docs/ops/gate-g6a.md`. Sessions: day 1 lease and plant (two crops, one watered, one not), set up the room; day 2 come back after at least 8 hours away and check growth against the field's own "ready in" hints; cook three dishes from the harvest; fish at three waters; day 3 harvest again, note anything lost or confusing. Each check has steps and an "Expect". A verdict section: pass, adjust (with tickets), rework. Dev shortcuts the owner may use (and must not need) listed at the end.
Acceptance: the owner can run it without help (the owner confirms in the PR).

### POW-M6-03 Husbandry

Size: M Depends: POW-M6-02, Gate G6a Status: READY
Refs: design/05-life-systems (Farming and husbandry), design/13-life-content (3), design/11-skill-table (Husbandry)

Goal: animals that produce and bond.
Scope:

- **Husbandry is wired.** Remove it from `PENDING_SKILLS`. `tend` XP event (feed, pet, brush, collect). Band 0: can keep 2 kinds. Band 15 passive **Gentle Hand**: mood decays half as fast.
- **Pens:** 2 pen slots at the reeve's field, leased like plots (`lease.penWeekly`). A pen holds one kind, up to 4 animals, a feed trough (7 days) and a water trough.
- **Animals** per 13 section 3, as data in `src/content/husbandry/animals.ts`. New items: every good, hay, mulberry leaf, manure (fertilizer, M6-02 reads it).
- **Output** per the formula in 13 section 3, as a pure function of world ticks and pen state, online or offline the same.
- **Bond** hearts per animal, shown on a small card when you pet one. Naming an animal.
- **Husbandry Trial 15** with Tamsin: collect goods from 3 kinds of animal at bond 2.

Out of scope: breeding (later). Homestead pens (08).
Save: pens (kind, animals with name, mood, bond, last fed and petted ticks, trough levels). Schema bump with a migration and a fixture test.
Integrity: animal goods are a ledger source. Bound: per animal at most one good per in-game day (two for bond bonuses). Test edits goods up and is caught.
Acceptance:

- Tests of the output formula across mood 0, 30, 60 and 100, fed and unfed, and across an offline gap of 1, 7 and 30 days (stepped vs jumped, same result).
- Test: no state of neglect removes or kills an animal. Mood never falls below the offline floor while away.
- Phone screenshot of a full pen.

### POW-M6-13 House plots and furniture

Size: L Depends: POW-M6-07, Gate G6a Status: READY
Refs: design/05-life-systems (Housing), design/13-life-content (1, 6), design/07-simulated-mmo (friends visit)

Goal: a house of your own, furnished and visited.
Scope:

- **Two house plots** in Hearthford (east side, inside the walls), baked as houses with an 8 x 6 interior (POW-M6-07 tech) and a yard with a 2 x 2 kitchen garden (2 farm plots that use M6-02's rules). Buying one needs Renown 20 and 1,500 coin (`balance/housing.ts`). One house per player. A bought house is kept forever.
- **The rest of the furniture** from 13 section 6 (48 more pieces, 60 in all), with recipes at the carpentry, tailor, smithy and tinker bench, and some bought from Pell and Mara. Functional pieces work: stations are real stations, storage holds items, the trophy stand and fish tank show trophies, the fireplace adds `cozyRested` to Rested from your own bed, a planted pot grows a herb slowly.
- **Rested from your own bed** lasts `ownBedRestedPct` longer than an inn bed, more with better beds.
- **Visitors:** Travelers at Friend or better visit about once an in-game week while the player is at home. A visit lasts a few minutes. They say 1 to 3 lines that name pieces the player placed (templates with a `{furniture}` slot from the room's own pieces).
- The inn room stays usable after a house is bought.

Out of scope: homestead (08). Partners moving in (09). Storefront (11).
Save: house owned, its layout, the kitchen garden plots. Schema bump with a migration and a fixture test.
Integrity: buying a house is a coin sink, recorded in the ledger. None new.
Acceptance:

- Test: placement rules hold for all 60 pieces in all rotations.
- Test: a visitor line names a piece that is placed, never one that is not.
- Test: layout persists across a reload and an export and import, and migrates from the previous schema.
- Furniture contact sheet (all 60) in the PR. Phone screenshot of a furnished house with a visitor.

### POW-M6-09 Relationships

Size: L Depends: POW-M6-04, Gate G6a Status: READY
Refs: design/05-life-systems (Relationships), design/13-life-content (7), design/01-dawnmeadow (9 People), design/08-lore-SPOILERS (Delivery rules; read it for the Pilgrim, Wren and Old Fen), design/09-ui-ux (text rules)

Goal: people become friends, and four can become partners.
Scope:

- **Five hearts** for all 16 people, per 13 section 7, in `src/sim/friendship.ts` with numbers in `balance/people.ts`. A Hearts page in the Journal lists everyone met, their hearts, and the next unlock (named, not hidden).
- **Gifts:** give from the talk menu, once per person per in-game day. Loved, liked, neutral and disliked responses (4 lines per person, one per kind). Birthdays are out of scope.
- **Likes data:** 3 loved, 5 liked, 2 disliked per person in `src/content/people/index.ts`.
- **Heart events:** 32 scenes (2 and 4 hearts for each person) as dialogue data, triggered as 13 section 7 says. Text only, clear text, 4 to 8 lines each.
- **Unlocks** at hearts 1, 3 and 5 per person, one line each, as data. Help unlocks (heart 5) are small and bounded (a free repair a day, a minded stall day a week).
- **Deed lines:** at least 2 per person, from the journal's deed record.
- **Partners:** Pell, Nessa, Juniper, Mara, and Close Friend Travelers (07), per 13 section 7. The partner scene is a third heart event at 5 hearts. A partner moves into the house plot (needs POW-M6-13; without a house, they say they would like a home together and wait). The daily routine: a morning gift, waters the kitchen garden, chats, keeps their own work schedule. Ending is a kind talk option and loses nothing.
- **Farming and the fair count:** showing up at the fair (POW-M6-10 sends the event) adds points.

Out of scope: birthdays, more partner candidates (later regions), anything that breaks the wholesome rule.
Save: hearts points per person, gifts today, events seen, partner id. Schema bump with a migration and a fixture test.
Integrity: none (hearts create no coin or items; heart-5 help is bounded per day and tested).
Acceptance:

- Tests: thresholds, once-a-day gift and talk limits, every unlock fires once.
- Test: the partner routine runs on its schedule across an offline gap and never runs without a house.
- Validator: every scene, gift line and deed line passes `tools/bake-assets/validateDialogue.ts` (ids, conditions, no em dashes). Hidden-layer wording is checked by reading against 08's delivery rules, listed per scene in the PR.
- Phone screenshots of a heart event and the Hearts page.

### POW-M6-06 Taming, companions, mounts

Size: L Depends: POW-M6-03, POW-M6-22 Status: READY
Refs: design/05-life-systems (Taming), design/04-combat (Companions in combat, Party difficulty), design/13-life-content (5), design/12-travelers (7, Wardens of the Fog)

Goal: befriend a creature and bring it along.
Scope:

- **Taming is wired.** Remove it from `PENDING_SKILLS`. `tame` XP event. Band 0: can tame tier 1 creatures. Band 15 passive **Soft Voice**: a failed taming attempt does not scare the creature off.
- **Taming:** hold out the favorite food near a calm creature (not in a fight, or weakened when its condition says so). A short timing input like the gathering sweep. Conditions per 13 section 5, checked in the sim. A failed try lets the creature run, never attacks.
- **The 8 Dawnmeadow tameables** per 13 section 5. Companion roles: fight (Vanguard or Striker AI from POW-M5-07), carry (+8 Bag slots while out), gather (a small extra roll on nodes worked nearby), ride (mount), sniff (points at a buried find or a hidden path within range, once per area per day).
- **One active companion.** It counts toward POW-M6-22's party scale by its own competence (bond for tamed creatures). It does not take a Traveler's party slot. Others live in a stable at the inn yard (4 slots), more on the homestead.
- **Mounts:** downs ram and moorhound, speeds by terrain in `balance/taming.ts`, capped at `mountMaxSpeed`. Mount and dismount with the context button.
- **Bond and naming**, as for animals.
- **Taming Trial 15** with Old Fen: tame two creatures with different conditions.
- **Wardens of the Fog** joinable at Taming 15 or one tamed creature (test).

Out of scope: regions 2 to 4 tameables (M8). A second companion (Beast Warden Path, later).
Save: tamed companions (species, name, bond, role, active), stable. Schema bump with a migration and a fixture test.
Integrity: none (a companion creates no coin; gather rolls flow through gathering ledgers).
Acceptance:

- Taming scenarios, one per condition type, pass and fail cases.
- Test: a mount at full speed in a straight line never reaches an unloaded chunk (streaming budget, tech/04).
- Test: a companion downed in a fight gets up after it. Nothing removes a companion.
- Test: Wardens of the Fog accepts the player once Taming 15 or a companion is reached.
- Phone screenshot riding the ram and fighting beside the moorhound.

### POW-M6-08 Homestead

Size: L Depends: POW-M6-13, POW-M6-03 Status: READY
Refs: design/05-life-systems (Housing), design/06-automation (a place for Routines), design/13-life-content (1), design/regions/01-dawnmeadow

Goal: land outside town to build a working life on.
Scope:

- **The site:** about 2 x 2 chunks in Dawnmeadow, south of Millbrook along the Lark, not overlapping any point of interest, mini-dungeon, wake point, route or rest point. The PR proposes the exact rectangle with a map screenshot. The owner approves it in review.
- **Unlock:** the Hedge Warden resolved by any route. Edda grants the deed.
- **Buildables on a grid:** farm plots (up to 24), pens (up to 4), workshop (2 stations), storehouse (shared storage), stable (6 companion slots), a Waystone (crafted). Three upgrade tiers per structure, each a coin and material cost in `balance/housing.ts`.
- **Facility tags** on every structure so M7 Routines can target them (`facility: 'plot' | 'pen' | 'workshop' | 'store' | 'stable'`).

Out of scope: Routines themselves (M7). Homesteads in other regions (M8, M9).
Save: built structures as chunk deltas. Schema bump if a new field is needed, with a migration and a fixture test.
Integrity: structure costs are coin sinks in the ledger.
Acceptance:

- Test: a fully built homestead stays within the chunk delta budget (tech/04).
- A fully built homestead holds the frame budget on the reference profile (recorded run).
- Test: farm plots and pens here follow M6-02 and M6-03 rules exactly.

### POW-M6-10 The harvest fair and Performance

Size: L Depends: POW-M6-04, POW-M6-05, POW-M6-09, POW-M6-21, POW-M5-11 Status: READY
Refs: design/05-life-systems (Festivals, Performance), design/13-life-content (8), design/11-skill-table (Performance), design/12-travelers (4), POW-M5-27 (`festivalDanceBoost`, the well wishes)

Goal: four days a year the world gathers, and a bard has a stage. M6 builds the first.
Scope:

- **Festival framework:** a festival is a data record (`src/content/festivals/*.ts`: id, season, day, hub, dressing, contests, stall). The calendar (POW-M5-11) shows the next one with its real start time from the world clock. Spring, summer and winter festivals exist as records with a hub that is not baked yet and do nothing until it is.
- **The autumn harvest fair** per 13 section 8: dressing, crowd pull, chat templates, six contests with tested scoring, tokens, ribbons, the fair stall.
- **The fountain:** a new prop in the Hearthford square beside the well. Wishes (POW-M5-27) move from the well to the fountain.
- **Doll frames:** dedicated sit, wave, bow and dance frames replace the stand-ins from POW-M5-14.
- **Performance in full:** instruments as off-hand tools (lute, flute, drum: Woodworking), a rhythm input for songs, 8 songs (party Stamina, calm creatures, tips in towns, and two that open small secrets the region already has). Hum of Courage reaches the party. Tips: a song in a hub square earns coin from Travelers and people nearby, bounded per in-game day. Travelers gather to listen.
- The fair sends attendance to friendship (M6-09).

Out of scope: the other three festivals' content (M8, M9).
Save: contests entered this fair, tokens, ribbons, songs known. Schema bump with a migration and a fixture test.
Integrity: tokens and tips are ledger sources. Bounds: at most 30 tokens per fair, tips at most `tipsPerDayMax`. Tests edit both up and are caught.
Acceptance:

- Contest scoring tests for all six contests.
- The fair day holds the frame budget with the crowd at its evening peak (recorded run).
- Test: missing a fair loses nothing permanently (every fair good returns at the next fair).
- Test: wishes happen at the fountain and never at the well.
- Phone screenshots of the fair square and the music stage.

### POW-M6-11 Player shops

Size: M Depends: POW-M6-13, POW-M5-10 Status: READY
Refs: design/05-life-systems (Economy), design/07-simulated-mmo (market), `src/sim/market.ts`, tech/02-save-security (Ledger)

Goal: sell your work from your own counter.
Scope:

- **Stall license** (Brin, coin) lets the player rent one market-street day stall on days it is free. **Storefront:** a counter in the player's house (POW-M6-13), unlocked by Bartering 15.
- **Interactive stalls:** market-street stalls now open a sheet that shows who is selling what. Traveler listings from POW-M5-10 show at their stalls on market days, and on the terminal as before.
- **Stock and price UI** on the player's stall or counter.
- **Sales model:** foot traffic from Travelers online in the hub and people passing, times demand from the market model, times a price factor that falls smoothly to zero as the price rises above the market price (`balance/shop.ts`). Sales accrue on the world clock, online and offline the same.
- **Clerk:** hire one (wage per in-game day) so the counter sells while the player is away. Without a clerk, the counter sells only while the player is in the hub.
- **Maker's mark** dishes and gear sell faster. Travelers mention buying from the player by name in chat.
- **Market listing expiry** for the player's own listings (`listingDays`). Expired listings return to a collection box, never vanish.

Out of scope: caravans (later). Shops in other hubs (M8).
Save: license, stall rentals, counter stock and prices, clerk, sales log, listing expiry. Schema bump with a migration and a fixture test.
Integrity: shop income is a ledger source with a bound from foot traffic and elapsed time. Test edits income up and is caught.
Acceptance:

- Test: sales over a simulated week match the demand model within tolerance.
- Test: overpricing reduces sales to zero smoothly (monotonic, no cliff).
- Test: an expired listing returns its items to the collection box.
- Income bound tested against the integrity validator.

---

### POW-M6-20 Stage the seeded scenario tests

Size: S Depends: none Status: READY
Refs: tests/unit/travelerScenes.test.ts, tests/unit/chat-templates.test.ts, tests/unit/travelerBehaviors.test.ts, `__pow.sendTo` in `src/dev/slice.ts` (PR #180), the `travelerSnore` test (PR #174)

Goal: a change to chat or social dice no longer breaks unrelated scenario tests.
Finding: PRs #171, #174 and #175 each had to retune seeded tests ("on 8 of 10 seeds", own-lines "8 of 12 seeds") because a new roll moved what the seeds happened to produce. M6 adds farming and shop chatter, which would do it again.
Scope:

- Rewrite each scenario test that counts hits over seeds so it stages its own setup: place the Travelers it needs at the place and time it needs, the way `travelerSnore` and `__pow.sendTo` do, then assert the behavior happens. At minimum: the well wish, the inn dance-off, the camp ghost story, the dummy argument (`travelerScenes`), and the own-lines and pair-exchange coverage (`chat-templates`).
- Keep one seed-sweep test per scene, renamed as a rate check, with its threshold and seed count in one place at the top of the file and a comment saying what it measures. A rate check may fail only when the rate really changed.
- Same for any e2e spec that relies on a seed producing a scene (`tests/e2e/travelerScenes.spec.ts`).

Out of scope: changing any rate, weight or template. Production code, other than a test hook if one is missing (dev builds only).
Save: none. Integrity: none.
Acceptance:

- Each staged test passes on 20 different world seeds in a row (a loop in the PR, output pasted).
- Proof the staging works: add a dummy roll to the chat dice locally, and show that the staged tests still pass while only the rate checks move. Revert the dummy roll before merging.
- `npm run verify` and `npm run e2e` pass.

### POW-M6-21 The Pit hall

Size: M Depends: none Status: READY
Refs: design/12-travelers (4.6), design/08-lore-SPOILERS (Delivery rules), POW-M5-29 (placement rule), POW-M5-30, POW-M5-20 (doorways), `src/content/balance/pit.ts`, `src/sim/pitBouts.ts`

Goal: duels in the Pit have room, with the crowd watching from above.
Finding (owner, M5 review, 2026-11-27): the Pit is too small for its bouts. Owner's direction: a doorway into a new room where the duels happen.
Placement rule (design authority, extends POW-M5-29): the hall is an old working cut into the quarry wall at ring level, reached through an open arched doorway on the ring's edge. It is not under Hearthford, it is not sealed, and nothing has to be found or opened to enter it once the Pit is open. No string calls it under or below anything: Travelers say "the hall" or "inside the Pit". It must not touch the Stonecrop Deeps rooms or entrance.
Scope:

- The outdoor ring stays as the gathering spot: braziers, the "Next" board and Travelers waiting their turn.
- A new one-room interior, about three times the ring's floor area, with a central fighting floor and raised spectator ledges on three sides. Build it with the room and portal tech the dungeons use (an arch per POW-M5-20 on both sides of the doorway). It is not a dungeon: no creatures, no spawners, not a party activity, not in the dungeon list or the dungeon counts, and the "16 dungeons" doorway test is unchanged or extended without counting it.
- Bouts move into the hall: Traveler vs Traveler and player vs Traveler fight on the hall floor. Spectators stand on the ledges, up to 16 promoted (`balance/pit.ts`). `ringHalfPx` and the spectator spots move to new hall-sized values in `balance/pit.ts`.
- A Traveler walking to a bout goes through the doorway. Leaving the Pit area also leaves the hall.
- Re-bake Dawnmeadow.

Out of scope: new prizes, a ladder, wagers, changes to the duel rule or the honor.
Save: if the player can be saved inside the hall, a reload puts them back there (positions are already saved). If any saved field changes, bump the schema with a migration and a fixture test from schema 35. Expected: no bump.
Integrity: none.
Acceptance:

- Test: every Pit bout (Traveler vs Traveler and player vs Traveler) starts and ends on the hall floor. 200 bouts, none outside it.
- Test: the hall has no creature, spawner or party activity, and the dungeon counts are unchanged.
- Test: the doorway shows an arch from both sides, and the hall stays reachable after a reload with `flag.pit_open` set.
- Frame budget holds with 2 fighters and 16 spectators promoted in the hall (recorded run).
- Phone screenshots: the ring with the doorway, and a bout in the hall with the ledges full.

### POW-M6-22 Creatures scale with the party

Size: M Depends: none Status: READY
Refs: design/04-combat (Companions in combat, Party difficulty), design/07-simulated-mmo (Parties), master plan D29, `src/sim/party.ts` (`competence`), `src/sim/systems/spawner.ts`, `src/content/balance/party.ts`

Goal: a party fight is about as hard as a solo fight at the same tier.
Finding (owner, M5 review, 2026-11-27): "the monsters are easier because of them". Nothing scales creatures for party size today.
Scope:

- When a creature first engages (its first aggro on the player or a member), fix its Health scale for that fight: `scale = 1 + sum over members of perMember * (floor + (1 - floor) * c)`, where `c` is that member's competence from 0 to 1 (the same straight line as `PARTY.competence`, rank 0 to `rankFull`). Health and max Health are multiplied by `scale` and rounded. Defaults in `balance/party.ts`: `perMember` 0.6, `floor` 0.4, and a separate `bossPerMember` 0.5 for bosses and mini bosses.
- The scale is fixed once set. A member who joins mid-fight does not raise it. A member who leaves, is downed or logs off does not lower it. A creature that resets (leash, the player leaves the room) drops its scale and takes a new one on its next engagement.
- Damage, attack timing, XP, drops and loot rolls are unchanged. A solo player (no party) gets exactly `scale = 1`.
- Party frames or the target bar show nothing new. The player feels it, it is not announced.
- Tamed companions (M6-06) count as members when they arrive, by their own competence. Leave a hook. Do not build it.

Out of scope: damage scaling, elite variants, new mechanics for party fights.
Save: none (party state and fight state are session only). Integrity: none (no new value. A test confirms party loot stays within solo bounds, as POW-M5-07 required).
Acceptance:

- Unit tests of the formula: solo is 1.0, a party of three rank-0 Travelers gives 1 + 3 * 0.6 * 0.4 = 1.72, three at `rankFull` give 2.8, and bosses use `bossPerMember`.
- Tests: the scale does not change when a member joins, leaves or is downed mid-fight, and a reset creature rescales.
- Scenario: time to clear the Rootway with the player plus three rank-matched Travelers is within 0.7x to 1.3x of the solo clear time (sim-bot or a sim scenario, numbers pasted). Tune the defaults in `balance/party.ts` until it holds and report the final values.
- `npm run sim-bot` and `balance:ci` solo results unchanged from `main`.

### POW-M6-23 M5 loose ends

Size: S Depends: none Status: READY
Refs: docs/proposals/m5-closeout.md (section 6), design/12-travelers (4.4)

Goal: close the small M5 follow-ups in one pass.
Scope:

- Brags only on rare drops: a brag about a drop fires only when that drop's chance is at or under a threshold in `balance/chat.ts` (default: the same 30% as `PARTY.rollShowPct`). Common loot ("Got Rough Hide") is never bragged about.
- A reload in the middle of a field raid rebuilds the raid parties from the event state, so the raid still has its groups.
- The Woods-edge rest point sits inside the 80-tile ring Travelers rest in, or the ring rule includes it. Pick the smaller change and note which.
- `src/content/strings/dialogue.ts`: remove the old cook line around line 92 if nothing reads it (a grep in the PR proves it).

Out of scope: other chat tuning.
Save: none. Integrity: none.
Acceptance:

- Test: no brag template fires for a drop above the threshold, and one can fire for a rare drop.
- Test: after a reload mid-raid, the raid has the same parties it had before.
- Test: every rest point is reachable by the resting rule.
- `npm run verify` passes.
