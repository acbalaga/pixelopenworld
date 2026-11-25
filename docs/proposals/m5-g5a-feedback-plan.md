# Gate G5a feedback: plan and design briefs

**Status:** proposal for the owner and the planning agent. Nothing here changes `docs/design/` or `docs/tech/`. Each brief says what it would add, where it overlaps an existing ticket, the options, and a recommendation. Approve a brief and it becomes a ticket.

**Source:** the owner's Gate G5a playtest (evening and early morning in Hearthford, phone). The crowd feels populated and fun. Feedback: Travelers stuck in buildings, raids in groups, Travelers resting at rest areas, a rest area that can be used, an NPC too near the dummy, an underground Player vs Traveler arena found through chat rumors, and more humorous things Travelers do.

## Already done (PR for POW-M5-23 to M5-25)

| Feedback                      | What was done                                                                                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NPC and dummy stuck           | Touch input is released when a panel opens (the likely cause). Orla moved to the far corner of the guard yard. POW-M5-23, merged.                                                                                                                              |
| Travelers stuck in buildings  | A Traveler on a solid tile, or promoted onto one, goes back to the nearest open ground (never a one-tile pocket). POW-M5-24.                                                                                                                                   |
| Rest area active and apparent | Rest points in the wild can be used from the front. A small "Camp" panel offers Sleep. A night there gives half a bedroll's Rested (`campRestedShare`, tunable). A "z" mark shows over each rest point within 20 tiles, with the other giver marks. POW-M5-25. |

Decisions in M5-25 you may want to change (all are numbers or one line):

- Half a bedroll is a guess. A camp that gave full Rested would make beds pointless. A camp that gave none would make the panel pointless. Tune `campRestedShare` in `src/content/balance/world.ts`.
- A rest point inside a dungeon works the same way as one outside. It does not give the outdoor Survival lump there.
- The mark follows the "show giver marks" setting. If you want it always on, say so.

## Brief 1: Travelers rest at rest points

**What the player sees.** Travelers who are AFK, tired of a long grind, or between trips walk to a rest point, sit or lie by it, and sometimes share a line ("stew is on", "five more minutes"). A rest point with two or three Travelers at dusk looks like a camp.

**Fits.** The abstract sim already has activities `afk`, `social`, `travel` (design/12 3.2) and per-place standing slots (`src/content/people/placeSpots.ts`). Rest points are baked fixtures with known positions.

**Options.**

