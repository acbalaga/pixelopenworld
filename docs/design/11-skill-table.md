# 11 Skill table

The full list of the 36 skills from design/03: how each earns XP, and what it grants at the first two rank bands. Written by POW-M3-01. Techniques at rank 30 and above are authored with the tier 3 to 5 content that needs them (M8, M9) and are listed here only as a theme.

## Reading the table

- **XP event.** The sim event that pays the skill, as named in `src/content/skills/types.ts` (`XpEvent`). A tag narrows it (`damage:heavy` is damage dealt by a Heavy Arms weapon). Events marked _new_ are added by POW-M3-02 or by the ticket that adds the system that sends them.
- **Wired in.** The ticket whose system sends the event. A skill that has no system before a later milestone is marked **pending**, with the milestone that wires it. Pending skills exist in content, show in the Skills tab at 0 with the line "Not yet practiced anywhere", and are listed in `PENDING_SKILLS` so the "every skill earns XP" test knows to skip them. A later ticket that wires one removes it from the list in the same PR.
- **Band 0 / band 15.** What the skill grants at Novice (0) and Apprentice (15). _Active_ means a technique that can be slotted. _Passive_ means it applies on its own while the skill is at that rank. _Innate_ means it comes with the gear, not the skill.
- XP amounts are starting values in `src/content/balance/skills.ts`. POW-M3-12 tunes them against the budget (design/10: about 4 hours of focused use to 50, 14 hours to 100).

## Arms (7)

| Skill       | XP event                     | Wired in | Band 0                                                                                                               | Band 15                                                                    | 30+ theme                    |
| ----------- | ---------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------- |
| Blades      | `damage:blades`              | M1       | Active **Lunge** (exists: fast dash, cuts through)                                                                   | Active **Crosscut**: two quick cuts, the second deals stagger bonus damage | Backstab chains, bleed       |
| Heavy Arms  | `damage:heavy` _new tag_     | M3-04    | Active **Overhead**: slow slam, ground marker, large stagger                                                         | Active **Whirl**: full circle, costly, breaks guards                       | Guard breaks, earthquakes    |
| Polearms    | `damage:polearms`            | M1       | Active **Lunge** (exists: stepping thrust, whole line)                                                               | Active **Sweep**: wide arc, strong push back                               | Vaults, zone control         |
| Archery     | `damage:archery` _new tag_   | M3-04    | Active **Aimed Shot**: hold to charge (standing still charges faster), line                                          | Active **Scatter**: three arrows in a cone                                 | Traps, pins, piercing        |
| Unarmed     | `damage:unarmed`             | M3-04    | Active **Palm**: knockback, refunds Stamina on hit                                                                   | Active **Flurry**: five fast hits, each refunds a little Stamina           | Grapples, counters           |
| Shieldcraft | `block` _new_, `parry` _new_ | M3-04    | Innate with a shield: hold to block, a block begun just before impact parries. Active **Bash**: short shove, stagger | Active **Bulwark**: Warded for a moment (status from M3-09)                | Reflects, party cover        |
| Evasion     | `dodge`                      | M1       | Passive **Light Feet**: perfect dodge window 2 ticks longer                                                          | Active **Shadowstep**: dodge that ends behind the locked target            | Counters after perfect dodge |

## Magic (6)

All spells cost Focus. Status effects named here (Burning, Wet, Warded, Hexed, Dazed, Rooted) are declared in technique data by M3-13 and applied once M3-09 lands.

| Skill   | XP event                                              | Wired in | Band 0                                                 | Band 15                                                                           | 30+ theme                  |
| ------- | ----------------------------------------------------- | -------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------- |
| Ember   | `damage:ember`                                        | M1       | Active **Ember Bolt** (exists: projectile, Burning)    | Active **Flame Ring**: circle around the caster, Burning                          | Fire fields, meteor        |
| Tide    | `damage:tide`                                         | M3-13    | Active **Splash**: cone, Wet, small push               | Active **Undertow**: line that pulls targets in                                   | Floods, bubbles            |
| Gale    | `damage:gale`                                         | M3-13    | Active **Gust**: line, strong knockback                | Active **Tailwind**: self, faster movement, cheaper dodge                         | Tornado, flight hops       |
| Stone   | `damage:stone`                                        | M3-13    | Active **Stone Fist**: heavy short projectile, stagger | Active **Earth Wall**: raises a wall for 4 s that blocks projectiles and movement | Armor, pillars             |
| Mending | `heal` _new_ (Health restored by a Mending technique) | M3-13    | Active **Mend**: heal over time on self                | Active **Ward**: Warded on self (absorbs the next hit)                            | Cleanse, revive companions |
| Hexing  | `damage:hex`, `statusApplied:hexed` _new_             | M3-13    | Active **Hex**: line, Hexed                            | Active **Drain**: damage, heals the caster for half                               | Summons, echoes            |

