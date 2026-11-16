# 06 Automation

Automation is the reward for mastery. You automate what you have already proven you can do, so your attention is free for what you have not done yet. It must never be the best way to play, and it must never play the interesting parts for you.

## Three kinds

| Kind | What it does | Runs when |
|---|---|---|
| **Routines** | A worker repeats a gathering, farming, crafting, or selling loop | Game open or closed |
| **Tactics** | Rule-based control of the avatar and companions in combat | Game open |
| **Patrol** | The avatar auto-fights in a cleared zone using Tactics | Game open or closed |

## Requirements (all must hold)

### Routines

1. **Mastery:** the skill is Expert (50) or higher.
2. **Proof:** the player has done this exact thing by hand. Gathered from this node type 50 times, crafted this recipe 20 times, harvested this crop 10 times.
3. **A worker:** someone to do it. One of:
   - a **hired hand** (NPC, paid a daily wage, hired with Leadership and Renown),
   - a **companion** (tamed creature with the right role),
   - a **golem** (built with Tinkering, needs fuel).
4. **A place:** homestead facilities for farming and crafting. A claimed gathering site (a mine shaft, a grove) for gathering. A stall or shop for selling.

### Patrol

1. The zone's regional boss has been resolved.
2. The zone's bestiary is complete (every creature type there defeated 10 times by hand).
3. The avatar's worn gear tier is at or above the zone tier.
4. A Tactics set is saved.

Worker slots start at 1 and grow to 8 through Leadership ranks, homestead upgrades, and Paths.

## What automation can never do

- Pass a Trial or cross a mastery rank threshold.
- Produce a first: first discovery of a recipe, species, creature, or location.
- Produce Masterwork quality, legendary catches, boss drops, or lore fragments.
- Explore, open chests, complete requests, or enter dungeons.
- Run in a region the player has not finished the boss of.

## Yields

Automation is always worse than doing it yourself.

| Item | Rule |
|---|---|
| Output rate | 60% of the player's own measured manual rate for that activity, rising to 80% with worker upgrades |
| Skill XP | 25% of manual. Banks at the next mastery threshold like all XP. |
| Quality | Rolls one tier lower than the player's typical result, capped at Superior |
| Costs | Wages, fuel, feed, tool wear, and input materials are consumed. A Routine that runs out of inputs stops. |
| Patrol loot | Common drop tables only. Coin and materials. |
| Patrol risk | None. Patrol in a qualifying zone cannot kill the player. |

The "measured manual rate" is recorded when the player does the activity by hand. Getting better by hand makes your Routines better. That is the loop.

## Offline gains

The world clock runs while the game is closed. On login, a **settlement** computes what Routines and Patrol produced.

- Settlement is a formula over elapsed time, not a replay of the sim: `yield = rate * elapsed * efficiency`, limited by inputs, storage space, and the cap.
- **Cap:** 8 hours of accumulation at base. Upgrades (storehouse, foreman) raise it to 12. Past the cap, workers idle.
- **Efficiency:** offline runs at 50% of the online Routine rate at base, up to 75% with upgrades.
- Crops and animals follow their normal real-time rules. They are not capped, but ripe crops just wait.
- Elapsed time comes from trusted time (see tech/02-save-security). A device clock that moved backwards yields zero for that interval. No penalty beyond that.

### The welcome-back screen

On login after 10+ minutes away, one panel: time away, what each worker produced, what stopped and why (full storage, out of fuel), market sales, mail, who is online. One button: Collect all. It should feel like coming home to a full storehouse.

## Tactics

A small rule list, evaluated top to bottom, in the style of a gambit system.

`IF <condition> THEN <action>`, for example:

- IF my Health below 40% THEN use Mending technique
- IF target is Staggered THEN use slot 2
- IF enemy telegraph in range THEN dodge away
- IF companion Health below 30% THEN heal companion
- ELSE basic attack nearest

- Rule slots: 3 at start, up to 10. More slots and more condition types unlock from combat skill ranks and Leadership.
- Tactics drive Patrol, and can optionally drive the avatar in normal play (an "assist" toggle the player can interrupt with any input). This is also an accessibility feature.
- Tactics dodge worse than a good player by design: a reaction delay that shrinks with Evasion rank and never reaches zero.
- Tactics are refused inside dungeons and against bosses.

## Interface

A **Routines** tab in the menu: a list of workers, each a card showing what, where, rate per hour, inputs remaining, and status. Assigning is three taps: worker, activity, place. The tab shows the offline cap as a bar.

## Abuse limits

- All rates are bounded by named constants. The save integrity validator flags a save whose gains exceed what the Routines on record could produce in the elapsed trusted time.
- Market sales from player shops are bounded by simulated demand, so infinite production does not mean infinite coin.
- Settlement is idempotent: it is keyed to the last settled timestamp stored in the save.
