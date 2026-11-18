# Fight simulator report

Made by `npm run fight-sim` (POW-M3-12). Do not edit by hand. Headless fights on the real sim: 20 seeds per cell, 3200 fights. The avatar stands at the start of a fight with the creatures a tile or so away. The policy is the same for every build: lock the nearest, close in, swing, cast the best affordable spell, eat when hurt, and dodge a blow as its telegraph runs out (`tools/fight-sim/harness.ts`). The seed varies the starting distance and the first swing, so each cell is a spread.

- Par ranks (`balance/skills.ts`): tier 1 is 0, tier 2 is 15. Each build wears the best gear of its tier the content has. Mages carry Focus potions and everyone carries bread; both count under Food. Every family has a tier 2 weapon.
- Targets (design/04): common 4 to 8 s, elite 20 to 40 s, miniboss 60 to 90 s, regional boss 180 to 300 s, with 0.75 s of give on either side for a median of a spread. Targets are checked at par: a build of the creature's own tier against one creature. The cave miniboss is the gate out of the first map, so it is met by a tier 2 build (rank 15, tier 2 gear).
- **Outside the first map.** The 3 tier 2 creatures belong to Whisperwood (`content/world/regions.ts`), which has no map yet. They are tuned for rank 15 and tier 2 gear, and they are not kind to anyone else: see the packs below.
- **Gaps between builds are accepted** (owner decision). A family that loses a pack fight that another wins is not a defect: each build is meant to help somewhere in its progression, and these tables show where it does not yet. The thresholds bound the average, not each family.
- Damage taken is Health lost. Stamina and Focus are whole points spent. Fell is the share of fights where the avatar went down before the creatures did.

**At par:** 53 of 56 cells are inside their target band. 3 are outside: 3 listed with a reason, 0 unlisted. A prepared character fell in 0 of 960 fights against one common creature. Against a pack, prepared builds fell in 17% of fights and unprepared ones (tier 1 gear, rank 0) in 39%. 345 of 3200 fights over all ended in a fall.

## Tier 1 (par rank 0)