## Gathering (6)

| Skill     | XP event          | Wired in                                    | Band 0                                       | Band 15                                                         | 30+ theme              |
| --------- | ----------------- | ------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------- | ---------------------- |
| Mining    | `gather:mining`   | M3-06                                       | Passive: can work tier 1 veins at full speed | Passive **Sure Strike**: sweet window 2 ticks wider on veins    | Gem finds, deep veins  |
| Logging   | `gather:logging`  | M3-06                                       | Passive: can work tier 1 trees at full speed | Passive **Clean Cut**: +1 yield on a sweet hit                  | Rare woods, stumps     |
| Foraging  | `gather:foraging` | M1                                          | Passive: herbs and berries                   | Passive **Keen Eye**: rare variants twice as likely             | Truffles, night blooms |
| Fishing   | `gather:fishing`  | M3-06 (placeholder catch), M6-05 (minigame) | Passive: tier 1 waters                       | Passive **Patient Line**: placeholder catch takes 20% less time | Legendary fish         |
| Farming   | `harvest` (later) | **pending, M6-02**                          | Defined, no effect yet                       | Defined, no effect yet                                          | Rotation, giant crops  |
| Husbandry | `tend` (later)    | **pending, M6-03**                          | Defined, no effect yet                       | Defined, no effect yet                                          | Breeding, bonds        |

## Crafting (7)

The manual step for each craft is in the ticket that builds it (POW-M3-07 and POW-M3-14). Every craft pays on `craft` with its craft as the tag. Cooking moves from the old `cook` event to `craft:cooking` in POW-M3-02, with a save migration so no first-time bonus is paid twice.

| Skill       | XP event                         | Wired in            | Manual step         | Band 0                                               | Band 15                                                       | 30+ theme                 |
| ----------- | -------------------------------- | ------------------- | ------------------- | ---------------------------------------------------- | ------------------------------------------------------------- | ------------------------- |
| Smithing    | `craft:smithing`, `repair` _new_ | M3-07               | Timing (hammer)     | Passive: tier 1 recipes; repair own gear at an anvil | Passive **Even Temper**: repairs restore 25% more             | Alloys, named blades      |
| Woodworking | `craft:woodworking`              | M3-07               | Timing (saw stroke) | Passive: tier 1 recipes                              | Passive **True Grain**: Fine or better 10 points likelier     | Bows, furniture sets      |
| Tailoring   | `craft:tailoring`                | M3-14               | Trace (stitch line) | Passive: tier 1 recipes                              | Passive **Tight Seam**: crafted armor has 20% more durability | Cloaks, bags              |
| Cooking     | `craft:cooking`                  | M1 (moved in M3-02) | Rhythm (stir)       | Passive: camp pot dishes                             | Passive **Second Helping**: 1 in 5 dishes makes two           | Feasts, festival dishes   |
| Alchemy     | `craft:alchemy`                  | M3-14               | Hold (heat in band) | Passive: tier 1 potions                              | Passive **Steady Flame**: hold band 20% wider                 | Elixirs, bombs            |
| Enchanting  | `craft:enchanting`               | M3-14               | Trace (rune)        | Passive: first affix slot on tier 1 gear             | Passive: second affix slot                                    | Stronger affixes, rerolls |
| Tinkering   | `craft:tinkering`                | M3-14               | Timing (fit parts)  | Passive: tier 1 gadgets                              | Passive **Spare Parts**: 1 in 4 gadgets refunds one part      | Golem parts (M7)          |

## Social (5)

| Skill       | XP event                                                                                                         | Wired in           | Band 0                                                                          | Band 15                                                                                               | 30+ theme                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------- |
| Bartering   | `haggle` _new_ (an exchange won), `sale` _new_                                                                   | M3-10              | Passive: haggling is offered                                                    | Passive **Read the Room**: one extra counter-offer per exchange                                       | Market fees, caravans      |
| Performance | `perform` _new_ (a song finished)                                                                                | M3-13              | Active **Hum of Courage**: 3 s channel, Stamina regen up for self (party later) | Active **Lullaby**: needs an instrument in the off hand, Dazed on nearby creatures of tier 2 or lower | Crowds, tips (M6-10)       |
| Leadership  | `lead` (later)                                                                                                   | **pending, M5-07** | Defined, no effect yet                                                          | Defined, no effect yet                                                                                | Party buffs, office        |
| Taming      | `tame` (later)                                                                                                   | **pending, M6-06** | Defined, no effect yet                                                          | Defined, no effect yet                                                                                | Commands, second companion |
| Stealth     | `sneak` _new_ (a creature within its notice radius failed to notice a hidden avatar, once per creature per hide) | M3-13              | Active **Hide**: out of combat only, notice radius halved, move at 60%          | Active **Ambush**: the first hit from Hide is a crit                                                  | Pickpocket, shadows        |

