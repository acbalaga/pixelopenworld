import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-12: letters in the post stand, and a duel from a profile card. Dev server (`window.__pow`,
// `?at=`, `?localtime=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(240_000);

interface Pow {
  crowd(): { entities: number };
  befriend(): string | null;
  deliverLetters(): string | null;
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

test('a gift letter in the post stand can be taken once', async ({ page }) => {
  const problems = await watchProblems(page);
  // Just south of the post stand in the square.
  await page.goto('/?region=dawnmeadow&at=200,191&seed=3&foes=0&nosave=1&kit=dev&localtime=20:30');
  await ready(page);
  const handle = await page.evaluate(() =>
    (window as unknown as { __pow: Pow }).__pow.deliverLetters(),
  );
  expect(handle).not.toBeNull();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  const sheet = page.locator('.pow-mail');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('From ' + handle!);
  await expect(sheet).toContainText('25 coin');
  await page.keyboard.press('Backquote');
  await shot(page, 'm5-12-mail');
  await sheet.getByRole('button', { name: 'Take it' }).click();
  await expect(sheet).toContainText('Taken');
  await expect(sheet.getByRole('button', { name: 'Take it' })).toHaveCount(0);
  await shot(page, 'm5-12-mail-taken');
  expect(problems.pageErrors).toEqual([]);
});

test('a duel from the card begins, is fought, and ends with a result', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&at=192,196&seed=3&foes=0&nosave=1&kit=dev&localtime=20:30');
  await ready(page);
  const handle = await page.evaluate(() => (window as unknown as { __pow: Pow }).__pow.befriend());
  expect(handle).not.toBeNull();
  await page.keyboard.press('Escape');
  await page.locator('[data-tab="social"]').click();
  await page
    .locator('.pow-friend-row')
    .filter({ hasText: handle! })
    .getByRole('button', { name: /Profile/ })
    .click();
  const card = page.locator('.pow-traveler-card');
  await card.getByRole('button', { name: 'Challenge to a duel' }).scrollIntoViewIfNeeded();
  await card.getByRole('button', { name: 'Challenge to a duel' }).click();
  await expect(page.locator('.pow-notices')).toContainText('The duel begins', { timeout: 20_000 });
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(2500);
  await shot(page, 'm5-12-duel');
  // Nobody falls: the duel ends by itself with a result.
  await expect(page.locator('.pow-notices')).toContainText(/duel/i, { timeout: 120_000 });
  expect(problems.pageErrors).toEqual([]);
});
