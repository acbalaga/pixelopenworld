/*
 * Pixel Open World service worker (M2-05). Hand written, no libraries. The build fills in VERSION
 * and PRECACHE (see vite.config.ts). It is served from the site root as /sw.js.
 *
 * Rules:
 * - Install precaches the whole app shell: the page, the code chunks, the atlases and chunks of
 *   the world, the icons and the manifest. Install fails if any of it cannot be fetched, so a
 *   half-cached version never becomes active.
 * - A new version installs in the background and WAITS. There is no skipWaiting and no
 *   clients.claim, so code never changes under a running session. The new version takes over the
 *   next time the game is opened with no old window left.
 * - Navigations get the cached shell. Hashed assets are cache-first. /api/* is never touched.
 */
const VERSION = '__VERSION__';
const PRECACHE = /* __PRECACHE__ */ [];
const CACHE = 'pow-' + VERSION;
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
          keys.filter((k) => k.startsWith('pow-') && k !== CACHE).map((k) => caches.delete(k)),
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
  return cacheFirst(request);
}

self.addEventListener('fetch', (event) => {
  const answer = route(event.request);
  if (answer) event.respondWith(answer);
});
