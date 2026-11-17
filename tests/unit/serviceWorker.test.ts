import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(join(process.cwd(), 'src', 'platform', 'pwa', 'sw.js'), 'utf8');
const ORIGIN = 'https://game.test';

type Handler = (event: unknown) => void;

/** A tiny Cache API and fetch, enough to run the worker's own code. */
function boot(version: string, urls: string[], net: Map<string, number | 'down'>) {
  const stores = new Map<string, Map<string, string>>();
  const world = { stores, fetched: [] as string[], skipped: 0 };
  const keyOf = (r: string | { url: string }): string =>
    new URL(typeof r === 'string' ? r : r.url, ORIGIN).pathname;
  const cacheApi = {
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const s = stores.get(name) as Map<string, string>;
      return {
        async addAll(reqs: { url: string }[]) {
          for (const r of reqs) {
            const res = await fetchFn(r);
            if (!res.ok) throw new Error(`precache ${r.url} ${res.status}`);
            s.set(keyOf(r), res.body);
          }
        },
        async match(r: string | { url: string }) {
          const b = s.get(keyOf(r));
          return b === undefined ? undefined : { ok: true, body: b, from: 'cache' };
        },
        async put(r: { url: string }, res: { body: string }) {
          s.set(keyOf(r), res.body);
        },
      };
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name: string) {
      return stores.delete(name);
    },
  };
  const fetchFn = async (r: string | { url: string }) => {
    const k = keyOf(r);
    world.fetched.push(k);
    const status = net.get(k);
    if (status === 'down' || net.get('*') === 'down') throw new TypeError('offline');
    return {
      ok: (status ?? 200) < 400,
      status: status ?? 200,
      body: `${version}:${k}`,
      from: 'network',
      clone() {
        return this;
      },
    };
  };
  const listeners = new Map<string, Handler>();
  const self = {
    location: new URL(ORIGIN),
    addEventListener: (t: string, h: Handler) => listeners.set(t, h),
    skipWaiting: () => {
      world.skipped += 1;
    },
    clients: {
      claim: () => {
        throw new Error('clients.claim must not be called');
      },
    },
  };
  class FakeRequest {
    url: string;
    method: string;
    mode: string;
    constructor(u: string, init: { method?: string; mode?: string } = {}) {
      this.url = new URL(u, ORIGIN).href;
      this.method = init.method ?? 'GET';
      this.mode = init.mode ?? 'cors';
    }
  }
  const code = SRC.replace('__VERSION__', version).replace(
    '/* __PRECACHE__ */ []',
    JSON.stringify(urls),
  );
  runInNewContext(code, { self, caches: cacheApi, fetch: fetchFn, Request: FakeRequest, URL });
  const run = async (type: string, event: Record<string, unknown> = {}): Promise<void> => {
    let pending: Promise<unknown> = Promise.resolve();
    (listeners.get(type) as Handler)({
      ...event,
      waitUntil: (p: Promise<unknown>) => (pending = p),
    });
    await pending;
  };
  const request = async (
    url: string,
    init: { method?: string; mode?: string } = {},
  ): Promise<{ body: string; from: string } | null> => {
    let answer: Promise<{ body: string; from: string }> | null = null;
    (listeners.get('fetch') as Handler)({
      request: new FakeRequest(url, init),
      respondWith: (p: Promise<{ body: string; from: string }>) => (answer = p),
    });
    return answer ? await answer : null;
  };
  return { world, run, request, listeners };
}

const URLS = ['/', '/assets/app-AAA.js', '/assets/atlas-BBB.png', '/manifest.webmanifest'];

