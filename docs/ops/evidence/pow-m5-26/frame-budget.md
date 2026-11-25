# POW-M5-26 frame budget

Crowd tick (`travelersSystem`, abstract and entity layer) over 9000 sim ticks (5 in-game dusk
hours) with the avatar standing at the river camp, so the ring around it is loaded. Clear dusk,
three seeds, open collision grid (sim cost only, no render):

| Seed | Mean ms/tick | p99 ms | Peak promoted |
| ---- | ------------ | ------ | ------------- |
| 1    | 0.042        | 0.376  | 24            |
| 2    | 0.025        | 0.239  | 25            |
| 3    | 0.017        | 0.149  | 21            |

Budget in docs/tech/04-quality.md for the crowd: 0.5 ms average. The one-off maxima (4 to 28 ms)
are single ticks in the run (not compared against a run without the camp).
The camp adds one weather and phase check per social or afk choice, and an occupancy scan of the
online list only when a camp roll succeeds.
