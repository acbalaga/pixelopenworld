# Rootway fight simulator report

Made by `npm run fight-sim:rootway` (POW-M4-21). Do not edit by hand. 100 runs per row on the real sim. Each run is the cave's two hard fights back to back: the snare chamber (R5: three Root Grubs, then a Bramble Boar) and, after a rest at the R7 rest spot, Old Bramblehide in the den (R8). Health and bread carry over between fights; the policy is the one of `npm run fight-sim`.

- **Bare kit** (wooden dagger, ragged clothes, one bread, Blades 0). Design: lost, under 20% won.
- **Target loadout** (any weapon at rank 8, crafted tier 1 leather armor, three dishes). Design: 65 to 80% won, taken over all eight builds.

**Bare kit:** 5% won (5 of 100).
**Target loadout:** 72% won over all builds (578 of 800).

| Character | Won | Win % | Fell in R5 | Fell in R8 | Median clear s |
| --- | --- | --- | --- | --- | --- |
| Bare kit (wooden dagger, rags, one bread) | 5 of 100 | 5% | 3 | 92 | 188.2 |
| Blades (sword), rank 8, leather, three dishes | 79 of 100 | 79% | 0 | 21 | 99.3 |
| Polearms (spear), rank 8, leather, three dishes | 92 of 100 | 92% | 0 | 8 | 90.4 |
| Heavy Arms (maul), rank 8, leather, three dishes | 73 of 100 | 73% | 0 | 27 | 95.8 |
| Archery (bow), rank 8, leather, three dishes | 95 of 100 | 95% | 0 | 5 | 90.8 |
| Unarmed (cloth wraps), rank 8, leather, three dishes | 59 of 100 | 59% | 0 | 41 | 106.8 |
| Ember (fire), rank 8, leather, three dishes | 64 of 100 | 64% | 0 | 36 | 106.6 |
| Tide (water), rank 8, leather, three dishes | 55 of 100 | 55% | 0 | 45 | 117.0 |
| Stone (earth), rank 8, leather, three dishes | 61 of 100 | 61% | 0 | 39 | 114.0 |

## Clear time (estimate)

There is no bot that walks a dungeon, so this is built from measured parts, not a run (see the header of `tools/fight-sim/rootway.ts`). The whole Root Hall route as one script, target loadout, 160 runs: 80 cleared it (50%).

| Part | Seconds |
| --- | --- |
| fights, lit rooms (R3a, R5, R8) | 135 |
| fights, dark gallery (R4, x2) | 24 |
| walking the portals | 28 |
| stump puzzle (R6) | 90 |
| reading 8 rooms | 64 |
| rest (R7) | 20 |

**Estimated clear: 6.0 minutes** for a character that does not fail and does not wander (design: 12 to 18 for a person). This line is informational: it is not held by `--check`.

Where the full Root Hall route is lost (runs that fell, by the room of the fight they fell in): R5 16, R8 36, R3A 17, R4 11.

A build that wins less than another is accepted (owner decision, as in the main report): the bound is on the average.
