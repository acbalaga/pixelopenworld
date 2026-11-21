# 12 Travelers: data, simulation, chat grammar, roster

The working detail behind 07-simulated-mmo for M5. 07 says what the crowd is for. This doc says what a Traveler is in data, how the crowd moves while unseen, how a chat line is built, and who the 24 hand-tuned Travelers and the 12 guilds are.

Decisions that shape this doc: A4 (template chat, reply chips, no free text), D25 (everyone plays in Dawnmeadow until their home region is baked), D26 (text emoticons and pixel glyphs, no OS emoji), D27 (owner crowd check at Gate G5a).

Anything in this doc that supports the hidden layer is written so that its innocent reading is the only one visible here. The design authority keeps the other reading in 08-lore-SPOILERS. Executors whose ticket does not list 08 do not need it to implement this doc.

## 1. The Traveler record

A Traveler is two halves. The **identity** is regenerated from the world seed and the Traveler's slot every time the save loads, so it costs nothing in the save. The **life** is what has happened since, and it is saved.

### Identity (derived, never saved)

| Field     | Type                                         | Notes                                                                                                     |
| --------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| slot      | 0 to 239                                     | Stable for the life of the save. Slots 0 to 23 are the hand-tuned Travelers (section 6).                  |
| handle    | string, 3 to 16 chars                        | From a naming culture (section 2). Unique per save. Checked against the blocklist.                        |
| look      | `DollSpec`                                   | The same parts and palette the player's avatar uses (`src/content/dolls/parts.ts`).                       |
| archetype | one of 10                                    | Grinder, Explorer, Socializer, Crafter, Trader, Roleplayer, Completionist, Casual, Newbie, Veteran.       |
| focus     | 2 to 4 skill ids                             | What they mostly do. Drawn from the archetype's weights.                                                  |
| voice     | `VoiceId`                                    | One of 16 voices (section 4.3).                                                                           |
| schedule  | `ScheduleId` plus a per-Traveler phase shift | One of 10 schedule shapes (section 3.1).                                                                  |
| home      | region id 1 to 8                             | The region they will live in once it is baked. Until then they play in Dawnmeadow (D25).                  |
| guild     | guild id or none                             | Initial membership. About 55% of Travelers start in a guild.                                              |
| pace      | 0.6 to 1.6                                   | Progress multiplier against the reference player (section 3.4). Newbies start low, Veterans start ahead.  |
| temper    | `bold`, `steady`, `shy`                      | Decides duel acceptance, party invites and how often they speak first.                                    |
| plateau   | skill points                                 | The point where their progress flattens (section 3.4).                                                    |
| ties      | up to 3 other slots, each with a kind        | Standing relationships with other Travelers: `friend`, `sibling`, `rival`, `mentor`. Drives banter (4.5). |

### Life (saved)

| Field      | Encoding                                                 | Notes                                                                                      |
| ---------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| build      | sparse list of (skill index u8, points u16)              | Grows by the progress formula and by abstract activity.                                    |
| paths      | bitset                                                   | Paths they have earned, by the same rules as the player.                                   |
| coin       | u32                                                      | Their purse. Feeds the market model. Never enters the player's purse except through trade. |
| place      | u16 place index                                          | Where they are when online. Last place when offline.                                       |
| activity   | u8 activity id plus u8 subject                           | What they are doing (section 3.2).                                                         |
| guild      | u8                                                       | Current guild (may differ from the initial one).                                           |
| regard     | u8 tier plus u16 points                                  | Stranger, Acquaintance, Friend, Close Friend. Rival is a flag.                             |
| flags      | u16                                                      | Friend, rival, pending request, in party, muted, met.                                      |
| memory     | ring of 24 entries, each (kind u8, subject u16, day u16) | What the player did with or near them (section 5). Oldest drops first.                     |
| lastSeen   | u32 in-game minute                                       | Last time they and the player shared a chunk.                                              |
| lineCursor | u16                                                      | Variety control state for their chat (4.4).                                                |

Budget: the life half averages under 160 bytes per Traveler before compression. 240 Travelers stay under 40 KB of the 500 KB save target at 200 hours (tech/02). The encoder test checks the worst case: every Traveler a Friend with a full memory ring.

## 2. Handles

Six naming cultures, each a small set of syllable tables and patterns in `src/content/travelers/names.ts`:

