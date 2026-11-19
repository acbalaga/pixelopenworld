import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

/** Waits for the first frame, then lets tile painting and the room camera settle. */
async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(600);
}

// Places seen in the slice, as `?at=tx,ty` starts. `foes=0` keeps creatures out of the pictures.
const PLACES: readonly [name: string, at: string][] = [
  ['slice-square', '50,40'],
  ['slice-meadow', '26,42'],
  ['slice-bridge', '47,56'],
  ['slice-cave-mouth', '81,81'],
  ['slice-cave-room-a', '12,106'],
  ['slice-cave-room-c', '75,108'],
];

for (const [name, at] of PLACES) {
  test(`slice: ${name} draws with no console or CSP problems`, async ({ page }) => {
    const problems = await watchProblems(page);
    await page.goto(`/?foes=${name === 'slice-square' ? 1 : 0}&at=${at}`);
    await ready(page);
    await shot(page, name);
    expect(problems.console).toEqual([]);
    expect(problems.pageErrors).toEqual([]);
    expect(problems.csp).toEqual([]);
    expect(problems.failedRequests).toEqual([]);
  });
}

test('slice: the tablet opens with the context key, shows glyphs only, and closes', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  // Room D, one tile east of the tablet, facing it.
  await page.goto('/?foes=0&at=40,134');
  await ready(page);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyA');
  await page.keyboard.press('KeyE');
  const tablet = page.locator('.pow-tablet');
  await expect(tablet).toBeVisible();
  await expect(tablet.locator('polyline').first()).toBeAttached();
  expect((await tablet.innerText()).trim()).toBe('');
  await shot(page, 'slice-tablet');
  await page.keyboard.press('Escape');
  await expect(tablet).toHaveCount(0);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});

test('slice: a locked door says so', async ({ page }) => {
  const problems = await watchProblems(page);
  // The hall, one tile west of the boss door, facing it.
  await page.goto('/?foes=0&at=53,108');
  await ready(page);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyE');
  await expect(page.locator('.pow-notice')).toContainText('Locked');
  expect(problems.pageErrors).toEqual([]);
});

test.describe('touch', () => {
  test.use({ viewport: { width: 360, height: 800 }, hasTouch: true });

  test('slice: a tap closes the tablet, and a touch cannot walk the avatar under it', async ({
    page,
  }) => {
    const problems = await watchProblems(page);
    await page.goto('/?foes=0&at=40,134');
    await ready(page);
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyA');
    // The context button sits at the bottom right in Flow.
    await page.touchscreen.tap(323, 763);
    const tablet = page.locator('.pow-tablet');
    await expect(tablet).toBeVisible();
    // A drag on the screen goes to the overlay, not the stick: the tablet is still there.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: 100, y: 600, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: 160, y: 600, id: 1 }],
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.touchscreen.tap(180, 400);
    await expect(tablet).toHaveCount(0);
    expect(problems.pageErrors).toEqual([]);
  });
});
