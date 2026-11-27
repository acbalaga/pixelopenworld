# 13 Life content: crops, animals, fish, tameables, furniture, friendship, the first festival

The content plan for M6 (POW-M6-01). Rules live in 05-life-systems. This doc fixes what exists, how many, and where. Every number here is a default that the ticket puts in `src/content/balance/`. Ids are final once a ticket ships them (save data refers to them).

Time words: an **in-game day** is 48 real minutes, a **season** is 7 in-game days (5.6 real hours), a **year** is 22.4 real hours. The world clock runs from trusted time whether the game is open or not (tech/02), so everything in this doc that grows or produces does it on the world clock, online or offline, by the same formula.

## 1. Where the life is in Dawnmeadow

| Place               | What                                                                                                | Opens                                          | Ticket |
| ------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------ |
| The reeve's field   | 6 leased plots (2 x 3 tiles each) and, from M6-03, 2 pen slots, just outside Hearthford's east gate | Talk to Edda. Weekly lease in coin             | 02, 03 |
| Inn room            | Upstairs at the inn: bed, chest, 4 x 4 tile floor for furniture                                     | Free, from the start                           | 07     |
| House plots         | 2 empty lots inside Hearthford's walls (east side), fixed footprint, 8 x 6 tile interior            | Renown and coin                                | 13     |
| Homestead           | A larger plot outside town, about 2 x 2 chunks, farm plots, pens, workshops, a Waystone             | After the Hedge Warden is resolved (any route) | 08     |
| Market street stall | One of the two day stalls, rentable on days it is free                                              | Stall license                                  | 11     |
| The square fountain | New prop beside the well. Wishes move to it                                                         | Built by M6-10                                 | 10     |

The field and the homestead are the only outdoor farmland. A house plot has a 2 x 2 tile kitchen garden (2 small plots) in its yard.

## 2. Crops (30, tiers 1 to 4)

Growth is in in-game days on the world clock. **Regrows** means after the first harvest the plant fruits again after that many days, until its season ends. **Seasons** are when it can be planted. A crop in the ground when its season ends stops growing and waits (it never dies). Winter has few crops by design.

| #   | Crop        | Tier | Seasons          | Days | Regrows | Gives                          | Seed source        |
| --- | ----------- | ---- | ---------------- | ---- | ------- | ------------------------------ | ------------------ |
| 1   | Turnip      | 1    | spring, autumn   | 1    |         | turnip                         | Brin               |
| 2   | Radish      | 1    | spring           | 1    |         | radish                         | Brin               |
| 3   | Potato      | 1    | spring, autumn   | 2    |         | potato                         | Brin               |
| 4   | Pea         | 1    | spring           | 2    | 1       | pea pod                        | Brin               |
| 5   | Leek        | 1    | spring, autumn   | 2    |         | leek                           | Brin               |
| 6   | Flax        | 1    | spring, summer   | 2    |         | `item.flax_fiber` (exists)     | Brin               |
| 7   | Sunwort     | 1    | not winter       | 1    |         | `item.sunwort` (exists)        | Ilse               |
| 8   | Dewmint     | 1    | spring, summer   | 1    |         | `item.dewmint` (exists)        | Ilse               |
| 9   | Wheat       | 2    | summer, autumn   | 3    |         | wheat (Aldo mills it to flour) | Aldo               |
| 10  | Barley      | 2    | summer           | 3    |         | barley                         | Aldo               |
| 11  | Onion       | 2    | summer           | 2    |         | onion                          | Brin               |
| 12  | Carrot      | 2    | spring, autumn   | 2    |         | carrot                         | Brin               |
| 13  | Cabbage     | 2    | autumn           | 3    |         | cabbage                        | Tamsin             |
| 14  | Tomato      | 2    | summer           | 3    | 1       | tomato                         | Tamsin             |
| 15  | Runner bean | 2    | summer           | 2    | 1       | bean                           | Tamsin             |
| 16  | Strawberry  | 2    | spring           | 3    | 1       | strawberry                     | Tamsin             |
| 17  | Corn        | 3    | summer           | 4    |         | corn                           | Market             |
| 18  | Pumpkin     | 3    | autumn           | 4    |         | pumpkin (giant crop, see 2.2)  | Tamsin, heart 3    |
| 19  | Pepper      | 3    | summer           | 3    | 1       | pepper                         | Market             |
| 20  | Garlic      | 3    | spring           | 3    |         | garlic                         | Hesper             |
| 21  | Beet        | 3    | autumn           | 3    |         | beet                           | Market             |
| 22  | Hops        | 3    | summer           | 4    | 2       | hops                           | Hesper, heart 2    |
| 23  | Glowcap bed | 3    | any (shade only) | 3    |         | `item.glowcap` (exists)        | Ilse, heart 2      |
| 24  | Woad        | 3    | summer           | 3    |         | woad leaf (blue dye)           | Mara               |
| 25  | Sweet melon | 4    | summer           | 5    |         | melon (giant crop)             | Market, Farming 30 |
| 26  | Saffron     | 4    | autumn           | 5    |         | saffron (spice, high value)    | Market, Farming 30 |
| 27  | Frost kale  | 4    | winter           | 4    |         | kale                           | Tamsin, heart 4    |
| 28  | Frostroot   | 4    | winter           | 5    |         | frostroot                      | Old Fen            |
| 29  | Artichoke   | 4    | spring           | 5    |         | artichoke                      | Market, Farming 30 |
| 30  | Honeyvine   | 4    | autumn           | 6    | 2       | honeygrape                     | Market, Farming 40 |