| Build | Creature | TTK median s | TTK p90 s | Target s | Damage taken | Stamina | Focus | Food | Deaths | At par |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Blades (sword) | Mossling (common) | 5.2 | 6.0 | 4 to 8 | 1 | 41 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Spitbloom (common) | 4.2 | 4.9 | 4 to 8 | 0 | 24 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Bramble Boar (common) | 6.0 | 6.8 | 4 to 8 | 4 | 63 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Thornling (common) | 8.4 | 9.9 | 4 to 8 | 6 | 94 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Fogcap (common) | 6.5 | 7.2 | 4 to 8 | 1 | 51 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Cinderback Boar (common) | 8.2 | 10.2 | 4 to 8 | 18 | 104 | 0 | 0.1 | 0 | n/a |
| Blades (sword) | Old Bramblehide (miniboss) | 101.7 | 135.0 | 60 to 90 | 67 | 1061 | 0 | 4.7 | 7 | n/a |
| Polearms (spear) | Mossling (common) | 5.4 | 5.8 | 4 to 8 | 0 | 45 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Spitbloom (common) | 5.5 | 6.4 | 4 to 8 | 1 | 53 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Bramble Boar (common) | 5.8 | 7.5 | 4 to 8 | 2 | 70 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Thornling (common) | 8.0 | 8.9 | 4 to 8 | 0 | 65 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Fogcap (common) | 8.4 | 9.0 | 4 to 8 | 3 | 98 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Cinderback Boar (common) | 8.5 | 10.1 | 4 to 8 | 5 | 101 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Old Bramblehide (miniboss) | 133.6 | 180.9 | 60 to 90 | 90 | 1539 | 0 | 7.3 | 14 | n/a |
| Heavy Arms (maul) | Mossling (common) | 4.3 | 5.5 | 4 to 8 | 1 | 24 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Spitbloom (common) | 4.4 | 5.6 | 4 to 8 | 1 | 29 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Bramble Boar (common) | 5.9 | 8.0 | 4 to 8 | 4 | 54 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Thornling (common) | 7.7 | 8.0 | 4 to 8 | 9 | 45 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Fogcap (common) | 7.0 | 7.3 | 4 to 8 | 4 | 41 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Cinderback Boar (common) | 8.4 | 11.2 | 4 to 8 | 7 | 90 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Old Bramblehide (miniboss) | 60.2 | 153.6 | 60 to 90 | 70 | 683 | 0 | 5.4 | 10 | n/a |
| Archery (bow) | Mossling (common) | 5.8 | 6.9 | 4 to 8 | 1 | 54 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Spitbloom (common) | 6.8 | 7.7 | 4 to 8 | 1 | 56 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Bramble Boar (common) | 5.3 | 7.4 | 4 to 8 | 1 | 59 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Thornling (common) | 8.0 | 9.0 | 4 to 8 | 5 | 75 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Fogcap (common) | 13.4 | 15.8 | 4 to 8 | 6 | 188 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Cinderback Boar (common) | 7.8 | 9.0 | 4 to 8 | 5 | 85 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Old Bramblehide (miniboss) | 66.7 | 106.4 | 60 to 90 | 18 | 549 | 0 | 0.1 | 0 | n/a |
| Unarmed (cloth wraps) | Mossling (common) | 6.2 | 8.0 | 4 to 8 | 2 | 74 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Spitbloom (common) | 4.4 | 4.6 | 4 to 8 | 0 | 26 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Bramble Boar (common) | 8.6 | 10.8 | 4 to 8 | 4 | 118 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Thornling (common) | 12.1 | 13.5 | 4 to 8 | 17 | 188 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Fogcap (common) | 8.0 | 9.0 | 4 to 8 | 2 | 89 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Cinderback Boar (common) | 13.0 | 19.9 | 4 to 8 | 13 | 204 | 0 | 0.1 | 0 | n/a |
| Unarmed (cloth wraps) | Old Bramblehide (miniboss) | 85.4 | 117.8 | 60 to 90 | 32 | 600 | 0 | 1.4 | 0 | n/a |
| Ember (fire) | Mossling (common) | 5.0 | 6.2 | 4 to 8 | 3 | 60 | 35 | 0.0 | 0 | ok |
| Ember (fire) | Spitbloom (common) | 4.3 | 4.5 | 4 to 8 | 1 | 24 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Bramble Boar (common) | 6.1 | 9.0 | 4 to 8 | 5 | 80 | 41 | 0.1 | 0 | ok |
| Ember (fire) | Thornling (common) | 9.0 | 10.9 | 4 to 8 | 8 | 121 | 57 | 0.1 | 0 | n/a |
| Ember (fire) | Fogcap (common) | 6.7 | 7.8 | 4 to 8 | 3 | 60 | 32 | 0.0 | 0 | n/a |
| Ember (fire) | Cinderback Boar (common) | 8.4 | 13.2 | 4 to 8 | 17 | 118 | 53 | 0.2 | 0 | n/a |
| Ember (fire) | Old Bramblehide (miniboss) | 73.8 | 138.4 | 60 to 90 | 62 | 985 | 293 | 8.4 | 8 | n/a |
| Tide (water) | Mossling (common) | 6.0 | 6.7 | 4 to 8 | 3 | 55 | 28 | 0.0 | 0 | ok |
| Tide (water) | Spitbloom (common) | 4.8 | 4.9 | 4 to 8 | 0 | 170 | 25 | 0.0 | 0 | ok |
| Tide (water) | Bramble Boar (common) | 6.3 | 10.6 | 4 to 8 | 5 | 75 | 36 | 0.1 | 0 | ok |
| Tide (water) | Thornling (common) | 10.2 | 12.7 | 4 to 8 | 8 | 134 | 49 | 0.1 | 0 | n/a |
| Tide (water) | Fogcap (common) | 7.0 | 7.5 | 4 to 8 | 6 | 970 | 35 | 0.4 | 1 | n/a |
| Tide (water) | Cinderback Boar (common) | 9.2 | 14.2 | 4 to 8 | 22 | 115 | 48 | 0.3 | 0 | n/a |
| Tide (water) | Old Bramblehide (miniboss) | 106.5 | 164.6 | 60 to 90 | 68 | 1060 | 322 | 9.8 | 9 | n/a |
| Stone (earth) | Mossling (common) | 4.6 | 5.5 | 4 to 8 | 1 | 36 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Spitbloom (common) | 3.2 | 3.2 | 4 to 8 | 0 | 0 | 35 | 0.0 | 0 | listed |
| Stone (earth) | Bramble Boar (common) | 5.7 | 8.8 | 4 to 8 | 3 | 74 | 46 | 0.3 | 0 | ok |
| Stone (earth) | Thornling (common) | 8.8 | 10.6 | 4 to 8 | 6 | 96 | 51 | 0.5 | 0 | n/a |
| Stone (earth) | Fogcap (common) | 5.6 | 5.8 | 4 to 8 | 1 | 28 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Cinderback Boar (common) | 7.2 | 13.9 | 4 to 8 | 13 | 104 | 51 | 0.3 | 0 | n/a |
| Stone (earth) | Old Bramblehide (miniboss) | 97.8 | 165.5 | 60 to 90 | 52 | 949 | 285 | 7.7 | 5 | n/a |

