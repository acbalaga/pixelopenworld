# Sim bot report

Made by `npm run sim-bot` (POW-M3-12). Do not edit by hand. Four v1 policies drive the real sim in the slice's own supply (three herb patches, two berry bushes, a camp pot, a shopkeeper, the guard). Each reports over 60 sim minutes. The bots take every sweet spot and never miss, so these are a fast player's numbers. Every minute the bot saves, and every snapshot is loaded back through the integrity validator.

- Policies: **gather** (Forage the herb patches and berry bushes, sell what is gathered); **fight** (Fight Mosslings with the sword, sell the loot); **craft** (Forage, cook at the camp pot, sell the dishes); **request** (Take Orla's and Wren's requests, then the board's gathering jobs); **fish** (Fish a stretch of river bank, sell the catch); **survive** (Walk a circuit of camps, sleep out at each and stand there a while).
- Snapshots validated: 341. Flagged: **59**.
  - request minute 1: REQUEST_STATE
  - request minute 2: REQUEST_STATE
  - request minute 3: REQUEST_STATE
  - request minute 4: REQUEST_STATE
  - request minute 5: REQUEST_STATE
  - request minute 6: REQUEST_STATE
  - request minute 7: REQUEST_STATE
  - request minute 8: REQUEST_STATE
  - request minute 9: REQUEST_STATE
  - request minute 10: REQUEST_STATE
  - request minute 11: REQUEST_STATE
  - request minute 12: REQUEST_STATE
  - request minute 13: REQUEST_STATE
  - request minute 14: REQUEST_STATE
  - request minute 15: REQUEST_STATE
  - request minute 16: REQUEST_STATE
  - request minute 17: REQUEST_STATE
  - request minute 18: REQUEST_STATE
  - request minute 19: REQUEST_STATE
  - request minute 20: REQUEST_STATE
  - request minute 21: REQUEST_STATE
  - request minute 22: REQUEST_STATE
  - request minute 23: REQUEST_STATE
  - request minute 24: REQUEST_STATE
  - request minute 25: REQUEST_STATE
  - request minute 26: REQUEST_STATE
  - request minute 27: REQUEST_STATE
  - request minute 28: REQUEST_STATE
  - request minute 29: REQUEST_STATE
  - request minute 30: REQUEST_STATE
  - request minute 31: REQUEST_STATE
  - request minute 32: REQUEST_STATE
  - request minute 33: REQUEST_STATE
  - request minute 34: REQUEST_STATE
  - request minute 35: REQUEST_STATE
  - request minute 36: REQUEST_STATE
  - request minute 37: REQUEST_STATE
  - request minute 38: REQUEST_STATE
  - request minute 39: REQUEST_STATE
  - request minute 40: REQUEST_STATE
  - request minute 41: REQUEST_STATE
  - request minute 42: REQUEST_STATE
  - request minute 43: REQUEST_STATE
  - request minute 44: REQUEST_STATE
  - request minute 45: REQUEST_STATE
  - request minute 46: REQUEST_STATE
  - request minute 47: REQUEST_STATE
  - request minute 48: REQUEST_STATE
  - request minute 49: REQUEST_STATE
  - request minute 50: REQUEST_STATE
  - request minute 51: REQUEST_STATE
  - request minute 52: REQUEST_STATE
  - request minute 53: REQUEST_STATE
  - request minute 54: REQUEST_STATE
  - request minute 55: REQUEST_STATE
  - request minute 56: REQUEST_STATE
  - request minute 57: REQUEST_STATE
  - request minute 58: REQUEST_STATE
  - request minute 59: REQUEST_STATE

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
| request | Blades | 642 |
| request | Survival | 300 |
| request | Cartography | 54 |
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
