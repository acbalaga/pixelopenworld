import { expect, test, type APIRequestContext } from '@playwright/test';
import { SECURITY_HEADERS } from '../../src/shared/headers';
import { watchProblems } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

/** Every header the Worker or the static host must send on this path. */
async function expectHardened(
  request: APIRequestContext,
  path: string,
  extra: string[] = [],
): Promise<void> {
  const res = await request.get(path);
  const h = res.headers();
  for (const [k, v] of Object.entries(SECURITY_HEADERS))
    expect(h[k.toLowerCase()], `${path} ${k}`).toBe(v);
  for (const k of extra) expect(h[k.toLowerCase()], `${path} ${k}`).toBeTruthy();
}

test('the built site sends the security headers on the page, assets, worker and API', async ({
  page,
  request,
}) => {
  await page.goto('/?at=40,31');
  const asset = await page.evaluate(
    () =>
      performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .find((n) => n.includes('/assets/') && n.endsWith('.js')) ?? '',
  );
  expect(asset).not.toBe('');
  await expectHardened(request, '/', ['Permissions-Policy']);
  await expectHardened(request, new URL(asset).pathname, ['Permissions-Policy']);
  await expectHardened(request, '/sw.js', ['Permissions-Policy']);
  await expectHardened(request, '/manifest.webmanifest');
  // The Worker answers every API path with the same headers, and never caches.
  for (const p of ['/api/time', '/api/health', '/api/does-not-exist']) {
    await expectHardened(request, p);
    expect((await request.get(p)).headers()['cache-control']).toBe('no-store');
  }
  expect((await request.get('/api/does-not-exist')).status()).toBe(404);
});

test('the policy is enforced: inline script and a third-party request are blocked', async ({
  page,
}) => {
  await page.goto('/?nosave=1&skip=1');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  const outcome = await page.evaluate(async () => {
    const seen: string[] = [];
    document.addEventListener('securitypolicyviolation', (e) => seen.push(e.violatedDirective));
    const s = document.createElement('script');
    s.textContent = 'window.__inline = true';
    document.head.appendChild(s);
    let remoteBlocked = false;
    try {
      await fetch('https://example.invalid/x');
    } catch {
      remoteBlocked = true;
    }
    await new Promise((r) => setTimeout(r, 100));
    return {
      inline: (window as unknown as { __inline?: boolean }).__inline === true,
      remoteBlocked,
      seen,
    };
  });
  expect(outcome.inline).toBe(false);
  expect(outcome.remoteBlocked).toBe(true);
  expect(outcome.seen).toEqual(expect.arrayContaining(['script-src-elem', 'connect-src']));
});

test('a normal session has no CSP violation, console problem or page error', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?at=40,31');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(400);
  await page.keyboard.up('KeyD');
  expect(problems.csp).toEqual([]);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});

test('no game state is reachable from the console by name', async ({ page }) => {
  await page.goto('/?at=40,31');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  const found = await page.evaluate(() => {
    // What a fresh page has, from a blank frame of the same origin.
    const frame = document.createElement('iframe');
    frame.src = 'about:blank';
    document.body.appendChild(frame);
    const standard = new Set(Object.getOwnPropertyNames(frame.contentWindow));
    frame.remove();
    const w = window as unknown as Record<string, unknown>;
    const extra = Object.getOwnPropertyNames(window).filter((k) => !standard.has(k));
    // Anything custom, and anything that looks like game state wherever it is.
    const looksLikeState = (v: unknown): boolean =>
      typeof v === 'object' &&
      v !== null &&
      ['entities', 'rng', 'tick', 'ledger', 'sim'].some((k) => k in (v as object));
    return {
      extra,
      stateful: extra.filter((k) => looksLikeState(w[k])),
      top: Object.getOwnPropertyNames(window).filter((k) => looksLikeState(w[k])),
    };
  });
  // The test harness adds one function. The game adds nothing.
  expect(found.extra.filter((k) => !k.startsWith('__report'))).toEqual([]);
  expect(found.stateful).toEqual([]);
  expect(found.top).toEqual([]);
});

test('System > Help carries the privacy note', async ({ page }) => {
  await page.goto('/?at=40,31');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.touchscreen.tap(360 - 12 - 22, 12 + 22);
  await page.locator('[data-tab="system"]').click();
  const note = page.locator('[data-key="privacy-note"]');
  await note.scrollIntoViewIfNeeded();
  await expect(note).toContainText('no accounts');
  await expect(note).toContainText('no analytics and no cookies');
  await expect(note).toContainText('stays on this device');
  await expect(note).toContainText('keeps nothing about players');
});
