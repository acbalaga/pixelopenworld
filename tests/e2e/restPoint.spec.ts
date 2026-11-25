import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-25: a rest point in the wild shows a mark from a distance and can be used. Dev server:
// `?at=` and `?nosave=` exist there. Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 640 } });
test.setTimeout(90_000);

test('a rest point shows a mark, opens a camp panel, and a night there gives a short rest', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  // One tile north of the meadow rest point at (140, 235) in Dawnmeadow, facing south.
  await page.goto('/?region=dawnmeadow&nosave=1&foes=0&at=140,234');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1500);
  // Hide the dev overlay, so the shot shows the world.
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(400);
  await shot(page, 'm5-25-mark');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(120);
  await page.keyboard.up('KeyS');
  await page.keyboard.press('KeyE');
  const camp = page.locator('.pow-rest');
  await expect(camp).toBeVisible();
  await expect(camp.locator('.pow-talk-name')).toHaveText('Camp');
  await shot(page, 'm5-25-camp');
  await camp.locator('.pow-choice').click();
  await expect(camp.locator('.pow-shop-msg')).toContainText('rested');
  await shot(page, 'm5-25-slept');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});
