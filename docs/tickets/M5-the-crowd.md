# M5 The Crowd: simulated MMO

**Result:** the world is full of Travelers who log in and out, talk, party up, compete, and trade.

Executors on M5-03, M5-04, and M5-05 also read design/08-lore-SPOILERS (sections "The truth", "Delivery rules", "Clue families") because schedules, logs, and chat must support the hidden layer without revealing it. Other M5 tickets do not need it.

---

### POW-M5-01 Refinement: M5 specs to READY
Size: M      Depends: M4 complete      Status: DRAFT (design authority)

Goal: READY specs. Includes the Traveler data schema, the chat template grammar, the abstract sim model, the 24 hand-tuned Travelers (written profiles), and the 12 guilds.
Acceptance: owner approves.

### POW-M5-02 Traveler model and generator
Size: L      Depends: M5-01      Status: DRAFT
Refs: design/07-simulated-mmo (Travelers)

Goal: 240 persistent Travelers per save, each distinct.
Scope: Traveler record (handle, look, build, archetype, schedule, home, guild, voice, memory, regard). Seeded generator with naming cultures and a handle blocklist. Paper-doll looks. 24 hand-tuned Travelers injected at fixed slots. Compact save encoding. Summary fields for plausibility.
Acceptance: generation is deterministic from the seed. No duplicate handles. 240 Travelers cost under the stated save budget share. A gallery image of 60 generated avatars with handles.

### POW-M5-03 Schedules, presence, abstract simulation
Size: L      Depends: M5-02, M2-07      Status: DRAFT
Refs: design/07-simulated-mmo (Presence, Technical shape), design/08-lore-SPOILERS

Goal: Travelers are online at believable real-world hours and progress while away.
Scope: schedule model in real local time with day-of-week patterns and jitter (and the deliberate regularities the spoilers doc calls for). Online set computation. Abstract activity sim at one tick per in-game minute: location, activity, outcomes, skill growth, coin. Catch-up by formula on login. Progress pacing keyed to save playtime and real days.
Acceptance: online count across a simulated week matches the target curve (20 to 45, evening peak). Abstract tick cost under 0.5 ms for the full population. Catch-up over a 30-day gap completes in under 100 ms.

### POW-M5-04 Travelers in the world
Size: L      Depends: M5-03      Status: DRAFT
Refs: design/07-simulated-mmo, design/08-lore-SPOILERS

Goal: nearby Travelers are real entities doing real things.
Scope: promotion from abstract to full entity near the player and back. Behaviors: travel, fight, gather, craft at stations, shop, idle, sit, AFK, emote, dance. Waystone arrival and departure, login and logout shimmer. Name and title over head. They use the same combat and skills code as the player. Tap to inspect (profile card).
Acceptance: a Traveler's abstract state and entity state stay consistent across promotion and demotion (test). 30 Travelers in Hearthford square hold the frame budget.

### POW-M5-05 Chat engine
Size: L      Depends: M5-03      Status: DRAFT
Refs: design/07-simulated-mmo (Chat, Believability rules), design/08-lore-SPOILERS

Goal: chat that is always about something true.
Scope: template grammar with slots, conditions, and voice transforms (case, punctuation, emoji use, typos at a per-voice rate). Event-to-line selection with rate limiting and variety control (no repeated template within a window). Channels. Multi-line exchanges between Travelers with relationships. Hints that can be wrong. About 600 templates to start. Ticker and full log UI. System channel.
Acceptance: every emitted line traces to a sim event or state (a debug view shows the source). A property test over a simulated day finds no line referencing an item, place, or creature that does not exist or that the speaker could not know. Chat rate at 4 a.m. is lower than at 8 p.m.

### POW-M5-06 Reply chips, friends, memory
Size: L      Depends: M5-04, M5-05      Status: DRAFT
Refs: design/07-simulated-mmo (Chat, Friends)

Goal: the player can answer, and Travelers remember.
Scope: reply chip generation from context. Emotes. Whisper. Friend requests both ways, friend list with presence and activity. Regard levels and decay. Memory log per Traveler of player interactions, referenced later in chat and dialogue. Profile cards show shared history.
Acceptance: scenario: fight near a Traveler, receive a friend request, accept, see them online next scheduled session, and receive a line that references the earlier fight.

### POW-M5-07 Parties and companion AI
Size: L      Depends: M5-06      Status: DRAFT
Refs: design/07-simulated-mmo (Parties), design/04-combat (Companions in combat)

Goal: run content with up to three Travelers.
Scope: party finder board (browse and post). Invite and accept logic by regard, suitability, and schedule. Role AI: Vanguard, Striker, Support, following the player's lock, with competence from build. Party frames. Party chat during runs. Visible loot rolls. Members leave when their schedule ends, with notice.
Acceptance: a party clears a Dawnmeadow dungeon in a scenario test. A low-skill member performs measurably worse than a high-skill one. Departure warning precedes logout.

### POW-M5-08 Guilds
Size: M      Depends: M5-06      Status: DRAFT
Refs: design/07-simulated-mmo (Guilds)

Goal: 12 guilds with cultures, halls, and a reason to join.
Scope: guild data, membership, invitations by Renown, skill, or friend. Guild chat tone. Shared stash. Weekly goals and guild requests. Halls as interiors (first two in Hearthford, others placed with their regions).
Acceptance: join flow scenario. Guild chat lines differ in tone between two guilds (sampled output in the PR).

### POW-M5-09 Rankings
Size: M      Depends: M5-03      Status: DRAFT
Refs: design/07-simulated-mmo (Rankings)

Goal: boards that place the player among the 240.
Scope: boards by skill, wealth, bestiary, map, duels, fishing, festivals, Renown. Plateau rules for top Travelers. Board props in hubs and a Social tab view. Reactions when the player passes someone.
Acceptance: ranks are consistent with underlying state. A bot run reaches first place on one board within the hours the refinement specifies.

### POW-M5-10 Market simulation
Size: L      Depends: M5-03, M3-10      Status: DRAFT
Refs: design/05-life-systems (Economy), design/07-simulated-mmo (Market)

Goal: a living auction house.
Scope: per-item supply and demand model with seasonal and event drivers. Listings with seller handles, undercutting behavior. Buy, list, cancel. Fees. Proceeds by mail. Price history sparkline. Chat reacts to price moves. Player flooding depresses price, cornering raises it, both bounded. Plausibility rule for market income.
Acceptance: property tests: prices stay within bounds, no infinite-coin loop between market and NPC shops, flooding recovers over time.

### POW-M5-11 World events and calendar
Size: L      Depends: M5-04, M4-09      Status: DRAFT
Refs: design/07-simulated-mmo (World events)

Goal: scheduled things worth showing up for.
Scope: event scheduler on the world clock. Field raid (Travelers converge, scaled boss, contribution rewards), settlement invasion, market day. Calendar in the menu with countdowns. System announcements. The "maintenance" announcement mechanism with nothing behind it yet (M10 fills it).
Acceptance: a field raid with 15 Travelers holds the frame budget. Events fire at scheduled trusted times, including right after an offline gap.

### POW-M5-12 Duels, rivals, mail
Size: M      Depends: M5-06      Status: DRAFT
Refs: design/07-simulated-mmo (Rivals and duels, Mail)

Goal: sporting competition and letters.
Scope: duel challenge, acceptance by temperament, non-lethal rules, result recorded. Rival flag from repeated competition and its behaviors. Mailbox with letters, gifts, invitations, attachments. About 150 letter templates in voice.
Acceptance: duel scenario. A rival appears at a dungeon the player frequents within a bounded number of visits. Mail attachments cannot be duplicated (test).
