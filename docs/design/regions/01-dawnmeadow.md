# Region 1: Dawnmeadow

Tier 1. Farmland, gentle hills, one river. Hub: Hearthford. Home, and first everything.

This document is the pattern for regions 2 to 8. Every region doc has the same sections in the same order. The region spec (`src/content/world/regions/dawnmeadow/`, POW-M4-04) is authoritative for coordinates. This doc is authoritative for intent, names and counts. If the two disagree, raise a Design Query.

Executors do not need design/08 for this document. Lore fragment slots are listed by position only.

## 1. Identity

- **Feeling.** Morning light, wind over barley, a mill turning. The safest region, but not a soft one: the first cave and the moor punish a careless start.
- **Signature activities.** Foraging, Cooking, first crafts, first fights. Farming joins in M6.
- **What the player leaves with.** A handful of awakened skills at 10 to 20, tier 1 to 2 gear they made or earned, a bed in the inn, a few names who know theirs, and a reason to go west.

## 2. Map sketch

12 x 12 chunks (384 x 384 tiles). One cell is one chunk. North is up.

```
      0   1   2   3   4   5   6   7   8   9  10  11
  0   ^   ^   ^   ^   ^   ^   ^   ^   ^   ^   ^   ^     ^  Crown cliffs, sheer (true wall)
  1   C   C   C   s   s   S   s   s   r   ^   ^   ^     C  Cairnmoor            S  Stonecrop camp
  2   C   C   c   s   s   s   s   s   r   m   ^   ^     c  moor edge            s  Stonecrop Rise
  3   F   F   c   d   d   d   s   r   M   m   m   ~     F  Fernside Edge        M  Millbrook hamlet
  4   T   F   F   d   d   h   h   r   m   m   m   E     T  Thornwall Pass       m  Millbrook fields
  5   T   F   F   d   h   H   H   r   m   m   m   E     d  Hollow Downs         h  Hearthford commons
  6   T   F   d   d   h   H   H   r   m   m   R   E     H  Hearthford (hub)     r  the Lark river
  7   F   F   d   d   d   h   h   r   r   R   R   E     R  Reedmouth marsh      E  coast road east
  8   F   d   d   d   d   d   d   d   r   R   R   ~     ~  sea
  9   ~   d   d   d   d   d   d   r   R   R   ~   ~
 10   ~   ~   d   d   ~   ~   ~   R   R   ~   ~   ~
 11   ~   ~   ~   ~   ~   ~   ~   ~   ~   ~   ~   ~
```

Roads: a cross through Hearthford. West road to Fernside and Thornwall Pass. East road over the Lark bridge to Millbrook, then the coast road out at E. North road up Stonecrop Rise to the quarry. South road over the downs to the wayside chapel and the sea cliffs. A cart track from Millbrook down the river to Reedmouth.

The Lark runs from a spring under the Crown cliffs (chunk 8,1), through Millbrook's mill race, past Hearthford's east wall, and fans into the Reedmouth delta.

## 3. Zones and spawn ramp

Difficulty rises with distance from Hearthford. Sub-steps inside tier 1 are a, b and c (balance multipliers in `src/content/balance/world.ts`, POW-M4-05).

