# Endurance bot report (pre-M5 sense check)

Made on build `626be6f` (after POW-M4-22F, potion stack 20, chest 80). Tools: `tools/endurance-bot/`. Not a ticket; a sense check for the owner after G4.

Three bots:

1. **Map-out bot** (`map.ts`). Plays the real baked Dawnmeadow headless through `stepWorld`: real collision, real portals, real fog, real streaming. It always walks to the nearest tile whose fog block is still dark, and treats every portal as a one-way hop. It has perfect knowledge, takes no detours, opens no locks and solves no puzzles.
2. **Skill-max model** (`rates.ts`, `gather.ts`, `skills.ts`). Event rates come from the real sim loops (sim-bot policies) and from the node layout on the real map (BFS walking tours, node respawn). It integrates the real `xpToNext` curve and the real `challengePct` falloff point by point. It is calibrated against the measured Blades loop (model 25.5 min vs measured 29.6 min to 15; the gap is applied as a downtime factor to the modeled rows).
3. **Visual soak bot** (`visual/soak.spec.ts`). A fresh character in the production build on a Pixel 5 profile. It walks, swings and interacts, then saves, closes, reopens and logs in. It repeats for 10 cycles and checks the seal and the saved and loaded state hash each time.

## Headline

| Question | Answer |
| --- | --- |
| Time to fog-clear all of Dawnmeadow | **23 to 28 sim minutes** of pure walking (sprint 24.5, walk only 28.4, creatures on 25.1, other wake point 22.9). 8,951 of 12,288 blocks (72.8%); the rest is sea and rock. 0 deaths with creatures on. |
| Time to rank 15 in every wired skill | **about 70 h**, plus 195 min of Trials. Fishing alone is 29 h. Without Fishing: about 41 h. |
| Time to the Dawnmeadow ceiling (29 with a full bar; no rank 30 Trial exists) | **about 530 h**. Fishing 281 h, Survival 35 h, Mining 26 h, every crafting skill about 16 h. |
| Skills that cannot reach 15 in Dawnmeadow at all | **Cartography** (0 XP in live play, bug below), **Deciphering** (600 XP total, so 3 points max) |
| Skills with no XP source yet | Farming, Husbandry, Leadership, Taming (pending by design) |
| Save integrity over 10 play, save and reopen cycles | **10 of 10 intact**, every loaded hash equals the saved hash, 0 page errors |

## Findings

**F1. Cartography never earns XP in the live game (bug, high).** `mapSystem` runs after `skillsSystem` in `WORLD_SYSTEMS` (`src/sim/step.ts`). Events are cleared at the start of each tick, so the `revealed` event is never seen by skills. The unit test (`tests/sim/map.test.ts`) calls `mapSystem` then `skillsSystem` by hand, so it passes. Bot proof: same walk, shipped order gives Cartography 0 and 0 XP; with `mapSystem` moved before `skillsSystem`, Cartography reaches 14 with 8,951 XP. Consequences: the reveal radius never grows past 3 blocks, the Cartography rank 15 Trial is unreachable, and every future regional map pays nothing. Fix: move `mapSystem` ahead of `skillsSystem`, and add a test that drives `stepWorld` rather than the systems by hand. Check whether this needs a save migration (it does not change the saved shape, but past walks are lost XP).

**F2. Fishing is supply-starved (balance, high).** The whole region has one `node.fishing_spot`, on a 3-minute respawn, so the ceiling is 0.33 catches a minute. Rank 15 takes about 29 h and the Dawnmeadow ceiling about 281 h. Every other gathering skill reaches 15 in 0.1 to 2.7 h.

**F3. Survival is a 10 to 11 hour grind to 15 (balance, medium).** 30 XP per in-game night hour outdoors means about 3 XP a minute averaged over the day cycle. Eating raw food is the only other source. Compare with the 27-minute design target for a focused skill (design/10).

**F4. Tier 2 supply is thin (balance, medium).** Mining has 2 iron veins and 1 of them cannot be walked to, so 0.13 a minute. Tier 2 foraging nodes are defined (6) but none are placed in Dawnmeadow. From 15 to 29, tier 1 pays the 10% floor, so these skills crawl: Mining 26 h to the ceiling.

**F5. Deciphering caps at 3 points (content, medium).** It pays 100 XP once per tablet kind. There are 7 tablets of 6 kinds, so 600 XP in total. xpTo(15) is 4,378. Its rank 15 Trial exists but cannot be reached. Delving holds 9,080 XP (58 rooms, 6 puzzles, 16 clears), which is enough for 15 and about 23 after the Trial.