## Tier 2 (par rank 15)

| Build | Creature | TTK median s | TTK p90 s | Target s | Damage taken | Stamina | Focus | Food | Deaths | At par |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Blades (sword) | Mossling (common) | 4.0 | 4.6 | 4 to 8 | 1 | 41 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Spitbloom (common) | 3.2 | 3.4 | 4 to 8 | 0 | 23 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Bramble Boar (common) | 5.3 | 5.9 | 4 to 8 | 4 | 63 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Thornling (common) | 5.7 | 6.9 | 4 to 8 | 5 | 70 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Fogcap (common) | 4.2 | 5.4 | 4 to 8 | 1 | 34 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Cinderback Boar (common) | 6.8 | 9.3 | 4 to 8 | 16 | 103 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Old Bramblehide (miniboss) | 71.9 | 93.1 | 60 to 90 | 73 | 964 | 0 | 3.7 | 5 | ok |
| Polearms (spear) | Mossling (common) | 3.4 | 4.0 | 4 to 8 | 0 | 35 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Spitbloom (common) | 4.1 | 4.8 | 4 to 8 | 0 | 53 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Bramble Boar (common) | 3.2 | 4.5 | 4 to 8 | 1 | 39 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Thornling (common) | 5.7 | 6.5 | 4 to 8 | 0 | 64 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Fogcap (common) | 5.8 | 7.1 | 4 to 8 | 3 | 79 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Cinderback Boar (common) | 4.5 | 6.3 | 4 to 8 | 5 | 53 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Old Bramblehide (miniboss) | 62.7 | 154.7 | 60 to 90 | 61 | 864 | 0 | 1.6 | 0 | ok |
| Heavy Arms (maul) | Mossling (common) | 3.5 | 3.6 | 4 to 8 | 1 | 23 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Spitbloom (common) | 3.6 | 3.8 | 4 to 8 | 1 | 21 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Bramble Boar (common) | 4.5 | 5.7 | 4 to 8 | 2 | 41 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Thornling (common) | 5.2 | 6.4 | 4 to 8 | 4 | 24 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Fogcap (common) | 5.3 | 6.4 | 4 to 8 | 3 | 30 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Cinderback Boar (common) | 6.7 | 9.5 | 4 to 8 | 6 | 75 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Old Bramblehide (miniboss) | 65.9 | 111.4 | 60 to 90 | 67 | 677 | 0 | 5.4 | 6 | ok |
| Archery (bow) | Mossling (common) | 3.6 | 3.7 | 4 to 8 | 1 | 28 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Spitbloom (common) | 4.6 | 4.8 | 4 to 8 | 1 | 44 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Bramble Boar (common) | 4.0 | 4.5 | 4 to 8 | 1 | 53 | 0 | 0.0 | 0 | n/a |
| Archery (bow) | Thornling (common) | 5.0 | 5.2 | 4 to 8 | 2 | 50 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Fogcap (common) | 7.7 | 9.7 | 4 to 8 | 2 | 119 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Cinderback Boar (common) | 4.6 | 6.3 | 4 to 8 | 3 | 58 | 0 | 0.0 | 0 | ok |
| Archery (bow) | Old Bramblehide (miniboss) | 39.4 | 44.4 | 60 to 90 | 15 | 321 | 0 | 0.0 | 0 | listed |
| Unarmed (cloth wraps) | Mossling (common) | 3.7 | 5.6 | 4 to 8 | 2 | 60 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Spitbloom (common) | 3.0 | 3.3 | 4 to 8 | 0 | 26 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Bramble Boar (common) | 4.8 | 6.2 | 4 to 8 | 2 | 70 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Thornling (common) | 7.2 | 9.1 | 4 to 8 | 10 | 130 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Fogcap (common) | 4.8 | 5.8 | 4 to 8 | 1 | 59 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Cinderback Boar (common) | 6.6 | 9.4 | 4 to 8 | 8 | 106 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Old Bramblehide (miniboss) | 52.8 | 108.5 | 60 to 90 | 45 | 616 | 0 | 1.3 | 1 | listed |
| Ember (fire) | Mossling (common) | 5.4 | 5.7 | 4 to 8 | 2 | 61 | 60 | 0.0 | 0 | n/a |
| Ember (fire) | Spitbloom (common) | 3.9 | 4.1 | 4 to 8 | 0 | 26 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Bramble Boar (common) | 5.7 | 8.7 | 4 to 8 | 3 | 91 | 73 | 0.1 | 0 | n/a |
| Ember (fire) | Thornling (common) | 7.2 | 8.5 | 4 to 8 | 5 | 95 | 71 | 0.0 | 0 | ok |
| Ember (fire) | Fogcap (common) | 5.9 | 8.4 | 4 to 8 | 2 | 63 | 48 | 0.0 | 0 | ok |
| Ember (fire) | Cinderback Boar (common) | 8.6 | 13.3 | 4 to 8 | 10 | 135 | 91 | 0.5 | 0 | ok |
| Ember (fire) | Old Bramblehide (miniboss) | 64.8 | 157.9 | 60 to 90 | 60 | 1053 | 463 | 9.5 | 6 | ok |
| Tide (water) | Mossling (common) | 5.0 | 5.7 | 4 to 8 | 1 | 65 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Spitbloom (common) | 3.9 | 4.8 | 4 to 8 | 0 | 28 | 43 | 0.0 | 0 | n/a |
| Tide (water) | Bramble Boar (common) | 6.0 | 8.6 | 4 to 8 | 3 | 93 | 48 | 0.0 | 0 | n/a |
| Tide (water) | Thornling (common) | 7.6 | 9.0 | 4 to 8 | 6 | 96 | 55 | 0.1 | 0 | ok |
| Tide (water) | Fogcap (common) | 6.9 | 31.1 | 4 to 8 | 2 | 166 | 85 | 0.5 | 0 | ok |
| Tide (water) | Cinderback Boar (common) | 8.1 | 12.6 | 4 to 8 | 12 | 129 | 66 | 0.2 | 0 | ok |
| Tide (water) | Old Bramblehide (miniboss) | 85.3 | 180.0 | 60 to 90 | 59 | 1045 | 471 | 9.3 | 5 | ok |
| Stone (earth) | Mossling (common) | 3.6 | 4.5 | 4 to 8 | 1 | 36 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Spitbloom (common) | 2.3 | 2.3 | 4 to 8 | 0 | 0 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Bramble Boar (common) | 4.6 | 7.9 | 4 to 8 | 2 | 63 | 40 | 0.0 | 0 | n/a |
| Stone (earth) | Thornling (common) | 7.0 | 7.8 | 4 to 8 | 5 | 86 | 51 | 0.0 | 0 | ok |
| Stone (earth) | Fogcap (common) | 4.6 | 4.7 | 4 to 8 | 1 | 28 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Cinderback Boar (common) | 5.8 | 12.6 | 4 to 8 | 11 | 90 | 46 | 0.1 | 0 | ok |
| Stone (earth) | Old Bramblehide (miniboss) | 67.2 | 102.7 | 60 to 90 | 45 | 725 | 247 | 4.8 | 3 | ok |

