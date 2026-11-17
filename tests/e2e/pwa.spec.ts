import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { watchProblems } from './helpers';

// The only spec that lets the service worker run.
test.use({ viewport: { width: 360, height: 800 }, serviceWorkers: 'allow' });
test.setTimeout(90_000);

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(300);
}
const attr = (page: Page, name: string): Promise<string | null> =>
  page.locator('#game').getAttribute(name);

async function controlled(page: Page): Promise<void> {
  // The first visit installs the worker; a reload puts the page under it.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await ready(page);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

const cacheKeys = (page: Page): Promise<string[]> =>
  page.evaluate(async () => (await caches.keys()).sort());

test('installability: manifest, icons and a worker with a fetch handler', async ({
  page,
  request,
}) => {
  await page.goto('/?at=40,31');
  await ready(page);
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  const res = await request.get(href as string);
  expect(res.ok()).toBe(true);
  const m = (await res.json()) as { icons: { src: string }[]; display: string };
  expect(m.display).toBe('standalone');
  for (const i of m.icons) expect((await request.get(i.src)).ok()).toBe(true);
  const sw = await request.get('/sw.js');
  expect(sw.headers()['cache-control']).toContain('no-cache');
  expect(await sw.text()).toContain("addEventListener('fetch'");
});

test('load once online, go offline, reload: the game boots and the saved game loads', async ({
  page,
  context,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/?at=40,31');
  await ready(page);
  await controlled(page);
  // Write a save, then remember what it was.
  const seq0 = Number((await attr(page, 'data-saved-seq')) ?? '0');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(async () => Number((await attr(page, 'data-saved-seq')) ?? '0'))
    .toBeGreaterThan(seq0);
  const hash = await attr(page, 'data-saved-hash');

  await context.setOffline(true);
  await page.reload();
  await ready(page);
  expect(await attr(page, 'data-loaded-hash')).toBe(hash);
  expect(await attr(page, 'data-time-synced')).toBe('false');
  expect(problems.pageErrors).toEqual([]);
  await context.setOffline(false);
});

test('repeat visits serve chunks and atlases from the cache', async ({ page }) => {
  await page.goto('/?at=40,31');
  await ready(page);
  await controlled(page);
  const served: { url: string; sw: boolean }[] = [];
  page.on('response', (r) => {
    if (new URL(r.url()).pathname.startsWith('/assets/'))
      served.push({ url: r.url(), sw: r.fromServiceWorker() });
  });
  await page.reload();
  await ready(page);
  expect(served.length).toBeGreaterThan(5);
  expect(served.filter((s) => !s.sw).map((s) => s.url)).toEqual([]);
  expect(served.some((s) => s.url.includes('atlas-core'))).toBe(true);
  expect(served.some((s) => s.url.includes('chunk-slice'))).toBe(true);
});

/** Serves dist/client on its own origin, with a worker file whose version the test can change. */
function deployServer(): Promise<{
  url: string;
  setVersion: (v: string | null) => void;
  close: () => void;
}> {
  const root = join(process.cwd(), 'dist', 'client');
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css',
    '.png': 'image/png',
    '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json',
  };
  let version: string | null = null;
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    const rel = path === '/' ? 'index.html' : path.slice(1);
    const file = join(root, rel);
    if (!file.startsWith(root) || !existsSync(file) || rel.startsWith('api/')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
      return;
    }
    let body: Buffer | string = readFileSync(file);
    if (rel === 'sw.js' && version)
      body = body
        .toString('utf8')
        .replace(/const VERSION = '[^']*'/, `const VERSION = '${version}'`);
    res
      .writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
      })
      .end(body);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
        setVersion: (v) => (version = v),
        close: () => server.close(),
      }),
    ),
  );
}

test('a new version installs in the background and only takes over on the next launch', async ({
  context,
}) => {
  const site = await deployServer();
  try {
    const first = await context.newPage();
    await first.goto(`${site.url}/?at=40,31`);
    await ready(first);
    await controlled(first);
    const before = await cacheKeys(first);
    expect(before).toHaveLength(1);

    // "Deploy": the server's worker file now carries another version.
    site.setVersion('next');
    await first.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update();
    });
    // Installed and waiting with its own cache, while the running session keeps the old one.
    await expect.poll(() => cacheKeys(first)).toEqual([...before, 'pow-next'].sort());
    await expect
      .poll(() =>
        first.evaluate(
          async () => (await navigator.serviceWorker.getRegistration())?.waiting !== null,
        ),
      )
      .toBe(true);
    expect(await first.evaluate(async (k) => caches.has(k), before[0] as string)).toBe(true);
    // The session is still served by the old version: its shell is the one it started with.
    await first.reload();
    await ready(first);
    expect(await cacheKeys(first)).toEqual([...before, 'pow-next'].sort());

    // Close every window. The next launch runs the new version and the old cache is dropped.
    await first.close();
    const next = await context.newPage();
    await next.goto(`${site.url}/?at=40,31`);
    await ready(next);
    await expect.poll(() => cacheKeys(next), { timeout: 20_000 }).toEqual(['pow-next']);
  } finally {
    site.close();
  }
});

test('System says whether storage is protected and how to install', async ({ page }) => {
  await page.goto('/?at=40,31');
  await ready(page);
  await page.touchscreen.tap(360 - 12 - 22, 12 + 22);
  await page.locator('[data-tab="system"]').click();
  await expect(page.locator('[data-key="storage-state"]')).toHaveAttribute(
    'data-state',
    /granted|denied|unsupported/,
  );
  await expect(page.locator('[data-key="install-hint"]')).toContainText(/install|Installed/i);
});

test('Update now: System offers it when a version is waiting, saves, restarts on the new version', async ({
  context,
}) => {
  const site = await deployServer();
  try {
    const page = await context.newPage();
    await page.goto(`${site.url}/?at=40,31`);
    await ready(page);
    await controlled(page);
    const openSystem = async (): Promise<void> => {
      await page.touchscreen.tap(360 - 12 - 22, 12 + 22);
      await page.locator('[data-tab="system"]').click();
    };
    // Nothing new yet: up to date, with a way to check.
    await openSystem();
    await expect(page.locator('[data-key="update-state"]')).toHaveAttribute('data-state', 'none');
    await expect(page.locator('[data-key="update-apply"]')).toBeHidden();
    const seq0 = Number((await attr(page, 'data-saved-seq')) ?? '0');

    // A deploy lands. Check for updates finds it and offers Update now.
    site.setVersion('next');
    await page.locator('[data-key="update-check"]').click();
    await expect(page.locator('[data-key="update-state"]')).toHaveAttribute('data-state', 'ready');
    // The running session is untouched until the player chooses.
    expect(await cacheKeys(page)).toHaveLength(2);
    expect(
      await page.evaluate(() => navigator.serviceWorker.controller?.state === 'activated'),
    ).toBe(true);

    await page.locator('[data-key="update-apply"]').click();
    // It saved first, then the page restarted on the new version and the old cache went.
    await page.waitForLoadState('load');
    await ready(page);
    await expect
      .poll(() => cacheKeys(page).catch(() => []), { timeout: 20_000 })
      .toEqual(['pow-next']);
    await ready(page);
    expect(Number((await attr(page, 'data-loaded-seq')) ?? '0')).toBeGreaterThan(seq0);
  } finally {
    site.close();
  }
});
