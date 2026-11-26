import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-31: a sleeping Traveler shows a floating z, and the Poke button on their card wakes them.
// Dev server (`window.__pow`, `?localtime=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(240_000);

interface Pow {
  crowd(): { entities: number; asleep: number };
  putToSleep(): string | null;
}

test('a sleeping Traveler shows a z, and a poke wakes them with a line', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&at=192,196&seed=3&foes=0&nosave=1&kit=dev&localtime=20:30');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().entities ?? 0),
      { timeout: 120_000, intervals: [1000] },
    )
    .toBeGreaterThan(3);
  const handle = await page.evaluate(() =>
    (window as unknown as { __pow: Pow }).__pow.putToSleep(),
  );
  expect(handle).not.toBeNull();
  await expect
    .poll(
      async () => page.evaluate(() => (window as unknown as { __pow: Pow }).__pow.crowd().asleep),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(500);
  await shot(page, 'm5-31-asleep');
  // The card offers Poke while they sleep.
  await page.keyboard.press('Escape');
  await page.locator('[data-tab="social"]').click();
  await page
    .locator('.pow-friend-row')
    .filter({ hasText: handle! })
    .getByRole('button', { name: /Profile/ })
    .click();
  const card = page.locator('.pow-traveler-card');
  await expect(card).toContainText('fast asleep');
  await card.getByRole('button', { name: 'Poke' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.pow-chat-lane')).toContainText(handle!, { timeout: 15_000 });
  await page.waitForTimeout(600);
  await shot(page, 'm5-31-woke');
  await expect
    .poll(
      async () => page.evaluate(() => (window as unknown as { __pow: Pow }).__pow.crowd().asleep),
      { timeout: 10_000 },
    )
    .toBe(0);
  expect(problems.pageErrors).toEqual([]);
});
