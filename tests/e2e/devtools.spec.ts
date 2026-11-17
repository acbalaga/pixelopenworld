import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

test('overlay shows timing and toggles with the key', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?skip=1');
  const overlay = page.locator('#pow-dev-overlay');
  await expect(overlay).toContainText(/fps/);
  await expect(overlay).toContainText(/entities \d+/);
  await expect(overlay).toContainText(/draw calls \d+/);
  await expect(overlay).toContainText(/logical \d+x\d+ at \d+x/);
  await shot(page, '10-overlay');
  await page.keyboard.press('Backquote');
  await expect(overlay).toBeHidden();
  await page.keyboard.press('Backquote');
  await expect(overlay).toBeVisible();
  expect(problems.pageErrors).toEqual([]);
});

test('overlay toggles with a three finger tap', async ({ page }) => {
  await page.goto('/?skip=1');
  const overlay = page.locator('#pow-dev-overlay');
  await expect(overlay).toBeVisible();
  const three = async (): Promise<void> => {
    const cdp = await page.context().newCDPSession(page);
    const pts = [0, 1, 2].map((i) => ({ x: 100 + i * 60, y: 300, id: i }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await three();
  await expect(overlay).toBeHidden();
  await three();
  await expect(overlay).toBeVisible();
});

test('/dev/sprites lists sprites and animates', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/dev/sprites');
  await expect(page.locator('#pow-dev-sprites .dev-card').first()).toBeVisible();
  const n = await page.locator('#pow-dev-sprites .dev-card').count();
  expect(n).toBeGreaterThan(80);
  await page.fill('input[type=search]', 'char.dev_0');
  await expect(page.locator('.dev-card:not([hidden])')).toHaveCount(1);
  await page.waitForTimeout(300);
  await shot(page, '11-dev-sprites-character');
  await page.fill('input[type=search]', 'tile.water');
  await page.waitForTimeout(300);
  await shot(page, '12-dev-sprites-water');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});

test('/dev/audio plays an effect and a track', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/dev/audio');
  await page.getByRole('button', { name: 'sfx.chime' }).click();
  await expect(page.locator('#pow-dev-audio')).toContainText('context running');
  await page.getByRole('button', { name: /Play music.theme/ }).click();
  await shot(page, '13-dev-audio');
  expect(problems.pageErrors).toEqual([]);
});