## Packs: prepared (tier 2 builds, rank 15)

A pack is as many as the creature's spawner keeps standing together.

| Build | Pack | TTK median s | Damage taken | Food | Fell |
| --- | --- | --- | --- | --- | --- |
| Blades (sword) | Thornling x4 | 38.5 | 78 | 3.7 | 35% |
| Blades (sword) | Fogcap x3 | 16.1 | 42 | 0.5 | 5% |
| Blades (sword) | Cinderback Boar x2 | 14.5 | 54 | 1.1 | 10% |
| Polearms (spear) | Thornling x4 | 10.8 | 13 | 0.2 | 0% |
| Polearms (spear) | Fogcap x3 | 13.0 | 13 | 0.1 | 0% |
| Polearms (spear) | Cinderback Boar x2 | 9.6 | 32 | 0.3 | 0% |
| Heavy Arms (maul) | Thornling x4 | 43.2 | 93 | 5.5 | 70% |
| Heavy Arms (maul) | Fogcap x3 | 21.3 | 58 | 4.9 | 10% |
| Heavy Arms (maul) | Cinderback Boar x2 | 13.0 | 50 | 1.6 | 10% |
| Archery (bow) | Thornling x4 | 22.0 | 57 | 1.4 | 10% |
| Archery (bow) | Fogcap x3 | 26.1 | 45 | 0.8 | 0% |
| Archery (bow) | Cinderback Boar x2 | 10.0 | 22 | 0.3 | 0% |
| Unarmed (cloth wraps) | Thornling x4 | 39.1 | 89 | 2.5 | 55% |
| Unarmed (cloth wraps) | Fogcap x3 | 16.2 | 23 | 0.1 | 0% |
| Unarmed (cloth wraps) | Cinderback Boar x2 | 13.1 | 58 | 1.1 | 15% |
| Ember (fire) | Thornling x4 | 37.1 | 55 | 4.3 | 20% |
| Ember (fire) | Fogcap x3 | 20.1 | 35 | 1.5 | 0% |
| Ember (fire) | Cinderback Boar x2 | 16.1 | 66 | 3.3 | 30% |
| Tide (water) | Thornling x4 | 45.6 | 50 | 5.4 | 20% |
| Tide (water) | Fogcap x3 | 31.2 | 56 | 4.2 | 25% |
| Tide (water) | Cinderback Boar x2 | 17.7 | 68 | 2.0 | 30% |
| Stone (earth) | Thornling x4 | 47.7 | 65 | 4.2 | 35% |
| Stone (earth) | Fogcap x3 | 19.7 | 47 | 1.9 | 10% |
| Stone (earth) | Cinderback Boar x2 | 16.1 | 43 | 1.4 | 10% |

