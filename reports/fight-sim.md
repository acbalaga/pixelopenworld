# Fight simulator report

Made by `npm run fight-sim` (POW-M3-12). Do not edit by hand. Headless fights on the real sim: 20 seeds per cell, 1280 fights. The avatar stands at the start of a fight with the creature one tile away. The policy is the same for every build: swing every tick, cast the best affordable spell, dodge on a fixed rhythm (`tools/fight-sim/harness.ts`). The seed varies the starting distance and the first swing, so each cell is a spread.

- Par ranks (`balance/skills.ts`): tier 1 is 0, tier 2 is 15. Each build wears the best gear of its tier the content has. Heavy Arms, Archery and Unarmed have no tier 2 weapon yet, so they wear their tier 1 weapon at both ranks.
- Targets (design/04): common 4 to 8 s, elite 20 to 40 s, miniboss 60 to 90 s, regional boss 180 to 300 s.
- **Tier 2.** The content has 0 tier 2 creatures, so the tier 2 table shows each build at rank 15 against tier 1 creatures. It reads how much faster an over-par build kills, and the table gains real tier 2 rows the day a tier 2 creature is added with a role in `tools/fight-sim/targets.ts`. Targets are checked at par only: tier 1 builds against tier 1 creatures.
- Damage taken is Health lost. Stamina and Focus are whole points spent. Deaths are fights where the avatar fell first (of 20).

**At par:** 25 of 32 cells are inside their target band. 7 are outside: 7 listed with a reason, 0 unlisted. Deaths: 0 of 960 fights against common enemies, 312 of 1280 over all.

## Tier 1 (par rank 0)

| Build | Creature | TTK median s | TTK p90 s | Target s | Damage taken | Stamina | Focus | Bread | Deaths | At par |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Blades (sword) | Mossling (common) | 4.8 | 5.2 | 4 to 8 | 9 | 51 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Spitbloom (common) | 4.8 | 4.8 | 4 to 8 | 5 | 41 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Bramble Boar (common) | 5.2 | 5.8 | 4 to 8 | 28 | 53 | 0 | 0.0 | 0 | ok |
| Blades (sword) | Old Bramblehide (miniboss) | 50.6 | 50.6 | 60 to 90 | 98 | 310 | 0 | 7.7 | 19 | listed |
| Polearms (spear) | Mossling (common) | 4.3 | 4.9 | 4 to 8 | 1 | 50 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Spitbloom (common) | 4.9 | 4.9 | 4 to 8 | 5 | 31 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Bramble Boar (common) | 5.8 | 5.8 | 4 to 8 | 14 | 50 | 0 | 0.0 | 0 | ok |
| Polearms (spear) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 403 | 0 | 8.0 | 20 | listed |
| Heavy Arms (maul) | Mossling (common) | 4.8 | 5.9 | 4 to 8 | 7 | 61 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Spitbloom (common) | 5.9 | 5.9 | 4 to 8 | 5 | 51 | 0 | 0.0 | 0 | ok |
| Heavy Arms (maul) | Bramble Boar (common) | 6.7 | 8.7 | 4 to 8 | 27 | 78 | 0 | 0.1 | 0 | ok |
| Heavy Arms (maul) | Old Bramblehide (miniboss) | 60.7 | 60.7 | 60 to 90 | 100 | 316 | 0 | 8.0 | 19 | ok |
| Archery (short bow) | Mossling (common) | 6.7 | 8.0 | 4 to 8 | 25 | 73 | 0 | 0.0 | 0 | ok |
| Archery (short bow) | Spitbloom (common) | 4.7 | 4.8 | 4 to 8 | 9 | 26 | 0 | 0.0 | 0 | ok |
| Archery (short bow) | Bramble Boar (common) | 7.1 | 8.0 | 4 to 8 | 40 | 68 | 0 | 0.2 | 0 | ok |
| Archery (short bow) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 430 | 0 | 8.0 | 20 | listed |
| Unarmed (cloth wraps) | Mossling (common) | 5.1 | 5.7 | 4 to 8 | 14 | 51 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Spitbloom (common) | 4.7 | 5.1 | 4 to 8 | 5 | 43 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Bramble Boar (common) | 6.6 | 6.7 | 4 to 8 | 31 | 70 | 0 | 0.0 | 0 | ok |
| Unarmed (cloth wraps) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 220 | 0 | 8.0 | 20 | listed |
| Ember (fire) | Mossling (common) | 4.6 | 5.8 | 4 to 8 | 8 | 59 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Spitbloom (common) | 6.3 | 8.6 | 4 to 8 | 7 | 50 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Bramble Boar (common) | 7.1 | 9.0 | 4 to 8 | 29 | 73 | 30 | 0.0 | 0 | ok |
| Ember (fire) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 754 | 95 | 8.0 | 20 | listed |
| Tide (water) | Mossling (common) | 5.7 | 6.2 | 4 to 8 | 8 | 66 | 25 | 0.0 | 0 | ok |
| Tide (water) | Spitbloom (common) | 6.8 | 7.7 | 4 to 8 | 5 | 69 | 25 | 0.0 | 0 | ok |
| Tide (water) | Bramble Boar (common) | 6.6 | 9.7 | 4 to 8 | 24 | 71 | 26 | 0.0 | 0 | ok |
| Tide (water) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 629 | 95 | 8.0 | 20 | listed |
| Stone (earth) | Mossling (common) | 4.8 | 6.2 | 4 to 8 | 4 | 60 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Spitbloom (common) | 4.6 | 5.7 | 4 to 8 | 0 | 54 | 35 | 0.0 | 0 | ok |
| Stone (earth) | Bramble Boar (common) | 5.7 | 9.7 | 4 to 8 | 8 | 85 | 40 | 0.0 | 0 | ok |
| Stone (earth) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 606 | 70 | 8.0 | 20 | listed |

