import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-29: the Pit at the quarry lip. Crates close the way in, using them slides them aside, and
// the ring is there to see. Dev server (`?at=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

test('the crates slide aside and the Pit shows from its edge', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&at=187,35&foes=0&nosave=1&kit=dev&crowd=0');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Backquote');
  // Walk east into the crates, which stop the avatar. Shot with them shut.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(400);
  await shot(page, 'm5-29-crates-shut');
  await page.keyboard.press('KeyE');
  await expect(page.locator('.pow-notices')).toContainText('slide aside', { timeout: 5000 });
  await page.waitForTimeout(1200);
  await shot(page, 'm5-29-crates-open');
  // Now the way is clear: walk in to the edge of the ring.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(500);
  await shot(page, 'm5-29-pit-edge');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});