Seeds also come from `item.seed_pod` (exists): planting an unknown pod grows a random tier 1 or 2 crop of the season and teaches its seed. That is the farming version of experimenting.

### 2.1 Growth rules

- Stages: seed, sprout, young, ripe (4 sprites per crop, generated from data). Ripe crops wait forever.
- **Watering:** a watered plot grows at full rate for one in-game day from the watering. Unwatered time grows at `dryRate` 0.5. Rain or storm on a day waters every outdoor plot for that day. Weather per day is a pure function of seed and day index (`weatherOn`), so offline rain is exact.
- **Soil quality** 0 to 3 per plot. Each harvest of the same crop family on the same plot lowers it by 1 (min 0). A different family, a fallow day, or fertilizer raises it by 1 (max 3). Soil adds to harvest quantity and quality: +0, +10%, +25%, +40% yield and the same steps on the quality roll. Families: root, leaf, fruit, grain, herb.
- **Fertilizer:** compost (Survival or Alchemy, from scraps and `item.moss_tuft`), and from M6-03 manure from pens. Raises soil by 1, or, applied to a growing crop, `fertBoost` +25% growth rate until harvest.
- **Quality** of a harvest rolls Common to Superior from Farming rank against crop tier plus soil. Masterwork only from a giant crop.
- **Harvest XP** on the `harvest` event (new). First harvest of each crop pays the first-time bonus.

### 2.2 Giant crops

Pumpkin and sweet melon only. Four ripe plants of the same giant crop in a 2 x 2 square, with soil 3 on all four, have `giantChance` 15% (Farming 50: 30%) to merge into one giant at harvest time. A giant gives 12 of the crop at Masterwork and counts for the festival's largest-crop contest.

## 3. Animals (8, Husbandry)

