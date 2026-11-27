# Frame budget, Hearthford square at the evening peak

Headless Chromium, 360 x 640, CPU throttled 4x as a proxy for a mid-range phone, rain on, chat sheet open. The same scene is measured with the crowd asleep (`?crowd=0`) and awake.

|                   | Crowd asleep | Crowd awake    |
| ----------------- | ------------ | -------------- |
| Traveler entities | 0            | 22 (30 online) |
| fps               | 46           | 40             |
| frame ms (p95)    | 21.5 (29)    | 24.7 (35)      |
| render ms         | 8.46         | 10.43          |
| sim tick ms (max) | 1.65 (6)     | 2.05 (21)      |

Budgets (tech/04): 60 fps in a busy hub, never below 45; render under 8 ms; tick under 6 ms average, 12 ms worst. This is a proxy, not the reference device: re-check on a real phone at Gate G5a.
