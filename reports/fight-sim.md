# Fight simulator report

Made by `npm run fight-sim` (POW-M3-12). Do not edit by hand. Headless fights on the real sim: 20 seeds per cell, 8640 fights. The avatar stands at the start of a fight with the creatures a tile or so away. The policy is the same for every build: lock the nearest, close in, swing, cast the best affordable spell, eat when hurt, and dodge a blow as its telegraph runs out (`tools/fight-sim/harness.ts`). The seed varies the starting distance and the first swing, so each cell is a spread.

- Par ranks (`balance/skills.ts`): tier 1 is 0, tier 2 is 15. Each build wears the best gear of its tier the content has. Mages carry Focus potions and everyone carries bread; both count under Food. Every family has a tier 2 weapon.
- Targets (design/04): common 4 to 8 s, elite 20 to 40 s, miniboss 60 to 90 s, regional boss 180 to 300 s, with 0.75 s of give on either side for a median of a spread. Targets are checked at par: a build of the creature's own tier against one creature. The cave miniboss is the gate out of the first map, so it is met by a tier 2 build (rank 15, tier 2 gear).
- **Outside the first map.** The 4 tier 2 creatures belong to Whisperwood (`content/world/regions.ts`), which has no map yet. They are tuned for rank 15 and tier 2 gear, and they are not kind to anyone else: see the packs below.
- **Gaps between builds are accepted** (owner decision). A family that loses a pack fight that another wins is not a defect: each build is meant to help somewhere in its progression, and these tables show where it does not yet. The thresholds bound the average, not each family.
- Damage taken is Health lost. Stamina and Focus are whole points spent. Fell is the share of fights where the avatar went down before the creatures did.

**At par:** 181 of 192 cells are inside their target band. 11 are outside: 11 listed with a reason, 0 unlisted. A prepared character fell in 0 of 3520 fights against one common creature. Against a pack, prepared builds fell in 18% of fights and unprepared ones (tier 1 gear, rank 0) in 39%. 391 of 8640 fights over all ended in a fall.

## Tier 1 (par rank 0)