| Culture   | Examples of shape                   | Share |
| --------- | ----------------------------------- | ----- |
| plain     | `Halla`, `Tobo`, `Ines`             | 25%   |
| gamer     | `Kestrel99`, `xVoltx`, `NoScopeNed` | 20%   |
| lowercase | `lilfern`, `mossy_`, `quietcat`     | 20%   |
| silly     | `sir_pancake`, `BreadKnight`        | 15%   |
| fantasy   | `Aelwynn`, `Thoradin`, `Skarrow`    | 15%   |
| compound  | `RiverStone`, `AshAndOak`           | 5%    |

Rules:

- Unique per save, compared case-insensitively and with `_`, `.`, `x` padding stripped.
- Never equal to an NPC name, a creature name, a place name or a skill name (checked against content at bake).
- A blocklist in `src/content/travelers/blocklist.ts` of slurs, insults, sexual terms, real brands and real public figures, matched on normalized substrings (leetspeak folded). Generation rerolls on a hit. The blocklist is data and has its own test with known-bad inputs.
- No handle names a real place, a real date or a real platform.

## 3. Presence and the abstract simulation

### 3.1 Schedules

Online time is computed in the player's **real local time**: trusted time (tech/02) plus the device's time zone offset, both inputs to the sim. The sim never reads the clock itself.

A schedule shape is a list of sessions per day of the week: start minute, length, and jitter for each. A Traveler's own schedule is its shape plus a fixed phase shift (minus 40 to plus 40 minutes) and a per-session jitter drawn from the travelers RNG stream, seeded by (slot, real day index). The same Traveler on the same real day always gets the same sessions, so a reload never changes who is online.

| Shape      | Weekdays                            | Weekends                       | Share |
| ---------- | ----------------------------------- | ------------------------------ | ----- |
| student    | 16:00 to 18:00, 20:00 to 23:30      | 11:00 to 15:00, 19:00 to 01:00 | 18%   |
| office     | 19:30 to 23:00                      | 14:00 to 18:00, 20:00 to 00:00 | 22%   |
| early      | 06:00 to 07:45                      | 07:00 to 11:00                 | 7%    |
| nightshift | 08:30 to 12:30                      | 09:00 to 13:00                 | 6%    |
| parent     | 21:30 to 23:15                      | 13:00 to 15:00, 21:00 to 23:30 | 13%   |
| lunch      | 12:10 to 12:55, 20:00 to 21:30      | 10:00 to 12:00                 | 8%    |
| retiree    | 09:00 to 12:00, 14:00 to 17:30      | 10:00 to 16:00                 | 6%    |
| weekend    | none, or 21:00 to 22:00 one weekday | 10:00 to 02:00 with breaks     | 10%   |
| nightowl   | 23:00 to 03:00                      | 00:00 to 05:00                 | 7%    |
| always     | three long sessions, short gaps     | the same                       | 3%    |

Some sessions are skipped: each weekday session has a 12% skip chance (25% for `parent`), which is how "they did not show up today" happens. The shares are tuned so the online count follows the target curve in 07 (about 20 at the 05:00 trough, about 45 at the 21:00 weekday peak, a flatter and higher weekend). Shapes and shares live in `src/content/balance/travelers.ts`.

The schedule system also supports a session with zero jitter and a fixed first line per week. M5 builds the support. Which Travelers use it is set in M10.

### 3.2 Activities

An online Traveler is always doing one thing, at one place:

| Activity | Subject           | Where                                  | Outcome per abstract tick                               |
| -------- | ----------------- | -------------------------------------- | ------------------------------------------------------- |
| travel   | destination place | between places                         | Arrives after the route minutes the places table gives. |
| gather   | gathering skill   | a node area of that skill              | XP, item counts into their stock.                       |
| fight    | creature area     | a creature area at or under their tier | XP, coin, drops, small chance of "died" (a chat event). |
| craft    | station           | the station's workshop                 | Consumes stock, makes goods, XP.                        |
| trade    | market            | market street or the terminal          | Lists or buys (M5-10). Before M5-10, sells to the shop. |
| social   | none              | square, inn, a bench                   | Nothing. Chat weight goes up.                           |
| afk      | none              | where they stand                       | Nothing. No chat.                                       |
| party    | party id          | with the party                         | Shared fight outcome.                                   |
| dungeon  | dungeon id        | inside                                 | Clear or wipe after the dungeon's minutes.              |

The next activity is chosen when the current one ends, by archetype weights, focus, time of day, weather, world events, and what their stock and coin need (a crafter low on ore goes mining or buys ore). Weights live in `src/content/balance/travelers.ts`.

