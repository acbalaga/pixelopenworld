# Sim bot report

Made by `npm run sim-bot` (POW-M3-12). Do not edit by hand. Four v1 policies drive the real sim in the slice's own supply (three herb patches, two berry bushes, a camp pot, a shopkeeper, the guard). Each reports over 60 sim minutes. The bots take every sweet spot and never miss, so these are a fast player's numbers. Every minute the bot saves, and every snapshot is loaded back through the integrity validator.

- Policies: **gather** (Forage the herb patches and berry bushes, sell what is gathered); **fight** (Fight Mosslings with the sword, sell the loot); **craft** (Forage, cook at the camp pot, sell the dishes); **request** (Take Orla's and Wren's requests, then the board's gathering jobs).
- Snapshots validated: 215. Flagged: **0**.

## Time to rank 15

"Time to 15" is when the skill has 14 points and a full bar: the next point waits on a Trial (design/03). The target is derived from the curve: `4 h * xpTo(15) / xpTo(50)`, about 27 minutes. The band is 20 to 40 minutes (M3-02).

| Loop | Skill | Minutes to 15 | In band |
| --- | --- | --- | --- |
| Forage the herb patches and berry bushes, sell what is gathered | Foraging | 29.3 | yes |
| Fight Mosslings with the sword, sell the loot | Blades | 29.6 | yes |
| Forage, cook at the camp pot, sell the dishes | Cooking | 24.5 | yes |

## XP per hour, top four skills of each policy

| Policy | Skill | XP per hour |
| --- | --- | --- |
| gather | Foraging | 6081 |
| gather | Survival | 150 |
| gather | Bartering | 111 |
| fight | Blades | 6316 |
| fight | Evasion | 3937 |
| fight | Survival | 120 |
| fight | Bartering | 21 |
| craft | Cooking | 7056 |
| craft | Foraging | 6081 |
| craft | Survival | 150 |
| craft | Bartering | 60 |
| request | Foraging | 6081 |
| request | Blades | 421 |
| request | Survival | 150 |

## Coin per hour, by activity

Coin per hour is the coin held at the end plus the coin spent, over the window. By source is coin earned.

| Policy | Coin per hour | By source | Deaths | Requests done |
| --- | --- | --- | --- | --- |
| gather | 224 | sale 224 | 0 | 0 |
| fight | 457 | loot 137, echo 218, sale 102 | 4 | 0 |
| craft | 198 | sale 198 | 0 | 0 |
| request | 149 | loot 4, request 145 | 0 | 4 |

## Save summaries

The summary of every snapshot is in `reports/sim-bot-summaries.json` (one per sim minute, per policy).
