# Tech 01 Architecture

## Stack

| Layer     | Choice                                                                            | Notes                                                                                          |
| --------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Language  | TypeScript, `strict`                                                              | One language for client, Worker, tools                                                         |
| Build     | Vite                                                                              | Dev server, production bundle, code splitting                                                  |
| Rendering | Canvas 2D on a low-resolution logical canvas                                      | Renderer sits behind an interface so a WebGL backend can replace it without touching game code |
| UI        | Canvas for HUD and pixel text. DOM for Menu, dialogue, and all clear text         | No UI framework. Small hand-written view helpers.                                              |
| Audio     | Web Audio API, synthesized                                                        | No audio files                                                                                 |
| Storage   | IndexedDB                                                                         | Saves, baked chunk cache, settings                                                             |
| Backend   | One small Cloudflare Worker serving static assets, `/api/health`, and `/api/time` | No secrets, no database, no bindings beyond static assets                                      |
| Tests     | Vitest (unit, sim), Playwright (smoke, screenshots)                               |                                                                                                |
| Lint      | ESLint with custom rules for sim purity                                           |                                                                                                |

Runtime dependencies in the client: none. Dev dependencies are kept short: `vite`, `typescript`, `vitest`, `@playwright/test`, `eslint` and its TypeScript plugin, `wrangler`, `zod` (build-time content validation only), `pngjs` (atlas bake only).

Cloudflare platform details change. Any ticket touching `wrangler` config, bindings, or Worker APIs must check the current Cloudflare documentation before writing config, and say which doc page it followed in the PR.

## Repository layout

```
/
  index.html
  src/
    main.ts                 boot, wires everything
    sim/                    PURE. Deterministic game logic. No platform access.
      kernel/               entity store, scheduler, rng, fixed-point helpers, events
      systems/              movement, combat, skills, ai, crafting, economy, travelers, ...
      settle/               offline settlement formulas
      state.ts              the SimState type (everything that is saved)
    content/                DATA. Typed, validated at build.
      balance/              every tunable number
      items/ skills/ creatures/ recipes/ dialogue/ requests/ paths/
      sprites/ tiles/ audio/
      world/                region specs, stamps
      strings/              all player-facing text, keyed
    render/                 canvas renderer, camera, layers, lighting, particles
    ui/
      hud/                  canvas HUD
      dom/                  Menu, dialogue, clear-text panels
      text/                 the text rule (pixel vs clear decision)
    platform/               input, audio engine, storage, clock, network, haptics, pwa
    save/                   envelope, crypto, seal, integrity validator, migrations
    shared/                 code used by BOTH client and Worker (constants, small helpers)
    dev/                    debug overlay, viewers, editors. Stripped from production.
  worker/
    index.ts                routes (health, time), static asset fallthrough
  tools/                    bake-assets, bake-world, validate-content, pacing-ledger, sim-bot
  baked/                    committed bake output (atlases, chunks, manifests)
  tests/
    unit/ sim/ e2e/ fixtures/
  docs/
```

Import rules, enforced by lint:

- `sim/` imports only from `sim/`, `content/` (types and data), and `shared/`.
- `render/`, `ui/`, `platform/` may read sim state and send commands. They never mutate sim state directly.
- `worker/` imports only from `worker/` and `shared/`.
- `dev/` is imported only behind `import.meta.env.DEV`.

## The simulation

### Loop

- Fixed timestep, 30 Hz. The frame loop accumulates real time and runs zero or more sim ticks, then renders once with interpolation between the last two sim states for moving entities.
- Maximum 5 catch-up ticks per frame. Longer gaps (tab was hidden) are not simulated tick by tick. They go through settlement.
- The game pauses on `visibilitychange` hidden.

### Determinism

Given the same initial state, the same seed, and the same command stream, the sim produces the same state. Required for tests, for settlement correctness, and for the integrity validator to bound results.

