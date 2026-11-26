import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-30: a Traveler bout in the Pit with spectators, and the "Next" board. Dev server
// (`window.__pow`, `?at=`, `?localtime=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(240_000);

interface Pow {
  crowd(): { entities: number };
  stagePit(): number;
}

test('a bout in the Pit is fought and watched, and the Next board lists who waits', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto(
    '/?region=dawnmeadow&at=195,33&weather=clear&seed=3&foes=0&nosave=1&kit=dev&localtime=20:30',
  );
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.stagePit() ?? 0),
      {
        timeout: 120_000,
        intervals: [1500],
      },
    )
    .toBeGreaterThanOrEqual(4);
  const lane = page.locator('.pow-chat-lane');
  await expect(lane).toContainText(/go |gg|bout|front row|coin is on|watch/i, { timeout: 60_000 });
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(2500);
  await shot(page, 'm5-30-bout');
  // The Next board is just north, at the rim.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(200);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  const sheet = page.locator('.pow-pit .pow-part-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Waiting for a duel');
  await shot(page, 'm5-30-next');
  expect(problems.pageErrors).toEqual([]);
});