| Zone             | Chunks (rough) | Step | Day roster (temperament)                                                                                     | Night roster (temperament)                                        |
| ---------------- | -------------- | ---- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Commons          | ring round H   | a    | Meadow Hare (skittish), Hedge Sparrow flock (skittish, flyer), Mossling (curious)                            | Mossling (territorial), Moor Wisp (curious, flyer)                |
| Millbrook fields | m              | a    | Downs Ram (defensive, pack), Grain Rat (hostile, swarm, only in barns), Fox (curious)                        | Fox (skirmisher, hostile), Strawman (hostile, guard, fields only) |
| Hollow Downs     | d              | b    | Bramble Boar (territorial), Burrow Mole (defensive, burrower), Thistle Wasp (territorial, flyer, near hives) | Bramble Boar (hostile), Barrow Bones (hostile, near barrows)      |
| Reedmouth marsh  | R              | b    | Reed Crab (defensive, guard), Spitbloom (territorial), Marsh Leech (hostile, chaser)                         | Moor Wisp (curious), Marsh Leech (hostile)                        |
| Stonecrop Rise   | s, S           | b    | Rubblet (territorial, guard), Crag Hawk (territorial at nests, flyer)                                        | Rubblet (hostile), Moorhound (hostile, pack)                      |
| Fernside Edge    | F              | c    | Thornling scout (hostile, tier 2 visitor), Spitbloom (territorial), Fox (curious)                            | Moorhound (hostile, pack), Barrow Bones (hostile)                 |
| Cairnmoor        | C, c           | c    | Moorhound (hostile, pack), Crag Hawk (territorial), **Hollowhorn** (field boss, territorial, roams)          | Moorhound (hostile, pack), Barrow Bones (hostile), Hollowhorn     |

Dungeon-only creatures: Root Grub (hostile, burrower), Glowcap (territorial, shooter, dark rooms only).

Total distinct tier 1 creatures: 20 (Mossling, Spitbloom, Bramble Boar from M1 to M3, plus 17 new). Bosses are listed in section 8.

Rules:

- No hostile or territorial spawn within 12 tiles of a wake point, a road, or the town walls.
- Each zone has at least one place where its creatures can be watched from safety (a hill, a fence, a bridge), so a player can learn the tells before engaging.
- The Fernside Thornling is a tier 2 creature visiting tier 1 land. It is the region's "early is allowed, and it hurts" sample.

## 4. Settlements

### Hearthford (hub)

About 3 x 3 chunks, walled with a low stone wall and four gates. Laid out by the hub rules in design/02 (D18).

```
                         N gate (Stonecrop road)
              +-----------------||------------------+
              |  homes     craft row (N-E street)   |
              |  [h][h]   [smithy][carpentry][tailor]|
              |               [apothecary][tinker]   |
              |  [rune house + Wren's study]         |
   W gate ====|  [guard yard]      SQUARE      [h]   |==== E gate, Lark bridge
   (Fernside) |  [dummy]   [Waystone][board][wall]   |     (Millbrook)
              |  [INN: bed, storage, pot, mirror]    |
              |  [inn yard]   market street (S)      |
              |  [h][h]   [Brin's shop][stalls][h]   |
              +-----------------||------------------+
                         S gate (chapel road)
```

| District      | Holds                                                                                                                 | People                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Square        | Waystone, request board, guild notice wall, well, benches                                                             | The Pilgrim (by day, on a bench) |
| Craft row     | Smithy (anvil, forge), carpentry (workbench), tailor (loom), apothecary (alchemy table), tinker's shed (tinker bench) | Tobin, Pell, Mara, Ilse, Juniper |
| Rune house    | Rune stone, Wren's study (tablets, books)                                                                             | Wren                             |
| Inn           | Bed, storage chest, cook pot, mirror (avatar look changes), cellar door                                               | Hesper                           |
| Guard yard    | Training dummy, weapon rack                                                                                           | Orla                             |
| Market street | Brin's shop counter, two day stalls (stock rotates by weekday), market terminal (M5)                                  | Brin                             |
| Homes         | Eight houses, each owned by a named person in section 9                                                               |                                  |

Landmarks seen from two or more chunks away: the mill sails at Millbrook, Hearthford's bell tower above the square, the Waystone's column of light at night.

The M3 square fixtures move as follows (POW-M4-04): Waystone and board stay in the square. Anvil to the smithy. Workbench to the carpentry. Loom to the tailor. Alchemy table to the apothecary. Tinker bench to the tinker's shed. Rune stone to the rune house. Bed, storage and camp pot to the inn. Training dummy to the guard yard. The element set pieces move to a practice field just outside the north gate.

### Millbrook (hamlet)

