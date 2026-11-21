# M5 The Crowd: simulated MMO

**Result:** Dawnmeadow is full of Travelers who log in and out at believable hours, talk about things that really happened, remember the player, party up, join guilds, compete on boards, duel, write letters, and trade on a living market.

**Gate G5a (mid M5, D27):** once POW-M5-04, POW-M5-14 and POW-M5-05 merge, the owner plays Hearthford at two real times of day. Does it feel populated, and does chat read as people? Wave C does not start until it passes. Checklist: `docs/ops/gate-g5a.md` (written by POW-M5-13).

Read first: `docs/design/07-simulated-mmo.md` and `docs/design/12-travelers.md`. Decisions D24 to D27 in the master plan.

Executors on POW-M5-03, POW-M5-04, POW-M5-05 and POW-M5-15 also read design/08-lore-SPOILERS (sections "The truth", "Delivery rules", "Clue families") because schedules, logs and chat must support the hidden layer without revealing it. Other M5 tickets do not need it.

## Order of work

Ticket ids 02 to 12 keep their numbers from the draft. 13 to 15 are new in this refinement. 20 and up are reserved for Gate G4 findings (D24).

| Wave | Tickets                                      | Notes                                                                                     |
| ---- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A    | 20, 21, 22 (done), and any later G4 findings | Gate G4 findings. Merge before wave B starts, as the owner asked.                         |
| B    | 02, then 03, then 04, 05, 09, then 14, 15    | 04, 05 and 09 run in parallel after 03. 14 needs 04. 15 needs 05.                         |
| G5a  | 13, then the owner check                     | 13 needs 04, 14, 05 and 15.                                                               |
| C    | 06, then 07, 08, 12. Also 10, 11.            | Starts after G5a passes. 07, 08 and 12 run in parallel after 06. 10 and 11 need only G5a. |

**Save schema bumps serialize.** Tickets 02, 06, 08, 10 and 12 each bump the schema. Whichever merges later rebases, takes the next number, and re-exports its fixture from main as it stands then. Each migration stays a separate step.

**Sim purity holds.** Real local time reaches the sim as two inputs, trusted time (tech/02) and the device time zone offset in minutes. Neither is read inside `src/sim/`. All Traveler randomness comes from the `travelers` RNG stream.

**D25 everywhere.** Until a region is baked, its Travelers play in Dawnmeadow. No template, letter, rumor, profile or board names an unbaked place. The content validator enforces it.

---

### POW-M5-01 Refinement: M5 specs to READY

Size: M Depends: M4 complete Status: READY (design authority, delivered by the planning PR that wrote this file)

Goal: READY specs for M5.
Scope: this file. `docs/design/12-travelers.md` (Traveler schema, abstract sim, chat grammar, the 24 hand-tuned Travelers, the 12 guilds). Master plan D24 to D27 and Gate G5a. The guild hall line in design/02.
Acceptance: owner approves the PR, after the Gate G4 verdict (D24).

---

## Wave B: the crowd

### POW-M5-02 Traveler model and generator

Size: L Depends: POW-M5-01 Status: READY
Refs: design/12-travelers (1, 2, 6, 7), design/07-simulated-mmo (Travelers), tech/02 (Save anatomy), tech/03 (paper doll)

Goal: 240 persistent, distinct Travelers per save, cheap to store.

Scope:

