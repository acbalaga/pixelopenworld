# Gate G5a checklist

**Question:** does Hearthford feel populated, and does chat read as people, at two times of day? (D27)
**If no:** a finding on a single item is a ticket. A crowd that feels empty or fake, or chat that reads as a loop, is a rework: change design/12 before wave C starts. Parties, guilds, duels, mail and the market (POW-M5-06 and later) do not start until this passes.
**Who:** the owner, on a real phone. About an hour: two sessions of 30 minutes.

Record what you see next to each step. A step that behaves differently from "Expect" is a finding. Write it down exactly and send it to the planning agent.

## 0. Before you start

1. On the computer: `npm ci && npm run verify`. It must pass.
2. `npm run crowd-report`. Expect: the online count for a simulated week, with the evening peak well above the early morning trough. Write down the two numbers, so you can compare them with what you count in the game.
3. Start the dev server so the phone can reach it: `npm run dev -- --host`. Open the printed network URL on the phone. The time flag below works in dev builds only. It is absent from production builds, and a build test holds that.
4. Make a **new** character, or load a test one. Do not use `?kit=dev` unless you need the gear.

## 1. Setting the time without touching the clock

The crowd follows the real local time of the device. To check two times of day in one sitting, add `localtime=HH:MM` (24 hour, device local) to the URL. The crowd then behaves as if it were that time, from that minute on, and runs on normally. The device clock is not changed.

| Session               | URL ends with      | Expect                                    |
| --------------------- | ------------------ | ----------------------------------------- |
| Weekday evening       | `&localtime=20:30` | The busy part of the day. Run 30 minutes. |
| Weekday early morning | `&localtime=05:30` | A thinner crowd. Run 30 minutes.          |

Use a weekday date on the device (Monday to Friday). Schedules differ at the weekend, which is a different check. Add `&chatdebug=1` if you want each chat line's source and template shown. Tap the dev overlay (Backquote, or three fingers) to see the online and entity counts.

## 2. Each session (30 minutes in Hearthford, on the phone)

Do these in the square, the inn and the market street. Walk about. Do not stand still.

### C1. Count the Travelers

1. Open the dev overlay. Write down the online count and the entity count (Travelers you can see in the world).
2. Count the Travelers you can see from the square at one moment. Write it down.
   Expect: the online count is close to the `crowd-report` figure for that hour (it uses another seed, so not exact). The evening count is clearly higher than the morning count. The square, the inn and the market street each hold a few people, not all in one place.
3. Watch five Travelers for a minute each.
   Expect: some walk, some stand and talk, some sit, some are at a station or a stall. Nobody walks through a wall, stands inside another, or jumps.

### C2. Read 50 lines of chat

1. Read the ticker and the chat sheet for 50 lines in World and Local together. Do not skim.
2. Tick off, and write down any line that does:
   - names a place, creature or item that is not on the map or not in the game yet (any place not in the world map is a finding);
   - repeats a line you read earlier in the same session;
   - reads like a machine, a menu or a system message;
   - refers to something the speaker could not know;
   - is cruel, or talks about the real world in a way you could check (a date, a city, a brand);
   - explains the world or tells you what is going on.
     Expect: about 50 lines in about 30 minutes in the evening, fewer in the morning. A line or two that feels slightly off is normal. A pattern is a finding.
3. Find one question and its answer. Expect: the answer is sometimes wrong, never harmful.
4. Find a pair of friends or rivals talking. Expect: a few lines, in turn, in voice.

### C3. Tap three profile cards

1. Tap three different Travelers. Pick one who is talking, one who is walking, one who is at a station.
2. Expect: a doll, a handle, a title, a guild if they have one, three skills as rank bands (never exact points). The card opens and closes cleanly and the world does not pause strangely.
3. Compare with chat. A Traveler who said they were crafting should be at a station.

### C4. Watch one log out

1. Pick a Traveler who is near and has been talking. Stay with them.
2. Expect: they say goodbye or go quiet, walk to a believable spot, and are gone without a pop. The online count drops by one.

### C5. Nothing names a place not on the map

1. Open the map. Read the chat for places. Ask: is every place a Traveler names on the map?
   Expect: yes. Any place or region name that is not in Dawnmeadow is a finding. Write down the exact line.

## 3. Compare the two sessions

| Check                    | Evening | Early morning |
| ------------------------ | ------- | ------------- |
| Online count             |         |               |
| Travelers visible        |         |               |
| Chat lines in 30 minutes |         |               |
| Anything off in chat     |         |               |
| Does it feel populated?  |         |               |

Expect: morning is quieter, in a way that feels like early morning and not like a broken game. If the morning looks the same as the evening, or the evening looks empty, that is a finding.

## 4. Verdict

Record, for the planning agent: the two counts, the three things that felt most like people, the three that felt most like a script, every line that tripped C2, and one of:

- **pass** (wave C starts);
- **adjust** (wave C starts, with the tickets you list);
- **rework** (change design/12 before wave C).

## 5. Result

- **Date:** 2026-11-25, evening and early morning, on a phone.
- **Verdict:** adjust. The crowd feels populated and fun. Wave C started.
- **Findings:** POW-M5-23 to POW-M5-31 (`docs/proposals/m5-g5a-feedback-plan.md`). All merged by 2026-11-27, except POW-M5-28, which was withdrawn into POW-M5-11.
- **Frame budget (5.8 of the M5 closeout):** no slowdown was reported in either phone session. Whether name labels switch to clear text when they are too small for pixel text is left to the M12 device pass.