- All randomness from a seeded PRNG owned by sim state (a small, fast generator such as sfc32 or xoshiro128). Separate streams per concern (combat, loot, world, travelers) so adding a roll in one does not shift another. Chat wording is the one exception: it picks lines with hash dice keyed on the event, outside the streams, because text must never change the simulation.
- No `Math.random`, `Date`, `performance.now` inside `sim/`. Time enters as tick count and as a trusted wall-clock value passed in by the platform layer.
- No iteration over objects whose key order could vary. Entities are iterated by ascending id.
- Positions and velocities use integers in sub-pixel units (1/256 px). No reliance on float behavior across devices for anything that feeds gameplay outcomes.

### Entities

A lean entity-component store. Components are plain typed records in arrays keyed by entity id. Systems are functions `(state, tickInput) => void` run in a fixed order. No inheritance trees.

Commands are the only way the outside changes the sim: `{ type: 'move', dir }`, `{ type: 'useTechnique', slot }`, `{ type: 'craft', recipeId, inputs }`. Commands are validated by the sim before they apply.

Sim emits events (`damageDealt`, `skillRankUp`, `itemLooted`, `travelerSpoke`) into a per-tick queue. Render, audio, UI, and chat read events. They never poll for changes.

### Levels of detail

| Zone                                    | What runs                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Active chunks (3 x 3 around the player) | Full entity simulation at 30 Hz                                                                                        |
| Loaded but distant                      | Creatures frozen, Travelers abstract                                                                                   |
| Rest of world                           | Abstract only: Travelers, market, crops, Routines, world events, at one tick per in-game minute (every 2 real seconds) |

## Content pipeline

- Content is authored as TypeScript data modules that export plain objects conforming to types in `content/types.ts`.
- `tools/validate-content` runs zod schemas and cross-reference checks (every item a recipe names exists, every sprite a creature names exists, every string key resolves, drop tables sum correctly). Runs in `npm run verify` and CI.
- Ids are stable strings (`item.iron_sword`). Ids are never renamed after they ship in a save. Deprecated ids stay with a `removed: true` flag and a migration.
- All player-facing text is in `content/strings/` keyed by id. No string literals in systems or UI code.

## World streaming

- The bake outputs one binary file per chunk (tile layers, collision, object placements) plus a region manifest.
- The client keeps a 3 x 3 active window and a 5 x 5 loaded window. Chunks load asynchronously one ring ahead of the player's movement.
- Each loaded chunk's static layers are drawn once to an offscreen canvas and blitted per frame. Only animated tiles and entities redraw.
- Chunk files are cached in IndexedDB after first fetch. A region can be fully downloaded for offline play (default: current and adjacent regions are prefetched on Wi-Fi-like connections, and the player can pin regions).
- Frontier chunks are generated in a Web Worker from the seed, never fetched.
- Player-made changes to a chunk (built structures, chopped trees with respawn timers) are stored as deltas in the save, not as modified chunk files.

## State and saves

- `SimState` is the whole truth and is serializable. Nothing gameplay-relevant lives outside it.
- Save format, encryption, sealing, and integrity checks are in tech/02.
- Settings and UI preferences are stored separately, outside the save.

## Networking

The client talks only to its own origin.

| Endpoint          | Purpose      |
| ----------------- | ------------ |
| `GET /api/health` | Liveness     |
| `GET /api/time`   | Trusted time |

The game works fully without either. Network failure is a normal state, not an error screen.

## PWA

- Web app manifest, icons generated by the asset bake.
- A hand-written service worker: precache the app shell and core atlases, cache-first for hashed assets and chunk files, network-only for `/api/*`.
- Update flow: new version downloads in the background and applies on next launch. Never mid-session.
- `navigator.storage.persist()` is requested after the first manual save-worthy moment, with a plain explanation.

## Performance approach

Budgets are in tech/04. Design choices that serve them:

- Low logical resolution means few pixels to fill. Integer upscale is one `drawImage` or CSS scaling.
- Chunk layer caching makes terrain cost constant.
- Object pools for particles, projectiles, and damage numbers. No per-frame allocation in hot paths.
- Abstract simulation for everything off-screen.
- Code splitting: boot shell, core game, Menu UI, dev tools, and per-region content load separately.

## Error handling

- A top-level handler catches uncaught errors, writes a local crash record (no network), attempts an emergency save to a separate slot, and shows a recover screen.
- No telemetry leaves the device. The crash record can be exported by the player to send to the owner by hand.
