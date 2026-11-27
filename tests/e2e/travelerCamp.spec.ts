import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-26: at dusk the river rest point looks like a camp, with Travelers sitting round it. Dev
// server (`window.__pow`, `?at=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 640 } });
test.setTimeout(240_000);

interface Pow {
  crowd(): { online: number; entities: number; handles: string[]; atCamp: number };
  sendTo(place: string, n: number): string[];
}

test('a camp at dusk has Travelers sitting round the river rest point', async ({ page }) => {
  const problems = await watchProblems(page);
  const evening = new Date();
  evening.setDate(evening.getDate() + ((3 - evening.getDay() + 7) % 7));
  evening.setHours(21, 10, 0, 0);
  await page.clock.install({ time: evening });
  await page.goto('/?region=dawnmeadow&at=236,191&time=dusk&weather=clear&foes=0&nosave=1&kit=dev');
  await page.clock.resume();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  // Send a few to the camp, so the spec does not wait on someone choosing it by chance (that
  // depended on the seed's random sequence, which every M5 change moved). They still walk out and
  // settle by the crowd's own rules.
  const sent = await page.evaluate(() =>
    (window as unknown as { __pow: Pow }).__pow.sendTo('wayside.river_camp', 4),
  );
  expect(sent).not.toEqual([]);
  // Wait for people to walk out from town to the camp and settle.
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().atCamp ?? 0),
      { timeout: 200_000, intervals: [2000] },
    )
    .toBeGreaterThan(1);
  await page.waitForTimeout(3000);
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(400);
  await shot(page, 'm5-26-camp-dusk');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});
