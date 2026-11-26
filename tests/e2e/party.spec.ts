import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-07: the party finder in the square, joining a group, the party frames, Party chat and a
// loot roll. Dev server (`window.__pow`, `?at=`, `?localtime=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(300_000);

interface Pow {
  crowd(): { entities: number };
  party(): { members: string[]; listings: number };
  spawnFoeAhead(id: string): void;
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

test('join a group at the party finder, fight together, and see a roll', async ({ page }) => {
  const problems = await watchProblems(page);
  // Just south of the party finder in the square.
  await page.goto('/?region=dawnmeadow&at=196,191&seed=3&foes=0&nosave=1&kit=dev&localtime=20:30');
  await ready(page);
  await expect
    .poll(
      async () => page.evaluate(() => (window as unknown as { __pow: Pow }).__pow.party().listings),
      {
        timeout: 60_000,
      },
    )
    .toBeGreaterThan(0);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  const sheet = page.locator('.pow-party .pow-part-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Groups looking');
  await page.keyboard.press('Backquote');
  await shot(page, 'm5-07-finder');
  await sheet.getByRole('button', { name: 'Join' }).first().click();
  await expect(sheet).toContainText('Your party', { timeout: 10_000 });
  await shot(page, 'm5-07-joined');
  await page.waitForTimeout(400);
  await page.locator('.pow-party .pow-part-sheet-close').click();
  await expect(page.locator('.pow-party')).toHaveCount(0);
  await expect(page.locator('.pow-party-frame').first()).toBeVisible();
  // A few thornlings ahead: the party fights them, and their rarer drops are rolled.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() =>
      (window as unknown as { __pow: Pow }).__pow.spawnFoeAhead('creature.thornling'),
    );
    await page.waitForTimeout(6000);
    if (await page.locator('.pow-party-roll:not([hidden])').isVisible()) break;
  }
  await page.waitForTimeout(500);
  await shot(page, 'm5-07-fight');
  const lane = page.locator('.pow-chat-lane');
  await expect(lane).toBeVisible();
  expect(problems.pageErrors).toEqual([]);
});
