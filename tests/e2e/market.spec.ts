import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-10: the market terminal on Hearthford's market street, an item with its sparkline and
// Traveler listings, and a listing sheet. Dev server (`?at=`, `?kit=dev`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(240_000);

test('the terminal shows prices, a sparkline and sellers, and lists from the bag', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  // Just south of the terminal at the east end of the market street.
  await page.goto('/?region=dawnmeadow&at=200,209&seed=3&foes=0&nosave=1&kit=dev&localtime=20:30');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.waitForTimeout(3000);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  const sheet = page.locator('.pow-market .pow-part-sheet');
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Backquote');
  await shot(page, 'm5-10-terminal');
  const copper = sheet
    .locator('.pow-market-pick')
    .filter({ hasText: /copper ingot/i })
    .first();
  await copper.scrollIntoViewIfNeeded();
  await copper.click();
  await expect(sheet).toContainText('For sale');
  await sheet.locator('.pow-market-spark').scrollIntoViewIfNeeded();
  await expect(sheet.locator('.pow-market-spark')).toBeVisible();
  await shot(page, 'm5-10-item');
  await sheet.getByRole('button', { name: 'Sell' }).click();
  const pick = sheet.locator('.pow-market-pick').first();
  if (await pick.isVisible().catch(() => false)) {
    await pick.click();
    await expect(sheet).toContainText('Fee');
    await sheet.locator('.pow-market-price').scrollIntoViewIfNeeded();
    await shot(page, 'm5-10-listing');
  }
  expect(problems.pageErrors).toEqual([]);
});