Places come from the baked people places table (`src/content/people/places.ts`) and the dungeon and node tables. A Traveler's region of play is Dawnmeadow until their home region is baked (D25). When it is, a migration moves them home on their next login.

### 3.3 The tick

- One abstract tick per in-game minute (every 2 real seconds) for online Travelers not promoted to entities (tech/01 levels of detail). The full population tick costs under 0.5 ms.
- A Traveler near the player is promoted to a full entity (M5-04). Its abstract state is frozen while promoted and written back when it is demoted, so the abstract and entity views never disagree.
- Each tick emits sim events (`travelerArrived`, `travelerLooted`, `travelerRankUp`, `travelerDied`, `travelerListed`, `travelerLoggedIn`, `travelerLoggedOut` and others). Chat reads these events (section 4) and never invents one.

### 3.4 Progress and catch-up

A Traveler's expected skill points follow:

```
expected(t) = min(plateau, pace * (A * playHours + B * realDays) * archetypeCurve(t))
```

`playHours` is the save's play time, `realDays` the real days since the save was made. `A`, `B` and the curves are balance data. Pace sets who stays ahead of the player and who falls behind. Newbies start with a low pace that rises (the "Newbie in hour 5, Master smith in hour 80" arc). Veterans start high and plateau early.

Activity outcomes nudge a Traveler toward their expected value. They never push them past it by more than a small band. On login, catch-up sets every Traveler to their expected value for the elapsed time in one pass, by formula, with no tick replay. It also sets coin, place and a short list of "while you were away" events (at most 6, chosen from rank-ups and notable drops). A 30-day gap catches up in under 100 ms.

The integrity validator bounds each Traveler's build by `expected(t)` plus the band. A Traveler build is never a source of player value, so this check only guards the save's consistency.

## 4. Chat

### 4.1 Channels

World, Local, Party, Guild, Whisper, System. The lanes and the chat sheet exist (POW-M4-17). Local is everyone within the player's loaded chunks. World is everyone online. The ticker shows World, Local, Party, Guild and Whisper. System shows in the log and the ticker only for announcements.

### 4.2 Template grammar

Templates are data in `src/content/chat/templates/*.ts`, one file per category. A template:

```ts
{
  id: 'trade.sell.basic',
  category: 'trade',            // lfg, trade, brag, question, answer, joke, banter, weather, event, deed, greet, farewell, afk, complaint
  channel: 'world',
  trigger: 'travelerListed',    // the sim event or state that can produce it
  when: { archetype: ['Trader', 'Crafter'], minRank: { skill: '$item.skill', rank: 5 } },
  text: [
    'selling {item} x{qty}, {price}c each',
    'WTS {item} {qty}x {price}c',
    '{item} for sale, {price} a piece, whisper me',
  ],
  weight: 3,
  cooldownMin: 30,             // in-game minutes before this speaker may use it again
}
```

- **Slots** are typed: `{item}`, `{qty}`, `{price}`, `{place}`, `{creature}`, `{skill}`, `{rank}`, `{handle}` (another Traveler), `{player}`, `{dungeon}`, `{weather}`, `{time}`. Each slot fills only from the event's own payload or the speaker's own state. A slot that cannot fill drops the template.
- **Conditions** (`when`) read speaker fields, the event, world time, weather and regard. They never read anything the speaker could not know (a Traveler in the inn cannot know what the player looted in the Rootway unless the player said so in chat or it was a public deed).
- **Places** fill only from baked places (D25). The bake fails if any template text or alternative names a place, item, creature or skill that is not in content.
- **Alternatives** in `text` give variety without new conditions.

### 4.3 Voices

A voice is a set of transforms applied after the text is filled, in this order:

| Transform   | Settings                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| lexicon     | Word swaps: "you" to "u", "please" to "pls", "thanks" to "ty", "lol" insertion. Per-voice table.        |
| case        | `lower`, `sentence`, `shout` (rare caps on one word), `title`.                                          |
| punctuation | `none`, `light`, `full`, `ellipsis`, `exclaim`.                                                         |
| emoticon    | Rate and set: text emoticons (`:)`, `:D`, `xD`, `o7`, `<3`, `^^`, `;-;`) and pixel glyphs (D26).        |
| typo        | Rate per line and kinds: swapped letters, doubled letter, dropped letter, then sometimes a `*fix` line. |
| signoff     | Optional habits: "o7" on leaving, "gg" after fights.                                                    |

