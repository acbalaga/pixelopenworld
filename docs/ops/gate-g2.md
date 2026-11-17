# Gate G2 checklist

**Question:** can a player trust their save, and can the game be trusted not to be trivially cheated?
**If no:** fix the failing item before M3. The controls are in `docs/tech/02-save-security.md`; the review of each threat is in `docs/ops/security-review.md`.
**Who:** the owner, on a real phone and a computer. About 90 minutes, plus waiting for the offline days.

Record what you see next to each step. A step that behaves differently from "Expect" is a finding. Write it down exactly and send it to the planning agent.

## 0. Before you start

1. On the computer: `npm ci && npm run verify`. It must pass. This runs the tamper suite, the header checks, the production build checks and the dependency review.
2. `npm run tamper -- --sample`. Expect: every line starts `ok`, ending `33 checks: every blind edit was refused, and the re-sealed edit was flagged.`
3. Deploy a preview (see `docs/ops/deploy.md`) and use that URL on the phone. The service worker and the headers only exist on the deployed build.
4. On the phone, make a new character and play for 10 minutes: fight, open a chest, take a request.

## 1. Open a save file in a text editor

1. In the game, Menu, System, Backup, Export save file. Move the `.powsave` file to the computer.
2. Open it in a plain text editor (Notepad, TextEdit in plain mode, VS Code).
   Expect: unreadable noise. No words from the game (no item names, no handle, no "coin").
3. Open it in a hex editor if you have one. Expect: the first four bytes read `POWS`, and everything after the first 35 bytes looks random.

## 2. Try to edit it

1. In the editor, change one byte somewhere in the middle and save it under a new name.
2. On the phone, Menu, System, Backup, Import save file, pick the edited file.
   Expect: refused, with a plain message (damaged or from a different version). The current save is unchanged. Confirm by closing the menu and checking your coin and items.
3. Repeat with one byte changed in the first 35 bytes, and with the last byte removed. Expect the same refusal each time.
4. On the computer: `npm run tamper -- path/to/your-export.powsave`. Expect: the same `ok` list on your real file, and a last line showing the deliberate edit sealed with the real key is `flagged`.
5. Import your own untouched export again. Expect: it asks before replacing, and keeps the old save available.

## 3. The clock trick

The point: moving the device clock must not farm offline gains. Offline gains arrive with M7, so today this checks the clock, not coin.

1. Note the in-game time of day on the HUD clock.
2. With the phone online, set the phone's date forward by 10 days (Settings, Date and time, turn off automatic time). Reopen the game.
   Expect: the HUD clock continues from where it was. It does not jump. (The server's time wins while the game can reach it.)
3. Turn on airplane mode. Set the date forward another 10 days. Reopen the game.
   Expect: it plays. The in-game time of day moves ahead by the forward jump (the device clock is all it has offline). This is the bounded case: at most one offline cap period (8 hours) can ever be claimed between two syncs, which `tests/unit/clock.test.ts` proves. Nothing pays out until M7.
4. Turn airplane mode off and reopen. Expect: the clock corrects to the real time, with no error.
5. Set the date back by 10 days, offline, and reopen. Expect: the world does not go backwards.
6. Turn automatic date and time back on.

## 4. Play offline for days

1. Open the deployed site once online, on the phone, and let it finish loading.
2. Add it to the home screen (System shows the steps for your phone).
3. Turn on airplane mode. Close the app fully. Open it from the home screen.
   Expect: it opens and your character loads. Play five minutes.
4. Leave it in airplane mode for two or three days, opening it once a day.
   Expect: it opens every time. Your save is still there.
5. System, This device: note whether storage is protected. If it says it is not, tap Protect storage and note the answer.
6. Turn airplane mode off, wait a minute, and open System. Tap Check for updates. Expect either "latest version" or an offer of Update now. Both are fine.

## 5. Export on one device, import on another

1. Phone: Menu, System, Backup, Export save file. Send the file to the computer (or a second phone).
2. On the second device, open the deployed site in a browser with no earlier save. Turn the network off.
3. At the title, choose Import save file and pick the file.
   Expect: it shows the handle and play time, asks to confirm, then you can log in as that character with the same coin, items and skills. The seal on the title screen is solid.
4. Make a small change on the second device (open a chest), export again, and import that file back on the first device. Expect: the same.

## 6. Check what the game sends

1. Open the browser's network panel on the computer and play for five minutes on the deployed site.
   Expect: requests only to your own site. The only API call is `/api/time`. No third-party hosts. No cookies (Application tab, Cookies is empty).
2. Menu, System, Help. Expect the privacy note: no accounts, no analytics, no cookies, the save stays on the device, the server keeps nothing.

## 7. Console

1. On the computer, open the game and the developer console. Try typing `game`, `state`, `sim`, `save`.
   Expect: `ReferenceError` for each. Nothing useful is reachable by name.
2. In Sources, look for `.map` files. Expect none.

## Result

| Section                   | Pass | Notes |
| ------------------------- | ---- | ----- |
| 0 Verify and tamper tool  |      |       |
| 1 Save file is unreadable |      |       |
| 2 Editing is refused      |      |       |
| 3 Clock trick             |      |       |
| 4 Offline for days        |      |       |
| 5 Two devices             |      |       |
| 6 Network and privacy     |      |       |
| 7 Console                 |      |       |
| Lighthouse installability |      |       |

Run Lighthouse's installability audit on the deployed site once (Chrome, DevTools, Lighthouse, Progressive Web App) and write the result in the last row. Section 4 step 4 is the only part that needs real days. If a step fails, do not start M3 until the finding is fixed or the owner accepts the residual risk in `docs/ops/security-review.md`.