## Tier 2 (par rank 15)

| Build | Creature | TTK median s | TTK p90 s | Target s | Damage taken | Stamina | Focus | Bread | Deaths | At par |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Blades (sword) | Mossling (common) | 3.2 | 4.2 | 4 to 8 | 10 | 31 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Spitbloom (common) | 3.2 | 3.2 | 4 to 8 | 6 | 16 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Bramble Boar (common) | 4.2 | 4.3 | 4 to 8 | 25 | 49 | 0 | 0.0 | 0 | n/a |
| Blades (sword) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 115 | 320 | 0 | 8.0 | 20 | n/a |
| Polearms (spear) | Mossling (common) | 2.4 | 2.8 | 4 to 8 | 1 | 25 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Spitbloom (common) | 2.9 | 3.0 | 4 to 8 | 6 | 6 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Bramble Boar (common) | 3.8 | 3.8 | 4 to 8 | 14 | 24 | 0 | 0.0 | 0 | n/a |
| Polearms (spear) | Old Bramblehide (miniboss) | 36.6 | 36.9 | 60 to 90 | 112 | 359 | 0 | 7.9 | 16 | n/a |
| Heavy Arms (maul) | Mossling (common) | 4.8 | 5.9 | 4 to 8 | 7 | 61 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Spitbloom (common) | 5.9 | 5.9 | 4 to 8 | 5 | 51 | 0 | 0.0 | 0 | n/a |
| Heavy Arms (maul) | Bramble Boar (common) | 6.7 | 8.7 | 4 to 8 | 27 | 78 | 0 | 0.1 | 0 | n/a |
| Heavy Arms (maul) | Old Bramblehide (miniboss) | 60.7 | 60.7 | 60 to 90 | 100 | 316 | 0 | 8.0 | 19 | n/a |
| Archery (short bow) | Mossling (common) | 5.9 | 6.8 | 4 to 8 | 24 | 66 | 0 | 0.0 | 0 | n/a |
| Archery (short bow) | Spitbloom (common) | 4.1 | 4.7 | 4 to 8 | 10 | 18 | 0 | 0.0 | 0 | n/a |
| Archery (short bow) | Bramble Boar (common) | 5.3 | 7.7 | 4 to 8 | 38 | 61 | 0 | 0.0 | 0 | n/a |
| Archery (short bow) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 115 | 439 | 0 | 8.0 | 20 | n/a |
| Unarmed (cloth wraps) | Mossling (common) | 4.3 | 5.1 | 4 to 8 | 15 | 48 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Spitbloom (common) | 3.8 | 4.1 | 4 to 8 | 6 | 41 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Bramble Boar (common) | 6.2 | 6.6 | 4 to 8 | 32 | 63 | 0 | 0.0 | 0 | n/a |
| Unarmed (cloth wraps) | Old Bramblehide (miniboss) | 55.1 | 55.1 | 60 to 90 | 115 | 253 | 0 | 8.0 | 19 | n/a |
| Ember (fire) | Mossling (common) | 4.7 | 7.7 | 4 to 8 | 6 | 63 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Spitbloom (common) | 5.7 | 7.8 | 4 to 8 | 5 | 69 | 45 | 0.0 | 0 | n/a |
| Ember (fire) | Bramble Boar (common) | 6.6 | 9.7 | 4 to 8 | 22 | 71 | 53 | 0.0 | 0 | n/a |
| Ember (fire) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 561 | 118 | 8.0 | 20 | n/a |
| Tide (water) | Mossling (common) | 5.7 | 7.8 | 4 to 8 | 13 | 73 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Spitbloom (common) | 6.2 | 7.7 | 4 to 8 | 6 | 74 | 40 | 0.0 | 0 | n/a |
| Tide (water) | Bramble Boar (common) | 7.9 | 9.8 | 4 to 8 | 34 | 88 | 42 | 0.0 | 0 | n/a |
| Tide (water) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 600 | 116 | 8.0 | 20 | n/a |
| Stone (earth) | Mossling (common) | 4.8 | 6.2 | 4 to 8 | 4 | 60 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Spitbloom (common) | 4.6 | 5.7 | 4 to 8 | 0 | 54 | 35 | 0.0 | 0 | n/a |
| Stone (earth) | Bramble Boar (common) | 5.7 | 9.7 | 4 to 8 | 8 | 85 | 40 | 0.0 | 0 | n/a |
| Stone (earth) | Old Bramblehide (miniboss) | never | never | 60 to 90 | 100 | 605 | 70 | 8.0 | 20 | n/a |

