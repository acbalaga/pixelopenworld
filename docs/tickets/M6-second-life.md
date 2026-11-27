# M6 A Second Life: life systems

**Result:** a player can live a full non-combat life: farm, raise animals, cook, fish, tame, own a home and a shop, make friends, attend festivals.

## Wave A: M5 review findings (D28)

Ids 20 and up hold the M5 milestone review findings and the M5 closeout follow-ups, the way M5 reserved 20 and up for Gate G4. They are READY now and do not wait for POW-M6-01. POW-M6-20 merges before POW-M6-02, so M6's new chatter does not move the seeded tests again. 21, 22 and 23 have no order between them.

## Carried into the POW-M6-01 refinement

Decided at the M5 closeout (`docs/proposals/m5-closeout.md`, 2026-11-27). The refinement writes these into the ticket scopes:

- **M6-06:** Wardens of the Fog stays closed until Taming ships. When it does, Taming 15 or a tamed creature opens it, with a test.
- **M6-10:** a fountain prop in the Hearthford square, and wishes move from the well to it (the owner still wants it, 2026-11-27). The festival dance uses the `festivalDanceBoost` hook from POW-M5-27. Dedicated sit, wave and bow doll frames (POW-M5-14 used stand-ins).
- **M6-11:** market-street stalls become interactive with player shops (POW-M5-10 listings live only on the terminal sheet). Market sales get a listing expiry.

Explicit drops (no ticket; reopen only if play shows a problem):

