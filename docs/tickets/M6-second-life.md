# M6 A Second Life: life systems

**Result:** a player can live a full non-combat life: farm, raise animals, cook, fish, tame, own a home and a shop, make friends, attend festivals.

---

### POW-M6-01 Refinement: M6 specs to READY
Size: M      Depends: M5 complete      Status: DRAFT (design authority)

Goal: READY specs, including crop and animal tables, the fish list for regions 1 to 4, the furniture list, NPC friendship content plan, and festival designs.
Acceptance: owner approves.

### POW-M6-02 Farming
Size: L      Depends: M6-01      Status: DRAFT
Refs: design/05-life-systems (Farming and husbandry)

Goal: plant, tend, harvest, on the real clock.
Scope: plots, tilling, seeds, watering, growth stages in trusted real time including offline, season and weather effects, soil quality, rotation, fertilizer. About 30 crops for tiers 1 to 4. Ripe crops wait. Farming XP and Trials at 30 and 50.
Acceptance: growth across an offline gap matches the formula exactly. A neglected farm never destroys anything. Crop art contact sheet.

### POW-M6-03 Husbandry
Size: M      Depends: M6-02      Status: DRAFT
Refs: design/05-life-systems (Farming and husbandry)

Goal: animals that produce and bond.
Scope: pens, feed, daily goods, bonding, mood. 8 animal types. Neglect lowers output only. Trials.
Acceptance: output formula tests across attention levels and offline time.

### POW-M6-04 Cooking in full
Size: M      Depends: M6-02      Status: DRAFT
Refs: design/05-life-systems (Cooking)

Goal: the social craft.
Scope: recipe set grows to about 100 (tiers 1 to 4). Camp meals for the party. Gifting dishes. Stall-ready dishes. Cooking Trials through 50. Chronicle recipes page.
Acceptance: party buff applies to all members. Every dish reachable by experiment or teaching.

### POW-M6-05 Fishing
Size: M      Depends: M6-01      Status: DRAFT
Refs: design/05-life-systems (Fishing)

Goal: a calm minigame with a deep log.
Scope: one-thumb tension minigame. Species tables by region, water type, weather, season, time. 48 species for regions 1 to 4, with legendaries. Rod and bait tiers. Chronicle fish page with records. Feeds the fishing ranking.
Acceptance: catch tables validated (every species is catchable under some reachable condition). Minigame playable one-handed with assist options.

### POW-M6-06 Taming, companions, mounts
Size: L      Depends: M6-03      Status: DRAFT
Refs: design/05-life-systems (Taming), design/04-combat (Companions in combat)

Goal: befriend creatures and bring one along.
Scope: taming interaction (food preference, timing, conditions such as not having harmed its kind that day). Companion roles: fight, carry, gather, ride, sniff. One active companion. Stable at home. Mounts with speed and terrain traits. About 16 tameable species for regions 1 to 4. Companion bond and naming.
Acceptance: taming scenarios per condition type. Mount speed integrates with chunk streaming budget. Companions cannot die permanently.

### POW-M6-07 Housing
Size: L      Depends: M6-01, M3-07      Status: DRAFT
Refs: design/05-life-systems (Housing)

Goal: a home that is yours.
Scope: inn room, house plots by Renown and coin, interior tile-grid placement with rotate, move, store. About 60 furniture pieces including functional ones (stations, storage, trophy stand, bookshelf for found lore). Rested buff from your own bed. Friend visits with comments drawn from what is placed.
Acceptance: placement rules tested (no blocking the door, no overlap). Layout persists and migrates. A visitor comment references a placed item.

### POW-M6-08 Homestead
Size: L      Depends: M6-07, M6-02, M6-03      Status: DRAFT
Refs: design/05-life-systems (Housing), design/06-automation (a place)

Goal: land outside town to build a working life on.
Scope: homestead plot unlocked after the regional boss. Buildable structures on a grid: farm plots, pens, workshops, storehouse, stable, a Waystone. Upgrade tiers. Facilities are tagged so M7 Routines can target them.
Acceptance: building persists as chunk deltas within budget. A fully built homestead holds the frame budget.

### POW-M6-09 Relationships
Size: L      Depends: M6-01, M4-12      Status: DRAFT
Refs: design/05-life-systems (Relationships)

Goal: NPCs become friends, and a few can become more.
Scope: five-heart friendship, likes and dislikes, gift responses, heart events (short authored scenes) for Dawnmeadow NPCs, unlocks (recipes, Trials, discounts, help). Partner system for eligible NPCs and Close Friend Travelers, with a shared home routine. Deed memory lines.
Acceptance: heart thresholds and unlocks tested. Partner routine runs on the schedule. All content wholesome and optional.

### POW-M6-10 Festivals and Performance
Size: L      Depends: M6-04, M6-05, M5-11      Status: DRAFT
Refs: design/05-life-systems (Festivals, Performance)

Goal: four days a year the world gathers, and a bard has a stage.
Scope: Performance skill: instruments as off-hand tools, rhythm input, songs with effects (party buffs, calm creatures, tips, a few secrets). Festival framework on the calendar: hub dressing, crowds, contests (cooking, fishing, music, duels, race), limited goods. First festival fully authored, the other three with their regions.
Acceptance: contest scoring tests. Festival day holds the frame budget with a crowd. Missing a festival loses nothing permanently.

### POW-M6-11 Player shops
Size: M      Depends: M5-10, M6-07      Status: DRAFT
Refs: design/05-life-systems (Economy)

Goal: sell your work from your own counter.
Scope: stall license, then storefront. Stock and price UI. Foot-traffic sales model bounded by simulated demand. Clerk hire. Maker's mark reputation effects. Travelers mention purchases. Plausibility rule for shop income.
Acceptance: sales over time match the demand model. Overpricing reduces sales to zero smoothly. Income bound tested against plausibility.
