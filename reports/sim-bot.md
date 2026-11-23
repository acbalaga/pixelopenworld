# Sim bot report

Made by `npm run sim-bot` (POW-M3-12). Do not edit by hand. Four v1 policies drive the real sim in the slice's own supply (three herb patches, two berry bushes, a camp pot, a shopkeeper, the guard). Each reports over 60 sim minutes. The bots take every sweet spot and never miss, so these are a fast player's numbers. Every minute the bot saves, and every snapshot is loaded back through the integrity validator.

- Policies: **gather** (Forage the herb patches and berry bushes, sell what is gathered); **fight** (Fight Mosslings with the sword, sell the loot); **craft** (Forage, cook at the camp pot, sell the dishes); **request** (Take Orla's and Wren's requests, then the board's gathering jobs); **fish** (Fish a stretch of river bank, sell the catch); **survive** (Walk a circuit of camps, sleep out at each and stand there a while).
- Snapshots validated: 336. Flagged: **0**.

## Time to rank 15

"Time to 15" is when the skill has 14 points and a full bar: the next point waits on a Trial (design/03). The target is derived from the curve: `4 h * xpTo(15) / xpTo(50)`, about 27 minutes. The band is 20 to 40 minutes (M3-02) for combat. Foraging and Cooking are slower on purpose, 35 to 70 minutes: on the first map they are paced by how fast the nodes come back, and the slow pace pays in kind (a large first-time bonus for every new herb and dish, and a sale price for what is made).

| Loop | Skill | Minutes to 15 | Band | In band |
| --- | --- | --- | --- | --- |
| Forage the herb patches and berry bushes, sell what is gathered | Foraging | 51.7 | 35 to 70 | yes |
| Fight Mosslings with the sword, sell the loot | Blades | 28.6 | 20 to 40 | yes |
| Forage, cook at the camp pot, sell the dishes | Cooking | 41.9 | 35 to 70 | yes |
| Fish a stretch of river bank, sell the catch | Fishing | 56.2 | 35 to 70 | yes |
| Walk a circuit of camps, sleep out at each and stand there a while | Survival | 45.0 | 35 to 70 | yes |

## XP per hour, top four skills of each policy

| Policy | Skill | XP per hour |
| --- | --- | --- |
| gather | Foraging | 4650 |
| gather | Survival | 300 |
| gather | Bartering | 111 |
| gather | Cartography | 64 |
| fight | Blades | 6322 |
| fight | Evasion | 2962 |
| fight | Survival | 240 |
| fight | Cartography | 189 |
| craft | Cooking | 5115 |
| craft | Foraging | 4659 |
| craft | Survival | 300 |
| craft | Cartography | 67 |
| request | Foraging | 4650 |
| request | Blades | 642 |
| request | Survival | 300 |
| request | Cartography | 68 |
| fish | Fishing | 4542 |
| fish | Survival | 300 |
| fish | Cartography | 85 |
| fish | Bartering | 24 |
| survive | Survival | 5800 |
| survive | Cartography | 291 |

## Coin per hour, by activity

Coin per hour is the coin held at the end plus the coin spent, over the window. By source is coin earned.

| Policy | Coin per hour | By source | Deaths | Requests done |
| --- | --- | --- | --- | --- |
| gather | 224 | sale 224 | 0 | 0 |
| fight | 654 | loot 161, echo 349, sale 144 | 2 | 0 |
| craft | 225 | sale 225 | 0 | 0 |
| request | 79 | loot 4, request 75 | 0 | 2 |
| fish | 188 | sale 188 | 0 | 0 |
| survive | 0 | none | 0 | 0 |

## Save summaries

The summary of every snapshot is in `reports/sim-bot-summaries.json` (one per sim minute, per policy).