- A. Add rest points as places with slots, and let the `afk` and `social` choices pick them at dusk and night (weighted by archetype: Casual, Explorer, Roleplayer most). Cheap, uses what exists.
- B. A new `rest` activity with its own duration and a small effect on the Traveler (a rested Traveler gains a little pace, so the crowd's progress stays bounded by the plateau rules).

**Recommendation.** A. It is a place and weights, no new activity, no new saved field. Add B only if A looks thin in a playtest.

**Size and depends.** S to M. Depends on POW-M5-25 and POW-M5-04. Needs a baked place per rest point in Dawnmeadow (6 in the region spec) in `places.ts` and `placeSpots.ts`.

**Acceptance sketch.** At dusk, at least one Traveler is at a rest point in 8 of 10 seeded evenings. None stands on the fixture itself. Traveler counts stay inside the frame budget.

**Risk.** Rest points far from town may never be promoted (nobody sees them). Choose the nearest two or three, and let the others wait.

## Brief 2: Traveler raid parties

**What the player sees.** Groups of three to five Travelers form, walk together to a creature area or a field boss, fight it, and report in chat ("down on the second try", "no drop again"). The player can see them leave and return.

**Fits.** This overlaps two existing tickets, so it should not be a third system:

- POW-M5-07 (parties and companion AI) already gives Travelers roles and party behaviour for the player's runs.
- POW-M5-11 (world events) already has "field raid, several per real day, Travelers converge".

**Options.**

- A. Travelers-only raid parties inside the abstract sim: a group activity at a field boss spot on a schedule, reported in chat. The player sees them if they are nearby (promoted). No player participation.
- B. Fold it into M5-11: the scheduled field raid spawns a boss, Travelers form raid parties and converge, the player can join. This is the full version.
- C. Both: A now so the world feels alive before Gate G5b, B when M5-11 lands.

**Recommendation.** C, with A as a small ticket now. It gives the "raid in groups" you saw missing without waiting for the event system, and A's group formation is reused by B.

**Size and depends.** A is M, depends on POW-M5-04 and the existing `formGroups`. B is M5-11 as written. Both need no saved field for A.

**Acceptance sketch.** A group of 3 to 5 forms from friends or guild mates, walks to the raid spot as a group, and the chat reports an outcome from the event stream. Frame budget holds with 15 promoted Travelers (the M5-11 acceptance).

**Risk.** Travelers fighting a boss need a rule for who wins. Use the abstract roll the crowd already uses for fights, and never let the loot touch the player.

## Brief 3: The underground Player vs Traveler arena

**What the player sees.** A rumor in chat ("someone said there is a pit under the old yard") sends the player looking. After a few clues the player finds a hidden way down, and finds an arena where Travelers duel and where the player can challenge one. Results go on the Duels board.

**Fits.**

- POW-M5-12 (duels, rivals, mail) already defines a non-lethal duel (first to lose 30% health), acceptance by temper and regard, a result recorded as memory and on the Duels board. The arena would be a place for those duels, not a new rule set.
- POW-M5-06 (reply chips) is where the player answers a Traveler's rumor.
- The rumor table (`src/content/chat/rumors.ts`) and the rule "rumors never mention the hidden layer" (design/12 4.6).

**Options.**

- A. A place only: a hidden room under the Hearthford guard yard with a ring and Travelers who gather to duel each other and the player. Found by three linked rumors plus one world action.
- B. A place plus a ladder: ranked fights, a Traveler champion, a prize. This is a value-creating system.
- C. A place with spectators and no stakes, as the fun first version, with the ladder added later.

**Recommendation.** A (or C, which is A plus spectators). No coin wagers and no prizes in v1. That keeps it out of the integrity ledger and out of the economy. The Duels board already exists and is the reward.

**How the player finds it.** Three rumors, said by Travelers over a few real days, each true and each a little more specific. Because rumors are template chat, they are written the same way as the M5-15 rumors, with a flag so a Traveler only repeats them after the player has done the step before. The world action is one interactable (a loose barrel or a floor stone) in the guard yard, which opens a stair.

**Needs from the planning agent before a ticket.**

1. Does an arena under a hub collide with the "dev rooms" clue family in design/08 (sealed rooms under hubs)? It must not look like it, and the arena should not be a sealed room.
2. Is it acceptable to show a Traveler duel to the player in the arena, since design/12 4.8 says Travelers are never cruel? The M5-12 rule (first to 30%) keeps it sporting.
3. Is the arena one place, or one per region later?

**Size and depends.** L. Depends on POW-M5-06 and POW-M5-12.

**Acceptance sketch.** The three rumors are each said at least once in a simulated 7 real days and are true. The stair opens only after the world action. A duel in the arena records a result on the Duels board once.

**Risk.** A hidden place can be a progress blocker if rumors are missed. It must be optional (nothing else needs it), and it must not be the only way to anything.

## Brief 4: A recovery bonus at rest points (if you want more than M5-25)

M5-25 already gives a half-length Rested at a camp. If you want a bigger reward, the options are:

- A. A small heal over time while resting (Mending-like), no Rested. Easy to explain, easy to balance.
- B. Rested at a higher share, with a cost (a food or a coin cost per night) so beds stay worth building.
- C. Keep as is.

**Recommendation.** C until the playtest says it feels weak. The bed and the camp should differ by convenience and length, not by a separate power system.

## Brief 5: More humorous things Travelers do

Each is a small ticket (S), mostly chat plus a short behaviour, none touching the economy. Ordered by how cheaply they use what exists.

| Idea                     | What it is                                                                                                     | Uses                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Fountain wishes          | A Traveler tosses a coin at the fountain and says a wish. Rarely, a "wish came true" line later.               | `state.idle` templates, a place slot at the fountain |
| Arguments with the dummy | A Traveler loses to the training dummy, demands a rematch, and blames the dummy.                               | Existing dummy jokes, a fight loop                   |
| Inn dance-offs           | Two or three friends dance at the inn at dusk. The `dance` entity mode exists.                                 | `EntMode` `dance`, `formGroups`                      |
| Fish stories             | At the jetty a Traveler announces a catch that gets bigger each time they retell it, and a friend teases them. | Fishing record board, exchanges                      |
| Boar loose               | A boar runs through the square. Travelers flee and shout, the player can help.                                 | Roamer creature, chat events                         |
| Hat day                  | On a scheduled day many Travelers wear the same silly hat.                                                     | `look` variants, M5-11 calendar                      |
| Snoring AFK              | Sleeping Travelers show a floating "z". Poking one (an emote) wakes them with a grumpy line.                   | `afk`, reply chips (M5-06)                           |
| Wrong number             | A Traveler whispers the player by mistake, apologises, stays friendly.                                         | Whisper channel (M5-06)                              |
| Race you                 | xVoltx challenges the player to a timed run and posts the time.                                                | Existing Trial times, M5-12                          |
| Ghost stories at camp    | At a rest point at dusk, Travelers tell short, silly stories.                                                  | Brief 1                                              |

**Recommendation.** Pick three for the first pass: fountain wishes, inn dance-offs and ghost stories at camp. They need no new system and all three show in the first minute of a playtest.

## Suggested order

1. **Now (done):** POW-M5-23, 24, 25.
2. **Next small tickets, any order:** Brief 1 (Travelers rest at rest points), Brief 5 first three.
3. **After Gate G5a passes, with wave C:** Brief 2 option A, then fold B into POW-M5-11.
4. **After POW-M5-12:** Brief 3, the arena, with the three rumors written in the same ticket.
5. **Only if the playtest asks:** Brief 4.

## Questions for the owner

1. Is half a bedroll the right Rested at a camp, or do you want it to feel different from a bed in another way (Brief 4)?
2. For Brief 3: is it fine that the arena has no prizes at first?
3. For Brief 2: do you want A (Travelers raid on their own) before the full raid event, or wait for POW-M5-11?
4. Which three of the ten humorous ideas should go first?
