# XP rate report

Made by `npm run xp-report` (POW-M3-02). Do not edit by hand. Each loop is a test bot driving the real sim for 30 minutes of sim time (the loop then runs on, if it has not yet got there, to find the time to rank 15).

- XP to reach 15 points: 4378. To reach 50: 39232.
- Target time to 15: `4 h * xpTo(15) / xpTo(50)` = **26.8 minutes** (design/10). The acceptance band is 20 to 40 minutes.
- "Time to 15" is when the skill has 14 points and a full bar: the next point waits on a Trial (design/03).

| Loop | Skill | XP in 30 min | XP per hour | Minutes to 15 | In 20 to 40 |
| --- | --- | --- | --- | --- | --- |
| Fight Mosslings with the sword, sell the loot | skill.blades | 4449 | 8898 | 29.6 | yes |
| Forage the herb patches and berry bushes, sell what is gathered | skill.foraging | 4400 | 8800 | 29.3 | yes |
| Forage, cook at the camp pot, sell the dishes | skill.cooking | 4944 | 9888 | 24.5 | yes |

Notes for M3-12 (balance harness):

- XP per event falls as the skill rises past the par rank of a tier 1 target (design/03): a tier 1 target is at the 10% floor by rank 15, so the time to 15 is longer than the first 30 minutes of rate suggest.
- Tuned by M3-12: the loops are the sim bot's (`tools/sim-bot/policies.ts`). Foraging and Cooking are paced by node supply (three herb patches and two berry bushes on the slice), so their XP per event is high; see reports/sim-bot.md and the M3-12 PR for before and after.
- The bots take the sweet spot every time and never miss, so these are fast-player times.