## Packs: unprepared (tier 1 builds, rank 0)

The first map does not make a character ready by itself. These are what the outside does to one who walks out without the rank and the gear.

| Build | Pack | TTK median s | Damage taken | Food | Fell |
| --- | --- | --- | --- | --- | --- |
| Blades (sword) | Thornling x4 | 65.0 | 85 | 3.1 | 65% |
| Blades (sword) | Fogcap x3 | 22.5 | 54 | 3.2 | 20% |
| Blades (sword) | Cinderback Boar x2 | 20.6 | 54 | 1.6 | 25% |
| Polearms (spear) | Thornling x4 | 16.8 | 14 | 0.3 | 0% |
| Polearms (spear) | Fogcap x3 | 19.9 | 39 | 1.6 | 5% |
| Polearms (spear) | Cinderback Boar x2 | 16.9 | 47 | 1.9 | 10% |
| Heavy Arms (maul) | Thornling x4 | 55.4 | 97 | 4.7 | 90% |
| Heavy Arms (maul) | Fogcap x3 | 23.9 | 79 | 4.0 | 55% |
| Heavy Arms (maul) | Cinderback Boar x2 | 17.4 | 54 | 2.9 | 20% |
| Archery (bow) | Thornling x4 | 37.5 | 66 | 4.8 | 20% |
| Archery (bow) | Fogcap x3 | 47.4 | 65 | 2.9 | 20% |
| Archery (bow) | Cinderback Boar x2 | 15.3 | 54 | 2.6 | 20% |
| Unarmed (cloth wraps) | Thornling x4 | 77.7 | 96 | 3.4 | 90% |
| Unarmed (cloth wraps) | Fogcap x3 | 29.0 | 71 | 3.9 | 35% |
| Unarmed (cloth wraps) | Cinderback Boar x2 | 23.4 | 76 | 3.1 | 50% |
| Ember (fire) | Thornling x4 | 62.0 | 85 | 6.5 | 65% |
| Ember (fire) | Fogcap x3 | 23.5 | 58 | 2.6 | 30% |
| Ember (fire) | Cinderback Boar x2 | 19.3 | 48 | 2.5 | 15% |
| Tide (water) | Thornling x4 | 62.2 | 82 | 7.5 | 60% |
| Tide (water) | Fogcap x3 | 25.7 | 67 | 3.9 | 60% |
| Tide (water) | Cinderback Boar x2 | 22.3 | 64 | 3.9 | 30% |
| Stone (earth) | Thornling x4 | 69.2 | 89 | 6.9 | 70% |
| Stone (earth) | Fogcap x3 | 28.3 | 80 | 4.0 | 55% |
| Stone (earth) | Cinderback Boar x2 | 20.5 | 45 | 2.6 | 15% |

## Listed deviations

- `stone|creature.spitbloom`: Stone Fist is a point-blank burst that lands on every cast against a rooted target, so it kills a Spitbloom sooner than it kills anything that moves. That is the school doing its job.
- `archery|creature.old_bramblehide`: A bow stands off a boss whose reach is short, so its damage is not interrupted. Fighting from a distance is what the family is for.
- `unarmed|creature.old_bramblehide`: Wraps give breath back on every hit, so an Unarmed fight is either a clean run (about 50 s) or a long one (over 100 s). The median sits under the band and the spread over it.