describe('service worker', () => {
  it('never claims clients, and skips waiting only when the player asks', async () => {
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/clients\.claim/);
    expect(code.match(/skipWaiting/g)).toHaveLength(1);
    const { world, run, listeners } = boot('v1', URLS, new Map());
    expect([...listeners.keys()].sort()).toEqual(['activate', 'fetch', 'install', 'message']);
    // Installing, activating and serving never skip waiting by themselves.
    await run('install');
    await run('activate');
    expect(world.skipped).toBe(0);
  });

  it('Update now: only the skip-waiting message starts a waiting version', async () => {
    const { world, listeners } = boot('v1', URLS, new Map());
    const send = (data: unknown): void => (listeners.get('message') as Handler)({ data });
    send({ type: 'hello' });
    send(null);
    send('skip-waiting');
    expect(world.skipped).toBe(0);
    send({ type: 'skip-waiting' });
    expect(world.skipped).toBe(1);
  });

  it('install precaches the whole shell under a versioned cache', async () => {
    const { world, run } = boot('v1', URLS, new Map());
    await run('install');
    expect([...(world.stores.get('pow-v1') as Map<string, string>).keys()].sort()).toEqual(
      [...URLS].sort(),
    );
  });

  it('install fails if any file cannot be fetched, so a half version never activates', async () => {
    const { run } = boot('v1', URLS, new Map([['/assets/atlas-BBB.png', 500]]));
    await expect(run('install')).rejects.toThrow();
  });

  it('activate removes older versions and leaves unrelated caches alone', async () => {
    const { world, run } = boot('v2', URLS, new Map());
    world.stores.set('pow-v1', new Map());
    world.stores.set('other-thing', new Map());
    await run('install');
    await run('activate');
    expect([...world.stores.keys()].sort()).toEqual(['other-thing', 'pow-v2']);
  });

  it('a page load gets the cached shell with no network', async () => {
    const net = new Map<string, number | 'down'>();
    const { run, request } = boot('v1', URLS, net);
    await run('install');
    net.set('*', 'down');
    const res = await request('/?at=40,31', { mode: 'navigate' });
    expect(res).toMatchObject({ body: 'v1:/', from: 'cache' });
  });

  it('hashed assets and atlases come from the cache, not the network', async () => {
    const { world, run, request } = boot('v1', URLS, new Map());
    await run('install');
    world.fetched.length = 0;
    expect(await request('/assets/atlas-BBB.png')).toMatchObject({ from: 'cache' });
    expect(await request('/assets/app-AAA.js')).toMatchObject({ from: 'cache' });
    expect(world.fetched).toEqual([]);
  });

  it('a hashed asset not precached (a lazy chunk) is fetched once, then kept', async () => {
    const { world, run, request } = boot('v1', URLS, new Map());
    await run('install');
    world.fetched.length = 0;
    expect(await request('/assets/lazy-CCC.js')).toMatchObject({ from: 'network' });
    expect(await request('/assets/lazy-CCC.js')).toMatchObject({ from: 'cache' });
    expect(world.fetched).toEqual(['/assets/lazy-CCC.js']);
  });

  it('other files are fetched and not stored', async () => {
    const { world, run, request } = boot('v1', URLS, new Map());
    await run('install');
    await request('/readme.txt');
    expect((world.stores.get('pow-v1') as Map<string, string>).has('/readme.txt')).toBe(false);
  });

  it('leaves the API, non-GET requests, other origins and itself to the network', async () => {
    const { run, request } = boot('v1', URLS, new Map());
    await run('install');
    expect(await request('/api/time')).toBeNull();
    expect(await request('/api/health', { mode: 'navigate' })).toBeNull();
    expect(await request('/assets/app-AAA.js', { method: 'POST' })).toBeNull();
    expect(await request('https://elsewhere.test/assets/x.js')).toBeNull();
    expect(await request('/sw.js')).toBeNull();
  });

  it('a new version waits: its caches do not change what the old one serves until activated', async () => {
    const a = boot('v1', URLS, new Map());
    await a.run('install');
    await a.run('activate');
    const b = boot('v2', URLS, new Map());
    // Share the cache storage, as one browser would.
    for (const [k, v] of a.world.stores) b.world.stores.set(k, v);
    await b.run('install');
    expect(await a.request('/assets/app-AAA.js')).toMatchObject({ body: 'v1:/assets/app-AAA.js' });
    expect(b.world.stores.has('pow-v1')).toBe(true);
  });
});
