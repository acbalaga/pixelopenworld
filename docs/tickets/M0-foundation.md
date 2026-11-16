# M0 Foundation

**Result:** a test map renders and scrolls smoothly on a phone, with touch input, sound, pixel and clear text, deployed to Cloudflare. No gameplay.

**Gate G0:** 60 fps on the reference phone on the test map.

Dependency graph: 01 first. Then 02, 03, 04, 05, 06, 08, 10 in parallel. 07 needs 05 and 06. 09 needs 05 and 06. 11 needs most of the rest.

---

### POW-M0-01 Repo scaffold
Size: M      Depends: none      Status: READY
Refs: CLAUDE.md, tech/01-architecture (Stack, Repository layout), tech/04-quality (Code standards)

Goal: a TypeScript project with the agreed layout and one command that verifies everything.

Scope:
- Vite + TypeScript (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Node version pinned in `.nvmrc` and `package.json` `engines`.
- Directory skeleton from tech/01 with a short `README.md` in `src/sim`, `src/content`, `src/shared`, and `worker` stating that folder's rule.
- ESLint with TypeScript plugin. Import-boundary rules from tech/01 ("Import rules"). Banned in `src/sim/**`: `Math.random`, `Date`, `performance`, `window`, `document`, `fetch`, `indexedDB`, `localStorage`. Banned everywhere: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, string arguments to timers.
- Prettier. Vitest with one passing sample test in `tests/unit`.
- npm scripts: `dev`, `build`, `test`, `lint`, `typecheck`, `verify` (lint, typecheck, test, build in that order), with `bake`, `e2e`, and `validate` as stubs that exit 0 and print "not implemented" until their tickets land.
- `index.html` with correct mobile meta: viewport with `viewport-fit=cover` and no user scaling on the game surface, theme color, no external resources.
- `src/main.ts` draws a solid color to a full-screen canvas to prove the pipeline.
- `.gitignore`, `.editorconfig`, lockfile committed.

Out of scope: game loop, renderer, CI, deploy.

Acceptance:
- `npm ci && npm run verify` passes from a clean clone.
- A test file under `src/sim/` that calls `Math.random()` fails lint. A file in `src/render/` importing from `worker/` fails lint. Both shown in the PR (then removed).
- `npm run build` output contains no third-party runtime code. `package.json` has an empty or absent `dependencies`.
- `npm run dev` serves a page that shows the colored canvas at a phone viewport.

---

### POW-M0-02 Continuous integration
Size: S      Depends: M0-01      Status: READY
Refs: tech/04-quality (CI)

Goal: every PR is checked automatically.

Scope:
- GitHub Actions workflow on pull requests and on pushes to `main`: `npm ci`, lint, typecheck, test, build.
- Bundle budget check: a small script in `tools/` that fails if the gzip size of boot JS exceeds the budget in tech/04. Budget values live in one JSON file.
- `npm audit --audit-level=high` step.
- Cache npm. Upload the `dist/` folder as an artifact.
- Workflow permissions set to read-only by default.

Out of scope: deploy (M0-03), e2e (M0-11), bake drift check (added by M0-06).

Acceptance:
- A PR with a lint error fails CI. A clean PR passes in under 5 minutes.
- Raising a file over the bundle budget in a test branch fails CI with a message naming the file and sizes.

---

### POW-M0-03 Cloudflare deployment
Size: M      Depends: M0-01      Status: READY
Refs: tech/01-architecture (Stack, Networking), tech/02-save-security (Client hardening)

Goal: the built site and a Worker deploy to Cloudflare, with previews per PR.

Scope:
- Check the current Cloudflare documentation for Workers with static assets and for the Vite integration before writing config. Name the pages followed in the PR.
- `wrangler` config: one Worker that serves `dist/` as static assets and handles `/api/*` itself. SPA-style fallback to `index.html` for non-asset, non-API paths.
- `worker/index.ts` with a tiny router. `GET /api/health` returns `{ ok: true, version }` where version is the git SHA injected at build. Unknown `/api/*` returns 404 JSON.
- Security headers from tech/02 on all static responses, including the CSP. API responses get `Cache-Control: no-store`. Hashed assets get long-lived immutable caching. `index.html` is not cached.
- `npm run dev` runs client and Worker together locally.
- GitHub Actions: deploy production on merge to `main`. Deploy a preview on PRs and comment the URL. Deploy steps are skipped cleanly (not failed) when Cloudflare secrets are absent.
- `docs/ops/deploy.md`: the exact owner steps and what each secret is for.

**Owner action:** create the Cloudflare API token and account id, add them as GitHub Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Optionally attach a custom domain.

Out of scope: D1, rate limiting, save endpoints (M2).

Acceptance:
- Locally, `/api/health` responds, `/api/nope` returns 404 JSON, and `/` serves the app with every header from tech/02 present (shown with `curl -I` output).
- The page loads with zero CSP violations in the console.
- With secrets set, a PR gets a preview URL and merging to `main` updates production. Without secrets, CI still passes.

---

### POW-M0-04 Sim kernel
Size: L      Depends: M0-01      Status: READY
Refs: tech/01-architecture (The simulation), tech/04-quality (Testing)

Goal: the deterministic core that all gameplay will run on.

Scope:
- `sim/kernel/rng.ts`: seeded PRNG with named independent streams, serializable state. Functions: `next`, `int(min, max)`, `chance(p)`, `pick(array)`, `weighted(table)`.
- `sim/kernel/entities.ts`: entity ids, component storage as typed arrays or dense arrays keyed by id, create and destroy with id reuse rules that are deterministic, queries returning ids in ascending order.
- `sim/kernel/scheduler.ts`: ordered list of systems, `tick(state, input)`.
- `sim/kernel/events.ts`: per-tick event queue with typed events, cleared at tick start.
- `sim/kernel/commands.ts`: command type union and a validated dispatch point.
- `sim/kernel/fixed.ts`: sub-pixel integer helpers (1/256 px units), integer vector math, direction enums.
- `sim/state.ts`: `SimState` root with tick counter, rng state, entity store, and a `hashState(state)` function (stable, fast, for tests and saves).
- Canonical serialization and deserialization of `SimState` (round-trip exact).
- `platform/loop.ts`: frame loop with accumulator, 30 Hz ticks, max 5 catch-up ticks, interpolation alpha passed to render, pause on hidden. Must behave correctly on 120 Hz displays.
- A trivial demo system (entities drifting and bouncing in a box) to exercise everything.

Out of scope: any real gameplay system, rendering of entities (M0-05 draws them).

Acceptance:
- Determinism test: two runs of 10,000 ticks with the same seed and command script give identical `hashState`. A different seed gives a different hash.
- Serialize then deserialize at tick 5,000 and continue to 10,000: same final hash as an uninterrupted run.
- RNG stream independence test: drawing extra values from stream A does not change stream B's sequence.
- Loop test with a fake clock: at 60 Hz and 120 Hz frame rates the sim advances exactly 30 ticks per second, and a 2 second stall produces at most 5 ticks in the next frame.
- Benchmark in the PR: tick cost for 500 demo entities.

---

### POW-M0-05 Renderer and viewport
Size: L      Depends: M0-01      Status: READY
Refs: design/09-ui-ux (Screen model), tech/01-architecture (Performance approach), tech/04-quality (budgets)

Goal: a crisp, integer-scaled pixel canvas that fits any phone, with a camera and draw layers.

Scope:
- `render/viewport.ts`: compute logical size and integer scale from the visual viewport and device pixel ratio per design/09 (logical width 180 to 239). Handle rotation, address bar resize, and safe-area insets. Expose logical size, scale, safe rect, and physical mm per logical pixel (best estimate from CSS px, used by the text rule).
- `render/renderer.ts`: a `Renderer` interface (`begin`, `drawSprite`, `drawRect`, `drawTiles`, `end`) and a Canvas 2D implementation. Smoothing off. Draw to a logical-size backbuffer, present with one scaled blit.
- `render/camera.ts`: follow target with the portrait offset (target sits in the center of the upper 62%), clamp to world bounds, pixel-snapped position, optional small smoothing that never produces sub-pixel shimmer.
- Layer order: ground, detail, objects and entities (y-sorted), overhead, weather, lighting grade, HUD.
- Interpolated entity drawing using the loop's alpha.
- Temporary colored rectangles stand in for sprites until M0-06.
- A frame-time meter (dev only).

Out of scope: atlases (M0-06), tile chunks (M0-07), lighting and weather content.

Acceptance:
- Screenshots at 360x800, 390x844, 412x915, 844x390 (landscape), and 1440x900 show square, unblurred pixels and correct letterboxing or extension, with logical width inside 180 to 239 in portrait.
- Rotating the device or resizing re-fits without a reload and without stretching.
- Nothing draws inside safe-area insets that is interactive.
- 500 moving rectangles render at 60 fps in desktop Chrome with 4x CPU throttle. Frame meter evidence in the PR.

---

### POW-M0-06 Asset pipeline v1 and master palette
Size: L      Depends: M0-01      Status: READY
Refs: tech/03-asset-pipeline (all)

Goal: sprites authored as text grids become atlases the renderer can draw, under one approved palette.

Scope:
- `content/sprites/palette.ts`: the 32-color master palette per tech/03, with ramp names. Include a short note per ramp on intended use.
- `SpriteDef` and `TileDef` types and zod schemas.
- `tools/bake-assets`: validate, composite, pack atlases by load group, write PNG and JSON manifest to `baked/`, write contact sheets (1x and 4x, light and dark backgrounds, labeled with ids). Deterministic output.
- Runtime `render/atlas.ts`: load manifest and image, `drawSprite(id, frame, x, y, flipX)` and animation playback by time.
- First real art, as the proof: a 16x16 grass tile with 3 variants, dirt, water (2 frames), a tree (trunk on object layer, canopy on overhead), a rock, and a 24x32 placeholder humanoid with a 4-frame walk in 4 directions.
- A swatch sheet image of the palette for owner review.
- CI step: run bake and fail on a diff in `baked/`.
- `npm run bake` and `npm run validate` become real.

**Owner action:** approve the palette from the swatch sheet and the first contact sheet. Revisions happen in this PR.

Out of scope: paper-doll layering (M1-01), autotiling (M0-07), generators beyond flip.

Acceptance:
- A sprite with a wrong row width, an unknown key character, or an out-of-palette index fails the bake with a message naming the sprite, frame, and row.
- Running the bake twice gives byte-identical output.
- Contact sheets and swatch sheet are attached to the PR. The executor states what they checked against the art bible rules.
- The demo scene draws the real sprites and the walk animation plays.

---

### POW-M0-07 Tilemaps and chunk rendering
Size: L      Depends: M0-05, M0-06      Status: READY
Refs: design/02-world (Units, Authoring model), tech/01-architecture (World streaming), tech/03-asset-pipeline (Tiles, Generators)

Goal: a multi-chunk tile world renders at constant cost and has collision.

Scope:
- Chunk data structure: 32x32 tiles, layers (ground, detail, object, overhead), collision grid, object list. Binary encode and decode.
- Autotile: 47-tile blob set resolution for at least grass-to-dirt and land-to-water, generated from authored edge pieces at bake time.
- Chunk renderer: each chunk's static layers drawn once to an offscreen canvas, re-used every frame. Animated tiles drawn on top. Overhead layer fades when a given entity is beneath it.
- A hand-made 3x3 chunk test map built from an ASCII source via a first, minimal version of the stamp format (documented in the file header, to be extended in M4).
- `sim/systems/collision.ts`: tile collision queries for an axis-aligned box, with slide-along-walls resolution. Collision shapes: none, full, water.
- A free-moving camera target driven by temporary keyboard or drag input to scroll the map.

Out of scope: streaming from network (M4), region specs (M4), entity collision between entities (M1).

Acceptance:
- The 3x3 test map renders with correct autotile transitions (screenshot).
- Scrolling across all nine chunks holds 60 fps with 4x CPU throttle. Per-frame draw calls for terrain do not grow with tile count (evidence: counter in dev overlay).
- Collision unit tests: box cannot enter solid tiles, slides along walls, does not tunnel at maximum speed, does not catch on tile seams.
- Encode then decode of a chunk is exact.

---

### POW-M0-08 Input
Size: M      Depends: M0-01      Status: READY
Refs: design/04-combat (Control schemes), design/09-ui-ux (Touch rules)

Goal: touch, keyboard, and gamepad all produce the same abstract actions.

Scope:
- `platform/input/actions.ts`: abstract actions (move vector, technique 1 to 4, dodge with direction, context, target tap at world position, menu, bag).
- Touch: floating stick in the lower zone (appears under the first touch, dead zone, max radius, 8-way and analog output), tap detection, flick detection (distance and time thresholds as tunables), hold detection, on-screen button hit-testing with 44 px minimum targets.
- The 200 ms heading coast when the stick thumb lifts (design/04).
- Keyboard (WASD and arrows, space, keys 1 to 4, E, Esc) and Gamepad API mapping.
- Suppress browser gestures on the game surface: `touch-action: none`, prevent context menu, selection, double-tap zoom, pull to refresh.
- Left-handed mirror flag honored by layout queries.
- Input is sampled into a per-tick input record consumed by the sim loop. The sim never sees DOM events.

Out of scope: drawing the controls (M0-09 draws a basic version, M1-06 the real HUD), combat meaning of actions.

Acceptance:
- Unit tests with synthetic pointer sequences: drag gives the expected vector, a fast short swipe is a flick with the right direction, a slow drag is not, a tap on a button region fires that button, coast lasts 200 ms.
- On a phone-sized emulated touch device the demo entity moves with the stick, and the page does not scroll, zoom, or select.
- Keyboard and gamepad move the same entity through the same action layer.

---

### POW-M0-09 UI foundation: pixel text, clear text, panels
Size: L      Depends: M0-05, M0-06      Status: READY
Refs: design/09-ui-ux (The text rule, Touch rules, Art direction for UI), tech/03-asset-pipeline (Fonts)

Goal: both text renderers exist and one function decides which to use.

Scope:
- Bitmap fonts 5x7 and 7x9 authored in the sprite text format (printable ASCII plus the symbols listed in the file). Canvas pixel-text drawing with outline option, alignment, and measurement.
- `ui/text/rule.ts`: `chooseTextRenderer({ text, lines, physicalMmPerLogicalPx })` implementing the rule in design/09 (2.0 mm capital height, 24 characters, single line). Pure and unit tested.
- 9-slice pixel panel drawing on canvas, and the same frame exported as a CSS `border-image` for DOM panels.
- `ui/dom/`: an overlay root above the canvas, a `ClearTextPanel` helper that builds DOM with `textContent` only, uses the system font stack, honors the text scale setting and OS font size, and is styled from palette colors via CSS custom properties (no inline style attributes, to satisfy the CSP).
- A canvas button component and a DOM button component with shared visual language.
- Settings store (not part of the signed save): text scale, HUD scale, handedness, reduced motion (initialized from the OS preference).
- Demo: a HUD row in pixel text, a temporary on-screen stick and buttons, and a sample dialogue sheet in clear text with a paragraph of prose.

Out of scope: the real HUD and Menu (M1), dialogue system (M1).

Acceptance:
- Unit tests for the text rule covering both thresholds and the automatic fallback on a simulated small-scale device.
- Screenshot at 360x800 showing pixel HUD text and a clear-text panel together, both legible, panel framed in pixel art.
- Text scale at 80%, 100%, and 160% reflows the sample panel without clipping.
- No CSP violations. Contrast of sample text measured at or above 4.5:1.

---

### POW-M0-10 Audio foundation
Size: M      Depends: M0-01      Status: READY
Refs: tech/03-asset-pipeline (Audio)

Goal: synthesized effects and looping tracker music play on phones.

Scope:
- `platform/audio/engine.ts`: audio context created on first user gesture, resume and suspend on visibility, master, music, effects, ambience, and UI gain buses, a limiter, 16-voice cap with priority.
- Effect synth from `SfxDef` presets (wave types, envelope, slide, vibrato, noise, filter, variance).
- Tracker player: instruments, patterns, order list, tempo, seamless looping, crossfade between tracks.
- Content: 8 starter effects (step, hit light, hit heavy, pickup, UI tap, UI open, error, chime) and one 30 to 45 second looping theme.
- Audio reacts to sim events through a small mapping table, not direct calls from systems.
- Volume settings in the settings store.

Out of scope: per-region music, ducking under dialogue (M1), dev audio page (M0-11).

Acceptance:
- No audio context is created before a user gesture (asserted in a test with a mocked `AudioContext`).
- Voice cap test: firing 40 effects in one tick never exceeds 16 voices.
- The theme loops with no gap or click. A short recording or a written check description is in the PR.
- Muting each bus works. Hiding the page silences output.

---

### POW-M0-11 Dev tools and smoke test
Size: M      Depends: M0-04, M0-05, M0-06, M0-07, M0-08, M0-09, M0-10      Status: READY
Refs: tech/04-quality (Testing, CI), tech/03-asset-pipeline (Review workflow)

Goal: the tools that let agents and the owner see what they built, and an automated check that the app boots.

Scope:
- Dev overlay (dev builds only, toggled by a key and a three-finger tap): fps, frame and tick ms, entity count, draw calls, logical size and scale, memory if available.
- `/dev/sprites`: browse every sprite and animation at 1x, 2x, 4x on light, dark, and terrain backgrounds.
- `/dev/audio`: play any effect or track.
- Confirm `src/dev/` is absent from the production bundle (a build check).
- Playwright set up with a mobile portrait profile and touch. `npm run e2e` becomes real: build, start the local Worker, load the app, tap to start, drag to move, assert the entity moved, assert zero console errors and zero CSP violations, capture screenshots.
- CI runs e2e and uploads screenshots.
- `docs/ops/gate-g0.md`: the owner's checklist for Gate G0 (devices, what to look at, how to read the overlay).

**Owner action:** run the G0 checklist on real phones.

Acceptance:
- `npm run e2e` passes locally and in CI, with screenshots attached as artifacts.
- Production bundle contains no dev routes (build check output in the PR).
- The G0 checklist exists and is specific.
