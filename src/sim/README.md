# src/sim

PURE. Deterministic game logic. Imports only from `sim/`, `content/` and `shared/`. Never touches DOM, canvas, `Date`, `Math.random`, `performance`, `fetch` or storage. Takes inputs and a seeded RNG, returns state.

## Map population

`world/populate.ts` puts the baked map's objects into the sim. A new game gets all of them. A loaded save only gains objects it has no counterpart for (same kind at the same place; people by kind), so a newer build's new people, fixtures and nodes show up for old saves, and nothing a player changed is touched. Objects a build moves or removes are not moved or removed in an old save.

## Requests (M3-11)

- `systems/requests.ts` is the engine: a request has solutions, each a list of steps run in order, and any one finished solution finishes it. Steps that are Trial objectives are tracked by the same code as Trials (`advanceTracked` in `systems/trials.ts`). `talk` and `flag` steps are the engine's own. Only manual play advances a request.
- `requestGen.ts` and `systems/boards.ts` post standing jobs at each board at dawn from what the region has (node kinds, spawners, empty shelves), using the `requests` RNG stream. A standing request is stored in the journal with its own definition.
- `requestLog.ts` is the only request API the interface may read. It returns strings and booleans, never positions. Nothing under `render/`, `ui/` or `platform/` imports the engine or the generator (a test greps for it).
- `renown.ts`: Renown by region. Requests, Trials and dialogue add to `journal.renown`. Trade adds the running net of sales (`journal.tradeCoin`), so a buyback takes it off and selling and buying back earns nothing.
