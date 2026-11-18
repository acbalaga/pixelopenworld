# 03 Progression

## Principles

- No classes. No character level. No stat points to allocate.
- Doing a thing makes you better at that thing.
- Nothing is permanently missable or locked out by an earlier choice.
- Power is visible in the world: titles over your head, how Travelers and NPCs address you, what you are allowed to automate.

## Skills

Thirty-six skills in six families. Each runs 0 to 100. The full table (XP sources, what each rank band grants) is in [11-skill-table](11-skill-table.md).

| Family          | Skills                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| Arms (7)        | Blades, Heavy Arms, Polearms, Archery, Unarmed, Shieldcraft, Evasion      |
| Magic (6)       | Ember, Tide, Gale, Stone, Mending, Hexing                                 |
| Gathering (6)   | Mining, Logging, Foraging, Fishing, Farming, Husbandry                    |
| Crafting (7)    | Smithing, Woodworking, Tailoring, Cooking, Alchemy, Enchanting, Tinkering |
| Social (5)      | Bartering, Performance, Leadership, Taming, Stealth                       |
| Exploration (5) | Cartography, Survival, Athletics, Deciphering, Delving                    |

### Earning skill XP

- XP comes from successful, meaningful use. A hit that deals damage, a node gathered, an item crafted, a sale haggled, a tile mapped.
- XP scales with challenge. Target tier relative to skill rank sets a multiplier: far below gives 10%, at par gives 100%, above gives up to 150%. Hitting a training dummy stops paying after rank 15.
- First-time bonus: the first craft of a recipe, first catch of a species, first kill of a creature each give a lump of XP. This rewards breadth.
- Curve: XP to next point grows smoothly. Budget is roughly 4 hours of focused manual use to reach 50 and 14 hours to reach 100 in a single skill. Related skills and Routines make the real total far lower than 36 times that (see 10-content-budget).

### Awakening and sources

A new character has no skills to look at and no techniques to choose from (D17). What they become starts with what they first do.

**Dormant and awake.** Every skill starts **dormant**: it does not show in the Skills tab, its techniques do not show in the Techniques list, and nothing hints at it. The first XP event for a skill **awakens** it. Awakening shows a small banner ("Foraging awakens") and the skill appears at 0 points with its XP already counting. A skill never goes back to sleep.

Holding a weapon does not awaken its skill. Landing the first hit with it does. Reading a manual awakens its skill. Being taught by a person awakens it too, so a teacher can open a skill the player has never used.

**Every technique has a source.** Reaching a technique's band makes it learnable. A source makes it known.

| Source  | How it is known                                                                                                   | Used for                                                                                 |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Innate  | Comes with the weapon or off-hand while it is held, from the first hit                                            | The basic swing of each weapon family, block and parry with a shield                     |
| Insight | Earned on its own after a counted amount of practice with the skill (`insightUses` in balance), shown as a banner | The first active of each Arms skill, Evasion's Light Feet                                |
| Trial   | Passing the rank's Trial makes the band's techniques known                                                        | Band 15 and later actives and passives, so the rank-up moment is also the new move       |
| Taught  | A named person teaches it, usually for a small task, coin or a request                                            | Magic, songs, Stealth's Hide                                                             |
| Manual  | A book, scroll or carving found in the world is read once                                                         | Alternatives to a teacher, odd techniques, a second way in for a player who avoids towns |

Rules:

- Every technique that is taught also has a second source somewhere in its region (a manual, an insight, or a Singular), so a player who skips a person is never locked out (Principles: nothing permanently missable).
- Insight thresholds count meaningful uses, the same events that pay XP. A training dummy counts until rank 5.
- A manual is an item. Reading it consumes it and writes the learned flag. Copies exist, so selling or losing one is not a loss.
- Nothing at creation awakens a skill. The wooden dagger awakens Blades with the first hit.

The full source of every band 0 and band 15 technique is in [11-skill-table](11-skill-table.md), "Sources".

### Mastery ranks and Trials

| Points | Rank        | Unlocks                                                          |
| ------ | ----------- | ---------------------------------------------------------------- |
| 0      | Novice      | Basics                                                           |
| 15     | Apprentice  | Second technique tier, tier 2 to 3 materials and recipes         |
| 30     | Journeyman  | Third technique tier, tier 4 to 5 content                        |
| 50     | Expert      | **Routines for this skill** (see 06-automation), tier 6 content  |
| 75     | Master      | Signature technique, tier 7 to 8 content, can teach (Leadership) |
| 100    | Grandmaster | Capstone, unique title, cosmetic aura                            |

Crossing 15, 30, 50, 75, and 100 requires a **Trial**: a short, authored, manual test for that skill given by a specific person or place in the world. A smith asks for a blade of a given quality. A river spirit wants a fish caught at night in rain. Skill XP is banked at the threshold until the Trial is passed. Trials cannot be automated. This keeps every rank a moment the player remembers.

### Techniques

Each skill grants techniques at ranks, each through a source (see Awakening and sources). Arms and Magic techniques are active combat abilities slotted into the four action slots. Gathering and Crafting techniques are passives and minigame aids. Social and Exploration techniques are a mix (Stealth has actives, Cartography has passives).