**F6. The map is fast to uncover compared with the 20-hour regional budget (pacing, note).** Fog-clearing is about 25 minutes of straight walking with perfect knowledge. A real player walks 3 to 6 times that, which is still a small share of the budget. This is fine if the 100% target counts POIs, dungeons and the Bestiary (it does), but fog alone will not carry exploration time. The bot came within 6 tiles of 21 to 24 of the 30 POIs just by clearing fog. The ones it missed are indoors or in dungeons.

**F7. Combat is very quick once tier 2 foes are in reach (balance, note).** At 8 points against tier 2 foes (par 15) the pay is up to 150%, and the model gets Blades to 15 in about 12 minutes. The measured tier 1 loop takes 29.6 minutes. Expect players who find the boars early to skip the 20-to-40-minute band.

**Soak, for the broken save.** 10 of 10 cycles stayed sealed and intact with matching hashes, including 7 cycles where the test server had died and the game ran offline from the service worker (7 console errors for `/api/time` refused; test setup, not the game). The bot did not reproduce the G4 broken save. The two latest save-touching changes (chest 40 to 80, potion stack 20) only raise caps that the validator checks as upper bounds, so a save written before them should still pass. To diagnose, the flag reason shown under "Save flagged, Tap for details" is the thing to capture.

## Skill table (to rank 15 and to the Dawnmeadow ceiling)

"How": measured is a real-sim loop; real-map uses node positions and respawns on the baked map; modeled uses a stated rate (see `skills.ts`). Hours exclude Trial time.

| Skill | How | To 15 | To ceiling (29 + bar) | Rate basis |
| --- | --- | --- | --- | --- |
| Blades | measured | 0.2 to 0.5 h | 1.2 h | 46 hits/min |
| Heavy Arms, Polearms, Archery, Unarmed | modeled | 0.2 to 0.5 h | 1.2 h | Blades hit rate |
| Ember, Tide, Gale, Stone, Hexing | modeled | 0.2 to 0.5 h | 1.2 h | Blades hit rate; Focus will slow these |
| Shieldcraft | modeled | 0.8 h | 6.3 h | parries at dodge rate |
| Evasion | measured | 1.3 h | 10.5 h | 4.4 dodges/min in fight loop |
| Mending | modeled | 5.2 h | 17.2 h | 4 heals/min at 4 XP |
| Mining | real-map | 2.7 h | 25.8 h | 19 copper (3.6/min), 2 iron (0.13/min) |
| Logging | real-map | 1.5 h | 12.7 h | 54 oak, 14 ash |
| Foraging | real-map | 0.1 h | 1.4 h | 191 patches and bushes (8.9/min) |
| Fishing | real-map | **29.1 h** | **281 h** | 1 spot (0.33/min) |
| Cooking | measured | 0.2 h | 2.3 h | 1.4 crafts/min |
| Smithing, Woodworking, Tailoring, Alchemy, Enchanting, Tinkering | modeled | 1.0 to 1.7 h | 15.5 to 16.1 h | cooking loop rate at 25 XP |
| Bartering | modeled | 2.9 h | 9.8 h | 2 haggles, 4 sales/min |
| Performance | modeled | 1.7 h | 5.7 h | a song every 15 s |
| Stealth | modeled | 4.2 h | 16.3 h | 2 sneaks/min |
| Survival | modeled | **10.6 h** | 34.7 h | night outdoors plus raw food |
| Athletics | measured | 0.5 h | 1.7 h | map bot sprinting, 160 XP/min |
| Cartography | finite | never (F1) | never | 8,951 XP if fixed, so about 23 after the Trial |
| Deciphering | finite | never (3 points) | never | 600 XP total |
| Delving | finite | about 23 points total | about 23 | 9,080 XP total |

## Limits of this check

- The map bot knows the map, never gets lost, and walks the shortest way. Real first-pass times are several times longer.
- Modeled rows are only as good as their stated rates. The ones that drive the conclusions (Fishing, Mining, Survival, Cartography, Deciphering) come from content counts and the curve, not from guesses.
- Trials are counted at their `estMinutes`, not played.
- No rank 30 Trials exist yet, so "max" here is the Dawnmeadow ceiling, not rank 100.

## Rerun

```
npx tsx tools/endurance-bot/map.ts --cap 240 [--fix-order] [--walk] [--foes] [--wake w7] --out map.json
npx tsx tools/endurance-bot/rates.ts 20
npx tsx tools/endurance-bot/skills.ts '{"athleticsXpPerMin":160,"mapBlocks":8951}'
npm run build && SOAK_CYCLES=10 npx playwright test -c tools/endurance-bot/visual/playwright.config.ts --trace off
```
