import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-06: reply chips under a Traveler's line, the friend list on the Social tab, and the shared
// history on a profile card. Dev server (`window.__pow`, `?localtime=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(240_000);

interface Pow {
  crowd(): { entities: number };
  befriend(): string | null;
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().entities ?? 0),
      { timeout: 120_000, intervals: [1000] },
    )
    .toBeGreaterThan(3);
}

const URL = '/?region=dawnmeadow&at=192,196&seed=3&foes=0&nosave=1&kit=dev&localtime=20:30';

test('a Traveler line offers 2 to 4 chips, tapping one says it and gets an answer', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto(URL);
  await ready(page);
  const bar = page.locator('.pow-chips');
  await expect(bar).toBeVisible({ timeout: 150_000 });
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(300);
  const chips = bar.locator('.pow-chip[data-chip]:not([data-chip="emotes"])');
  const n = await chips.count();
  expect(n).toBeGreaterThanOrEqual(2);
  expect(n).toBeLessThanOrEqual(4);
  // Every chip is a clear button at least 48 px tall.
  for (let i = 0; i < n; i++) {
    const box = await chips.nth(i).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(48);
  }
  await shot(page, 'm5-06-chips');
  await chips.first().click();
  await expect(page.locator('.pow-chat-lane')).toContainText('You:', { timeout: 10_000 });
  await shot(page, 'm5-06-chip-said');
  expect(problems.pageErrors).toEqual([]);
});

test('a friend shows on the Social tab, and their card shows what you share', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto(URL);
  await ready(page);
  const handle = await page.evaluate(() => (window as unknown as { __pow: Pow }).__pow.befriend());
  expect(handle).not.toBeNull();
  await page.keyboard.press('Escape');
  await expect(page.locator('.pow-menu')).toBeVisible();
  await page.locator('[data-tab="social"]').click();
  const row = page.locator('.pow-friend-row').filter({ hasText: handle! });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Friend');
  await shot(page, 'm5-06-friends');
  await row.getByRole('button', { name: /Profile/ }).click();
  const card = page.locator('.pow-traveler-card');
  await expect(card).toContainText('Shared history');
  await expect(card).toContainText(/fought a .* near them/);
  await expect(card).toContainText('Remove friend');
  await shot(page, 'm5-06-card');
  expect(problems.pageErrors).toEqual([]);
});
