# 07 The simulated MMO

The world must feel like an online game with real people in it. It is single-player. The crowd is simulated. On the surface the fiction treats Travelers as other players. What they really are is the game's mystery (spoilers doc).

## Travelers

240 persistent Travelers, generated once per save from the world seed, then simulated for the life of the save.

Each Traveler has:

| Field | Notes |
|---|---|
| Handle | Gamer-style names in several naming cultures. Some plain, some silly. |
| Look | Paper-doll avatar from the same parts the player uses |
| Build | Skill ranks that grow over time. They have Paths too. |
| Archetype | Grinder, Explorer, Socializer, Crafter, Trader, Roleplayer, Completionist, Casual, Newbie, Veteran |
| Schedule | When they are "online", in real local time. A student type plays evenings and weekends. A night-shift type plays mornings. Some are almost always on. One never logs out. |
| Home region and guild | Where they hang out, who they run with |
| Voice | A phrase set and style: terse, emoji-heavy, formal, jokes, lowercase |
| Memory | What the player did with or near them: fought together, traded, gifted, beat them in a duel, stood them up |
| Regard | Stranger, Acquaintance, Friend, Close Friend (and Rival as a separate flag) |

Travelers progress at roughly the pace of a moderately active player, keyed to the save's total playtime and to real days elapsed. Some are always ahead of the player, some behind. A Newbie the player helps in hour 5 can be a Master smith in hour 80 and remember who helped.

### Presence

- About 20 to 45 are online at a time depending on real time of day. Evenings are busy.
- Online Travelers exist somewhere in the world doing something appropriate. Those near the player are simulated as full entities. Those elsewhere are simulated abstractly (location, activity, outcomes) at a coarse tick.
- They gather, fight, craft, sell, idle in town squares, sit at the inn, go AFK at the fountain, dance at festivals.
- They are seen arriving and leaving by Waystone, and logging out (a brief shimmer).

## Chat

A chat ticker sits on the HUD (two lines, tap to open). Channels: World, Local, Party, Guild, Whisper, System.

- **Every line is generated from a real sim event or state** using templates filled in the speaker's voice. A Traveler really did just loot that drop, really is looking for a party for that dungeon, really is complaining about the price of iron because the price really rose.
- Categories: looking for group, trade offers, brags, questions, answers (sometimes wrong), jokes, banter between specific Travelers with ongoing relationships, reactions to weather and events, reactions to the player's public deeds.
- **The player speaks with reply chips.** Context offers 2 to 4 short replies (greet, offer help, joke, decline, ask about something they mentioned). Emotes are always available. No free text entry (decision A4).
- Chat teaches. Hints about secrets, recipes, and boss mechanics surface as things people say, and are not always right.
- Quiet is allowed. At 4 a.m. real time World chat is slow. That is part of the feeling.

## Friends

- Travelers send friend requests after shared activity. The player can send them too.
- The friend list shows who is online, where, and what they are doing.
- Friends whisper, invite to parties, send mail and gifts, visit the player's home, and ask for favors.
- Regard decays slowly without contact and never below Acquaintance.
- Travelers at Close Friend can become a partner (see 05-life-systems), with the same rules as NPCs.

## Parties

- Up to 3 Travelers join the player (party of 4).
- Party finder board in hubs lists real open groups by activity. The player can post a listing and Travelers answer over a few minutes based on who is online and suited.
- In combat they use role AI (see 04-combat). Their competence reflects their build. A Newbie stands in fire.
- They talk during runs, react to wipes and rare drops, and need loot. Loot is rolled visibly.
- They log off. A party member might say they have to go for dinner and leave in ten minutes.

## Guilds

- 12 Traveler guilds with distinct cultures: a hardcore raid guild, a crafting union, a cartographers' society, a roleplay troupe, a fishing club, a merchant house, and others.
- Joining needs an invitation earned by Renown, relevant skills, or a member friend.
- Guilds give a hall, a shared stash, guild requests, weekly goals, and a chat channel with its own tone.
- Late game the player can found a guild and recruit Travelers (Leadership).

## Rankings

Boards in every hub and in the menu: by skill, wealth, bestiary, map completion, duels, fishing records, festival wins, and a combined "Renown" board.

- The player is ranked against the 240 Travelers.
- Rankings are a pull, not a treadmill. Top Travelers plateau at believable values so the player can pass them with real effort.
- Travelers react to being passed.

## Market

See 05-life-systems for the economy rules. From the MMO side: listings show seller handles. Travelers undercut. Known crafters have reputations. The player's maker's mark becomes a brand if their quality is high.

## World events

On a real-time schedule, shown on a calendar in the menu.

| Event | Cadence | What happens |
|---|---|---|
| Field raid | Several per real day | A field boss spawns in a region. Travelers converge. The player can join the zerg. |
| Invasion | Daily | Creatures attack a settlement. Defending raises Renown. |
| Market day | Weekly | Port Brine fills up. Rare goods. |
| Festival | Each in-game season | See 05-life-systems. |
| Meteor night, aurora, eclipse | Rare | Rare spawns and gathering. Chat goes wild. |
| "Maintenance" | Rare | A system message announces brief maintenance. Nothing happens. Or something small does. (Lore.) |

Events run on the world clock, so they can be missed. They recur.

## Rivals and duels

- Any Traveler can be challenged to a duel (non-lethal, first to a threshold). They accept by temperament.
- A Traveler can become a Rival after repeated competition. Rivals show up at the same dungeons, bid against the player, taunt in chat, and occasionally help when it matters.

## Mail

A mailbox at home and in hubs. Travelers and NPCs send letters, gifts, invitations, and market proceeds. Letters are short and in voice.

## Believability rules

1. Travelers never break the fiction that they are players. They talk about the game as a game: drop rates, patches, "brb".
2. They never talk about a verifiable real world. Mentions of life outside are vague and human (dinner, work tomorrow, the cat).
3. They are inconsistent the way people are. They make typos, change their minds, forget.
4. They are never cruel. Rivalry is sporting.
5. Fewer, deeper. If the budget is tight, cut Traveler count before cutting memory and voice.
6. Their schedules and behaviors contain small, real regularities. A careful player can notice. This is intended. See the spoilers doc before changing anything about schedules or logs.

## Technical shape (detail in tech/01)

- Abstract simulation tick: once per in-game minute for all online Travelers not near the player.
- Catch-up on login: Traveler progress since last session is computed by formula from elapsed time, like offline settlement. Chat history for the gap is not generated, except a few "while you were away" lines.
- Deterministic from the save seed plus event history, so the integrity validator can bound it.
