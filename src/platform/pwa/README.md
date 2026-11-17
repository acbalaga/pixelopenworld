# src/platform/pwa

Installable and offline (POW-M2-05).

- `sw.js` is the hand-written service worker. `vite.config.ts` (`serviceWorker()` plugin) fills in `VERSION` (a hash of the precache list) and `PRECACHE` (the page as `/`, every emitted asset, the icons and the manifest) and emits it as `/sw.js`. `npm run check:pwa` fails the build if the list and `dist/client` disagree.
- Install precaches everything or fails, so a half-cached version never activates. There is no `skipWaiting` and no `clients.claim`: a new version waits until no window uses the old one, so code never changes mid-session. The next launch runs it and drops the old cache.
- Navigations get the cached shell, hashed assets are cache-first, `/api/*` is never touched. The shell is cached as `/` because the host redirects `/index.html` to it and a redirected response cannot answer a navigation.
- `index.ts` registers the worker (production builds only), keeps the "updated" note (build id compared with the last one seen), asks `navigator.storage.persist()` once (after the first Trial or 15 minutes of play, from `demo/world.ts`), and gives System what it needs to explain installing. iOS has no install prompt API, so it gets text.
- Icons and `manifest.webmanifest` come from `tools/bake-assets/pwa.ts`, one authored 16 by 16 emblem scaled by integers, colors from the palette. `npm run bake` writes them to `public/`, `bake:check` catches drift.
- The worker leaves `/api/*` alone, so e2e routes on the API still work. `tests/e2e/pwa.spec.ts` covers offline boot, cache hits and the update flow.