- Questions are about 2% of chat. Kept as tuned.
- A gathering Traveler does not deplete the node. Kept, so Travelers never take the player's nodes.
- Travelers earn no Path titles. Not before M10.
- Map-board passes are not announced. Needs region sizes; revisit in M8.
- Sheets at posts use the standard 60% sheet height. Kept.
- Rivals joining a party, and a Rival body in the dungeon. Not now.
- The 60 ms W holds in the `stationSheet` and `actionMeter` e2e specs. Act only if CI flakes, starting with `stationSheet`.
- Travelers stuck inside buildings when crowded. Open, waiting for an owner screenshot (PR #166). No ticket without a repro.

---

### POW-M6-01 Refinement: M6 specs to READY

Size: M Depends: M5 complete Status: DRAFT (design authority)

Goal: READY specs, including crop and animal tables, the fish list for regions 1 to 4, the furniture list, NPC friendship content plan, and festival designs.
Acceptance: owner approves.

### POW-M6-02 Farming

Size: L Depends: M6-01 Status: DRAFT
Refs: design/05-life-systems (Farming and husbandry)

Goal: plant, tend, harvest, on the real clock.
Scope: plots, tilling, seeds, watering, growth stages in trusted real time including offline, season and weather effects, soil quality, rotation, fertilizer. About 30 crops for tiers 1 to 4. Ripe crops wait. Farming XP and Trials at 30 and 50.
Acceptance: growth across an offline gap matches the formula exactly. A neglected farm never destroys anything. Crop art contact sheet.

### POW-M6-03 Husbandry

Size: M Depends: M6-02 Status: DRAFT
Refs: design/05-life-systems (Farming and husbandry)

Goal: animals that produce and bond.
Scope: pens, feed, daily goods, bonding, mood. 8 animal types. Neglect lowers output only. Trials.
Acceptance: output formula tests across attention levels and offline time.

### POW-M6-04 Cooking in full

Size: M Depends: M6-02 Status: DRAFT
Refs: design/05-life-systems (Cooking)

Goal: the social craft.
Scope: recipe set grows to about 100 (tiers 1 to 4). Camp meals for the party. Gifting dishes. Stall-ready dishes. Cooking Trials through 50. Chronicle recipes page.
Acceptance: party buff applies to all members. Every dish reachable by experiment or teaching.

### POW-M6-05 Fishing

Size: M Depends: M6-01 Status: DRAFT
Refs: design/05-life-systems (Fishing)

Goal: a calm minigame with a deep log.
Scope: one-thumb tension minigame. Species tables by region, water type, weather, season, time. 48 species for regions 1 to 4, with legendaries. Rod and bait tiers. Chronicle fish page with records. Feeds the fishing ranking.
Acceptance: catch tables validated (every species is catchable under some reachable condition). Minigame playable one-handed with assist options.

### POW-M6-06 Taming, companions, mounts

Size: L Depends: M6-03 Status: DRAFT
Refs: design/05-life-systems (Taming), design/04-combat (Companions in combat)

Goal: befriend creatures and bring one along.
Scope: taming interaction (food preference, timing, conditions such as not having harmed its kind that day). Companion roles: fight, carry, gather, ride, sniff. One active companion. Stable at home. Mounts with speed and terrain traits. About 16 tameable species for regions 1 to 4. Companion bond and naming.
Acceptance: taming scenarios per condition type. Mount speed integrates with chunk streaming budget. Companions cannot die permanently.

### POW-M6-07 Housing

Size: L Depends: M6-01, M3-07 Status: DRAFT
Refs: design/05-life-systems (Housing)

Goal: a home that is yours.
Scope: inn room, house plots by Renown and coin, interior tile-grid placement with rotate, move, store. About 60 furniture pieces including functional ones (stations, storage, trophy stand, bookshelf for found lore). Rested buff from your own bed. Friend visits with comments drawn from what is placed.
Acceptance: placement rules tested (no blocking the door, no overlap). Layout persists and migrates. A visitor comment references a placed item.

### POW-M6-08 Homestead

Size: L Depends: M6-07, M6-02, M6-03 Status: DRAFT
Refs: design/05-life-systems (Housing), design/06-automation (a place)

Goal: land outside town to build a working life on.
Scope: homestead plot unlocked after the regional boss. Buildable structures on a grid: farm plots, pens, workshops, storehouse, stable, a Waystone. Upgrade tiers. Facilities are tagged so M7 Routines can target them.
Acceptance: building persists as chunk deltas within budget. A fully built homestead holds the frame budget.

### POW-M6-09 Relationships

Size: L Depends: M6-01, M4-12 Status: DRAFT
Refs: design/05-life-systems (Relationships)

Goal: NPCs become friends, and a few can become more.
Scope: five-heart friendship, likes and dislikes, gift responses, heart events (short authored scenes) for Dawnmeadow NPCs, unlocks (recipes, Trials, discounts, help). Partner system for eligible NPCs and Close Friend Travelers, with a shared home routine. Deed memory lines.
Acceptance: heart thresholds and unlocks tested. Partner routine runs on the schedule. All content wholesome and optional.

### POW-M6-10 Festivals and Performance

Size: L Depends: M6-04, M6-05, M5-11 Status: DRAFT
Refs: design/05-life-systems (Festivals, Performance)

Goal: four days a year the world gathers, and a bard has a stage.
Scope: Performance skill: instruments as off-hand tools, rhythm input, songs with effects (party buffs, calm creatures, tips, a few secrets). Festival framework on the calendar: hub dressing, crowds, contests (cooking, fishing, music, duels, race), limited goods. First festival fully authored, the other three with their regions.
Acceptance: contest scoring tests. Festival day holds the frame budget with a crowd. Missing a festival loses nothing permanently.

### POW-M6-11 Player shops

Size: M Depends: M5-10, M6-07 Status: DRAFT
Refs: design/05-life-systems (Economy)

Goal: sell your work from your own counter.
Scope: stall license, then storefront. Stock and price UI. Foot-traffic sales model bounded by simulated demand. Clerk hire. Maker's mark reputation effects. Travelers mention purchases. Ledger entries and integrity rule for shop income.
Acceptance: sales over time match the demand model. Overpricing reduces sales to zero smoothly. Income bound tested against the integrity validator.

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