- `src/sim/travelers/` (new): `types.ts` with `TravelerIdentity` and `TravelerLife` as design/12 section 1. `generate.ts`: `identityOf(worldSeed, slot)` (pure, deterministic, no state) and `initialLife(identity)`. Slots 0 to 23 come from `src/content/travelers/handTuned.ts`. Slots 24 to 239 are generated.
- Content: `src/content/travelers/names.ts` (six naming cultures, design/12 section 2), `blocklist.ts`, `handTuned.ts` (the table in design/12 section 6 as typed data, with ties), `guilds.ts` (the table in section 7 as data, halls as place ids or `null`).
- Balance: `src/content/balance/travelers.ts` with archetype weights, focus weights, culture shares, pace ranges, plateau ranges, guild start share.
- Handle rules: uniqueness by normalized comparison, no clash with NPC, creature, place or skill names (checked against content at generation), blocklist normalization (case, separators, leetspeak). Reroll on a hit, with a bounded number of rerolls and a fallback pattern that is always safe.
- Looks: a `DollSpec` per Traveler from the player's doll parts, weighted so the crowd reads as varied at a glance (no two of the 24 hand-tuned share hair style and color).
- `SimState.travelers`: an array of 240 `TravelerLife`. Identity is computed on load and kept in a transient cache, never saved.
- Save: compact binary encoding of the life half in `src/save/binary.ts`. Schema bump, migration that creates the 240 lives for an existing save from its world seed, fixture test from the previous version.
- `SaveSummary` gains Traveler totals (sum of build points, sum of coin) for the validator.
- Dev: `tools/traveler-gallery.ts` renders the first 60 generated Travelers with handles to a PNG (used for the acceptance image).

Out of scope: schedules and the tick (M5-03). Entities in the world (M5-04). Regard changes (M5-06).

Save: new `travelers` section, schema bump, migration.
Integrity: Traveler totals in the summary. A rule that each life's build is within its expected band is added in M5-03, where the formula exists.

Acceptance:

- Determinism: the same seed gives byte-identical identities and lives across two runs and two processes (test).
- No duplicate handles across 1,000 seeds, by normalized comparison (property test). No handle hits the blocklist or a content name across 1,000 seeds.
- The blocklist test rejects every entry of a known-bad list, including leetspeak and separator variants.
- Encoded size of 240 lives, worst case (every Traveler a Friend with a full memory ring), under 40 KB after compression (test prints the number).
- Migration test loads the previous-version fixture and finds 240 lives matching a fresh generation from its seed.
- PR includes the gallery image of 60 generated Travelers with handles.

### POW-M5-03 Schedules, presence, abstract simulation

Size: L Depends: POW-M5-02, M2-04 Status: READY
Refs: design/12-travelers (3), design/07-simulated-mmo (Presence, Technical shape), tech/01 (Levels of detail), tech/02 (Trusted time), design/08-lore-SPOILERS

Goal: Travelers are online at believable real-world hours, do believable things while unseen, and progress while the player is away.

Scope:

- `src/sim/travelers/schedule.ts`: the ten schedule shapes and shares (design/12 3.1) from balance data. `sessionsFor(identity, realDayIndex)` and `isOnline(identity, localMinuteOfWeek, realDayIndex)`, pure. Phase shift, jitter, skip chance. Support for a session with zero jitter and a fixed weekly first line, unused in M5 (the lore support the spoilers doc calls for; M10 assigns it).
- Inputs: a new `TickInput` field for the device time zone offset in minutes, set by the platform layer from `Intl` and stored with the clock memory. Local minute of week is computed from trusted time plus offset inside the sim.
- `src/sim/travelers/abstract.ts`: the activity model of design/12 3.2. One abstract tick per in-game minute for online, unpromoted Travelers. Activity choice by weights, place routing over the people places table, outcomes (XP, coin, stock counts). Sim events: `travelerLoggedIn`, `travelerLoggedOut`, `travelerArrived`, `travelerLooted`, `travelerRankUp`, `travelerDied`, `travelerCrafted`, `travelerSold`.
- `src/sim/travelers/progress.ts`: `expected(t)` and catch-up as design/12 3.4. On login, one pass sets builds, coin and place, and returns at most 6 "while you were away" events.
- Before the market exists (M5-10), Traveler sales go to the NPC shop price model and never touch the player's economy.
- Dev overlay (dev builds only): online count, a list of online Travelers with activity and place.

Out of scope: entities (M5-04). Chat (M5-05). The market (M5-10).