The mill on the Lark, three farms, a barn with a rat problem. Waystone by the mill pond. Aldo the miller and Tamsin. The Undermill dungeon is under the mill.

### Reedmouth (fishing camp)

Stilted huts at the delta, drying racks, a jetty. Waystone on the jetty. Nessa. Fishing is best here. The coast road east to Saltreach starts here.

### Stonecrop (quarry camp)

Tents and a crane at the quarry lip. Waystone at the crane. Garrick. Mining and the Stonecrop Deeps dungeon.

## 5. Wake points

A new character wakes at one of eight points (D19), drawn by the character's seed from the subset its origin allows. Each is one to three minutes' walk from a Hearthford gate, along a road or with the town in sight.

| #   | Wake point                      | Chunk | Walk to gate | Origins                                   | On the way                                             |
| --- | ------------------------------- | ----- | ------------ | ----------------------------------------- | ------------------------------------------------------ |
| W1  | Hayfield above Millbrook        | 8,3   | 2.5 min      | Unremembered, Farmhand                    | Berry bushes, the mill in view, Downs Rams grazing     |
| W2  | Ditch by the east road          | 8,5   | 1.5 min      | Unremembered, Road-weary                  | A dropped satchel with string, the Lark bridge         |
| W3  | Under the old Lark bridge       | 7,6   | 1 min        | Unremembered, River-found                 | A fishing spot, reeds, a Mossling patch (curious)      |
| W4  | Hunter's lean-to, Fernside edge | 2,5   | 2.5 min      | Unremembered, Hunter's ward               | Herb patches, a boar's territory to walk around        |
| W5  | Wayside chapel steps            | 5,8   | 2 min        | Unremembered, Pilgrim's child             | Flowers, a bench, the sea cliffs, Mend's manual inside |
| W6  | Reed bank at Reedmouth          | 9,7   | 3 min        | Unremembered, River-found                 | Reed Crabs (defensive), the cart track up the river    |
| W7  | Shepherd's hut on Hollow Downs  | 3,7   | 2.5 min      | Unremembered, Farmhand, Hunter's ward     | Sheep pen, a burrow, the Rootway's oak on the skyline  |
| W8  | Milestone on the Stonecrop road | 5,3   | 1.5 min      | Unremembered, Road-weary, Pilgrim's child | The quarry crane in view, an oak to fell later         |

Rules:

- The wake point is the respawn point until the player touches a Waystone or sleeps in a bed.
- From every wake point at least one Hearthford landmark is on screen within 10 seconds of walking.
- Every wake path passes at least one node that awakens a gathering skill and one creature whose temperament is not hostile.
- The first contextual line on waking is set by origin (strings in `src/content/strings/origins.ts`, POW-M4-19). It describes the moment, never the hidden layer.

## 6. Waystones

Six: Hearthford square, Millbrook pond, Reedmouth jetty, Stonecrop crane, Fernside (a broken arch at the forest edge), Cairnmoor (inside a ring of standing stones, hard to reach). No walk in the region is longer than about two minutes from an attuned stone.

## 7. Routes out (freedom of route)

| Exit  | Leads to         | Easy way                                         | Harder ways                                                                                                                                                                                                |
| ----- | ---------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| West  | Whisperwood (T2) | Thornwall Pass dungeon and its regional boss     | The Fernside climb (Athletics 25, stamina ledges, two rest points). The badger tunnels from the Badger Sett mini-dungeon's back door (Stealth 15 to pass the sleeping sett mother, or Delving when wired). |
| East  | Saltreach (T3)   | The coast road from Reedmouth, open from day one | None needed. The road is open and lethal: tier 3 creatures notice from far (design/04 Tier gap).                                                                                                           |
| North | The Crown        | None. The cliffs are a true wall.                | None in M4. A lit window halfway up the cliff (above-tier sight) hints at a way that opens far later.                                                                                                      |
| South | The sea          | None until boats (M8)                            | None.                                                                                                                                                                                                      |

