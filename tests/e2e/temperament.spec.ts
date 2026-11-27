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
  await page.goto('/?region=slice&nosave=1&at=58,52');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  // Sample by wall time, not by shot count: a fast runner takes 14 shots before the warning
  // (at least TEMPERAMENT.warnMinTicksTier1, one second) has run out.
  const start = Date.now();
  const reds: { ms: number; n: number }[] = [];
  for (let k = 0; Date.now() - start < 6000; k++) {
    const png = PNG.sync.read(await shot(page, `m4-16-territorial-${String(k).padStart(2, '0')}`));
    reds.push({ ms: Date.now() - start, n: red(png) });
    if (reds.length > 4 && reds.slice(-3).every((r) => r.n > 100)) break;
    await page.waitForTimeout(200);
  }
  // Quiet at first (the warning), then the "!" when it commits.
  const first = reds.find((r) => r.n > 100);
  expect(first, JSON.stringify(reds)).toBeDefined();
  expect(first!.ms, JSON.stringify(reds)).toBeGreaterThan(600);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});