Save: life fields `place`, `activity` and `lastSeen` already exist from M5-02. No schema bump unless the executor finds a field missing (then bump and migrate).
Integrity: new rule in `src/save/integrity/plausibility.ts`: each Traveler's build is within `expected(t)` plus the band, from the save's play time and real days.

Acceptance:

- Online count over a simulated real week (every 10 real minutes) stays between 18 and 48, with the weekday peak in 20:00 to 23:00 local and the trough in 03:00 to 07:00. Plot in the PR.
- The same save at the same trusted time and offset gives the same online set after a reload (test).
- Abstract tick for the full population under 0.5 ms average on the reference CPU profile (bench in the PR).
- Catch-up over a 30-day gap under 100 ms (bench), and the result equals `expected(t)` for every Traveler (test).
- A Newbie-paced Traveler is behind the reference player at 5 play hours and ahead of it in their focus skill at 80 play hours (scenario on the formula).
- Scenario: a crafter Traveler low on stock gathers or buys before crafting.
- `src/sim/` grep finds no `Date`, `Intl` or `Math.random` (existing purity lint passes).

### POW-M5-04 Travelers in the world

Size: L Depends: POW-M5-03 Status: READY
Refs: design/12-travelers (3.3), design/07-simulated-mmo (Presence), tech/01 (Levels of detail, Entities), tech/04 (budgets), design/08-lore-SPOILERS

Goal: Travelers near the player are real entities, and moving between the abstract and entity views never loses or invents anything.

Scope:

- Promotion when a Traveler's place is inside the active chunks, demotion when it leaves them or logs out. Promotion builds the entity from life plus identity. Demotion writes position, activity and outcomes back. While promoted, the abstract tick skips them.
- Entity basics only: walk the route to the place, stand, sit, idle, AFK (still, with a "zzz" glyph after 2 minutes), gather at a node with the same work animation and meter-free timing as the player's gather, fight creatures in the same combat system the player uses (their build sets their numbers).
- Waystone arrival and departure (the existing waystone effect), login and logout shimmer (a short palette pulse, data in `src/content/sprites/`).
- Name over head in clear text, title under it when they have one. Both follow the 09 text rule and hide when the player turns names off (new UI setting).
- Tap to inspect: a profile card on the shared panel parts (POW-M4-18) with doll, handle, title, guild, three top skills by rank band (not exact points), and "met" or not. Shared history arrives in M5-06.
- A promotion cap: at most 30 promoted Travelers. Past the cap the nearest win.

Out of scope: crafting at stations, shopping, emotes, dancing (M5-14). Chat bubbles (M5-05). Parties (M5-07).

Save: none (entity state is derived from life on load).
Integrity: none.

Acceptance:

- Round trip test: promote, run 600 ticks, demote, and the life equals what the abstract model would accept (place reachable, XP and coin within the per-tick bounds for that time). No item or coin is created or lost across 1,000 seeded round trips.
- 30 Travelers in Hearthford square with weather on and the chat sheet open hold the frame budget in tech/04 on the reference phone profile (trace in the PR).
- A Traveler who logs out on screen shimmers and is gone, and is not in the online set on the next tick.
- Phone screenshots: the square at the evening peak, a Traveler fighting a Mossling, the profile card.

### POW-M5-14 Traveler behaviors

Size: M Depends: POW-M5-04 Status: READY
Refs: design/12-travelers (3.2), design/07-simulated-mmo (Presence)

Goal: promoted Travelers look busy in the ways players are busy.

Scope:

