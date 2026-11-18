# src/sim

PURE. Deterministic game logic. Imports only from `sim/`, `content/` and `shared/`. Never touches DOM, canvas, `Date`, `Math.random`, `performance`, `fetch` or storage. Takes inputs and a seeded RNG, returns state.

## Map population

`world/populate.ts` puts the baked map's objects into the sim. A new game gets all of them. A loaded save only gains objects it has no counterpart for (same kind at the same place; people by kind), so a newer build's new people, fixtures and nodes show up for old saves, and nothing a player changed is touched. Objects a build moves or removes are not moved or removed in an old save.
