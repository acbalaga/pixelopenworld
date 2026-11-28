import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M6-02: the reeve's field outside Hearthford's east gate, planted at mixed stages, and the
// plot sheet the context button opens. Dev server (`?at=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

test('the field shows crops at every stage, and a plot opens its sheet', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&at=228,204&foes=0&nosave=1&kit=dev&crowd=0');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Backquote');
  await page.evaluate(() =>
    (window as unknown as { __pow: { stageField(): void } }).__pow.stageField(),
  );
  await page.waitForTimeout(800);
  await shot(page, 'm6-02-field');
  // Turn down to the bottom right plot (empty and tilled) and press the context button.
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(80);
  await page.keyboard.up('KeyS');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await expect(page.locator('.pow-part-sheet-title')).toContainText('Plot', { timeout: 5000 });
  await page.waitForTimeout(300);
  await shot(page, 'm6-02-plot-sheet');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});
