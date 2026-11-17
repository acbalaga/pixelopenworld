# XP rate report

Made by `npm run xp-report` (POW-M3-02). Do not edit by hand. Each loop is a test bot driving the real sim for 30 minutes of sim time (the loop then runs on, if it has not yet got there, to find the time to rank 15).

- XP to reach 15 points: 4378. To reach 50: 39232.
- Target time to 15: `4 h * xpTo(15) / xpTo(50)` = **26.8 minutes** (design/10). The acceptance band is 20 to 40 minutes.
- "Time to 15" is when the skill has 14 points and a full bar: the next point waits on a Trial (design/03).

| Loop                                            | Skill          | XP in 30 min | XP per hour | Minutes to 15 | In 20 to 40 |
| ----------------------------------------------- | -------------- | ------------ | ----------- | ------------- | ----------- |
| Fight Mosslings with the sword                  | skill.blades   | 4133         | 8266        | 39.3          | yes         |
| Forage the herb patch                           | skill.foraging | 711          | 1422        | 676.1         | deviation   |
| Cook herb tea (foraging the herbs between pots) | skill.cooking  | 748          | 1496        | not in 1200   | deviation   |

Notes for M3-12 (balance harness):

- XP per event falls as the skill rises past the par rank of a tier 1 target (design/03), so the time to 15 is longer than the first 30 minutes of rate suggest.
- Cooking has no timer in the sim yet (the pot is instant), so its loop is paced by foraging the herbs. M3-07 adds the stir step.
- The bots take the sweet spot every time and never miss, so these are fast-player times.