Above-tier sights (design/02), at least three:

1. The floating stones of the Crown on the northern skyline, visible from anywhere on Stonecrop Rise.
2. A lit window halfway up the Crown cliffs above Cairnmoor, seen only at night.
3. A tier 3 creature's den on the far bank of the Reedmouth delta, across deep water.

## 8. Dungeons and bosses

Four dungeons, twelve mini-dungeons, one field boss, one regional boss. Built on the POW-M4-08 framework. Each dungeon teaches one idea, twists it, tests it at the boss, and keeps one secret for a return visit.

### The Rootway (first cave)

The owner's playtest asked for a cave that is a real challenge for the first levels (playtest F5). This replaces the M1 cave. Entrance under the great oak on Hollow Downs, about one minute south-west of the south gate. Target clear: 12 to 18 minutes for a character at Blades (or any weapon) 6 to 10 with crafted tier 1 armor and three dishes. With the bare kit (wooden dagger, rags) it is meant to be lost.

**Idea:** light and roots. Darkness hides threats. Roots block, hold and break.

Room graph (POW-M4-21 authors it in the M4-08 room graph format):

| Room | Name          | What happens                                                                                                                                                                                                                |
| ---- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | Mouth         | Lit by daylight. A lantern hook with no lantern, and a hint that the dark ahead is worse. Two Mosslings (territorial in the dark).                                                                                          |
| R2   | Fork          | Two ways on. Left to the Root Hall (fight). Right to the Narrow Crawl (sneak or climb).                                                                                                                                     |
| R3a  | Root Hall     | A Mossling swarm with a Spitbloom crossfire from a ledge. A pillar to break line of sight. The fighting route.                                                                                                              |
| R3b  | Narrow Crawl  | A sleeping Bramble Boar in a tight passage (pass under Hide, or climb a ledge at Athletics 5). Holds the manual for Hide (the "back passage" in design/11).                                                                 |
| R4   | Dark Gallery  | Unlit. Glowcaps shoot from the dark. Without a light the player sees only telegraph markers, which always glow. A lantern (Tinkering) or any Ember technique lights a radius.                                               |
| R5   | Snare Chamber | The room that punishes running in. Stepping past the threshold drops a root gate behind (arena). Two waves: Root Grubs from the floor, then a Bramble Boar.                                                                 |
| R6   | Stump Puzzle  | The M1 puzzle room, extended: push two stumps onto root plates to open the Root Key alcove. A pushable stump can also block a Glowcap's line.                                                                               |
| R7   | Shortcut      | A barred gate back to R1, opened from this side only (mid-point shortcut). A rest spot with copper and iron veins.                                                                                                          |
| R8   | Bramble Den   | Miniboss: Old Bramblehide. Phase 1: charges with a long tell. Phase 2 (at 50%): calls three boarlets and roots burst from marked tiles (arena hazard). 60 to 90 s at par.                                                   |
| R9   | Root Heart    | Secret, return visit: a root wall that breaks only to a heavy hit (Heavy Arms Overhead, or a Stone spell, neither likely on a first visit). Holds the Unarmed manual (a carved post), a fragment slot (DM-F07) and a chest. |