## Listed deviations

- `blades|creature.old_bramblehide`: The policy swings and dodges on a fixed beat and does not read telegraphs, so it falls before it can win. A miniboss is beaten by reading its attacks (design/04), so its time to kill waits for a telegraph-reading bot (M12-03).
- `polearms|creature.old_bramblehide`: The policy swings and dodges on a fixed beat and does not read telegraphs, so it falls before it can win. A miniboss is beaten by reading its attacks (design/04), so its time to kill waits for a telegraph-reading bot (M12-03).
- `archery|creature.old_bramblehide`: The policy swings and dodges on a fixed beat and does not read telegraphs, so it falls before it can win. A miniboss is beaten by reading its attacks (design/04), so its time to kill waits for a telegraph-reading bot (M12-03).
- `unarmed|creature.old_bramblehide`: The policy swings and dodges on a fixed beat and does not read telegraphs, so it falls before it can win. A miniboss is beaten by reading its attacks (design/04), so its time to kill waits for a telegraph-reading bot (M12-03).
- `ember|creature.old_bramblehide`: The policy swings and dodges on a fixed beat and does not read telegraphs, so it falls before it can win. A miniboss is beaten by reading its attacks (design/04), so its time to kill waits for a telegraph-reading bot (M12-03).
- `tide|creature.old_bramblehide`: The policy swings and dodges on a fixed beat and does not read telegraphs, so it falls before it can win. A miniboss is beaten by reading its attacks (design/04), so its time to kill waits for a telegraph-reading bot (M12-03).
- `stone|creature.old_bramblehide`: The policy swings and dodges on a fixed beat and does not read telegraphs, so it falls before it can win. A miniboss is beaten by reading its attacks (design/04), so its time to kill waits for a telegraph-reading bot (M12-03).