- Craft at stations in their workshops (the station's work animation), shop at Brin's (walk in, stand at the counter, walk out), sit at the inn and on benches, dance (a looping pose, more likely at festivals and dusk), the emote set (wave, cheer, bow, laugh, sit, sleep) shown as a glyph and a pose.
- Group idle: two to five Travelers who are friends or in the same guild stand together in the square.
- Weather and time react: shelter indoors in rain, more in the inn at night.
- Behavior weights in `src/content/balance/travelers.ts`.

Out of scope: chat (M5-05 and 15). Player emotes and replies (M5-06).

Save: none. Integrity: none.

Acceptance:

- Scenario: at the evening peak, at least one Traveler is crafting, one shopping, one idle, one AFK and one in a group (sampled over 10 runs, each run passes).
- Rain moves at least 60% of idle promoted Travelers indoors within 2 in-game minutes (test).
- Short screen recording (or frame sequence) of the square for 60 seconds at the evening peak in the PR.

### POW-M5-05 Chat engine

Size: L Depends: POW-M5-03 Status: READY
Refs: design/12-travelers (4), design/07-simulated-mmo (Chat, Believability rules), design/09-ui-ux (Message lanes, The text rule), design/08-lore-SPOILERS

Goal: an engine that turns real sim events into chat in a Traveler's voice, at a believable rate.

Scope:

- `src/sim/chat/` (new, pure): template types and the grammar of design/12 4.2, voice transforms (4.3), selection, rate limiting and variety control (4.4), exchanges (4.5), rumors (4.6). Output is a `travelerSpoke` sim event with channel, speaker slot, text, glyph ids and source event id.
- Content: `src/content/chat/voices.ts` (16 voices), `glyphs.ts` (12 glyphs as pixel data), `templates/` with a starting set of about 120 templates across every category, enough to test the engine. The full set is POW-M5-15.
- Validator at bake: every slot resolves, every named item, creature, place and skill exists and is baked (D25), no emoji code points, no real dates, a banned-word check sharing the handle blocklist.
- UI: chat lines from `travelerSpoke` go through the existing `MessageRouter` chat lane with `from` and `channel`. Glyphs render inline in clear text at text height with `alt`. Channels with content now show their tabs. `scaffold.ts` and the scripted ticker in `ui/dom/ambient.ts` are deleted.
- Dev builds: a chat debug toggle that shows each line's source event and template id.

Out of scope: the full template set (M5-15). Reply chips and the player's lines (M5-06). Party and guild chat content (M5-07, M5-08).

Save: `lineCursor` in life already exists (M5-02). The log is not saved beyond the session.
Integrity: none (chat creates no value).

Acceptance:

- Every emitted line over a simulated day carries a source event id that exists in that day's event stream (property test).
- Property test over a simulated day: no line references an item, place, creature or skill that does not exist, is not baked, or that the speaker could not know (speaker knowledge rules in design/12 4.2).
- World chat rate at 04:00 local is under a third of the rate at 21:00 (test over a simulated week).
- No template id repeats in a channel within its window (test).
- Voice test: the same filled template through `lowercase`, `formal`, `glyphy` and `terse` gives four visibly different lines (snapshot).
- Phone screenshots of the ticker and the chat sheet with a glyph line, at 100% and 160% text scale.

### POW-M5-15 Chat templates

Size: L Depends: POW-M5-05 Status: READY
Refs: design/12-travelers (4, 6), design/07-simulated-mmo (Chat, Believability rules), design/08-lore-SPOILERS

Goal: enough lines that an hour in Hearthford never feels like a loop.

Scope:

- About 600 templates in total across the 14 categories, weighted toward trade, lfg, questions and answers, and reactions to weather and events.
- At least 40 exchanges for the standing ties of the 24 hand-tuned Travelers (design/12 section 6), and a few lines per hand-tuned Traveler that only they say.
- About 80 rumors, about one in four wrong, none costly.
- Deed reactions: lines for the player's public deeds that exist today (a boss resolved, a Trial passed, a rank-up past a known Traveler, a Singular step that is public).

Out of scope: lore lines (M10). Guild-tone sets (M5-08). Letters (M5-12).

Save: none. Integrity: none.

Acceptance:

- Validator passes on the full set.
- A simulated evening hour (21:00 to 22:00) in Hearthford with the full set: no template repeats in World, and at least 70% of the lines in Local come from distinct templates (test prints the numbers).
- A sample of 200 lines from a simulated day is in the PR for owner review, grouped by category.
- Believability review checklist (design/12 4.8) filled in the PR.

### POW-M5-09 Rankings

Size: M Depends: POW-M5-03 Status: READY
Refs: design/07-simulated-mmo (Rankings), design/12-travelers (3.4)

Goal: boards that place the player among the 240 and can be climbed.

Scope:

- Boards: each skill, wealth (coin plus listed value later), bestiary, map percent, duels (empty until M5-12), fishing records, festivals (empty until M6), Renown. Computed from Traveler lives and the player's state, pure, recomputed on change.
- Plateau rules: top Travelers flatten at their plateau (design/12 3.4) so the player can pass them with real effort. Balance data sets the top-of-board values per board at given play hours.
- Board props: the existing request board's wall in the Hearthford square gains a rankings panel. A Social tab in the Menu shows boards (enable the tab in `ENABLED_TABS`, built on the shared parts).
- Reactions: a `playerPassed` sim event when the player passes a Traveler in the top 20 of a board. M5-15 supplies the lines.

Out of scope: duel and festival content. Guild boards.

Save: none (boards are derived). Integrity: none.

Acceptance:

- Ranks equal a brute-force sort of the same underlying state for 100 random states (property test).
- A bot run focused on Fishing reaches first place on the Fishing board within 15 play hours, and does not reach it within 5 (scenario).
- The top Traveler on the Smithing board at 80 play hours is within reach of the reference player's expected rank (formula test).
- Phone screenshots of the board prop and the Social tab.

### POW-M5-13 Gate G5a checklist

Size: S Depends: POW-M5-04, POW-M5-14, POW-M5-05, POW-M5-15 Status: READY
Refs: docs/ops/gate-g4.md (the pattern), design/07-simulated-mmo, design/12-travelers

Goal: the owner can run the crowd check in about an hour and report findings the planning agent can act on.

Scope: `docs/ops/gate-g5a.md` in the format of gate-g4. Steps for a weekday evening (20:00 to 22:00) and a weekday early morning (05:00 to 07:00) session of 30 minutes each in Hearthford on a phone: count the Travelers, read 50 lines of chat, tap three profile cards, watch one Traveler log out, check that nothing in chat names a place not on the map. A verdict section: pass, adjust (tickets), or rework (change design/12 before wave C). A dev URL flag that lets the owner set the local time for the check without changing the device clock (dev builds only, never in production).

Save: none. Integrity: none.

Acceptance: the checklist exists. The dev time flag is absent from production builds (build test).

---

## Wave C: the crowd and the player (after Gate G5a)

### POW-M5-06 Reply chips, friends, memory

Size: L Depends: POW-M5-04, POW-M5-05, Gate G5a Status: READY
Refs: design/12-travelers (4.7, 5), design/07-simulated-mmo (Chat, Friends)

Goal: the player can answer, and Travelers remember.

Scope:

- Reply chips: on a line addressed to the player or to Local near them, 2 to 4 chips built from the line's category and the player's regard with the speaker (greet, offer help, joke, decline, ask about the thing mentioned). Emote chips always available. Chips are clear text buttons, at least 48 px tall. Player lines go to the log in plain sentence case.
- Whisper: Travelers whisper the player (friend requests, thanks, favors), the player replies with chips.
- Memory: the memory kinds of design/12 section 5 recorded by the sim when they happen. Regard points from balance weights, tiers and decay.
- Friend requests both ways: a Traveler sends one after shared activity, by temper and regard. The player sends one from the profile card, accepted by regard and temper.
- Friend list in the Social tab: online state, place, activity. Profile cards gain shared history (the last 5 memory entries in plain words).
- Memory lines: templates with `{memory.*}` slots, at most one per Traveler per session.

Out of scope: party invites (M5-07). Gifts and mail (M5-12). Partners (M6).

Save: regard, flags and memory in life (fields exist). Schema bump if any encoding changes, with migration.
Integrity: none (regard creates no value).

Acceptance:

- Scenario: fight near a Traveler, receive a friend request, accept, see them online at their next scheduled session, and receive a line that references the earlier fight.
- Regard decay test: a Friend with no contact for 60 real days is still at least an Acquaintance.
- Memory ring test: the 25th entry drops the oldest.
- Chip test: every chip set offered over a simulated day has 2 to 4 chips and each chip's reply is valid for the speaker.

### POW-M5-07 Parties and companion AI

Size: L Depends: POW-M5-06 Status: READY
Refs: design/07-simulated-mmo (Parties), design/04-combat (Companions in combat), design/12-travelers (3.2)

Goal: run content with up to three Travelers.

Scope:

- Party finder board in the Hearthford square (a prop beside the request board). Browse listings that come from real Traveler lfg state. Post a listing by activity (a dungeon, a creature area, a Trial). Travelers answer over a few in-game minutes by who is online, suited (focus, tier), regard and schedule.
- Role AI: Vanguard, Striker, Support, following the player's target lock, competence from build (reaction delay, dodge chance, positioning error, standing in telegraphs for low ranks). Downed members revive after the fight (04).
- Party frames in the HUD (small, top left, clear text names), Party chat from M5-05 with run lines (wipes, rare drops, "brb").
- Visible loot rolls: need or pass per member by what they use, shown in Party chat and a small roll panel. The player's share follows the existing drop tables. Travelers' shares go to their stock.
- Departure: a member whose session ends gives notice 10 in-game minutes ahead, then leaves at the end of the fight in progress.

Out of scope: raids (M5-11). Guild runs (M5-08).

Save: party state is session only. A party in progress when the game closes disbands.
Integrity: loot to the player passes the existing drop ledger. A Traveler's loot never enters the player's state.

Acceptance:

- Scenario: a party of the player and three Travelers clears the Rootway.
- A rank-5 Striker deals measurably less damage per minute and takes more avoidable hits than a rank-40 Striker over the same fight (scenario prints both).
- A departure warning always precedes a member's logout (test over a simulated week of parties).
- The player's loot in a party run is within the same bounds as a solo run (integrity test).

### POW-M5-08 Guilds

Size: M Depends: POW-M5-06 Status: READY
Refs: design/12-travelers (7), design/07-simulated-mmo (Guilds)

Goal: 12 guilds with cultures, two halls, and a reason to join.

Scope:

- Guild data from `src/content/travelers/guilds.ts`. Membership changes over time (a Traveler may switch guilds at a low rate).
- Invitations: a member who is a Friend, or a guild officer when the player meets the join condition, sends one. The player can ask from a member's profile card.
- Guild chat with a tone set per guild (about 15 templates per guild in `src/content/chat/templates/guild/`).
- Shared stash in the hall, weekly goals (contribute N of an item or clear N of a thing), guild requests on a board in the hall, paid from the guild's goal table.
- Halls: Lantern Players and Hearth and Home in Hearthford as interiors (stamps). Members of other guilds meet in the inn's back room (a new small interior) until their hall's region is baked.

Out of scope: founding a guild (late). Guild boards.

Save: player guild id, stash contents, goal progress. Schema bump and migration.
Integrity: stash items are moved, never created. Guild request rewards get a ledger entry `guildRequest` and a bound like standing requests.

Acceptance:

- Join flow scenario: meet the condition, receive an invite, join, use the stash, finish a weekly goal.
- Sampled guild chat from Iron Oath and Lantern Players over a simulated evening, side by side in the PR. The two read as different tones.
- Stash test: no sequence of deposit and withdraw changes the total item count.

### POW-M5-12 Duels, rivals, mail

Size: M Depends: POW-M5-06 Status: READY
Refs: design/07-simulated-mmo (Rivals and duels, Mail), design/12-travelers (5)

Goal: sporting competition and letters.

Scope:

- Duel: challenge from a profile card or a Traveler's whisper, acceptance by temper and regard, non-lethal (first to 30% health lost), result recorded as memory and on the Duels board.
- Rival flag from repeated close competition (design/12 section 5). Rivals show up at the dungeon the player has entered most in the last 7 real days, taunt in chat (sporting), and sometimes help when the player is downed nearby.
- Mailbox at the inn and the post stand in the square. Letters, gifts, invitations, and later market proceeds. About 150 letter templates in voice in `src/content/chat/letters/`.
- Attachments: items and coin in a gift come from the Traveler's own stock and coin, and are claimed once.

Out of scope: market proceeds (M5-10 adds them through this mailbox).

Save: mailbox (letters with claimed flags). Schema bump and migration.
Integrity: ledger entry `mailGift` for gifted coin and items, bounded by the number of Friend-tier Travelers and a per-day cap in balance data.

Acceptance:

- Duel scenario: challenge, accept, win, see the result on the Duels board and in the Traveler's memory.
- A rival appears at the dungeon the player frequents within 5 visits (scenario).
- Mail attachments cannot be duplicated by claiming twice, by reloading between claim and save, or by importing an older save (tests).

### POW-M5-10 Market simulation

Size: L Depends: POW-M5-03, M3-10, Gate G5a Status: READY
Refs: design/05-life-systems (Economy), design/07-simulated-mmo (Market), tech/02 (Integrity validator)

Goal: a living auction house in Hearthford.

Scope:

- A market terminal on Hearthford's market street, plus stalls that show listings by Traveler handle. Port Brine's market hub arrives with Saltreach (M8).
- Per-item supply and demand from Traveler activity (their crafts and gathers list, their needs buy), season, weather and events, and what the player lists. Prices bounded by a floor and a ceiling from the NPC shop price per item.
- Listings with seller handles, undercutting, buy, list, cancel, a listing fee and a sale cut (balance data). Proceeds by mail (M5-12's mailbox).
- Price history sparkline per item (14 in-game days).
- Chat reacts to price moves (M5-15 lines on `priceMoved` events).
- Player flooding depresses the price, cornering raises it, both bounded, both recover over in-game days.

Out of scope: player shops (M6). Caravans (late).

Save: the player's listings and market price state. Schema bump and migration.
Integrity: ledger entries `marketSale` (coin earned) and `marketFee` (coin spent), and `itemsListed` / `itemsBought`. Rule: market coin earned is at most the sum of sold listings' prices, and items sold were held.

Acceptance:

- Property tests: prices stay within bounds for 10,000 random event sequences. No coin loop between the market and NPC shops (buy low on one, sell high on the other, repeat) gains coin over 1,000 cycles. Flooding recovers to within 10% of the base price within 7 in-game days.
- Integrity test: a save whose market income exceeds its sold listings is flagged.
- Phone screenshots of the terminal, a listing sheet and a sparkline.

### POW-M5-11 World events and calendar

Size: L Depends: POW-M5-04, M4-09, Gate G5a Status: READY
Refs: design/07-simulated-mmo (World events), design/02-world (Time)

Goal: scheduled things worth showing up for.

Scope:

- Event scheduler on the world clock from trusted time. Field raid (several per real day, a scaled field boss spawns in a Dawnmeadow creature area, Travelers converge, contribution rewards), settlement invasion (daily, creatures attack Hearthford's outskirts, defending raises Renown), market day (weekly, held in Hearthford until Port Brine exists, more listings and rare goods).
- Calendar in the Menu with countdowns. System announcements in the System channel before each event.
- The "maintenance" announcement mechanism with nothing behind it yet (M10 fills it).
- Travelers react in chat (M5-15 lines on event events).

Out of scope: festivals (M6). Meteor night, aurora, eclipse (M8, with their spawns).

Save: last fired event per kind (so an offline gap does not refire). Fold into the next schema bump in this wave or bump separately.
Integrity: raid contribution rewards get a ledger entry `eventReward` bounded by events fired in the play window.

Acceptance:

- A field raid with 15 promoted Travelers holds the frame budget (trace).
- Events fire at their scheduled trusted times, including the first event after a 3-day offline gap (test). No event fires twice for one schedule slot.
- Renown from defending an invasion is within its balance bound.

---

## Wave A: Gate G4 findings

From the owner's G4 playtest on 2026-11-21. More are added here if the rest of the G4 checklist turns up findings (D24).

### POW-M5-20 Dungeon doorways

Size: S Depends: none Status: DONE (PR #126)
Refs: design/02-world (Dungeons), docs/ops/gate-g4.md (F5)

Goal: a way on inside a dungeon looks like a way on.
Finding: inside every dungeon the room to room portals had no art, so every exit read as a secret door and players walked the walls looking for them.
Scope: `defineDungeon` (`src/content/world/dungeons/build.ts`) cuts a `tile.cave_arch` into the wall behind each portal a person can walk through from inside a room (every edge that leaves the room, the far end of an open or locked edge, the way out, back doors not behind a slab), or stands one on the portal's tile when it is out in the room. Drop and shortcut landings stay plain, since they work one way only. Re-bake the world.
Out of scope: secret ways (none exist today; a future secret edge opts out by kind). A brighter doorway sprite.
Save: none. Integrity: none.
Acceptance: a test that every edge, the far end of every two way edge and the way out show an arch in all 16 dungeons. Before and after phone screenshots. The existing landing tests still pass.

### POW-M5-21 Quick slot for consumables

Size: M Depends: none Status: DONE (PR #128)
Refs: design/09-ui-ux (HUD, The Menu, Touch rules)

Goal: eat or use a consumable in a fight without opening the Bag.
Scope:

- One HUD button on the outer rim of the technique arc (Flow: beside technique 2 and 3; Classic: one step further out, clear of Guard). It shows the item's icon and how many are left, and hides when the Bag holds nothing usable. Tap uses the item through the ordinary `use` command. A long press steps to the next item and names it in the floater lane.
- Items it takes: food, and gadgets other than the lantern.
- The Bag detail sheet offers "Pin to quick slot" or "Unpin" on those items. Up to three pinned, the oldest dropped. A long press steps through the pinned ones held. With none pinned it offers the first usable item in the Bag. Feed outranks the pin when a sheet would have four actions.
- Keys: F uses, V steps. Pad: d-pad up uses, d-pad down steps.
- Pins and the current pick are UI settings, outside the save, persisted and sanitized like the other settings.
  Save: none (UI settings only). Integrity: none (the sim sees only `use`).
  Acceptance: unit tests for the rules (pick, step, wrap, pin cap, counts, which items qualify). Layout test: the button overlaps no other control in Flow and Classic, with and without a shield, portrait and landscape, either hand. Input test: a tap uses, a long press steps once. Settings sanitize test. Phone screenshots portrait and landscape.

### POW-M5-22 Technique and boss move callouts

Size: S Depends: none Status: DONE (PR #127)
Refs: design/04-combat (Bosses), design/09-ui-ux (The text rule)

Goal: the player can tell which technique they threw and which big move a boss is starting.
Scope: on `techniqueUsed` by the avatar, the technique's name shows over its head in gold pixel text for about a second, drifting up (no drift under reduced motion). Bosses get an optional `callouts` map (attack id to string key in `src/content/strings/callouts.ts`); on `attackStarted` by a boss for a mapped attack, its name shows over the boss in red as the telegraph starts. Plain attacks and common creatures stay quiet. One callout per entity at a time. Timing in `UI_BALANCE.callout`. Render side only.
Save: none. Integrity: none.
Acceptance: unit tests (the avatar's technique shouts, someone else's does not, a mapped boss move shouts, an unmapped one and a common creature do not, every callout names a move in its boss's pattern and a string of at most 16 characters). Phone screenshot of a boss callout.
