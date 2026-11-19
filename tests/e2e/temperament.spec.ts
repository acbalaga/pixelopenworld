import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { shot, watchProblems } from './helpers';

// POW-M4-16: a Spitbloom is territorial. Stepping inside its territory starts a warning (an amber
// ring at the territory edge), and a red "!" appears over it when it commits to the chase.
// `?at=` stands the avatar about four tiles from a Spitbloom of the slice map.
test.use({ viewport: { width: 360, height: 800 } });

/** Pixels of the "!" red, below the HUD row. */
function red(png: PNG): number {
  let n = 0;
  for (let i = png.width * 4 * 400; i < png.data.length; i += 4) {
    if (
      (png.data[i] as number) > 180 &&
      (png.data[i + 1] as number) < 80 &&
      (png.data[i + 2] as number) < 70
    )
      n++;
  }
  return n;
}

test('a territorial creature warns before it commits to a chase', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/?nosave=1&at=58,52');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  const reds: number[] = [];
  for (let k = 0; k < 14; k++) {
    const png = PNG.sync.read(await shot(page, `m4-16-territorial-${String(k).padStart(2, '0')}`));
    reds.push(red(png));
  }
  // Quiet at first (the warning), then the "!" when it commits.
  const first = reds.findIndex((n) => n > 100);
  expect(first).toBeGreaterThan(2);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});
