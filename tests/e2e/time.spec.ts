import { expect, test, type Page } from '@playwright/test';
import { watchProblems } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(300);
}

const attr = (page: Page, name: string): Promise<string | null> =>
  page.locator('#game').getAttribute(name);

async function saveNow(page: Page): Promise<void> {
  const seq0 = Number((await attr(page, 'data-saved-seq')) ?? '0');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(async () => Number((await attr(page, 'data-saved-seq')) ?? '0'))
    .toBeGreaterThan(seq0);
}

test('the server answers /api/time with epoch ms, uncached', async ({ request }) => {
  const before = Date.now();
  const res = await request.get('/api/time');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-store');
  const { now } = (await res.json()) as { now: number };
  expect(Math.abs(now - before)).toBeLessThan(60_000);
});

test('the game boots and plays with /api/time unreachable', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.route('**/api/time', (route) => route.abort());
  await page.goto('/?region=slice&at=40,31');
  await ready(page);
  expect(await attr(page, 'data-time-synced')).toBe('false');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyW');
  await saveNow(page);
  expect(problems.pageErrors).toEqual([]);
});

test('a device clock set ten days ahead does not move the world while the server is reachable', async ({
  page,
}) => {
  await page.goto('/?region=slice&at=40,31');
  await ready(page);
  expect(await attr(page, 'data-time-synced')).toBe('true');
  await saveNow(page);
  // Reload with the device clock jumped forward ten days.
  await page.addInitScript(() => {
    const real = Date.now.bind(Date);
    Date.now = () => real() + 10 * 24 * 3600 * 1000;
  });
  await page.goto('/?region=slice&at=40,31');
  await ready(page);
  expect(await attr(page, 'data-time-synced')).toBe('true');
  // The server wins: the game was closed for seconds, not ten days.
  expect(Number(await attr(page, 'data-closed-ms'))).toBeLessThan(120_000);
});
