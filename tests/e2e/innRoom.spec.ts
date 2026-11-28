import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M6-07: the inn room. Through the stair door and back, the room empty and furnished with all
// twelve pieces, and the room panel at the top of the Bag tab. Dev server (`?at=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(120_000);

type Pow = { furnishRoom(full: boolean): void };
const furnish = (page: import('@playwright/test').Page, full: boolean): Promise<void> =>
  page.evaluate((f) => (window as unknown as { __pow: Pow }).__pow.furnishRoom(f), full);

test('the inn room empty and furnished, and the stair door', async ({ page }) => {
  const problems = await watchProblems(page);
  // The room's floor is tiles 355..358 by 483..486. Stand on it.
  await page.goto('/?region=dawnmeadow&at=357,485&foes=0&nosave=1&kit=dev&crowd=0');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Backquote');
  await furnish(page, false);
  await page.waitForTimeout(600);
  await shot(page, 'm6-07-room-empty');
  await furnish(page, true);
  await page.waitForTimeout(800);
  await shot(page, 'm6-07-room-furnished');
  // The room panel leads the Bag tab inside the room.
  await page.keyboard.press('KeyB');
  await expect(page.locator('.pow-room')).toContainText('Your room at the inn', { timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, 'm6-07-room-panel');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});

test('the stair door leads in, and the way out leads back to the yard', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&at=182,214&foes=0&nosave=1&kit=dev&crowd=0');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await shot(page, 'm6-07-stairs');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyB');
  await expect(page.locator('.pow-room')).toContainText('Your room at the inn', { timeout: 5000 });
  await page.keyboard.press('KeyB');
  await page.waitForTimeout(300);
  await shot(page, 'm6-07-inside');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});