Exit: a one-way drop from R8 to the downs near the entrance (as the M1 cave's way back). Daily respawn. Solved stays solved.

Non-combat route: R3b and a Stealth or Athletics pass through R5 (a crack in the wall at Athletics 10 skips the arena). The boss is still fought or, for this cave only, can be fled past to the drop once Phase 2 begins (no boss reward, the den chest stays shut).

Tuning acceptance (POW-M4-21): fight-sim win rate for the bare kit under 20%, for the target loadout 65 to 80%, read as the two hard fights (R5, R8) with a rest at R7. The 12 to 18 minutes is a person's first clear, checked in the Gate G4 playtest, not a bot time (a perfect bot run is about 6 minutes).

### The Undermill

Under Millbrook's mill. **Idea:** water level. Sluice wheels raise and lower water across rooms; low water opens paths, high water floats crates to new ledges. Tide techniques fill basins as a second way to set levels. Boss: the Millrace Eel, who strikes from the flooded channel and must be fought at low water (or kept out with the sluices). Return secret: a drained cistern only reachable with the Tide band 15 Undertow pulling a float. 25 to 35 minutes.

### Stonecrop Deeps

Old quarry galleries. **Idea:** weight. Pressure plates held by carts, blocks and the player; Stone techniques' Earth Wall holds a plate too. Boss: the Foreman's Engine, a clockwork digger whose phases add rails it rides on. Non-combat route through the Deeps: Tinkering 15 jams the engine's gear (the boss still ends, as a puzzle). Return secret: a sealed vein behind a cart track that needs Mining 20. 25 to 35 minutes.

### Thornwall Pass (pass dungeon)

A briar-choked gorge with a ruined keep, the easy road west. **Idea:** cutting and growing. Briar walls burn (Ember), are cut (Heavy Arms) or grow aside (Mending on withered roots). Regional boss: **the Hedge Warden**, a briar-and-stone guardian, three phases (briar lash; thorn walls that split the arena; a rooted bloom that heals it unless burnt or cut). 3 to 5 minutes at par.

Non-combat resolution: **the Keeper's Bells.** Three bells hang on the gorge walls (reached by climbing, Athletics 20). The order to ring them is carved inside the keep and must be found. Rung in order, then a Performance song at rank 30 played at the Warden's root, it sleeps and the gate opens. Same reward as the fight, different title line.

Return secret: the keep's upper room, reached only by the Fernside climb from outside.

### Mini-dungeons (12)

| #   | Name                 | Where            | Idea (5 to 10 min)                                                                    |
| --- | -------------------- | ---------------- | ------------------------------------------------------------------------------------- |
| m1  | Inn Cellar           | Hearthford       | Grain Rat swarm, barrels to push into a choke point                                   |
| m2  | Badger Sett          | Fernside Edge    | Burrows, a sleeping sett mother, the back door west (section 7)                       |
| m3  | Old Watchtower       | Commons, west    | Climb floors, a crossbow trap that also hits creatures                                |
| m4  | Smugglers' Cove      | Reedmouth        | Tide timing, a cave that floods twice a day (in-game clock)                           |
| m5  | Drowned Chapel Crypt | Under the chapel | Light and dark, Barrow Bones, Mending makes them rest                                 |
| m6  | Fox Hollow           | Millbrook fields | A fox den maze, foxes steal an item and run                                           |
| m7  | The Sinkhole         | Hollow Downs     | One-way drops, find the way back up                                                   |
| m8  | Abandoned Kiln       | Stonecrop Rise   | Heat: stand too long near the vents and burn                                          |
| m9  | Hermit's Well        | Cairnmoor        | Descending rings, a hermit's notes (Deciphering XP)                                   |
| m10 | Shepherd's Barrow    | Hollow Downs     | A tomb with plates and a guardian that only wakes if you take the urn                 |
| m11 | Hive Hill            | Hollow Downs     | Thistle Wasp swarms, smoke (Smoke Pellet) calms them                                  |
| m12 | Lamp Tower           | Stonecrop Rise   | Light the lamp to see the cliff path; the key to the Fernside climb's last rest point |

### Field boss

**Hollowhorn**, an old ram the size of a cart, roams Cairnmoor and the high downs on a daily route. Territorial: it warns hard and long. Two phases. Can be avoided entirely by watching its route. Can be calmed instead of fought by Taming when M6 wires it (data authored now, effect pending).

## 9. People

About 15 named people. Schedules, homes and likes are authored now (POW-M4-12). Friendship arrives in M6.

| Name    | Role                     | Home / work                    | Teaches or tests                                                                                   |
| ------- | ------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Brin    | Shopkeeper               | Market street                  | Bartering Trial 15                                                                                 |
| Tobin   | Smith                    | Smithy                         | Smithing and Heavy Arms Trials 15, teaches Overhead                                                |
| Mara    | Outfitter and tailor     | Tailor                         | Tailoring Trial 15                                                                                 |
| Ilse    | Herbalist and apothecary | Apothecary                     | Alchemy and Mending Trials 15                                                                      |
| Hesper  | Innkeeper and cook       | Inn                            | Cooking, Foraging and Performance Trials 15, teaches Hum of Courage                                |
| Orla    | Gate guard               | Guard yard, west gate          | Blades, Polearms, Archery, Shieldcraft, Evasion Trials 15, teaches Polearm Lunge, Aimed Shot, Bash |
| Wren    | Scholar                  | Rune house                     | Teaches the six band 0 spells, Ember, Hexing, Enchanting and Deciphering Trials 15                 |
| Pilgrim | Wanderer                 | Square by day, chapel at night | Teaches Hide, Stealth Trial 15                                                                     |
| Pell    | Carpenter                | Carpentry                      | Woodworking and Logging Trials 15                                                                  |
| Juniper | Tinker                   | Tinker's shed                  | Tinkering Trial 15                                                                                 |
| Aldo    | Miller                   | Millbrook mill                 | Requests, the Undermill, Gale Trial 15                                                             |
| Tamsin  | Farmer's daughter        | Millbrook farm                 | Requests, Athletics and Unarmed Trials 15                                                          |
| Nessa   | Fisher                   | Reedmouth                      | Fishing and Tide Trials 15                                                                         |
| Garrick | Quarry foreman           | Stonecrop                      | Mining and Stone Trials 15, the Deeps                                                              |
| Old Fen | Hermit                   | Cairnmoor, the well            | Survival, Cartography and Delving Trials 15                                                        |
| Edda    | Reeve of Hearthford      | Bell tower house               | Threads, Renown                                                                                    |

The M3 givers (Orla, Wren, Hesper, Brin, the Pilgrim) keep their ids, Trials and requests when they move (POW-M4-12). The Smithing Trial is Tobin's and the Athletics Trial is Tamsin's (moved from Brin and the Pilgrim in PR #111).

Every wired skill has a rank 15 Trial here: 32 in all. Rank 30 Trials are not set in Dawnmeadow. Each later region's trainers set them (M8), so the step from 15 to 30 is one of the reasons to go west.

People follow their schedules by moving only while off screen: when an NPC's slot changes, it moves to its new place the next time the player cannot see either spot. Nobody walks the streets yet. Each named place has a tile rectangle in the region spec.

## 10. Requests and Threads

25 authored requests (POW-M4-12, absorbing the 20 Hearthford requests moved out of M3), 5 Threads. At least 8 have a non-combat solution (marked NC). `estMinutes` is the planning estimate.

| #   | Title (working)           | Giver   | Shape                                   | NC  | est |
| --- | ------------------------- | ------- | --------------------------------------- | --- | --- |
| r1  | Bread for the Road        | Hesper  | Gather wheat, bake at the inn           | NC  | 8   |
| r2  | Rats in the Cellar        | Hesper  | Clear m1 or set Snares                  | NC  | 10  |
| r3  | A Blade for Orla          | Orla    | Craft a tier 1 blade of Fine quality    | NC  | 12  |
| r4  | Moss for the Poultice     | Ilse    | Gather moss in the Commons              | NC  | 6   |
| r5  | The Boar at the Fence     | Tamsin  | Drive off or calm the boar              | NC  | 8   |
| r6  | Grist and Sluice          | Aldo    | Reach the first Undermill sluice        |     | 15  |
| r7  | Wool from the Downs       | Mara    | Shear (M6) or trade for wool            | NC  | 8   |
| r8  | The Lost Satchel          | Orla    | Recover the satchel in the Rootway      |     | 15  |
| r9  | Kindling for the Forge    | Tobin   | Fell 10 oaks                            | NC  | 8   |
| r10 | Copper for Pots           | Tobin   | Mine copper in the Rootway or Stonecrop |     | 10  |
| r11 | A Song for the Inn        | Hesper  | Perform at the inn at dusk              | NC  | 6   |
| r12 | Wasps in the Orchard      | Tamsin  | Smoke the hives or clear m11            | NC  | 10  |
| r13 | Nessa's Net               | Nessa   | Tailor a net from twine                 | NC  | 10  |
| r14 | The Crabs Took My Bait    | Nessa   | Clear the jetty of Reed Crabs           |     | 8   |
| r15 | Cart Wheels               | Garrick | Woodworking: two wheels                 | NC  | 10  |
| r16 | Lamp Oil for the Tower    | Garrick | Alchemy oil, light m12                  | NC  | 12  |
| r17 | Readings for Wren         | Wren    | Copy three carvings (Deciphering)       | NC  | 12  |
| r18 | The Bell Tower Clock      | Edda    | Tinker the tower clock                  | NC  | 12  |
| r19 | Moorhounds at Dusk        | Old Fen | Clear a pack or lead it off             |     | 12  |
| r20 | The Pilgrim's Errand      | Pilgrim | Carry a letter to the chapel at night   | NC  | 8   |
| r21 | Barrow Lights             | Edda    | Learn what the lights on the downs are  |     | 12  |
| r22 | Stock for the Stalls      | Brin    | Sell 10 crafted goods                   | NC  | 10  |
| r23 | A Pie for Aldo            | Aldo    | Cook a berry pie of Fine quality        | NC  | 8   |
| r24 | The Thornling at Fernside | Orla    | Deal with the tier 2 visitor            |     | 15  |
| r25 | Mend the Chapel Roof      | Pilgrim | Woodworking and a climb                 | NC  | 12  |

Threads (about 45 minutes each):

| #   | Thread               | Centered on     | Shape                                                                                                       |
| --- | -------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| t1  | The Mill Turns Again | Aldo, Millbrook | Restore the mill: sluice (Undermill), gears (Tinkering), sails (Tailoring). Ends with flour in Brin's shop. |
| t2  | Hearthford Watch     | Orla            | Three nights of watch duty at the gates. Ends with the guard yard opening its weapon rack.                  |
| t3  | The Quarry Strike    | Garrick         | The workers will not go down. Find out why (the Deeps), and settle it with a deal or the Engine.            |
| t4  | Wren's Missing Pages | Wren            | Pages of a study scattered across the region's POIs. Deciphering and Cartography.                           |
| t5  | The Reeve's Ledger   | Edda, Brin      | A trade route to Reedmouth. Bartering, a cart, and the coast road's first stretch.                          |

## 11. Singulars

Three (POW-M4-20). None is posted, hinted in a UI string, or marked on the map. Each starts from a trigger in the world.

| Singular            | Trigger                                                                         | Steps (sketch)                                                                                                    | Reward                                                              |
| ------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| The Crow's Due      | Give a shiny item to the crow on the scarecrow at Millbrook on 3 different days | Bring 7 different shiny things over 7 days; follow it at dusk; dig where it lands (Survival); read the book found | Hex technique's second source (design/11), a crow feather trinket   |
| Eight Beds of Straw | Sleep outdoors at 3 different wake points (W1 to W8)                            | Sleep at all eight, one per night; at the last, a bundle is left beside you                                       | The Wayfarer's Cloak (unique look, outdoor sleep gives half Rested) |
| The Cold Oven       | Use the cook pot in the empty house on the market street three times at dawn    | Find the baker's firebricks (Rootway R9, Deeps, Undermill); have Tobin set them (Smithing 10); bake at dawn       | The Baker's Peel (unique tool), a recipe with no other source       |

## 12. Points of interest (30)

| Kind     | Count | Examples                                                                                                                                                         |
| -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shrines  | 6     | River shrine (Tide manual), wayside chapel (Mending manual), Windmill Hill cairn (Gale manual), quarry camp altar (Stone manual), a roadside idol, a tree shrine |
| Vistas   | 6     | Windmill Hill, the sea cliffs, Stonecrop crane top, Cairnmoor ring, the Lark spring, the delta lookout                                                           |
| Wrecks   | 4     | A cart in the ditch, a fallen tower, a beached boat, a burnt barn                                                                                                |
| Hermits  | 4     | Old Fen's well, a painter on the cliffs, a beekeeper, a lost Traveler's camp (M5 fills it)                                                                       |
| Puzzles  | 6     | A stone circle that hums at dusk, a lever pond, a sundial, a hedge maze, a bell stone, a scarecrow line                                                          |
| Oddities | 4     | The "Kindling" manual in a burnt-out shed, the Old Mill loft (Light Feet manual), the inn cellar songsheet, the guardhouse notes (Lunge manual)                  |

The bake check (POW-M4-11) requires every land chunk to hold at least one discoverable: a POI, a node cluster, a secret, a vista or a settlement. A node cluster is two or more gathering nodes in the chunk, of kinds that suit its biome. The 30 POIs, the dungeons and the secrets cover the places worth a detour; node clusters cover the rest of the land (about 80 chunks), and they are where the region's gathering lives.

## 13. Secrets and lore slots

Return-visit secrets: one per dungeon (section 8).

Region secrets (at least a fifth reached by a non-combat skill, design/02):

| Secret                      | How                                     |
| --------------------------- | --------------------------------------- |
| The hedge maze centre       | Cartography reveal, or patience         |
| The sundial door            | Stand on it at noon on a clear day      |
| The bell stone              | A Performance song at rank 15           |
| The Lark spring grotto      | Swim against the current (Athletics 20) |
| The beekeeper's back garden | Bring a Fine honey cake                 |
| The painter's last canvas   | Visit the cliff at dawn, dusk and night |

Lore fragment slots (content arrives in M10, POW-M4-11 places empty markers): DM-F01 Wren's study, DM-F02 the bell tower, DM-F03 the Pilgrim's bench, DM-F04 the mill loft, DM-F05 the chapel crypt, DM-F06 the Shepherd's Barrow, DM-F07 Rootway R9, DM-F08 the Undermill cistern, DM-F09 Stonecrop Deeps sealed vein, DM-F10 Thornwall keep upper room, DM-F11 the stone circle, DM-F12 the Cairnmoor ring, DM-F13 Hermit's Well bottom, DM-F14 the sundial door, DM-F15 the lit window sightline, DM-F16 the beached boat, DM-F17 the hedge maze centre, DM-F18 the Lark spring grotto.

## 14. Pacing

Planning estimates. `tools/pacing-ledger` (POW-M4-12) sums the authored `estMinutes` and fails CI if Dawnmeadow drops under budget.

| Source                        | Count | Minutes each | Minutes                |
| ----------------------------- | ----- | ------------ | ---------------------- |
| Dungeons                      | 4     | 15 to 40     | 120                    |
| Mini-dungeons                 | 12    | 8            | 96                     |
| Points of interest            | 30    | 4            | 120                    |
| Requests                      | 25    | about 10     | 260                    |
| Threads                       | 5     | 45           | 225                    |
| Rank 15 Trials                | 32    | 6            | 192                    |
| Singulars                     | 3     | 30           | 90                     |
| Field boss, Waystones, routes |       |              | 90                     |
| **Authored total**            |       |              | **1,193 (about 20 h)** |

The last line is Hollowhorn (30), the six Waystones (5 each, 30) and the two harder routes west, the Fernside climb and the badger tunnels (15 each, 30).

First pass target (about 6 hours): wake, Hearthford, the Rootway, a handful of requests, one Thread, one more dungeon, the pass. Regional 100% target (about 20 hours): the authored total plus skill time toward the Trials.