Sixteen voices in `src/content/chat/voices.ts`: `terse`, `chatty`, `formal`, `jokey`, `lowercase`, `glyphy` (the emoji-heavy voice, using glyphs and emoticons), `shouty`, `kind`, `dry`, `nerdy`, `roleplay` (in-character speech), `newbie` (questions, apologizes), `veteran` (abbreviations, short), `merchant`, `sleepy`, `excitable`.

**Pixel glyphs (D26).** Twelve 8 x 8 glyphs drawn from data in `src/content/chat/glyphs.ts`: heart, coin, sword, shield, skull, star, sparkle, fish, music, zzz, laugh, sweat. In the clear-text chat they render inline at the line's text height as images built from data, with an `alt` of their name. The bitmap font is never used for chat (09 text rule). No OS emoji appears anywhere in generated chat, and the template validator rejects emoji code points.

### 4.4 Selection and rate

- Each sim event offers its eligible templates. A speaker is chosen among Travelers who could have said it (the actor first, then witnesses for reactions).
- Rate limit per channel per in-game minute, scaled by the online count. Quiet hours are quiet: at 04:00 real time World chat runs at about a fifth of its 21:00 rate.
- Variety control: no template id repeats in a channel within its window (default 40 lines). No speaker says two lines within 20 seconds unless it is a reply.
- Every emitted line carries its source: the event id or state that produced it. A debug view (dev builds only) shows the source per line.

### 4.5 Exchanges and banter

Two to five line exchanges are templates with roles (`a`, `b`) that fire between Travelers with a tie (section 1) or a shared activity. Examples: siblings arguing about who logs off first, a mentor answering a Newbie's question, rivals trading barbs after one passes the other on a board.

### 4.6 Hints and rumors

Questions and answers about recipes, boss mechanics and secrets come from a rumor table in `src/content/chat/rumors.ts`. Each rumor has a `true` or `false` flag and a minimum skill or place visit for a Traveler to repeat it. About one in four answers is wrong or half right. Wrong rumors are plausible and harmless (a wrong ingredient, a wrong time of day), never a trap that costs the player an item. Rumors never mention the hidden layer. M10 adds its own odd lines through its own tickets.

### 4.7 The player's voice

The player answers with reply chips (M5-06): 2 to 4 short options built from the line being answered and the player's regard with the speaker, plus the emote set. The player's lines show in the log in plain sentence case, with no voice transforms.

### 4.8 Believability rules for templates

07's believability rules apply to every template. The validator checks what it can: no real dates, no real places or brands, no emoji, no NPC or Traveler line that explains the world. Template review in each content PR checks the rest: never cruel, rivalry sporting, the game talked about as a game ("drop rates", "brb", "patch").

## 5. Memory and regard

Memory kinds: `foughtNear`, `partied`, `helpedDown` (revived them), `traded`, `gifted`, `duelWon`, `duelLost`, `stoodUp` (accepted a party then left), `passedOnBoard`, `answered` (replied to their question), `ignoredRequest`. Each entry stores the subject (creature, item, dungeon or board) and the in-game day.

Regard points come from memory events with weights in balance data. Tiers: Stranger, Acquaintance at 20, Friend at 60, Close Friend at 140. Decay of 1 point per real day without contact, never below Acquaintance once reached (07). Rival is a flag set by repeated close competition (boards, duels, the same dungeon), and it does not block friendship.

Templates and letters can reference memory entries with `{memory.subject}` and `{memory.daysAgo}`. Lines that reference memory are the "they remember" moments. They are rare (at most one per Traveler per session) so they stay special.

## 6. The 24 hand-tuned Travelers

These fill slots 0 to 23. Their identity is written here and fixed in `src/content/travelers/handTuned.ts`. The generator fills the rest. Every one of them plays in Dawnmeadow in M5 (D25). Home is where they go when that region is baked.

