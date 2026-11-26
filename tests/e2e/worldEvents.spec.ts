import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-11: the calendar of world events in the Menu's Social tab, with countdowns. Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(180_000);

test('the calendar lists the field raid, the invasion and market day with countdowns', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&at=192,193&seed=3&foes=0&nosave=1&kit=dev&localtime=17:40');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Escape');
  await page.locator('[data-tab="social"]').click();
  const cal = page.locator('.pow-calendar');
  await expect(cal).toBeVisible();
  await expect(cal).toContainText('Field raid');
  await expect(cal).toContainText('Invasion of Hearthford');
  await expect(cal).toContainText('Market day');
  await shot(page, 'm5-11-calendar');
  expect(problems.pageErrors).toEqual([]);
});
