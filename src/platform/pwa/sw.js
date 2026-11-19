/*
 * Pixel Open World service worker (M2-05). Hand written, no libraries. The build fills in VERSION
 * and PRECACHE (see vite.config.ts). It is served from the site root as /sw.js.
 *
 * Rules:
 * - Install precaches the whole app shell: the page, the code chunks, the atlases and chunks of
 *   the world, the icons and the manifest. Install fails if any of it cannot be fetched, so a
 *   half-cached version never becomes active.
 * - A new version installs in the background and WAITS, so code never changes under a running
 *   session. It takes over the next time the game is opened with no old window left, or sooner
 *   only when the player chooses Update now in System (a `skip-waiting` message). No clients.claim.
 * - Navigations get the cached shell. Hashed assets are cache-first. /api/* is never touched.
 * - /world/* (chunk files) is not precached. Chunks are cache-first in their own cache, and the
 *   manifest is network-first, pruning chunks it no longer names.
 */
const VERSION = '__VERSION__';
const PRECACHE = /* __PRECACHE__ */ [];
const CACHE = 'pow-' + VERSION;
// The baked world (M4-03) is kept apart from the app shell, so an app update never throws away
// regions the player has downloaded. Chunk URLs carry their bake hash (`?h=`), so a new bake is a
// new entry. The manifest is network first, and when it shows a new bake the old entries go.
const WORLD = 'pow-world';
// The page is cached as `/`: the host redirects /index.html to it, and a redirected response
// cannot be used to answer a navigation.
const SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // `reload` skips the browser's HTTP cache, so the precache holds what the server has now.
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('pow-') && k !== CACHE && k !== WORLD)
            .map((k) => caches.delete(k)),
        ),
      ),
  );
});

/** The cached answer for a request, or a fetch that is kept if it is a hashed asset. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && new URL(request.url).pathname.startsWith('/assets/'))
    await cache.put(request, res.clone());
  return res;
}

/** Drops cached chunk files of a region that its fresh manifest no longer names. */
async function pruneWorld(cache, region, manifest) {
  const keep = new Set(manifest.files.map((f) => `/world/${region}/${f.file}?h=${f.hash}`));
  keep.add(`/world/${region}/manifest.json`);
  for (const req of await cache.keys()) {
    const u = new URL(req.url);
    if (u.pathname.startsWith(`/world/${region}/`) && !keep.has(u.pathname + u.search))
      await cache.delete(req);
  }
}

/** A region manifest: the network when it answers, the kept copy when it does not. */
async function worldManifest(request) {
  const cache = await caches.open(WORLD);
  try {
    const res = await fetch(request);
    if (res.ok) {
      const copy = res.clone();
      await cache.put(request, copy.clone());
      try {
        const m = await copy.json();
        await pruneWorld(cache, new URL(request.url).pathname.split('/')[2], m);
      } catch {
        // A manifest that does not parse is the game's problem, not the cache's.
      }
    }
    return res;
  } catch (e) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw e;
  }
}

/** A chunk file: cache first, kept when fetched. */
async function worldChunk(request) {
  const cache = await caches.open(WORLD);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

/** The shell for any page load, so the game opens with no connection. */
async function shell(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(SHELL);
  if (hit) return hit;
  return fetch(request);
}

/** Decides how a request is answered. Returns null to leave it to the network untouched. */
function route(request) {
  if (request.method !== 'GET') return null;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return null;
  if (url.pathname.startsWith('/api/')) return null;
  if (url.pathname === '/sw.js') return null;
  if (request.mode === 'navigate') return shell(request);
  if (url.pathname.startsWith('/world/'))
    return url.pathname.endsWith('/manifest.json') ? worldManifest(request) : worldChunk(request);
  return cacheFirst(request);
}

// The one way a waiting version starts early: the player asks in System ("Update now"), after the
// game has saved. Nothing else calls skipWaiting, and nothing claims clients: the page reloads
// itself when the new worker takes control.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const answer = route(event.request);
  if (answer) event.respondWith(answer);
});