| Build | Creature | TTK median s | TTK p90 s | Target s | Damage taken | Stamina | Focus | Food | Deaths | At par |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Blades (sword) | Meadow Hare (critter) | 2.2 | 2.6 | 1 to 4 | 0 | 30 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Hedge Sparrow (critter) | 1.0 | 2.0 | 1 to 4 | 0 | 5 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Moor Wisp (critter) | 2.8 | 2.8 | 1 to 4 | 0 | 23 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Downs Ram (common) | 8.0 | 8.6 | 4 to 8 | 2 | 68 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Grain Rat (critter) | 1.0 | 2.0 | 1 to 4 | 0 | 5 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Fox (common) | 4.7 | 6.8 | 4 to 8 | 1 | 31 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Strawman (common) | 5.7 | 6.6 | 4 to 8 | 2 | 44 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Burrow Mole (common) | 6.0 | 9.5 | 4 to 8 | 2 | 63 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Thistle Wasp (critter) | 1.0 | 2.2 | 1 to 4 | 0 | 8 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Barrow Bones (common) | 6.4 | 7.5 | 4 to 8 | 2 | 59 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Reed Crab (common) | 7.4 | 8.1 | 4 to 8 | 1 | 68 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Marsh Leech (common) | 4.6 | 5.1 | 4 to 8 | 0 | 18 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Rubblet (common) | 6.5 | 7.0 | 4 to 8 | 1 | 50 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Crag Hawk (common) | 4.3 | 4.9 | 4 to 8 | 2 | 20 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Moorhound (common) | 6.0 | 6.4 | 4 to 8 | 2 | 46 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Thornling Scout (common) | 6.5 | 9.5 | 4 to 8 | 7 | 50 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Hollowhorn (miniboss) | 60.7 | 82.3 | 60 to 90 | 55 | 666 | 0 | 3.1 | 3 | ok |
| Blades (sword) | Mossling (common) | 5.2 | 6.0 | 4 to 8 | 1 | 41 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Spitbloom (common) | 4.7 | 5.8 | 4 to 8 | 0 | 24 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Bramble Boar (common) | 6.3 | 6.9 | 4 to 8 | 5 | 63 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Thornling (common) | 8.4 | 9.9 | 4 to 8 | 6 | 94 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Fogcap (common) | 6.5 | 7.2 | 4 to 8 | 1 | 51 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Cinderback Boar (common) | 8.2 | 10.2 | 4 to 8 | 18 | 104 | 0 | 0.1 | 0 | n/a |
| Blades (sword) | Old Bramblehide (miniboss) | 112.6 | 145.7 | 60 to 90 | 58 | 860 | 0 | 3.2 | 4 | n/a |
| Polearms (spear) | Meadow Hare (critter) | 1.3 | 2.5 | 1 to 4 | 0 | 13 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Hedge Sparrow (critter) | 1.3 | 2.0 | 1 to 4 | 0 | 5 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Moor Wisp (critter) | 2.8 | 3.2 | 1 to 4 | 0 | 26 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Downs Ram (common) | 7.7 | 8.1 | 4 to 8 | 0 | 53 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Grain Rat (critter) | 0.7 | 1.3 | 1 to 4 | 0 | 3 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Fox (common) | 5.0 | 6.8 | 4 to 8 | 0 | 29 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Strawman (common) | 5.3 | 5.7 | 4 to 8 | 0 | 23 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Burrow Mole (common) | 7.2 | 13.0 | 4 to 8 | 1 | 70 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Thistle Wasp (critter) | 1.3 | 2.0 | 1 to 4 | 0 | 5 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Barrow Bones (common) | 5.9 | 6.4 | 4 to 8 | 0 | 43 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Reed Crab (common) | 5.8 | 5.9 | 4 to 8 | 0 | 20 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Marsh Leech (common) | 3.8 | 4.5 | 4 to 8 | 0 | 3 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Rubblet (common) | 6.7 | 7.1 | 4 to 8 | 0 | 18 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Crag Hawk (common) | 4.6 | 5.8 | 4 to 8 | 1 | 26 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Moorhound (common) | 6.2 | 6.5 | 4 to 8 | 0 | 48 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Thornling Scout (common) | 6.5 | 7.1 | 4 to 8 | 0 | 48 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Hollowhorn (miniboss) | 69.6 | 99.2 | 60 to 90 | 68 | 709 | 0 | 4.0 | 5 | ok |
| Polearms (spear) | Mossling (common) | 5.4 | 5.8 | 4 to 8 | 0 | 45 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Spitbloom (common) | 6.1 | 7.0 | 4 to 8 | 1 | 56 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Bramble Boar (common) | 6.4 | 8.1 | 4 to 8 | 2 | 70 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Thornling (common) | 8.0 | 8.9 | 4 to 8 | 0 | 65 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Fogcap (common) | 8.4 | 9.0 | 4 to 8 | 3 | 98 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Cinderback Boar (common) | 8.5 | 10.1 | 4 to 8 | 5 | 101 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Old Bramblehide (miniboss) | 104.7 | 104.7 | 60 to 90 | 96 | 1486 | 0 | 6.7 | 18 | n/a |
| Heavy Arms (maul) | Meadow Hare (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Hedge Sparrow (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Moor Wisp (critter) | 2.0 | 2.0 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Downs Ram (common) | 7.0 | 7.2 | 4 to 8 | 4 | 44 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Grain Rat (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Fox (common) | 4.5 | 6.3 | 4 to 8 | 1 | 15 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Strawman (common) | 5.3 | 6.2 | 4 to 8 | 1 | 30 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Burrow Mole (common) | 6.6 | 8.2 | 4 to 8 | 3 | 55 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Thistle Wasp (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Barrow Bones (common) | 5.2 | 6.6 | 4 to 8 | 1 | 25 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Reed Crab (common) | 5.3 | 7.1 | 4 to 8 | 2 | 30 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Marsh Leech (common) | 3.7 | 4.7 | 4 to 8 | 0 | 3 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Rubblet (common) | 7.0 | 7.4 | 4 to 8 | 2 | 48 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Crag Hawk (common) | 3.7 | 4.7 | 4 to 8 | 0 | 9 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Moorhound (common) | 5.2 | 6.2 | 4 to 8 | 3 | 28 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Thornling Scout (common) | 4.8 | 8.6 | 4 to 8 | 5 | 35 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Hollowhorn (miniboss) | 50.7 | 93.4 | 60 to 90 | 45 | 449 | 0 | 2.1 | 1 | listed |
| Heavy Arms (maul) | Mossling (common) | 4.3 | 5.5 | 4 to 8 | 1 | 24 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Spitbloom (common) | 5.4 | 6.4 | 4 to 8 | 1 | 30 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Bramble Boar (common) | 6.1 | 8.8 | 4 to 8 | 4 | 58 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Thornling (common) | 7.7 | 8.0 | 4 to 8 | 9 | 45 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Fogcap (common) | 7.0 | 7.3 | 4 to 8 | 4 | 41 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Cinderback Boar (common) | 8.4 | 11.2 | 4 to 8 | 7 | 90 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Old Bramblehide (miniboss) | 59.7 | 104.7 | 60 to 90 | 72 | 646 | 0 | 4.3 | 11 | n/a |
| Archery (bow) | Meadow Hare (critter) | 2.1 | 2.3 | 1 to 4 | 0 | 24 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Hedge Sparrow (critter) | 1.8 | 2.5 | 1 to 4 | 0 | 25 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Moor Wisp (critter) | 3.0 | 3.1 | 1 to 4 | 1 | 23 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Downs Ram (common) | 7.0 | 7.8 | 4 to 8 | 3 | 49 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Grain Rat (critter) | 1.6 | 1.9 | 1 to 4 | 1 | 21 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Fox (common) | 4.9 | 5.4 | 4 to 8 | 0 | 29 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Strawman (common) | 4.9 | 5.1 | 4 to 8 | 1 | 24 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Burrow Mole (common) | 12.3 | 18.7 | 4 to 8 | 4 | 126 | 0 | 0.0 | 0 | listed |
| Archery (bow) | Thistle Wasp (critter) | 2.0 | 2.4 | 1 to 4 | 0 | 29 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Barrow Bones (common) | 5.8 | 6.1 | 4 to 8 | 2 | 50 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Reed Crab (common) | 5.6 | 7.9 | 4 to 8 | 1 | 33 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Marsh Leech (common) | 4.7 | 4.9 | 4 to 8 | 0 | 29 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Rubblet (common) | 5.6 | 6.2 | 4 to 8 | 2 | 25 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Crag Hawk (common) | 4.4 | 4.6 | 4 to 8 | 2 | 24 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Moorhound (common) | 5.7 | 6.1 | 4 to 8 | 1 | 56 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Thornling Scout (common) | 4.8 | 6.0 | 4 to 8 | 1 | 30 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Hollowhorn (miniboss) | 48.6 | 50.0 | 60 to 90 | 33 | 360 | 0 | 0.3 | 0 | listed |
| Archery (bow) | Mossling (common) | 5.8 | 6.9 | 4 to 8 | 1 | 54 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Spitbloom (common) | 7.8 | 9.2 | 4 to 8 | 1 | 65 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Bramble Boar (common) | 5.9 | 7.5 | 4 to 8 | 1 | 71 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Thornling (common) | 8.0 | 9.0 | 4 to 8 | 5 | 75 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Fogcap (common) | 13.4 | 15.8 | 4 to 8 | 6 | 188 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Cinderback Boar (common) | 7.8 | 9.0 | 4 to 8 | 5 | 85 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Old Bramblehide (miniboss) | 66.7 | 105.3 | 60 to 90 | 16 | 545 | 0 | 0.1 | 0 | n/a |
| Unarmed (cloth wraps) | Meadow Hare (critter) | 2.2 | 2.5 | 1 to 4 | 0 | 24 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Hedge Sparrow (critter) | 1.6 | 1.9 | 1 to 4 | 0 | 23 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Moor Wisp (critter) | 2.6 | 2.8 | 1 to 4 | 0 | 20 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Downs Ram (common) | 7.9 | 9.2 | 4 to 8 | 5 | 76 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Grain Rat (critter) | 1.6 | 1.9 | 1 to 4 | 1 | 19 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Fox (common) | 6.4 | 12.7 | 4 to 8 | 2 | 70 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Strawman (common) | 5.9 | 7.5 | 4 to 8 | 1 | 59 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Burrow Mole (common) | 6.5 | 8.2 | 4 to 8 | 2 | 71 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Thistle Wasp (critter) | 2.0 | 2.2 | 1 to 4 | 1 | 21 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Barrow Bones (common) | 6.7 | 7.4 | 4 to 8 | 2 | 65 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Reed Crab (common) | 6.4 | 8.3 | 4 to 8 | 2 | 56 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Marsh Leech (common) | 4.3 | 6.1 | 4 to 8 | 1 | 33 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Rubblet (common) | 7.7 | 9.0 | 4 to 8 | 1 | 85 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Crag Hawk (common) | 4.5 | 4.8 | 4 to 8 | 1 | 25 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Moorhound (common) | 6.1 | 6.8 | 4 to 8 | 3 | 55 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Thornling Scout (common) | 11.0 | 16.1 | 4 to 8 | 9 | 123 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Hollowhorn (miniboss) | 106.2 | 153.6 | 60 to 90 | 57 | 861 | 0 | 4.0 | 6 | listed |
| Unarmed (cloth wraps) | Mossling (common) | 6.2 | 8.0 | 4 to 8 | 2 | 74 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Spitbloom (common) | 5.3 | 6.3 | 4 to 8 | 0 | 31 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Bramble Boar (common) | 9.1 | 11.7 | 4 to 8 | 5 | 120 | 0 | 0.0 | 0 | listed |
| Unarmed (cloth wraps) | Thornling (common) | 12.1 | 13.5 | 4 to 8 | 17 | 188 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Fogcap (common) | 8.0 | 9.0 | 4 to 8 | 2 | 89 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Cinderback Boar (common) | 13.0 | 19.9 | 4 to 8 | 13 | 204 | 0 | 0.1 | 0 | n/a |
| Unarmed (cloth wraps) | Old Bramblehide (miniboss) | 82.2 | 125.1 | 60 to 90 | 47 | 771 | 0 | 3.1 | 5 | n/a |
| Ember (fire) | Meadow Hare (critter) | 2.2 | 2.4 | 1 to 4 | 0 | 24 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Hedge Sparrow (critter) | 1.8 | 2.0 | 1 to 4 | 0 | 23 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Moor Wisp (critter) | 2.6 | 2.9 | 1 to 4 | 1 | 23 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Downs Ram (common) | 7.7 | 8.2 | 4 to 8 | 3 | 64 | 38 | 0.0 | 0 | ok |
| Ember (fire) | Grain Rat (critter) | 1.1 | 1.8 | 1 to 4 | 0 | 6 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Fox (common) | 4.6 | 9.3 | 4 to 8 | 0 | 50 | 41 | 0.1 | 0 | ok |
| Ember (fire) | Strawman (common) | 5.4 | 6.2 | 4 to 8 | 2 | 40 | 32 | 0.0 | 0 | ok |
| Ember (fire) | Burrow Mole (common) | 6.8 | 12.7 | 4 to 8 | 2 | 90 | 39 | 0.1 | 0 | ok |
| Ember (fire) | Thistle Wasp (critter) | 2.2 | 2.3 | 1 to 4 | 0 | 29 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Barrow Bones (common) | 6.1 | 7.2 | 4 to 8 | 1 | 58 | 35 | 0.0 | 0 | ok |
| Ember (fire) | Reed Crab (common) | 7.2 | 8.5 | 4 to 8 | 3 | 68 | 36 | 0.0 | 0 | ok |
| Ember (fire) | Marsh Leech (common) | 4.3 | 4.4 | 4 to 8 | 0 | 25 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Rubblet (common) | 6.5 | 8.4 | 4 to 8 | 2 | 56 | 42 | 0.0 | 0 | ok |
| Ember (fire) | Crag Hawk (common) | 4.4 | 4.6 | 4 to 8 | 3 | 20 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Moorhound (common) | 5.5 | 6.7 | 4 to 8 | 2 | 49 | 33 | 0.0 | 0 | ok |
| Ember (fire) | Thornling Scout (common) | 6.6 | 9.8 | 4 to 8 | 5 | 69 | 50 | 0.1 | 0 | n/a |
| Ember (fire) | Hollowhorn (miniboss) | 89.4 | 142.6 | 60 to 90 | 66 | 824 | 267 | 8.4 | 5 | ok |
| Ember (fire) | Mossling (common) | 5.0 | 6.2 | 4 to 8 | 3 | 60 | 35 | 0.0 | 0 | ok |
| Ember (fire) | Spitbloom (common) | 4.8 | 5.0 | 4 to 8 | 1 | 24 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Bramble Boar (common) | 6.2 | 9.1 | 4 to 8 | 5 | 80 | 41 | 0.1 | 0 | ok |
| Ember (fire) | Thornling (common) | 9.0 | 10.9 | 4 to 8 | 8 | 121 | 57 | 0.1 | 0 | n/a |
| Ember (fire) | Fogcap (common) | 6.7 | 7.8 | 4 to 8 | 3 | 60 | 32 | 0.0 | 0 | n/a |
| Ember (fire) | Cinderback Boar (common) | 8.4 | 13.2 | 4 to 8 | 17 | 118 | 53 | 0.2 | 0 | n/a |
| Ember (fire) | Old Bramblehide (miniboss) | 84.7 | 158.3 | 60 to 90 | 61 | 890 | 282 | 8.0 | 6 | n/a |
| Tide (water) | Meadow Hare (critter) | 2.2 | 2.6 | 1 to 4 | 0 | 23 | 25 | 0.0 | 0 | ok |
| Tide (water) | Hedge Sparrow (critter) | 2.2 | 2.3 | 1 to 4 | 0 | 23 | 25 | 0.0 | 0 | ok |
| Tide (water) | Moor Wisp (critter) | 2.6 | 3.5 | 1 to 4 | 0 | 151 | 25 | 0.0 | 0 | ok |
| Tide (water) | Downs Ram (common) | 8.6 | 9.7 | 4 to 8 | 2 | 63 | 50 | 0.0 | 0 | ok |
| Tide (water) | Grain Rat (critter) | 1.5 | 2.0 | 1 to 4 | 0 | 11 | 25 | 0.0 | 0 | ok |
| Tide (water) | Fox (common) | 6.8 | 9.3 | 4 to 8 | 1 | 51 | 50 | 0.1 | 0 | ok |
| Tide (water) | Strawman (common) | 6.4 | 8.8 | 4 to 8 | 2 | 55 | 48 | 0.0 | 0 | ok |
| Tide (water) | Burrow Mole (common) | 7.2 | 20.0 | 4 to 8 | 1 | 100 | 63 | 0.5 | 0 | ok |
| Tide (water) | Thistle Wasp (critter) | 2.3 | 2.6 | 1 to 4 | 1 | 23 | 25 | 0.0 | 0 | ok |
| Tide (water) | Barrow Bones (common) | 7.2 | 7.9 | 4 to 8 | 2 | 65 | 39 | 0.0 | 0 | ok |
| Tide (water) | Reed Crab (common) | 21.8 | 104.6 | 4 to 8 | 2 | 90 | 51 | 0.0 | 0 | listed |
| Tide (water) | Marsh Leech (common) | 4.9 | 6.2 | 4 to 8 | 1 | 28 | 29 | 0.0 | 0 | ok |
| Tide (water) | Rubblet (common) | 7.2 | 9.9 | 4 to 8 | 2 | 64 | 43 | 0.1 | 0 | ok |
| Tide (water) | Crag Hawk (common) | 4.9 | 7.8 | 4 to 8 | 1 | 28 | 25 | 0.0 | 0 | ok |
| Tide (water) | Moorhound (common) | 6.1 | 7.0 | 4 to 8 | 2 | 51 | 26 | 0.0 | 0 | ok |
| Tide (water) | Thornling Scout (common) | 9.8 | 16.9 | 4 to 8 | 5 | 106 | 73 | 0.1 | 0 | n/a |
| Tide (water) | Hollowhorn (miniboss) | 81.2 | 157.4 | 60 to 90 | 68 | 977 | 332 | 9.3 | 6 | ok |
| Tide (water) | Mossling (common) | 6.0 | 6.7 | 4 to 8 | 3 | 55 | 28 | 0.0 | 0 | ok |
| Tide (water) | Spitbloom (common) | 5.4 | 5.7 | 4 to 8 | 1 | 265 | 25 | 0.0 | 0 | ok |
| Tide (water) | Bramble Boar (common) | 6.6 | 11.1 | 4 to 8 | 6 | 83 | 36 | 0.1 | 0 | ok |
| Tide (water) | Thornling (common) | 10.2 | 12.7 | 4 to 8 | 8 | 134 | 49 | 0.1 | 0 | n/a |
| Tide (water) | Fogcap (common) | 7.0 | 7.5 | 4 to 8 | 6 | 970 | 35 | 0.3 | 1 | n/a |
| Tide (water) | Cinderback Boar (common) | 9.2 | 14.2 | 4 to 8 | 22 | 115 | 48 | 0.3 | 0 | n/a |
| Tide (water) | Old Bramblehide (miniboss) | 108.1 | 187.8 | 60 to 90 | 70 | 1035 | 336 | 9.7 | 8 | n/a |
| Stone (earth) | Meadow Hare (critter) | 1.3 | 1.8 | 1 to 4 | 0 | 3 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Hedge Sparrow (critter) | 0.9 | 1.8 | 1 to 4 | 0 | 3 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Moor Wisp (critter) | 1.8 | 1.8 | 1 to 4 | 0 | 0 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Downs Ram (common) | 7.2 | 7.8 | 4 to 8 | 1 | 53 | 39 | 0.1 | 0 | ok |
| Stone (earth) | Grain Rat (critter) | 0.9 | 1.4 | 1 to 4 | 0 | 3 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Fox (common) | 3.2 | 3.8 | 4 to 8 | 0 | 4 | 35 | 0.0 | 0 | listed |
| Stone (earth) | Strawman (common) | 5.1 | 6.2 | 4 to 8 | 0 | 34 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Burrow Mole (common) | 4.7 | 9.5 | 4 to 8 | 1 | 56 | 40 | 0.1 | 0 | ok |
| Stone (earth) | Thistle Wasp (critter) | 1.3 | 2.3 | 1 to 4 | 0 | 4 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Barrow Bones (common) | 5.4 | 6.5 | 4 to 8 | 1 | 36 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Reed Crab (common) | 6.7 | 8.0 | 4 to 8 | 1 | 59 | 40 | 0.1 | 0 | ok |
| Stone (earth) | Marsh Leech (common) | 3.2 | 3.2 | 4 to 8 | 0 | 1 | 35 | 0.0 | 0 | listed |
| Stone (earth) | Rubblet (common) | 7.4 | 8.0 | 4 to 8 | 3 | 61 | 51 | 0.4 | 0 | ok |
| Stone (earth) | Crag Hawk (common) | 3.2 | 3.2 | 4 to 8 | 0 | 0 | 35 | 0.0 | 0 | listed |
| Stone (earth) | Moorhound (common) | 4.9 | 5.8 | 4 to 8 | 1 | 33 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Thornling Scout (common) | 5.4 | 8.6 | 4 to 8 | 3 | 43 | 40 | 0.1 | 0 | n/a |
| Stone (earth) | Hollowhorn (miniboss) | 67.7 | 168.8 | 60 to 90 | 63 | 1004 | 320 | 8.9 | 5 | ok |
| Stone (earth) | Mossling (common) | 4.6 | 5.5 | 4 to 8 | 1 | 36 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Spitbloom (common) | 3.8 | 3.8 | 4 to 8 | 0 | 0 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Bramble Boar (common) | 6.8 | 8.8 | 4 to 8 | 3 | 84 | 49 | 0.4 | 0 | ok |
| Stone (earth) | Thornling (common) | 8.8 | 10.6 | 4 to 8 | 6 | 96 | 51 | 0.5 | 0 | n/a |
| Stone (earth) | Fogcap (common) | 5.6 | 5.8 | 4 to 8 | 1 | 28 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Cinderback Boar (common) | 7.2 | 13.9 | 4 to 8 | 13 | 104 | 51 | 0.3 | 0 | n/a |
| Stone (earth) | Old Bramblehide (miniboss) | 93.6 | 177.4 | 60 to 90 | 58 | 1018 | 299 | 8.3 | 7 | n/a |

## Tier 2 (par rank 15)

| Build | Creature | TTK median s | TTK p90 s | Target s | Damage taken | Stamina | Focus | Food | Deaths | At par |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Blades (sword) | Meadow Hare (critter) | 1.7 | 2.2 | 1 to 4 | 0 | 30 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Hedge Sparrow (critter) | 0.6 | 1.4 | 1 to 4 | 0 | 5 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Moor Wisp (critter) | 1.8 | 2.4 | 1 to 4 | 0 | 23 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Downs Ram (common) | 5.3 | 5.4 | 4 to 8 | 2 | 46 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Grain Rat (critter) | 0.6 | 1.4 | 1 to 4 | 0 | 5 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Fox (common) | 3.7 | 5.8 | 4 to 8 | 1 | 31 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Strawman (common) | 4.2 | 4.8 | 4 to 8 | 2 | 36 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Burrow Mole (common) | 4.7 | 9.0 | 4 to 8 | 2 | 63 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Thistle Wasp (critter) | 1.0 | 1.6 | 1 to 4 | 0 | 8 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Barrow Bones (common) | 4.5 | 4.9 | 4 to 8 | 2 | 43 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Reed Crab (common) | 5.0 | 6.7 | 4 to 8 | 1 | 50 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Marsh Leech (common) | 3.2 | 3.7 | 4 to 8 | 0 | 18 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Rubblet (common) | 5.4 | 5.6 | 4 to 8 | 1 | 50 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Crag Hawk (common) | 3.2 | 3.5 | 4 to 8 | 2 | 20 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Moorhound (common) | 4.2 | 4.9 | 4 to 8 | 2 | 41 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Thornling Scout (common) | 5.5 | 8.4 | 4 to 8 | 7 | 50 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Hollowhorn (miniboss) | 39.8 | 75.1 | 60 to 90 | 45 | 425 | 0 | 0.5 | 0 | n/a |
| Blades (sword) | Mossling (common) | 4.0 | 4.6 | 4 to 8 | 1 | 41 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Spitbloom (common) | 3.2 | 3.8 | 4 to 8 | 0 | 23 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Bramble Boar (common) | 5.3 | 5.9 | 4 to 8 | 4 | 63 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Thornling (common) | 5.7 | 6.9 | 4 to 8 | 5 | 70 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Fogcap (common) | 4.2 | 5.4 | 4 to 8 | 1 | 34 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Cinderback Boar (common) | 6.8 | 9.3 | 4 to 8 | 16 | 103 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Old Bramblehide (miniboss) | 72.5 | 111.3 | 60 to 90 | 77 | 926 | 0 | 3.8 | 6 | ok |
| Polearms (spear) | Meadow Hare (critter) | 0.7 | 1.3 | 1 to 4 | 0 | 3 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Hedge Sparrow (critter) | 0.7 | 1.3 | 1 to 4 | 0 | 3 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Moor Wisp (critter) | 1.7 | 2.1 | 1 to 4 | 0 | 25 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Downs Ram (common) | 5.3 | 5.8 | 4 to 8 | 0 | 53 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Grain Rat (critter) | 0.7 | 1.3 | 1 to 4 | 0 | 3 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Fox (common) | 3.7 | 5.0 | 4 to 8 | 0 | 29 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Strawman (common) | 3.5 | 3.9 | 4 to 8 | 0 | 23 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Burrow Mole (common) | 5.1 | 8.5 | 4 to 8 | 0 | 60 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Thistle Wasp (critter) | 0.7 | 1.4 | 1 to 4 | 0 | 5 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Barrow Bones (common) | 4.0 | 4.7 | 4 to 8 | 0 | 35 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Reed Crab (common) | 3.8 | 4.1 | 4 to 8 | 0 | 19 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Marsh Leech (common) | 2.5 | 3.3 | 4 to 8 | 0 | 3 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Rubblet (common) | 3.7 | 4.5 | 4 to 8 | 0 | 18 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Crag Hawk (common) | 3.3 | 4.0 | 4 to 8 | 1 | 26 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Moorhound (common) | 4.5 | 4.7 | 4 to 8 | 0 | 48 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Thornling Scout (common) | 3.6 | 5.3 | 4 to 8 | 0 | 29 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Hollowhorn (miniboss) | 38.3 | 63.6 | 60 to 90 | 47 | 393 | 0 | 0.6 | 0 | n/a |
| Polearms (spear) | Mossling (common) | 3.4 | 4.0 | 4 to 8 | 0 | 35 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Spitbloom (common) | 4.8 | 5.5 | 4 to 8 | 1 | 53 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Bramble Boar (common) | 3.8 | 5.7 | 4 to 8 | 1 | 44 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Thornling (common) | 5.7 | 6.5 | 4 to 8 | 0 | 64 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Fogcap (common) | 5.8 | 7.1 | 4 to 8 | 3 | 79 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Cinderback Boar (common) | 4.5 | 6.3 | 4 to 8 | 5 | 53 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Old Bramblehide (miniboss) | 62.7 | 129.4 | 60 to 90 | 60 | 803 | 0 | 1.5 | 0 | ok |
| Heavy Arms (maul) | Meadow Hare (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Hedge Sparrow (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Moor Wisp (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Downs Ram (common) | 5.3 | 6.3 | 4 to 8 | 1 | 31 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Grain Rat (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Fox (common) | 3.6 | 5.5 | 4 to 8 | 1 | 14 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Strawman (common) | 4.4 | 5.4 | 4 to 8 | 1 | 29 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Burrow Mole (common) | 4.9 | 6.7 | 4 to 8 | 2 | 35 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Thistle Wasp (critter) | 1.1 | 1.1 | 1 to 4 | 0 | 0 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Barrow Bones (common) | 4.3 | 4.9 | 4 to 8 | 1 | 25 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Reed Crab (common) | 5.3 | 6.2 | 4 to 8 | 1 | 30 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Marsh Leech (common) | 2.9 | 3.8 | 4 to 8 | 0 | 3 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Rubblet (common) | 6.2 | 6.5 | 4 to 8 | 2 | 46 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Crag Hawk (common) | 2.9 | 3.8 | 4 to 8 | 0 | 9 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Moorhound (common) | 4.3 | 5.1 | 4 to 8 | 2 | 26 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Thornling Scout (common) | 4.0 | 8.2 | 4 to 8 | 3 | 35 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Hollowhorn (miniboss) | 41.0 | 49.3 | 60 to 90 | 37 | 313 | 0 | 0.5 | 0 | n/a |
| Heavy Arms (maul) | Mossling (common) | 3.5 | 3.6 | 4 to 8 | 1 | 23 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Spitbloom (common) | 4.4 | 5.6 | 4 to 8 | 1 | 29 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Bramble Boar (common) | 4.5 | 5.7 | 4 to 8 | 2 | 41 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Thornling (common) | 5.2 | 6.4 | 4 to 8 | 4 | 24 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Fogcap (common) | 5.3 | 6.4 | 4 to 8 | 3 | 30 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Cinderback Boar (common) | 6.7 | 9.5 | 4 to 8 | 6 | 75 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Old Bramblehide (miniboss) | 65.9 | 118.0 | 60 to 90 | 65 | 568 | 0 | 4.2 | 6 | ok |
| Archery (bow) | Meadow Hare (critter) | 1.6 | 1.9 | 1 to 4 | 0 | 20 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Hedge Sparrow (critter) | 1.5 | 1.8 | 1 to 4 | 0 | 23 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Moor Wisp (critter) | 2.4 | 2.5 | 1 to 4 | 1 | 23 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Downs Ram (common) | 4.2 | 4.9 | 4 to 8 | 2 | 28 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Grain Rat (critter) | 1.4 | 1.7 | 1 to 4 | 0 | 19 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Fox (common) | 3.7 | 4.1 | 4 to 8 | 0 | 26 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Strawman (common) | 3.5 | 3.7 | 4 to 8 | 1 | 24 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Burrow Mole (common) | 8.9 | 12.1 | 4 to 8 | 2 | 85 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Thistle Wasp (critter) | 1.5 | 1.7 | 1 to 4 | 0 | 25 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Barrow Bones (common) | 3.5 | 4.1 | 4 to 8 | 1 | 29 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Reed Crab (common) | 3.6 | 4.3 | 4 to 8 | 1 | 25 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Marsh Leech (common) | 3.3 | 3.5 | 4 to 8 | 0 | 29 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Rubblet (common) | 3.7 | 4.2 | 4 to 8 | 1 | 24 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Crag Hawk (common) | 3.6 | 3.7 | 4 to 8 | 2 | 23 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Moorhound (common) | 3.5 | 4.7 | 4 to 8 | 1 | 39 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Thornling Scout (common) | 3.6 | 4.0 | 4 to 8 | 1 | 26 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Hollowhorn (miniboss) | 29.1 | 32.0 | 60 to 90 | 16 | 234 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Mossling (common) | 3.6 | 3.7 | 4 to 8 | 1 | 28 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Spitbloom (common) | 4.8 | 5.4 | 4 to 8 | 1 | 48 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Bramble Boar (common) | 4.5 | 4.7 | 4 to 8 | 1 | 53 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Thornling (common) | 5.0 | 5.2 | 4 to 8 | 2 | 50 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Fogcap (common) | 7.7 | 9.7 | 4 to 8 | 2 | 119 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Cinderback Boar (common) | 4.6 | 6.3 | 4 to 8 | 3 | 58 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Old Bramblehide (miniboss) | 39.4 | 44.4 | 60 to 90 | 16 | 311 | 0 | 0.1 | 0 | listed |
| Unarmed (cloth wraps) | Meadow Hare (critter) | 1.4 | 1.7 | 1 to 4 | 0 | 19 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Hedge Sparrow (critter) | 0.5 | 1.4 | 1 to 4 | 0 | 10 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Moor Wisp (critter) | 1.7 | 2.1 | 1 to 4 | 0 | 20 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Downs Ram (common) | 4.9 | 6.0 | 4 to 8 | 2 | 51 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Grain Rat (critter) | 0.5 | 1.4 | 1 to 4 | 0 | 10 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Fox (common) | 4.5 | 9.6 | 4 to 8 | 2 | 60 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Strawman (common) | 3.8 | 4.4 | 4 to 8 | 0 | 54 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Burrow Mole (common) | 4.7 | 5.9 | 4 to 8 | 2 | 60 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Thistle Wasp (critter) | 0.5 | 1.5 | 1 to 4 | 0 | 10 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Barrow Bones (common) | 4.9 | 5.4 | 4 to 8 | 2 | 64 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Reed Crab (common) | 4.5 | 5.8 | 4 to 8 | 2 | 54 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Marsh Leech (common) | 3.0 | 3.1 | 4 to 8 | 1 | 24 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Rubblet (common) | 4.3 | 4.8 | 4 to 8 | 1 | 54 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Crag Hawk (common) | 2.8 | 3.0 | 4 to 8 | 1 | 25 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Moorhound (common) | 3.9 | 4.1 | 4 to 8 | 2 | 45 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Thornling Scout (common) | 6.2 | 8.3 | 4 to 8 | 5 | 68 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Hollowhorn (miniboss) | 39.2 | 65.9 | 60 to 90 | 35 | 458 | 0 | 0.3 | 0 | n/a |
| Unarmed (cloth wraps) | Mossling (common) | 3.7 | 5.6 | 4 to 8 | 2 | 60 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Spitbloom (common) | 3.0 | 3.6 | 4 to 8 | 0 | 26 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Bramble Boar (common) | 5.0 | 6.2 | 4 to 8 | 2 | 73 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Thornling (common) | 7.2 | 9.1 | 4 to 8 | 10 | 130 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Fogcap (common) | 4.8 | 5.8 | 4 to 8 | 1 | 59 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Cinderback Boar (common) | 6.6 | 9.4 | 4 to 8 | 8 | 106 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Old Bramblehide (miniboss) | 57.4 | 70.8 | 60 to 90 | 43 | 516 | 0 | 1.2 | 0 | listed |
| Ember (fire) | Meadow Hare (critter) | 2.3 | 2.4 | 1 to 4 | 0 | 25 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Hedge Sparrow (critter) | 1.6 | 1.8 | 1 to 4 | 0 | 25 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Moor Wisp (critter) | 2.6 | 2.9 | 1 to 4 | 1 | 26 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Downs Ram (common) | 5.6 | 6.1 | 4 to 8 | 2 | 50 | 51 | 0.0 | 0 | n/a |
| Ember (fire) | Grain Rat (critter) | 1.5 | 1.6 | 1 to 4 | 0 | 23 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Fox (common) | 5.3 | 7.7 | 4 to 8 | 1 | 45 | 63 | 0.1 | 0 | n/a |
| Ember (fire) | Strawman (common) | 5.2 | 5.4 | 4 to 8 | 1 | 51 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Burrow Mole (common) | 7.1 | 11.8 | 4 to 8 | 1 | 99 | 69 | 0.3 | 0 | n/a |
| Ember (fire) | Thistle Wasp (critter) | 1.9 | 2.9 | 1 to 4 | 0 | 31 | 47 | 0.0 | 0 | n/a |
| Ember (fire) | Barrow Bones (common) | 5.5 | 6.6 | 4 to 8 | 0 | 65 | 49 | 0.1 | 0 | n/a |
| Ember (fire) | Reed Crab (common) | 5.3 | 8.8 | 4 to 8 | 3 | 64 | 56 | 0.0 | 0 | n/a |
| Ember (fire) | Marsh Leech (common) | 3.9 | 4.6 | 4 to 8 | 1 | 26 | 47 | 0.0 | 0 | n/a |
| Ember (fire) | Rubblet (common) | 6.5 | 7.4 | 4 to 8 | 2 | 70 | 62 | 0.0 | 0 | n/a |
| Ember (fire) | Crag Hawk (common) | 4.1 | 5.0 | 4 to 8 | 1 | 26 | 50 | 0.0 | 0 | n/a |
| Ember (fire) | Moorhound (common) | 4.6 | 5.9 | 4 to 8 | 2 | 54 | 48 | 0.0 | 0 | n/a |
| Ember (fire) | Thornling Scout (common) | 7.9 | 13.9 | 4 to 8 | 3 | 93 | 89 | 0.3 | 0 | ok |
| Ember (fire) | Hollowhorn (miniboss) | 59.6 | 114.8 | 60 to 90 | 50 | 730 | 389 | 6.5 | 1 | n/a |
| Ember (fire) | Mossling (common) | 5.4 | 5.7 | 4 to 8 | 2 | 61 | 60 | 0.0 | 0 | n/a |
| Ember (fire) | Spitbloom (common) | 4.0 | 4.3 | 4 to 8 | 1 | 26 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Bramble Boar (common) | 6.1 | 10.2 | 4 to 8 | 4 | 96 | 76 | 0.2 | 0 | n/a |
| Ember (fire) | Thornling (common) | 7.2 | 8.5 | 4 to 8 | 5 | 95 | 71 | 0.0 | 0 | ok |
| Ember (fire) | Fogcap (common) | 5.9 | 8.4 | 4 to 8 | 2 | 63 | 48 | 0.0 | 0 | ok |
| Ember (fire) | Cinderback Boar (common) | 8.6 | 13.3 | 4 to 8 | 10 | 135 | 91 | 0.5 | 0 | ok |
| Ember (fire) | Old Bramblehide (miniboss) | 89.2 | 199.9 | 60 to 90 | 56 | 1140 | 483 | 8.6 | 4 | ok |
| Tide (water) | Meadow Hare (critter) | 2.9 | 3.2 | 1 to 4 | 0 | 39 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Hedge Sparrow (critter) | 1.9 | 2.0 | 1 to 4 | 0 | 26 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Moor Wisp (critter) | 2.5 | 3.4 | 1 to 4 | 1 | 26 | 43 | 0.0 | 0 | n/a |
| Tide (water) | Downs Ram (common) | 6.5 | 7.8 | 4 to 8 | 2 | 58 | 65 | 0.1 | 0 | n/a |
| Tide (water) | Grain Rat (critter) | 1.9 | 2.0 | 1 to 4 | 0 | 26 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Fox (common) | 6.0 | 8.1 | 4 to 8 | 1 | 50 | 65 | 0.2 | 0 | n/a |
| Tide (water) | Strawman (common) | 5.7 | 8.1 | 4 to 8 | 1 | 65 | 65 | 0.3 | 0 | n/a |
| Tide (water) | Burrow Mole (common) | 6.5 | 9.7 | 4 to 8 | 1 | 99 | 60 | 0.1 | 0 | n/a |
| Tide (water) | Thistle Wasp (critter) | 2.3 | 2.5 | 1 to 4 | 0 | 26 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Barrow Bones (common) | 5.4 | 8.0 | 4 to 8 | 1 | 64 | 46 | 0.1 | 0 | n/a |
| Tide (water) | Reed Crab (common) | 6.0 | 15.0 | 4 to 8 | 3 | 60 | 69 | 0.3 | 0 | n/a |
| Tide (water) | Marsh Leech (common) | 3.9 | 4.1 | 4 to 8 | 0 | 28 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Rubblet (common) | 8.3 | 10.6 | 4 to 8 | 2 | 80 | 78 | 0.5 | 0 | n/a |
| Tide (water) | Crag Hawk (common) | 4.1 | 7.2 | 4 to 8 | 1 | 29 | 48 | 0.0 | 0 | n/a |
| Tide (water) | Moorhound (common) | 5.5 | 6.1 | 4 to 8 | 1 | 69 | 41 | 0.0 | 0 | n/a |
| Tide (water) | Thornling Scout (common) | 8.5 | 12.9 | 4 to 8 | 5 | 85 | 81 | 0.4 | 0 | ok |
| Tide (water) | Hollowhorn (miniboss) | 57.7 | 113.0 | 60 to 90 | 43 | 631 | 345 | 5.5 | 1 | n/a |
| Tide (water) | Mossling (common) | 5.0 | 5.7 | 4 to 8 | 1 | 65 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Spitbloom (common) | 4.5 | 4.8 | 4 to 8 | 1 | 28 | 43 | 0.0 | 0 | n/a |
| Tide (water) | Bramble Boar (common) | 6.0 | 8.6 | 4 to 8 | 3 | 93 | 48 | 0.0 | 0 | n/a |
| Tide (water) | Thornling (common) | 7.6 | 9.0 | 4 to 8 | 6 | 96 | 55 | 0.1 | 0 | ok |
| Tide (water) | Fogcap (common) | 6.9 | 31.1 | 4 to 8 | 2 | 166 | 85 | 0.5 | 0 | ok |
| Tide (water) | Cinderback Boar (common) | 8.1 | 12.6 | 4 to 8 | 12 | 129 | 66 | 0.2 | 0 | ok |
| Tide (water) | Old Bramblehide (miniboss) | 86.8 | 170.7 | 60 to 90 | 58 | 1023 | 482 | 8.9 | 5 | ok |
| Stone (earth) | Meadow Hare (critter) | 0.9 | 1.4 | 1 to 4 | 0 | 3 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Hedge Sparrow (critter) | 0.9 | 1.8 | 1 to 4 | 0 | 3 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Moor Wisp (critter) | 1.3 | 1.3 | 1 to 4 | 0 | 0 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Downs Ram (common) | 5.7 | 6.3 | 4 to 8 | 0 | 43 | 37 | 0.0 | 0 | n/a |
| Stone (earth) | Grain Rat (critter) | 0.9 | 1.4 | 1 to 4 | 0 | 3 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Fox (common) | 2.3 | 2.9 | 4 to 8 | 0 | 4 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Strawman (common) | 3.7 | 4.0 | 4 to 8 | 0 | 26 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Burrow Mole (common) | 3.7 | 9.0 | 4 to 8 | 1 | 56 | 40 | 0.0 | 0 | n/a |
| Stone (earth) | Thistle Wasp (critter) | 0.9 | 1.8 | 1 to 4 | 0 | 4 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Barrow Bones (common) | 3.9 | 4.3 | 4 to 8 | 1 | 28 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Reed Crab (common) | 4.7 | 7.0 | 4 to 8 | 1 | 44 | 39 | 0.0 | 0 | n/a |
| Stone (earth) | Marsh Leech (common) | 2.8 | 2.8 | 4 to 8 | 0 | 1 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Rubblet (common) | 5.0 | 5.7 | 4 to 8 | 1 | 38 | 39 | 0.0 | 0 | n/a |
| Stone (earth) | Crag Hawk (common) | 2.3 | 2.3 | 4 to 8 | 0 | 0 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Moorhound (common) | 3.4 | 3.8 | 4 to 8 | 1 | 24 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Thornling Scout (common) | 4.3 | 7.8 | 4 to 8 | 3 | 43 | 40 | 0.0 | 0 | ok |
| Stone (earth) | Hollowhorn (miniboss) | 46.0 | 119.8 | 60 to 90 | 37 | 595 | 242 | 4.0 | 0 | n/a |
| Stone (earth) | Mossling (common) | 3.6 | 4.5 | 4 to 8 | 1 | 36 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Spitbloom (common) | 2.8 | 2.8 | 4 to 8 | 0 | 0 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Bramble Boar (common) | 5.0 | 8.4 | 4 to 8 | 2 | 63 | 40 | 0.0 | 0 | n/a |
| Stone (earth) | Thornling (common) | 7.0 | 7.8 | 4 to 8 | 5 | 86 | 51 | 0.0 | 0 | ok |
| Stone (earth) | Fogcap (common) | 4.6 | 4.7 | 4 to 8 | 1 | 28 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Cinderback Boar (common) | 5.8 | 12.6 | 4 to 8 | 11 | 90 | 46 | 0.1 | 0 | ok |
| Stone (earth) | Old Bramblehide (miniboss) | 67.2 | 140.2 | 60 to 90 | 49 | 880 | 292 | 6.2 | 4 | ok |

## Packs: prepared (tier 2 builds, rank 15)

A pack is as many as the creature's spawner keeps standing together.

| Build | Pack | TTK median s | Damage taken | Food | Fell |
| --- | --- | --- | --- | --- | --- |
| Blades (sword) | Thornling x4 | 38.5 | 79 | 3.5 | 35% |
| Blades (sword) | Fogcap x3 | 16.1 | 42 | 0.5 | 5% |
| Blades (sword) | Cinderback Boar x2 | 14.5 | 54 | 1.1 | 10% |
| Polearms (spear) | Thornling x4 | 10.8 | 13 | 0.2 | 0% |
| Polearms (spear) | Fogcap x3 | 13.0 | 13 | 0.1 | 0% |
| Polearms (spear) | Cinderback Boar x2 | 9.6 | 32 | 0.3 | 0% |
| Heavy Arms (maul) | Thornling x4 | 42.3 | 95 | 5.2 | 85% |
| Heavy Arms (maul) | Fogcap x3 | 21.3 | 60 | 4.7 | 10% |
| Heavy Arms (maul) | Cinderback Boar x2 | 13.0 | 50 | 1.6 | 10% |
| Archery (bow) | Thornling x4 | 22.0 | 57 | 1.4 | 10% |
| Archery (bow) | Fogcap x3 | 26.1 | 45 | 0.8 | 0% |
| Archery (bow) | Cinderback Boar x2 | 10.0 | 22 | 0.3 | 0% |
| Unarmed (cloth wraps) | Thornling x4 | 39.1 | 90 | 2.4 | 55% |
| Unarmed (cloth wraps) | Fogcap x3 | 16.2 | 23 | 0.1 | 0% |
| Unarmed (cloth wraps) | Cinderback Boar x2 | 13.1 | 58 | 1.1 | 15% |
| Ember (fire) | Thornling x4 | 37.1 | 56 | 4.2 | 20% |
| Ember (fire) | Fogcap x3 | 20.1 | 35 | 1.5 | 0% |
| Ember (fire) | Cinderback Boar x2 | 16.1 | 66 | 3.2 | 30% |
| Tide (water) | Thornling x4 | 45.6 | 50 | 5.2 | 20% |
| Tide (water) | Fogcap x3 | 33.1 | 57 | 4.0 | 30% |
| Tide (water) | Cinderback Boar x2 | 17.7 | 68 | 2.0 | 30% |
| Stone (earth) | Thornling x4 | 47.7 | 66 | 4.0 | 35% |
| Stone (earth) | Fogcap x3 | 19.7 | 48 | 1.9 | 10% |
| Stone (earth) | Cinderback Boar x2 | 16.1 | 43 | 1.4 | 10% |

## Packs: unprepared (tier 1 builds, rank 0)

The first map does not make a character ready by itself. These are what the outside does to one who walks out without the rank and the gear.

| Build | Pack | TTK median s | Damage taken | Food | Fell |
| --- | --- | --- | --- | --- | --- |
| Blades (sword) | Thornling x4 | 65.0 | 86 | 3.0 | 65% |
| Blades (sword) | Fogcap x3 | 22.5 | 55 | 3.0 | 25% |
| Blades (sword) | Cinderback Boar x2 | 20.6 | 55 | 1.6 | 25% |
| Polearms (spear) | Thornling x4 | 16.8 | 14 | 0.3 | 0% |
| Polearms (spear) | Fogcap x3 | 19.9 | 39 | 1.6 | 5% |
| Polearms (spear) | Cinderback Boar x2 | 16.9 | 47 | 1.8 | 10% |
| Heavy Arms (maul) | Thornling x4 | 55.4 | 98 | 4.4 | 90% |
| Heavy Arms (maul) | Fogcap x3 | 23.9 | 80 | 3.8 | 55% |
| Heavy Arms (maul) | Cinderback Boar x2 | 17.4 | 54 | 2.8 | 20% |
| Archery (bow) | Thornling x4 | 37.5 | 66 | 4.8 | 20% |
| Archery (bow) | Fogcap x3 | 47.3 | 66 | 2.7 | 25% |
| Archery (bow) | Cinderback Boar x2 | 15.3 | 55 | 2.5 | 20% |
| Unarmed (cloth wraps) | Thornling x4 | 77.7 | 96 | 3.1 | 90% |
| Unarmed (cloth wraps) | Fogcap x3 | 29.2 | 72 | 3.7 | 40% |
| Unarmed (cloth wraps) | Cinderback Boar x2 | 23.4 | 77 | 3.0 | 50% |
| Ember (fire) | Thornling x4 | 62.0 | 87 | 6.2 | 65% |
| Ember (fire) | Fogcap x3 | 23.5 | 58 | 2.5 | 30% |
| Ember (fire) | Cinderback Boar x2 | 19.3 | 48 | 2.5 | 15% |
| Tide (water) | Thornling x4 | 62.2 | 82 | 7.3 | 60% |
| Tide (water) | Fogcap x3 | 25.7 | 67 | 3.6 | 60% |
| Tide (water) | Cinderback Boar x2 | 22.3 | 65 | 3.6 | 30% |
| Stone (earth) | Thornling x4 | 69.2 | 91 | 6.6 | 75% |
| Stone (earth) | Fogcap x3 | 28.3 | 80 | 3.9 | 55% |
| Stone (earth) | Cinderback Boar x2 | 20.5 | 45 | 2.6 | 15% |

## Listed deviations

- `stone|creature.fox`: Stone Fist is a point-blank burst on a fixed cadence, so a creature this small dies to the same number of casts whatever its Health within a few points (3.2 s, just under the band). A gap between builds, accepted (owner decision, see the report notes).
- `stone|creature.marsh_leech`: Stone Fist is a point-blank burst on a fixed cadence, so a creature this small dies to the same number of casts whatever its Health within a few points (3.2 s, just under the band). A gap between builds, accepted (owner decision, see the report notes).
- `stone|creature.crag_hawk`: Stone Fist is a point-blank burst on a fixed cadence, so a creature this small dies to the same number of casts whatever its Health within a few points (3.2 s, just under the band). A gap between builds, accepted (owner decision, see the report notes).
- `unarmed|creature.hollowhorn`: Wraps give breath back on every hit, so an Unarmed fight is either a clean run or a long one (median 106 s, spread to 150 s), as it is against the cave miniboss.
- `archery|creature.hollowhorn`: A bow stands off a field boss whose melee reach is short, so its damage is not interrupted (about 50 s against a 60 to 90 s band). Fighting from a distance is what the family is for.
- `heavy|creature.hollowhorn`: The maul is the fastest melee family against Hollowhorn (about 55 s). A gap between builds, which is accepted (owner decision, see the report notes).
- `archery|creature.old_bramblehide`: A bow stands off a boss whose reach is short, so its damage is not interrupted. Fighting from a distance is what the family is for.
- `unarmed|creature.old_bramblehide`: Wraps give breath back on every hit, so an Unarmed fight is either a clean run (about 50 s) or a long one (over 100 s). The median sits under the band and the spread over it.
- `archery|creature.burrow_mole`: A Burrow Mole dives between strikes and an arrow cannot reach a diving target, so a bow spends most of the fight waiting for it to surface. Melee and spells punish the surface window.
- `tide|creature.reed_crab`: Tide fights at range, past a guard's tether. The crab lets go and walks home, and a guard only heals if it has been left alone for 5 s (`guardHealAfterTicks`), so kiting no longer resets it, but every walk home costs the caster time (median 22 s, spread to 105 s against a 4 to 8 s band). Guards are meant to be fought up close.
- `unarmed|creature.bramble_boar`: Wraps already sit at the top of the band against a Bramble Boar (8.6 s at step a). Boars in Hollow Downs are step b, which adds a tenth.
