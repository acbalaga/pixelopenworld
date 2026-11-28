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
  page.evaluate(() =>
    (window as unknown as { __pow: { fishing(): Fight | null } }).__pow.fishing(),
  );

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
  // Cast, tap the bite, and hold the key by the marker's place. A page poll is slower than a thumb,
  // so a fish may get away: cast again until one is landed.
  let landed = false;
  for (let cast = 0; cast < 8 && !landed; cast++) {
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(400);
    if (cast === 0) await shot(page, 'm6-05-cast');
    await expect.poll(async () => (await fighting(page))?.phase, { timeout: 15_000 }).toBe('bite');
    if (cast === 0) await shot(page, 'm6-05-bite');
    await page.keyboard.press('KeyE');
    await expect.poll(async () => (await fighting(page))?.phase).toBe('reel');
    let held = false;
    let reelShot = false;
    for (let i = 0; i < 700; i++) {
      const f = await fighting(page);
      if (!f) break;
      const want = f.m + f.v * 5 < 500;
      if (want !== held) {
        held = want;
        await (want ? page.keyboard.down('KeyE') : page.keyboard.up('KeyE'));
      }
      if (!reelShot && f.fill > 450 && cast === 0) {
        reelShot = true;
        await shot(page, 'm6-05-reel');
      }
      await page.waitForTimeout(16);
    }
    if (held) await page.keyboard.up('KeyE');
    await page.waitForTimeout(300);
    landed = await page.evaluate(() =>
      Object.keys(
        (
          window as unknown as { __pow: { snapshot(): { held: Record<string, number> } } }
        ).__pow.snapshot().held,
      ).some((k) => k.startsWith('item.fish_')),
    );
    if (landed) await shot(page, 'm6-05-landed');
    else await page.waitForTimeout(1500);
  }
  expect(landed).toBe(true);
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});