Animals live in pens (2 pen slots at the reeve's field, more on the homestead). A pen holds one kind and up to 4 animals. Goods appear once per in-game day if the animal was fed. **Mood** 0 to 100 rises with feeding, petting (once a day), brushing and a clean pen, and falls slowly without attention. **Bond** 0 to 5 hearts grows from days at good mood. Neglect lowers output only. Animals never die, sicken or leave.

| Animal     | Bought from    | Feed                 | Daily good                                      | Bond 3+ bonus           |
| ---------- | -------------- | -------------------- | ----------------------------------------------- | ----------------------- |
| Hen        | Tamsin         | grain or seeds       | egg                                             | 1 in 4: large egg       |
| Duck       | Nessa          | grain or greens      | duck egg                                        | sometimes a feather     |
| Rabbit     | Tamsin         | greens               | rabbit wool (every 2 days)                      | fine rabbit wool        |
| Sheep      | Tamsin         | hay                  | `item.wool_tuft` (every 2 days)                 | 2 tufts                 |
| Goat       | Aldo           | hay or greens        | goat milk                                       | 1 in 4: large goat milk |
| Cow        | Aldo           | hay                  | milk                                            | 1 in 4: large milk      |
| Pig        | Aldo           | scraps or grain      | finds a truffle on 1 day in 3, outdoors         | truffle every 2 days    |
| Silk moths | Mara (a frame) | mulberry leaf (Mara) | silk floss (spins to `item.silk_cloth`, exists) | fine silk floss         |

Output formula, per animal per in-game day: `goods = base * moodFactor * (fed ? 1 : 0)`, where `moodFactor` is 0.5 at mood 0 rising in a straight line to 1 at mood 60 and above. A day without feed gives nothing that day and costs mood. **Offline:** each pen has a feed trough (holds 7 days of feed). Offline days draw from the trough; mood decays at `offlineMoodDecay` per day to a floor of 30, never lower. So a week away gives fewer goods, never a loss.

Hay comes from cutting grass on the field and homestead (sickle), or from Aldo. Breeding and bonds beyond 5 hearts are the 30+ theme (later).

## 4. Fish (regions 1 to 4)

The full game has 96 species (10-content-budget). Regions 1 to 4 hold 46. Only Dawnmeadow's are built in M6 (POW-M6-05). The rest arrive with their regions in M8 and must not be named in chat before then (D25).

**Water types:** river, pond, marsh, estuary, sea, lake, hot spring. Each fish has a water type, a weight in its table, a size range (for the derby and the records page), and optional time, weather and season conditions. **Difficulty** 1 to 5 sets the tension band width and how hard the fish pulls.

### Dawnmeadow (14 plus 1 legendary)

| Fish          | Water   | When                         | Difficulty | Notes                         |
| ------------- | ------- | ---------------------------- | ---------- | ----------------------------- |
| River fish    | river   | any                          | 1          | `item.fish_river` (exists)    |
| Silverfin     | river   | day                          | 2          | `item.fish_silver` (exists)   |
| Minnow        | river   | any                          | 1          | bait                          |
| Brown trout   | river   | dawn, dusk                   | 2          |                               |
| Chub          | river   | day                          | 1          |                               |
| Perch         | pond    | day                          | 2          |                               |
| Carp          | pond    | any                          | 2          |                               |
| Tench         | pond    | rain                         | 3          |                               |
| Golden carp   | pond    | summer, day                  | 4          | rare                          |
| Pike          | river   | dusk, night                  | 3          |                               |
| Bog loach     | marsh   | night                        | 2          |                               |
| Reed eel      | marsh   | night, rain                  | 3          |                               |
| Flounder      | estuary | any                          | 2          | Reedmouth                     |
| Sea bass      | estuary | storm                        | 4          | Reedmouth                     |
| **Old Gnarl** | pond    | Millbrook pond, dusk, autumn | 5          | legendary pike, once per save |

### Regions 2 to 4 (built in M8, names fixed now)

- **Whisperwood (8):** fog trout, mossback, root carp, glass minnow, lantern fish (night), spotted grayling, shadow pike, legendary **the Fogking**.
- **Saltreach (16):** mackerel, herring, sardine, sea bream, red snapper, cod, crab (pot), shrimp (net), squid (night), octopus, tuna (storm), swordfish, pufferfish, moonfish (night), sunfish, legendary **Old Brine**.
- **Ironvale (8):** char, cave fish, ember carp (hot spring), stonefish, mountain trout, sulfur eel (hot spring), ice perch (winter), legendary **the Furnace Koi**.

## 5. Tameables (8 in Dawnmeadow)

The full game has 48 tameable species. Dawnmeadow has 8, all from creatures that exist today. Regions 2 to 4 add 8 more with their regions (M8). **Condition** is what taming needs beyond the right food at a calm moment.

| Creature      | Role                     | Favorite food | Condition                                         |
| ------------- | ------------------------ | ------------- | ------------------------------------------------- |
| Meadow hare   | sniff                    | carrot        | You have not hurt a hare today                    |
| Hedge sparrow | sniff (scout)            | seeds         | Dawn only                                         |
| Fox           | sniff, fight             | roast meat    | Dusk or night, and you are not sprinting          |
| Downs ram     | ride, carry              | hay           | Weakened below half Health first                  |
| Moorhound     | fight, ride              | raw meat      | Fog or rain, on the moor                          |
| Boarlet       | gather (truffles, roots) | red berries   | Its mother (bramble boar) is not near             |
| Burrow mole   | gather (ore, clay)       | grub          | Found at its burrow at dawn, then fed three times |
| Crag hawk     | fight                    | river fish    | Taming 15. Clear weather, from a high spot        |

**Mounts:** downs ram (fast on meadow and road, slow in woods) and moorhound (steady on any ground, best on the moor). Mount speed is capped at `mountMaxSpeed` so the 5 x 5 chunk window always loads ahead of the rider.

## 6. Furniture (about 60)

Crafted at the carpentry, the tailor, the smithy or the tinker bench, or bought. Footprint in tiles. **Function** means it does something.

| Group                 | Pieces                                                                                                                                         |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Beds (4)              | straw bed, oak bed, quilted bed, four-poster. Sleeping in your own bed gives Rested (better beds last longer)                                  |
| Storage (5)           | small chest, big chest, wardrobe (gear), pantry (food only, holds 200), seed box. All are function                                             |
| Stations (7)          | cook pot, oven, workbench, loom, small anvil, alchemy shelf, tinker table. Each is a working station for its craft at tier 1 to 2              |
| Tables and seats (10) | stool, bench, chair, armchair, rocking chair, small table, dining table, desk, side table, tea table                                           |
| Light (6)             | candle, lantern, oil lamp, chandelier, fireplace (warmth, a cozy Rested bonus), glowcap jar                                                    |
| Display (6)           | trophy stand (shows a boss trophy), fish tank (shows a caught fish), bookshelf (holds found lore, M10 fills it), weapon rack, banner, pedestal |
| Rugs and walls (8)    | 4 rugs, 2 wallpapers, 2 wall hangings, all in the master palette                                                                               |
| Plants (6)            | potted fern, potted sunwort, flower box, small tree, hanging basket, cactus. A planted pot grows a tier 1 herb slowly                          |
| Decor (8)             | clock, mirror (avatar look changes, like the inn mirror), music box, painting, globe, vase, dried flowers, rocking horse                       |

Rules (POW-M6-13): a tile grid, rotate in 90 degree steps, no piece blocks the door tile or the tile in front of it, no overlap, rugs sit under other pieces, wall pieces only on wall tiles. 60 pieces: 53 plus the 7 stations.

## 7. Friendship content plan

Every named Dawnmeadow person (16, 01-dawnmeadow section 9) gets a five-heart track.

- **Points:** a talk (once per in-game day), a liked gift (+), a loved gift (++), a disliked gift (a small minus), a finished request of theirs, and showing up at the festival. Thresholds and amounts in `balance/people.ts`. Points never decay.
- **Likes:** each person has 3 loved items, 5 liked items, 2 disliked items, all from items that exist by the end of M6. The existing `likes` lists become the liked set.
- **Heart events:** a short scene (4 to 8 lines, clear text, no bitmap font) at 2 hearts and at 4 hearts for each person: 32 scenes. A scene plays the next time the player talks to them after crossing the threshold, at a time and place the scene names.
- **Unlocks**, per person: heart 1, their shop or service is 5% cheaper (if they have one); heart 3, a recipe or seed; heart 5, help (Hesper minds a stall for a day, Tobin repairs for free once a day, Pell builds one furniture piece a season, and so on, one line per person in the ticket data).
- **Deed memory:** each person has at least 2 lines that name a deed the player did (a boss down, a Trial passed, a festival win, a giant crop).
- **Partners:** 4 people can become a partner: **Pell** (carpenter), **Nessa** (fisher), **Juniper** (tinker), **Mara** (tailor). Also any Traveler at Close Friend (07). A partner needs 5 hearts, a third heart event (the partner scene), and a hearth token (Woodworking, tier 2). A partner moves into the player's house plot (needs POW-M6-13) and has a daily routine there: one morning gift, waters the kitchen garden, chats, and goes to work on their own schedule. Ending it is allowed, kind, and loses nothing. Wholesome and optional: no gender restriction, no jealousy mechanics, nothing romantic beyond warmth.
- People who carry the hidden layer keep their lines within the delivery rules (08). The M6-09 executor reads 08 for them.

## 8. The autumn harvest fair (festival 1)

- **When:** autumn day 4 of each in-game year, one in-game day long (48 real minutes, dawn to night). The calendar (POW-M5-11) shows it, with the next real start time computed from the world clock. It comes back every 22.4 real hours. Missing it loses nothing.
- **Where:** Hearthford. Bunting, stalls and a stage in the square. The fountain (new) is the fair's center.
- **Crowd:** Travelers who are online that day go to Hearthford with `festivalPull` 0.7 for their social activity, and dance (`festivalDanceBoost`, POW-M5-27). Chat has fair templates.
- **Contests** (one entry each per fair, scored by rules the ticket tests):
  - **Cooking:** enter one dish. Score from dish tier, quality, and whether the three judges (Hesper, Edda, a Traveler) like it.
  - **Largest crop:** enter one crop. Score from quality and soil, giants always beat non-giants, heaviest giant wins.
  - **Fishing derby:** from dawn to dusk, the biggest fish caught counts. Size rolls in each fish's range.
  - **Music stage:** one song. Score from the Performance rhythm input and the song's tier.
  - **Pit bracket:** three bouts in the Pit hall (POW-M6-21) against Travelers, M5-12 duel rule.
  - **Race:** a lap of Hearthford's wall. Athletics time against Travelers' times.
- **Prizes:** fair tokens (1st 5, 2nd 3, 3rd 2, entering 1) and a ribbon (cosmetic, shown on the trophy stand). Tokens buy limited goods at the fair stall: seeds for pumpkin and honeyvine, 6 fair furniture pieces (bunting, scarecrow, harvest wreath, lantern string, hay bale seat, pumpkin lamp) and a cosmetic hat. Tokens are a currency with a ledger entry and a bound (at most 30 per fair).
- The other three festivals (spring, summer, winter) are data entries with their hub and a placeholder until their regions are baked (M8, M9). M6 builds the framework so a festival is a data record: day, hub, dressing, contests, stall.
