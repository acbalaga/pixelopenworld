import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-09: the rankings on the Social tab and on the request board's wall. Phone portrait, at
// 100% and 160% text scale. The crowd needs the clock, so these boot Dawnmeadow.
// Runs on the dev server: `?localtime=` and `?kit=dev` exist only there.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(800);
}

async function openSocial(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('.pow-menu')).toBeVisible();
  await page.locator('[data-tab="social"]').click();
  await expect(page.locator('[data-tab="social"]')).toHaveAttribute('aria-selected', 'true');
}

for (const scale of [100, 160]) {
  test(`the Social tab lists the boards and the player's place, at ${scale}% text`, async ({
    page,
  }) => {
    const problems = await watchProblems(page);
    await page.goto('/?region=dawnmeadow&nosave=1&foes=0&kit=dev&localtime=20:30');
    await ready(page);
    if (scale !== 100)
      await page.evaluate((s) => {
        document.documentElement.style.fontSize = `${s}%`;
      }, scale);
    await openSocial(page);
    const panel = page.locator('.pow-rankings');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.pow-rank-select')).toBeVisible();
    // Open the select's first board: the list has rows, each with a place and a value.
    await expect(panel.locator('.pow-rank-row').first()).toBeVisible();
    // No horizontal scroll at any scale.
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(wide).toBe(false);
    await shot(page, `m5-09-social-${scale}`);
    expect(problems.pageErrors).toEqual([]);
    expect(problems.console).toEqual([]);
  });
}

/** Walks into whatever is in that direction to face it, then presses the context key. */
async function use(page: Page, key: 'KeyW' | 'KeyS' | 'KeyA' | 'KeyD'): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(200);
  await page.keyboard.up(key);
  await page.keyboard.press('KeyE');
}

for (const scale of [100, 160]) {
  test(`the request board's wall has a rankings panel, at ${scale}% text`, async ({ page }) => {
    const problems = await watchProblems(page);
    // Just south of the board in the square.
    await page.goto('/?region=slice&foes=0&at=43,38&nosave=1');
    await ready(page);
    if (scale !== 100)
      await page.evaluate((s) => {
        document.documentElement.style.fontSize = `${s}%`;
      }, scale);
    await use(page, 'KeyW');
    const board = page.locator('.pow-board');
    await expect(board).toBeVisible();
    await board.locator('[data-key="board-tab-rankings"]').click();
    await expect(board.locator('.pow-rankings')).toBeVisible();
    await expect(board.locator('.pow-rank-row').first()).toBeVisible();
    await shot(page, `m5-09-board-${scale}`);
    // Back to the requests.
    await board.locator('[data-key="board-tab-requests"]').click();
    await expect(board.locator('.pow-rankings')).toBeHidden();
    expect(problems.pageErrors).toEqual([]);
    expect(problems.console).toEqual([]);
  });
}
