import { expect, test } from '@playwright/test';
import { diffFraction, shot, watchProblems } from './helpers';

// POW-M4-13: working a node shows the action meter over the avatar, the avatar works, the node is
// outlined. Runs on the shipped build. `?at=` stands the avatar next to an oak at tile 18,43.
test.use({ viewport: { width: 360, height: 800 } });

test('felling a tree shows the meter, the work frame and the node outline', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?nosave=1&foes=0&at=19,43');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(800);
  // A short press turns the avatar toward the tree without walking away from it.
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(60);
  await page.keyboard.up('KeyA');
  await page.waitForTimeout(150);
  const before = await shot(page, 'm4-13-before');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const during = await shot(page, 'm4-13-gather-tree');
  // The meter, the work pose and the outline change a visible share of the screen.
  expect(diffFraction(before, during)).toBeGreaterThan(0.002);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});