Any technique from any skill can be slotted together. A Tide spell, a Blades combo ender, a Performance buff song, and a Taming command is a legal loadout.

## Attributes

Three pools, derived, never allocated.

| Pool    | Used for                                     | Grows from                                                   |
| ------- | -------------------------------------------- | ------------------------------------------------------------ |
| Health  | Staying alive                                | Sum of Arms, Survival, Athletics, Husbandry ranks, plus food |
| Stamina | Sprint, dodge, weapon techniques, gathering  | Arms, Gathering, Athletics ranks                             |
| Focus   | Magic, crafting precision, social techniques | Magic, Crafting, Social, Deciphering ranks                   |

A pure crafter still gains Health slowly and has a large Focus pool. A pure fighter has little Focus. This is the whole "build" system and it needs no menu.

Gear adds attack, defense, and affixes. Food adds timed buffs. Together these, not a level number, decide whether a region is survivable.

## Paths

A Path is an identity the world recognizes. Paths are earned, not chosen, and the requirements are hidden until met or hinted at.

- 60 Paths: 48 standard, 12 hidden.
- Requirement is a combination of skill ranks and deeds. Deeds are counted things: dishes cooked for others, creatures tamed, tablets read, duels won, coin earned from trade, nights spent outdoors.
- Earning a Path gives: a title, one unique passive or technique, a change in how NPCs and Travelers address and react to the player, and sometimes a cosmetic.
- A player may hold every Path they earn. Up to three are **worn** at once. Worn Paths set the title shown and which passives are active. Swapping is free at any bed.

Examples (full list is authored in POW-M3-08 and extended per region):

| Path               | Requirement sketch                                                   | Gift                                       |
| ------------------ | -------------------------------------------------------------------- | ------------------------------------------ |
| Spellblade         | Blades 30 and any Magic 30, land 200 spell-then-strike combos        | Weapon strikes carry the last element cast |
| Wandering Chef     | Cooking 50, cook in 6 regions, feed 30 different Travelers           | Camp meals buff the whole party longer     |
| Beast Warden       | Taming 50, Husbandry 30, 12 species tamed                            | Second active companion                    |
| Merchant Prince    | Bartering 75, own 3 shops, 1,000,000 coin lifetime trade             | Market fee waived, caravan Routine         |
| Hermit             | 20 in-game nights outdoors alone, Survival 50, no party for 10 hours | Strong solo buffs away from towns          |
| Cartographer Royal | Cartography 75, map every continental chunk                          | Sell maps, see rumor marks precisely       |
| Pacifist           | Reach tier 5 region with zero kills                                  | Creatures do not aggro first (hidden Path) |
| Night Mayor        | Leadership 50, be elected in a hub, hold office through one season   | Town services discount, town projects      |

Design rule: for every Path there is a different Path that plays opposite to it. No Path is strictly best.

## Singulars

The first inspiration principle (D23). A **Singular** is a rare hidden questline that starts from an odd action at an odd place. It is never posted on a board, never offered by a menu, and never marked on the map before the player finds it.

- **How one starts.** A trigger the player could stumble on: sleep in a ruin three nights running, feed the same stray five days in a row, play a song at a grave, carry a particular stone to the top of the mill, lose a fight to a named creature and come back. The trigger is data (a deed count, a place, a time, a held item, a weather) and the sim checks it.
- **What it is.** Three to six authored steps, each found in the world rather than told. The steps can cross regions. At least one step uses a non-combat skill.
- **What it gives.** Something nothing else gives: a one-of-a-kind item with its own history line, a technique with no other source, a hidden Path, a cosmetic, a place that opens. Never raw power beyond the tier of the region it ends in.
- **Firsts.** Finishing one is a world first. From M5 the world notices: a System line, Travelers talk about it, the ranking for Singulars moves. Before M5 it is a banner and a Chronicle entry.
- **Never missable.** A Singular never expires and no Traveler can take it first. Time and season triggers come round again. Branches inside a Singular may change its reward, never remove it.
- **Lore.** A Singular may touch the hidden layer only under the delivery rules in design/08. Its text never explains it.
- **Budget.** Three per region in Dawnmeadow (POW-M4-20). Later regions set their own count in their region doc. Singulars sit beyond 100% (design/10), like hidden Paths.

## Forms (late game)

"Become what you want" extends past being human. Six Forms are discoverable from tier 5 onward. Each is found through a hidden questline, changes the avatar's sprite and movement, and trades something away.

Sketch: Wolfkin (speed and tracking, cannot use shops while shifted), Wisp (pass through thin walls, cannot hold weapons), Stoneborn (huge defense, cannot swim), Tideling (breathe underwater, weak to heat), Shade (invisible at night, harmed by daylight), and a sixth that is a lore reward and listed only in the spoilers doc.

A Form is toggled at a shrine or by an item. It is never permanent.

## Respec and regret

- Skills never decay.
- There is nothing to respec because nothing was allocated.
- Worn Paths, loadouts, and Forms swap freely.

## Renown

Each region tracks Renown with the player, raised by requests, Trials, defending settlements, and trade. Renown opens housing plots, shop licenses, festival roles, and guild offers. It is the measure of belonging, separate from power.