| Slot | Handle        | Archetype     | Voice     | Schedule   | Home         | Guild                     | Focus                    | What makes them themselves                                                                                     |
| ---- | ------------- | ------------- | --------- | ---------- | ------------ | ------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 0    | `mira_`       | Casual        | lowercase | always     | Saltreach    | none                      | Fishing, Cooking         | Always seems to be online. Fishes, talks little, kind to Newbies. Her slot is reserved, M10 adds her behavior. |
| 1    | `Tobo`        | Newbie        | jokey     | student    | Dawnmeadow   | Hearth and Home           | Smithing, Mining         | Burns everything at first. The "help him in hour 5, Master smith in hour 80" arc. Remembers who helped.        |
| 2    | `Halla`       | Trader        | merchant  | office     | Saltreach    | Brine Ledger Company      | Bartering, Foraging      | Sells fresh forage every morning. First to complain when prices move.                                          |
| 3    | `Kestrel99`   | Grinder       | terse     | nightshift | Ironvale     | Iron Oath                 | Blades, Shieldcraft      | Always farming the same creature area. Posts kill counts. Respects anyone who out-farms her.                   |
| 4    | `sir_pancake` | Roleplayer    | roleplay  | weekend    | Dawnmeadow   | Lantern Players           | Performance, Cooking     | Speaks only in character. Hosts readings at the inn on weekends.                                               |
| 5    | `Aelwynn`     | Completionist | formal    | retiree    | Glass Desert | Society of the Folded Map | Cartography, Foraging    | Keeps a public tally of map percent. Corrects other people's directions, politely.                             |
| 6    | `lilfern`     | Socializer    | glyphy    | student    | Whisperwood  | Wardens of the Fog        | Taming, Foraging         | Greets everyone who logs in. The friendliest friend request in the game.                                       |
| 7    | `NoScopeNed`  | Veteran       | veteran   | nightowl   | Frostspine   | The Ninth Bell            | Archery, Athletics       | Was "here since launch". Duels anyone. Sporting loser, insufferable winner, briefly.                           |
| 8    | `Ines`        | Crafter       | kind      | parent     | Dawnmeadow   | Greenhand Circle          | Cooking, Farming         | Logs in late, cooks for the guild, logs off when the baby wakes. Gifts food.                                   |
| 9    | `Thoradin`    | Grinder       | shouty    | student    | Ironvale     | Iron Oath                 | Heavy Arms, Mining       | LOUD about rare drops. Iron Oath's tank. Kestrel's rival on the kill board.                                    |
| 10   | `quietcat`    | Explorer      | dry       | nightowl   | Sunken Mire  | Stiltwalkers              | Stealth, Alchemy         | Rarely speaks in World. Whispers useful things to people she likes.                                            |
| 11   | `BreadKnight` | Casual        | jokey     | lunch      | Dawnmeadow   | Hearth and Home           | Cooking, Blades          | Only online at lunch. Talks about bread. Tobo's best friend.                                                   |
| 12   | `Marrow`      | Veteran       | terse     | office     | Ironvale     | The Brass Union           | Smithing, Tinkering      | Best smith on the board. Plateaus early so the player can pass him. Gracious about it.                         |
| 13   | `xVoltx`      | Grinder       | excitable | weekend    | Frostspine   | Summit Club               | Athletics, Ember         | Speedruns Trials and posts times. Will race the player's Athletics time.                                       |
| 14   | `Saoirse`     | Roleplayer    | formal    | office     | Whisperwood  | Lantern Players           | Performance, Mending     | sir_pancake's co-lead. Plays a healer in character and actually heals in parties.                              |
| 15   | `RiverStone`  | Explorer      | chatty    | retiree    | Saltreach    | Quiet Hooks               | Fishing, Cartography     | Knows every fishing spot. Half of his rumors are wrong and he is sure of all of them.                          |
| 16   | `mossy_`      | Newbie        | newbie    | early      | Whisperwood  | none                      | Foraging, Taming         | Asks questions every morning. Grows into a tamer.                                                              |
| 17   | `Duskwright`  | Trader        | dry       | nightowl   | Sunken Mire  | Brine Ledger Company      | Alchemy, Bartering       | Corners potion ingredients. The market's villain, in a sporting way.                                           |
| 18   | `Petra.k`     | Crafter       | nerdy     | lunch      | Ironvale     | The Brass Union           | Tinkering, Smithing      | Explains crafting math nobody asked for. Usually right.                                                        |
| 19   | `HollyHocks`  | Socializer    | kind      | parent     | Dawnmeadow   | Greenhand Circle          | Farming, Performance     | Organizes festival entries. Remembers birthdays of the guild (in-game days).                                   |
| 20   | `Skarrow`     | Completionist | terse     | always     | The Crown    | Iron Oath                 | Blades, Evasion          | Top of the Renown board, plateaued. Says little. Notices when the player passes him.                           |
| 21   | `ByTheBook`   | Completionist | nerdy     | early      | Glass Desert | Society of the Folded Map | Deciphering, Cartography | Keeps a bestiary race with the player. Asks about creatures they have seen.                                    |
| 22   | `AshAndOak`   | Crafter       | chatty    | weekend    | Whisperwood  | Wardens of the Fog        | Woodworking, Logging     | Builds bows for friends. lilfern's sibling. They argue about who logs off first.                               |
| 23   | `Olly_O`      | Casual        | sleepy    | nightowl   | Dawnmeadow   | none                      | Fishing, Foraging        | Plays half asleep. "gn" at 02:00, back at 23:00. Goes AFK at the fountain.                                     |

