import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

test('overlay shows timing and toggles with the key', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=slice&skip=1');
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
  await page.goto('/?region=slice&skip=1');
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

test('the dev server sends the policy, and the dev reporter sees no violation', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const res = await page.goto('/?region=slice&skip=1');
  expect(res?.headers()['content-security-policy']).toContain("default-src 'self'");
  await expect(page.locator('#pow-dev-overlay')).toContainText(/fps/);
  await page.waitForTimeout(500);
  // The reporter writes any violation to the console as `[csp] ...`, and the page listener
  // collects it too. Either fails the run.
  expect(problems.csp).toEqual([]);
  expect(problems.console.filter((m) => m.includes('[csp]'))).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});

test('/dev/map: pan, toggle layers and overlays, pick a tile, teleport link', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/dev/map');
  await expect(page.locator('#pow-dev-map-canvas')).toBeVisible();
  await page.locator('[data-key="region"]').selectOption('sample');
  await page.waitForTimeout(800);
  const canvas = page.locator('#pow-dev-map-canvas');
  const sum = async (): Promise<number> =>
    canvas.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4)
        n = (n + d[i]! * 3 + d[i + 1]! * 5 + d[i + 2]!) % 1000003;
      return n;
    });
  const base = await sum();
  await shot(page, '13-dev-map-sample');
  // Hiding the ground changes the picture, and so does the collision overlay.
  await page.locator('[data-key="show-ground"]').uncheck();
  await page.waitForTimeout(150);
  expect(await sum()).not.toBe(base);
  await page.locator('[data-key="show-ground"]').check();
  await page.locator('[data-key="show-collision"]').check();
  await page.waitForTimeout(150);
  expect(await sum()).not.toBe(base);
  await shot(page, '14-dev-map-collision');
  // Pan by dragging.
  const box = (await canvas.boundingBox())!;
  const before = await sum();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  expect(await sum()).not.toBe(before);
  // Pick a tile: the info line names it, and the teleport link goes to the game on that tile.
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await expect(page.locator('[data-key="info"]')).toContainText(/^Tile -?\d+, -?\d+: /);
  const tele = page.locator('[data-key="teleport"]');
  await expect(tele).toBeVisible();
  expect(await tele.getAttribute('href')).toMatch(/^\/\?region=sample&at=\d+,\d+&nosave=1/);
  // An interior opens as its own space.
  await page.locator('[data-key="space"]').selectOption({ index: 1 });
  await page.waitForTimeout(500);
  await shot(page, '15-dev-map-interior');
  expect(problems.pageErrors).toEqual([]);
});

test('/dev/map stamp editor: paint a tile, export the layers', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/dev/map');
  await expect(page.locator('#pow-dev-stamp-canvas')).toBeVisible();
  await page.locator('[data-key="stamp"]').selectOption('sample_house');
  await page.locator('[data-key="stamp-layer"]').selectOption('object');
  await page.locator('[data-key="palette"] [data-char="W"]').click();
  const c = page.locator('#pow-dev-stamp-canvas');
  await c.scrollIntoViewIfNeeded();
  const box = (await c.boundingBox())!;
  // Tile (4, 4) of an 8 by 5 stamp.
  await page.mouse.click(box.x + (box.width * 4.5) / 8, box.y + (box.height * 4.5) / 5);
  await page.locator('[data-key="export"]').click();
  const text = await page.locator('[data-key="export-text"]').inputValue();
  expect(text).toContain('layers: {');
  expect(text).toContain("'    W   ',");
  await shot(page, '16-dev-stamp-editor');
  // Undo puts it back.
  await page.locator('[data-key="undo"]').click();
  await page.locator('[data-key="export"]').click();
  expect(await page.locator('[data-key="export-text"]').inputValue()).not.toContain("'    W   ',");
  expect(problems.pageErrors).toEqual([]);
});
