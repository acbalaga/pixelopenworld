# Gate G4 checklist

**Question:** does Dawnmeadow deliver its hours budget (about 6 hours first pass, about 20 hours to regional 100%), and does the first hour now start poor, outside town, and read clearly (playtest F1 to F8)?
**If no:** the region counts are re-planned before M8. A finding on a single item is a ticket, not a re-plan. A missed budget or a first hour that does not read is the re-plan.
**Who:** the owner, on a real phone, then on a computer. About 3 hours for the checks, plus the first-pass play.

Record what you see next to each step. A step that behaves differently from "Expect" is a finding. Write it down exactly and send it to the planning agent.

## 0. Before you start

1. On the computer: `npm ci && npm run verify`. It must pass.
2. `npm run pacing`. Expect: the report for Dawnmeadow at or above its budget, with `enforceBudget` on for Dawnmeadow in `tools/pacing-floor.json`. Read the category lines. A category far under its share of the budget is a finding even if the total passes.
3. Deploy a preview (see `docs/ops/deploy.md`) and use that URL on the phone. Make a **new** character. Do not use `?kit=dev`.

## 1. The first hour on the phone (playtest F1 to F8)

Play the first hour as a new player would. Do not read the docs first. Then walk the replay below.

### F1. The action meter is in sight

1. Fell a tree, mine a vein, cook at the pot, trace at the loom, fish.
   Expect: each timing meter sits over the avatar's head, never under the thumb. The avatar visibly works (swing, reach, stir, hands, cast). The thing being worked has a highlight outline. A hit sparks and sounds.
2. Stand at the top edge of a room and gather. Expect: the meter flips below the feet.
3. Play one gather in Classic landscape. Expect: the same.

### F2. A new character knows nothing it has not done

1. Open the Skills tab and the Techniques list on the new character. Expect: both empty, with the empty-state line.
2. Hit something with the wooden dagger. Expect: "Blades awakens" banner. Keep fighting. Expect: Lunge by insight after about 30 hits.
3. Find a manual (the guardhouse notes and the burnt-out shed each hold one) and read it. Expect: the skill awakens and the technique is learned. Read a known one again. Expect: not consumed, with a notice.
4. Ask Tobin, Orla, Hesper and the Pilgrim about teaching. Expect: one choice each, with a small ask.

### F3. Hearthford reads as a town

1. Walk the four roads in. Expect: a gate on each. Beyond the gate, a street.
2. Walk the square, the craft row, the rune house, the inn, the market street, the homes.
   Expect: the square holds civic things only (Waystone, board, notice wall). Each station stands in front of its own workshop. The bed and the storage chest are in the inn.
3. Read the town from a distance. Expect: the bell tower and the mill sails are visible well before the town is.

### F4. The start is poor and outside town

1. Make five new characters (close the game and start a new one each time). Note the wake point.
   Expect: not always the same one. Each wakes outside the walls, with a landmark or the fence in view on the first frame.
2. Check the bag, the gear and the techniques. Expect: one bread, a wooden dagger, ragged clothes, no technique.
3. Let a creature kill you before you touch a Waystone or a bed. Expect: you wake at the wake point.
4. Touch a Waystone, die again. Expect: you wake at the Waystone. Sleep in the inn, die again. Expect: the inn bed.
5. Expect: nothing on screen tells you where the town is, except the landmarks themselves.

### F5. The Rootway is a real challenge

1. With the bare kit, enter the Rootway. Expect: you lose, or you flee. This is meant.
2. Come back with a tier 1 weapon, crafted tier 1 armor and three dishes. Clear it.
   Expect: **12 to 18 minutes** for a first clear. Record the time. Record which route you took (fight, or sneak and climb) and where you rested.
3. Find the shortcut (R7). Expect: it opens from the inside only.
4. Return later for R9. Expect: it needs a heavy hit or a Stone spell, neither likely the first time.

### F6. Creatures act on their nature

1. Walk past a Mossling by day, then at night. Expect: curious by day (it comes to look and follows), territorial at night.
2. Walk into a Bramble Boar's ground. Expect: a warning pose and a ground edge marker first. An attack only if you stay.
3. Walk near Old Bramblehide and Hollowhorn. Expect: a long, hard warning.
4. Hit a defensive creature. Expect: its packmates join.
5. Expect: a "!" over a creature the moment it commits to a chase.

### F7. Messages and the Menu

1. Trigger a hint, a toast, a skill tick and a chat line at once. Expect: each in its own lane. Nothing over the clock. Nothing under the thumb.
2. Open the Menu and visit every tab. Expect: one visual language, no raw panel lists.

### F8. Character creation

1. Make a character with a non-default origin. Expect: only that origin's wake points are drawn, and the first contextual line is its own. No stat, item or XP effect.
2. Try eyes, brows, marks, hair, height, accessory, second cloth color. Expect: each shows on the doll.

## 2. The region (the hours budget)

Play Dawnmeadow as you would. Keep a stopwatch for each of these and write down the time.

1. **First pass:** reach the west edge by the Thornwall Pass dungeon and the Hedge Warden, doing what you like on the way. Budget: about 6 hours. A first pass under 3 hours or over 9 is a finding.
2. **Regional 100%:** the Bestiary, the map, the requests, the Threads, the Trials, the dungeons and the points of interest. Budget: about 20 hours. Do not finish it in one sitting. Note the hour where you first feel the region is thin or repeating, and which part.
3. **Freedom of route.** Reach Whisperwood's edge by the Fernside climb and by the badger tunnels, then by the pass. Expect: each works, each costs something different. Record the time for each (the plan says 15 minutes more than the pass for the two harder ones).
4. **The Hedge Warden.** Fight it. Then, on a second character, resolve it with the Keeper's Bells. Expect: the same reward, a different title line.
5. **Singulars.** Do not look them up. Expect: you may find none in the first pass. That is allowed. If you find one, expect a banner per step and nothing on the Skills or Character tabs.

## 3. Tuning checks carried from the build PRs

These were left for a person to judge because a bot cannot.

| Check                  | Do                                                                                            | Expect                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Rootway first clear    | See F5 above.                                                                                 | 12 to 18 minutes for a person.                                                                     |
| Athletics run          | Run the Athletics Trial.                                                                      | About 50 seconds at par. Under 35 is too easy, over 70 is too hard.                                |
| Cartography Trial      | Run it.                                                                                       | About 120 blocks. Say if it felt like a chore or a toy.                                            |
| Request coin           | Take five requests of different size. Then price what the coin buys in Brin's shop.           | A mid request buys about one useful item, not a stack. Say which request paid wrong.               |
| Distant givers         | Walk from the town gate to the Millbrook, Reedmouth, Stonecrop and Cairnmoor givers and back. | Each is a worthwhile trip (about 1 to 3 minutes out), not a chore. Note any that felt too far.     |
| People move            | Stay in the square through a dusk. Then leave town, return after dark.                        | No one jumps while you watch. The smith is at the inn at dusk, the Pilgrim at the chapel at night. |
| Schedules and services | Find the shop, the Trial givers and the teachers at different hours and in rain.              | Each is where the people table says, or the place beside it. None is lost for good.                |

## 4. Verdict

Record, for the planning agent: the first pass and regional hours you measured, the three things you enjoyed most, the three you would cut, and one of: **pass** (counts hold), **adjust** (counts hold with tickets), **re-plan** (change region counts before M8).