Standing ties: Tobo and BreadKnight (friend), Kestrel99 and Thoradin (rival), lilfern and AshAndOak (sibling), sir*pancake and Saoirse (friend), Marrow and Tobo (mentor, from hour 20 on), RiverStone and mira* (friend), Duskwright and Halla (rival), Skarrow and NoScopeNed (rival), Petra.k and Marrow (friend).

Skill names in the focus column follow 11-skill-table. Where the table names a skill differently, the table wins and the content file uses its id.

## 7. The twelve guilds

| Id  | Guild                     | Culture                                          | Chat tone                     | Home         | Hall                       | Joins by                          |
| --- | ------------------------- | ------------------------------------------------ | ----------------------------- | ------------ | -------------------------- | --------------------------------- |
| 1   | Iron Oath                 | Hardcore raiders. Schedules, roles, kill counts. | terse, strategic, "o7"        | Ironvale     | with Ironvale (M8)         | Any Arms skill 30 and Renown      |
| 2   | The Brass Union           | Crafting union. Quality standards, apprentices.  | nerdy, proud, shop talk       | Ironvale     | with Ironvale (M8)         | Any craft rank 25                 |
| 3   | Society of the Folded Map | Cartographers. Map percent, corrections.         | formal, precise               | Glass Desert | with the Glass Desert (M9) | Cartography 20 or a member friend |
| 4   | Lantern Players           | Roleplay troupe. Stays in character.             | roleplay voice, theatrical    | Dawnmeadow   | Hearthford (M5)            | A member friend or Performance 10 |
| 5   | Quiet Hooks               | Fishing club. Records, patience.                 | slow, kind, fish jokes        | Saltreach    | with Saltreach (M8)        | Fishing 20                        |
| 6   | Brine Ledger Company      | Merchant house. Prices, margins, rivals.         | merchant, brisk               | Saltreach    | with Saltreach (M8)        | Bartering 20 and coin held        |
| 7   | Hearth and Home           | Newbie-friendly social guild. Helps everyone.    | chatty, kind, many greetings  | Dawnmeadow   | Hearthford (M5)            | Anyone, after one shared activity |
| 8   | Greenhand Circle          | Farmers and cooks. Seasons, recipes, festivals.  | kind, homely                  | Dawnmeadow   | with M6 farming (M6)       | Cooking or Farming 15             |
| 9   | The Ninth Bell            | Duelists. Sporting rivalry, ladders.             | jokey trash talk, never cruel | Frostspine   | with Frostspine (M9)       | Win three duels                   |
| 10  | Wardens of the Fog        | Tamers and foragers.                             | glyphy, warm, creature talk   | Whisperwood  | with Whisperwood (M8)      | Taming 15 or a tamed creature     |
| 11  | Stiltwalkers              | Alchemists and sneaks.                           | dry, few words, odd humor     | Sunken Mire  | with the Sunken Mire (M9)  | Alchemy or Stealth 25             |
| 12  | Summit Club               | Speedrunners and climbers. Times, routes.        | excitable, numbers            | Frostspine   | with Frostspine (M9)       | An Athletics Trial under par      |

In M5 every guild exists, recruits and chats. Only Lantern Players and Hearth and Home have halls, both in Hearthford. Members of guilds with unbaked homes meet in the Hearthford inn's back room until their hall exists. The player can join any guild whose condition they meet. Membership is one guild at a time.

## 8. What M5 does not do

- Partners and romance with Travelers (M6, with the same rules as NPCs).
- Travelers in regions other than Dawnmeadow (M8 and M9 move them home).
- Founding a player guild (late, Leadership).
- Anything a Traveler does that serves the hidden layer, beyond the schedule support in 3.1 and the reserved slot 0 (M10).
