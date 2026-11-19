import { expect, test } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// The map (POW-M4-06): the minimap shows ground the avatar has uncovered, a tap opens the Map tab,
// notes can be added and removed, and the tab opens in under 200 ms.
test.use({ viewport: { width: 412, height: 915 } });

test('the minimap opens the Map tab, which draws, zooms and keeps notes', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&skip=1&foes=0&nosave=1&weather=clear&time=day');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1500);

  const mini = page.locator('.pow-minimap');
  await expect(mini).toBeVisible();
  await shot(page, 'map-minimap');

  // Open time: from the tap to the first painted frame of the open tab.
  const ms = await page.evaluate(async () => {
    const t0 = performance.now();
    (document.querySelector('.pow-minimap') as HTMLButtonElement).click();
    while (!document.querySelector('.pow-map-canvas')) await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(200);

  await expect(page.locator('[data-tab="map"]')).toHaveAttribute('aria-selected', 'true');
  const canvas = page.locator('.pow-map-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.pow-map-status')).toContainText('uncovered');
  // The canvas has been drawn on: it is not all one color.
  const drawn = await canvas.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 37)
      seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return seen.size;
  });
  expect(drawn).toBeGreaterThan(3);
  await shot(page, 'map-tab');

  // Zoom and pan do not throw, and the keys work on the focused canvas.
  await page.locator('[data-key="map-in"]').click();
  await page.locator('[data-key="map-out"]').click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 30, { steps: 4 });
  await page.mouse.up();
  await canvas.focus();
  await page.keyboard.press('ArrowLeft');
  await page.locator('[data-key="map-center"]').click();

  // A note: added at the avatar, listed, and removed.
  await page.locator('.pow-map-input').fill('  my   camp ');
  await page.locator('[data-key="map-note-add"]').click();
  const note = page.locator('.pow-map-note');
  await expect(note).toHaveCount(1);
  await expect(note.locator('.pow-map-place-name')).toHaveText('my camp');
  await shot(page, 'map-note');
  await page.locator('[data-key^="note-del-"]').click();
  await expect(note).toHaveCount(0);

  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);
});
