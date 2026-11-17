# Gate G1 playtest script

**Question:** is one-thumb combat fun for 20 minutes?
**If no:** iterate the controls before any more combat content (master plan, section 6). This gate matters most. Nothing downstream survives bad feel.
**Who:** the owner, on a real phone. About 40 minutes: 20 per control scheme.

Budgets come from `docs/tech/04-quality.md`. The numbers measured on the slice are in the POW-M1-11 PR.

## 1. Get a build with the scheme toggle

The toggle exists only in dev builds. Deployed previews do not have it, by design. Without it you can still switch scheme in Menu, System.

1. On your computer: `npm ci && npm run dev -- --host`. Note the `Network:` address it prints (for example `http://192.168.1.20:5173`).
2. Put the phone on the same Wi-Fi. Open the address in the phone's browser.
3. Choose Log In and make a character. The top right button reads `Scheme: flow` or `Scheme: classic`. Tap it to switch. The dev overlay (three-finger tap, top left) shows frame timing.

If the address does not load, check the computer's firewall allows port 5173.

## 2. The two schemes

| Scheme  | Hands | Summary (design/04)                                                                    |
| ------- | ----- | -------------------------------------------------------------------------------------- |
| Flow    | One   | Drag to move. Basic attack is automatic in reach. Tap an enemy to lock. Technique tap. |
| Classic | Two   | Fixed stick left, attack and dodge right. Manual attack.                               |

Play Flow first in portrait with one thumb, then Classic in landscape with two. Try each with the left-handed mirror from Menu, System if you are left handed or curious.

## 3. What to try, in each scheme

Do the slice in this order. It is the same route in both schemes.

1. **Arrive.** Walk around the square. Does the first hint appear and go away when you do the thing?
2. **Talk.** Speak to Brin (shop), the cook, and Orla the guard. Take Orla's request.
3. **Fight in the meadow.** Kill four Mosslings. Notice how long each fight takes (design says 5 to 20 seconds for common enemies).
4. **Dodge.** Let a Mossling wind up and dodge it. Try to dodge on purpose, not by accident.
5. **Run dry.** Dodge until Stamina is empty. Does running dry feel like your mistake?
6. **Turn in the request.** Check coin and the ring arrive once.
7. **Cook.** Stand at the camp pot. Cook the raw meat. Eat the result.
8. **The caves.** Go in. Fight a Bramble Boar and a Spitbloom. Try the cave rooms with the lantern puzzle and the locked door.
9. **The Bramblehide.** Fight the boss at least once. Note whether you died, and why.
10. **Log out and back in.** Confirm the same character, bag and request state.

## 4. Questions to answer

Answer for each scheme, then compare.

| Question                                                    | Flow | Classic |
| ----------------------------------------------------------- | ---- | ------- |
| Did the avatar do what you meant most of the time?          |      |         |
| Where did your thumb get tired, and after how many minutes? |      |         |
| Did you ever lose track of the avatar under your thumb?     |      |         |
| Did you dodge on purpose, or by accident?                   |      |         |
| Was any text hard to read? Which, on which screen?          |      |         |
| Were fights too short, too long, or about right?            |      |         |
| Did a tap ever miss, or hit the wrong thing?                |      |         |
| Did the touch to response delay ever feel late?             |      |         |
| Would you keep playing for another 20 minutes?              |      |         |

Questions for the whole slice:

1. **Which scheme felt better, and by how much?** This decides the portrait default. Classic stays the landscape default either way.
2. Does the art look like one game, or like parts from different games?
3. Did you know what to do next at every point without being told?
4. Did anything stutter, freeze, or play the wrong sound?
5. What was the first thing you wanted to change?

## 5. Performance on the phone

With the overlay on, in the busy square and in the cave fight, write down:

| Reading                      | Budget                    | Flow | Classic |
| ---------------------------- | ------------------------- | ---- | ------- |
| fps                          | 60, never below 45        |      |         |
| frame p95 and `>20 ms` count | no hitches in a fight     |      |         |
| render ms                    | under 8                   |      |         |
| tick ms (avg, max)           | under 6 avg, under 12 max |      |         |
| heap MB (Chrome)             | under 150, flat           |      |         |

Battery: note the percentage before and after a 20 minute session. Budget is under 8% per 30 minutes.

## 6. Notes form

Copy this block into an issue or a message.

```
Device and browser:
Date:
Default scheme I would ship (flow / classic / depends on orientation):
Flow, best thing:
Flow, worst thing:
Classic, best thing:
Classic, worst thing:
Thumb fatigue (where, when):
Lost the avatar? (when):
Hard to read text (screen):
Art looks like one game? (yes / no, why):
Performance problems (where):
Bugs (what I did, what happened):
Would I play 20 more minutes? (flow / classic):
```

## 7. What happens with the answers

The default scheme is set from question 1. The rest feed the M3 refinement ticket. Controls that fail the question get iterated before M3 starts.

## Result

**Passed** on 2026-11-17, owner playtest on a phone.

| Item              | Decision                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Portrait default  | Flow. Classic stays the default in landscape and on gamepad or keyboard.                                                              |
| Dodge in Flow     | The dodge button. Flick dodge was removed in the playtest fixes (PR #35) and stays removed. design/04 updated.                        |
| Numbers to change | None raised. M3 starts from the tunables on `main`.                                                                                   |
| Follow-ups        | The playtest fixes already merged (PRs #35, #40 and #45). Everything else feeds POW-M3-01, recorded in `docs/tickets/M3-core-rpg.md`. |
