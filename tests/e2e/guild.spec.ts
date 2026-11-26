import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-08: the Hearth and Home hall post, its goals and stash, and Guild chat. Dev server
// (`window.__pow`, `?at=`, `?localtime=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(240_000);

interface Pow {
  crowd(): { entities: number };
  joinGuild(id: number): void;
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().entities ?? 0),
      { timeout: 120_000, intervals: [1000] },
    )
    .toBeGreaterThan(0);
}

test('a hall post shows a stranger how to join, and a member the goals and the stash', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  // Just south of the Hearth and Home hall post.
  await page.goto('/?region=dawnmeadow&at=206,217&seed=3&foes=0&nosave=1&kit=dev&localtime=20:30');
  await ready(page);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  const sheet = page.locator('.pow-guild .pow-part-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Hearth and Home hall');
  await expect(sheet).toContainText('Joins by');
  await page.keyboard.press('Backquote');
  await shot(page, 'm5-08-hall-stranger');
  await page.locator('.pow-guild .pow-part-sheet-close').click();
  await page.evaluate(() => (window as unknown as { __pow: Pow }).__pow.joinGuild(7));
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await expect(sheet).toContainText('This week');
  await expect(sheet).toContainText('Stash');
  await shot(page, 'm5-08-hall-member');
  await sheet.getByRole('button', { name: 'Put in' }).first().click();
  await page.waitForTimeout(400);
  await expect(sheet).not.toContainText('The stash is empty.');
  await shot(page, 'm5-08-stash');
  await page.locator('.pow-guild .pow-part-sheet-close').click();
  expect(problems.pageErrors).toEqual([]);
});
