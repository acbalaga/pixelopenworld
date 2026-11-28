import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M6-05: a catch from the cast to the landing, on the river bank east of Hearthford. The page
// plays the fight with a bot that holds the context key by the marker's place, and takes a shot at
// each stage. Dev server (`?at=`). Phone portrait.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 800 } });
test.setTimeout(120_000);

interface Fight {
  phase: string;
  m: number;
  v: number;
  band: number;
  fill: number;
  item: string;
}
const fighting = (page: import('@playwright/test').Page): Promise<Fight | null> =>
  page.evaluate(() => (window as unknown as { __pow: { fishing(): Fight | null } }).__pow.fishing());

test('a cast, a bite, a reel and a landing', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&at=237,170&foes=0&nosave=1&kit=dev&crowd=0');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.keyboard.press('Backquote');
  await page.evaluate(() =>
    (window as unknown as { __pow: { giveItem(i: string, n: number): void } }).__pow.giveItem(
      'item.rod_ash',
      1,
    ),
  );
  // Face the spot to the east, then cast.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(60);
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  await shot(page, 'm6-05-cast');
  // Wait for the bite, then tap.
  await expect.poll(async () => (await fighting(page))?.phase, { timeout: 15_000 }).toBe('bite');
  await shot(page, 'm6-05-bite');
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await fighting(page))?.phase).toBe('reel');
  // Hold the key by the marker's place, like a thumb on the screen.
  let held = false;
  let shots = 0;
  for (let i = 0; i < 700; i++) {
    const f = await fighting(page);
    if (!f) break;
    const want = f.m + f.v * 5 < 500;
    if (want !== held) {
      held = want;
      await (want ? page.keyboard.down('KeyE') : page.keyboard.up('KeyE'));
    }
    if (shots === 0 && f.fill > 450) {
      shots++;
      await shot(page, 'm6-05-reel');
    }
    await page.waitForTimeout(33);
  }
  if (held) await page.keyboard.up('KeyE');
  await page.waitForTimeout(400);
  await shot(page, 'm6-05-landed');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});