## Exploration (5)

| Skill       | XP event                                                                                    | Wired in           | Band 0                 | Band 15                                                  | 30+ theme                    |
| ----------- | ------------------------------------------------------------------------------------------- | ------------------ | ---------------------- | -------------------------------------------------------- | ---------------------------- |
| Cartography | `reveal` (later)                                                                            | **pending, M4-06** | Defined, no effect yet | Defined, no effect yet                                   | Annotations, rumor precision |
| Survival    | `outdoorsNight` _new_ (each in-game hour of night spent in an outdoor room), `eatRaw` _new_ | M3-02              | Passive: none          | Passive **Hardy**: Health regen out of combat 25% faster | Weather resistance           |
| Athletics   | `sprint`                                                                                    | M1                 | Passive: sprint        | Passive **Second Wind**: sprint costs 15% less Stamina   | Climbing, swimming           |
| Deciphering | `tabletRead` _new as XP_, first time per tablet only                                        | M3-02              | Passive: none          | Passive: none (deciphering content arrives in M10)       | Cipher (M10)                 |
| Delving     | `delve` (later)                                                                             | **pending, M4-08** | Defined, no effect yet | Defined, no effect yet                                   | Dungeon senses               |

## Counts

- Wired by the end of M3: 30 skills. Pending: Farming, Husbandry, Leadership, Taming, Cartography, Delving.
- Active techniques by the end of M3: 29 (Arms 13, Magic 12, Stealth 2, Performance 2). Three exist already (Blades Lunge, Polearms Lunge, Ember Bolt), so M3 adds 26.
- Passives authored in M3: the band 0 and band 15 passives above that have an effect.

## Paths authored in M3

Sixteen Paths, as eight opposite pairs (design/03: every Path has a counterpart that plays opposite). Requirements use only skills and deeds that exist by the end of M3. Two are hidden: their requirement text never shows, and the Skills tab hint never points at them. Numbers are starting values in `src/content/balance/paths.ts`.

| Path                | Requirement                                                                                 | Gift (while worn)                                   | Opposite     |
| ------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------ |
| Duelist             | Blades 15, 60 kills with any one-handed weapon, 10 fights won untouched                     | Crit chance +5 points                               | Bulwark      |
| Bulwark             | Shieldcraft 15, 40 parries                                                                  | Blocking costs 30% less Stamina                     | Duelist      |
| Emberhand           | Ember 15, 3,000 Ember damage dealt                                                          | Ember techniques cost 15% less Focus                | Tidecaller   |
| Tidecaller          | Tide 15, 150 targets made Wet                                                               | Wet lasts 50% longer on others                      | Emberhand    |
| Forager             | Foraging 15, 300 forage gathered                                                            | +1 yield on sweet hits at herb and berry nodes      | Prospector   |
| Prospector          | Mining 15, 200 ore gathered                                                                 | Tool durability loss halved on veins                | Forager      |
| Anvil Hand          | Smithing 15, 25 metal items crafted, 20 repairs                                             | Repair at an anvil costs no materials               | Quick Needle |
| Quick Needle        | Tailoring 15, 25 cloth or leather items crafted                                             | Worn crafted armor speeds dodge recovery by 2 ticks | Anvil Hand   |
| Hearth Cook         | Cooking 15, 40 dishes cooked, 10 recipes known                                              | Fed lasts 25% longer                                | Wild Eater   |
| Wild Eater          | Survival 15, 40 raw forage eaten                                                            | Raw forage restores twice as much                   | Hearth Cook  |
| Haggler             | Bartering 15, 30 exchanges won                                                              | Shop buy prices 5% lower (inside the M3-10 bounds)  | Fair Dealer  |
| Fair Dealer         | 60 sales taken at the first price offered, with no haggle                                   | Shopkeepers' purses refill twice as fast for you    | Haggler      |
| Busker              | Performance 15, 30 songs finished                                                           | Songs last 50% longer                               | Shadow       |
| Shadow              | Stealth 15, 60 creatures passed unnoticed                                                   | Hide moves at 80% instead of 60%                    | Busker       |
| Mossfriend (hidden) | Meet 30 Mosslings (one comes within 3 tiles) over three in-game days in which you kill none | Mosslings never attack first                        | Pestward     |
| Pestward (hidden)   | 200 Mossling kills                                                                          | +20% damage to tier 1 creatures                     | Mossfriend   |

Address forms (how NPCs say the worn title) are in `src/content/strings/paths.ts`, one short form per Path ("Duelist", "our cook", "little shadow").
