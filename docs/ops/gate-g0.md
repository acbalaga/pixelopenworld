# Gate G0 checklist

**Question:** does the test map hold 60 fps on a mid-range phone?
**If no:** fix the renderer before any gameplay (master plan, section 6).
**Who:** the owner, on real phones. This takes about 20 minutes.

Budgets come from `docs/tech/04-quality.md`: 60 fps in a busy scene, never below 45, render under 8 ms per frame, sim tick under 6 ms average and 12 ms worst case at 30 Hz, no GC pause over 10 ms.

## 1. Devices

Minimum set (device matrix in tech/04). Record the exact model and browser version.

| Device                                  | Browser | Required for G0 |
| --------------------------------------- | ------- | --------------- |
| Mid-range Android (about 2021)          | Chrome  | Yes, the gate   |
| iPhone of similar age                   | Safari  | Yes, the gate   |
| Low-end Android                         | Chrome  | Report only     |
| Recent iPhone                           | Safari  | Report only     |
| Tablet                                  | Either  | Report only     |
| Desktop with 4x CPU throttle (DevTools) | Chrome  | Report only     |

## 2. Get a build with the overlay

The overlay exists only in dev builds. Deployed previews do not have it, by design.

1. On your computer: `npm ci && npm run dev -- --host`. Note the `Network:` address it prints (for example `http://192.168.1.20:5173`).
2. Put the phone on the same Wi-Fi. Open `<network address>/?auto=1` in the phone's browser.
3. If the address does not load, check the computer's firewall allows port 5173.

The dev build is unminified, so it is a little slower than production. A pass here is a pass in production. A marginal fail here needs a second look at a production build with the browser's own frame stats (see section 5).

## 3. Reading the overlay

Top left of the screen:

```
60 fps  frame 16.7 ms (p95 17.1, max 18.0, >20 ms: 0)
render 0.78 ms  tick 0.08 ms (max 0.10)
entities 1  draw calls 17
logical 180x333 at 6x  heap 9.5 MB
chunks 9 built 9 | terrain blits 1
```

| Line                | Meaning                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `fps`, `frame`      | Average frame interval over the last 240 frames (about 4 seconds). `p95` and `max` are the slow tail. |
| `>20 ms`            | Count of frames in the window slower than 20 ms. Each one is a visible hitch at 60 Hz.                |
| `render`, `tick`    | Milliseconds of work in the render callback, and per sim tick. Not the same as frame interval.        |
| `draw calls`        | Canvas draw calls last frame. Should not grow while walking across the map.                           |
| `logical ... at Nx` | Logical canvas size and the integer scale to the screen. Portrait width should be 180 to 239.         |
| `heap`              | JS heap in MB. Chrome only; shows `n/a` on Safari.                                                    |
| `terrain blits`     | Terrain is drawn from cached chunks. This stays at a handful.                                         |

Toggle the overlay with a three-finger tap, or the Backquote key on a keyboard. Hiding it removes its own cost from the measurement.

## 4. The run

`?auto=1` flies the camera through all nine chunks in a loop with no input, so every device sees the same load.

1. Load `/?auto=1`. Let it settle for 5 seconds.
2. Watch the overlay for 60 seconds. Note the worst `max` and the highest `>20 ms` you see.
3. Then load `/` (no `auto`), walk with the stick and a hard turn around the map for 30 seconds. Check that touch response feels immediate.
4. Screenshot the overlay at the end of the auto run.

### Pass

All of these, on both gate devices:

- Average `fps` within 1 of the display's refresh rate (59 or higher on a 60 Hz screen). On a 120 Hz screen, 60 or higher is a pass, since the game targets 60.
- `max` never above 22 ms (the 45 fps floor) after the first 5 seconds.
- `render` under 8 ms, `tick` under 6 ms average.
- `draw calls` and `terrain blits` flat while the camera moves between chunks.
- No visible tearing, stutter at chunk borders, or blurry pixels.
- `heap` does not climb steadily over the 60 seconds (a slow sawtooth is fine).

### Fail

Any `max` above 33 ms that repeats, an average below 55 fps, or `render` above 8 ms. Record the device, the numbers and a screenshot, and report it. Do not retune by hand: the fix is a renderer ticket.

## 5. Optional: production build check

If a dev result is marginal, run `npm run build && npx vite preview --host` and open the network address. There is no overlay in production. Use the browser's own tools instead: Chrome remote debugging (`chrome://inspect`) with the Performance panel, or Safari Web Inspector's Timelines, and look for frames over 16.7 ms.

## 6. Other things to look at while you are there

- Safe areas: the HUD and controls stay clear of notch and home bar.
- Address bar collapse and rotate: the canvas refits with no stretch.
- Audio: the first tap unlocks sound. Check iOS after a lock and unlock of the screen.
- Power: note battery percentage before and after 10 minutes of `?auto=1` (budget is under 8% per 30 minutes).

## 7. Report

Paste this into the ticket's GitHub issue or the PR, one row per device:

| Device and browser | avg fps | worst max ms | worst `>20 ms` | render ms | tick ms | Result |
| ------------------ | ------- | ------------ | -------------- | --------- | ------- | ------ |
|                    |         |              |                |           |         |        |

Attach the overlay screenshots. G0 passes when both gate devices pass.
