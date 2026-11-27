import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// Waystones (POW-M4-07): touching the Hearthford stone attunes it, and the Map tab lists it under
// Waystones with a Travel button. Standing at the stone, the button says so and is disabled.
test.use({ viewport: { width: 412, height: 915 } });

test('touching a Waystone attunes it and the Map lists it', async ({ page }) => {
  const problems = await watchProblems(page);
  // Just south of the Hearthford stone (185, 189), facing north. The crowd stays on: a Traveler
  // in the way never takes the press meant for the stone (M5-32).
  await page.goto('/?region=dawnmeadow&skip=1&foes=0&nosave=1&weather=clear&time=day&at=185,190');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1200);
  // Hold each key past a sim tick: a tap shorter than one can be missed on a slow frame.
  await page.keyboard.press('KeyW', { delay: 100 });
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE', { delay: 100 });
  await page.waitForTimeout(600);

  await page.locator('.pow-minimap').click();
  await expect(page.locator('.pow-map-canvas')).toBeVisible();
  const row = page.locator('.pow-map-stones .pow-map-note');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Hearthford Waystone');
  const travel = page.locator('[data-key="travel-hearthford"]');
  await expect(travel).toBeDisabled();
  await shot(page, 'map-waystones');

  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);
});
