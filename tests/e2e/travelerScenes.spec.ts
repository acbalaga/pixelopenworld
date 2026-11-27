import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M5-27: four small funny things the player can see. Dev server (`window.__pow`, `?at=`,
// `?time=`). Phone portrait. Each waits for the scene to start, then takes a screenshot.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 640 } });
test.setTimeout(300_000);

interface Pow {
  crowd(): { entities: number; atCamp: number; scenes: string[] };
}

async function evening(page: Page, url: string): Promise<void> {
  const when = new Date();
  when.setDate(when.getDate() + ((3 - when.getDay() + 7) % 7));
  when.setHours(21, 10, 0, 0);
  await page.clock.install({ time: when });
  await page.goto(url);
  await page.clock.resume();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
}

const scenes = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().scenes ?? []);

for (const [name, kind, url] of [
  ['wish', 'wish', '/?region=dawnmeadow&at=187,199&weather=clear&foes=0&nosave=1&kit=dev'],
  [
    'dance',
    'dance',
    '/?region=dawnmeadow&at=174,213&seed=3&tick=54000&weather=clear&foes=0&nosave=1&kit=dev',
  ],
  ['dummy', 'dummy', '/?region=dawnmeadow&at=173,201&weather=clear&foes=0&nosave=1&kit=dev'],
] as const) {
  test(`a ${name} scene shows on screen`, async ({ page }) => {
    const problems = await watchProblems(page);
    await evening(page, url);
    await expect
      .poll(async () => (await scenes(page)).includes(kind), { timeout: 240_000, intervals: [500] })
      .toBe(true);
    await page.waitForTimeout(1500);
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(300);
    await shot(page, `m5-27-${name}`);
    expect(problems.pageErrors).toEqual([]);
  });
}

test('a ghost story at the river camp shows two Travelers and the story in Local', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await evening(
    page,
    '/?region=dawnmeadow&at=236,198&tick=61300&weather=clear&foes=0&nosave=1&kit=dev',
  );
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().atCamp ?? 0),
      { timeout: 240_000, intervals: [1000] },
    )
    .toBeGreaterThan(1);
  // The story is a few lines a few seconds apart. Give it time, and look for the scene's lines.
  await expect
    .poll(async () => (await page.locator('.pow-chat-lane').allInnerTexts()).join(' '), {
      timeout: 120_000,
      intervals: [500],
    })
    .toMatch(/lantern|cold voice|river at night|haunted|gather round|watching us|screamed/i);
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(300);
  await shot(page, 'm5-27-ghost');
  expect(problems.pageErrors).toEqual([]);
});
