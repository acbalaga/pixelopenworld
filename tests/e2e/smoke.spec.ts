import { expect, test, type Page } from '@playwright/test';
import { diffFraction, shot, watchProblems } from './helpers';

/** True once the game canvas has drawn something other than the page background. */
async function canvasHasWorld(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const c = document.getElementById('game');
    if (!(c instanceof HTMLCanvasElement) || c.width < 100) return false;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    const d = ctx.getImageData(c.width >> 1, c.height >> 1, 16, 16).data;
    // Page background is #14121f.
    return d.some((v, i) => i % 4 < 3 && v !== [0x14, 0x12, 0x1f][i % 4]);
  });
}

test('boots, taps to start, drags to move, no console or CSP problems', async ({ page }) => {
  const problems = await watchProblems(page);
  await page.goto('/');
  await expect.poll(() => canvasHasWorld(page)).toBe(true);
  await shot(page, '01-boot');

  // The first gesture also unlocks audio.
  const canvas = page.locator('#game');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

  // Idle control: how much the canvas changes with no input (water and other animation).
  const idleA = await canvas.screenshot();
  await page.waitForTimeout(1000);
  const idleB = await canvas.screenshot();
  const idleDiff = diffFraction(idleA, idleB);

  // Drag the floating stick right, from the bottom-left stick zone, and hold it.
  const cdp = await page.context().newCDPSession(page);
  const x0 = box.x + 90;
  const y0 = box.y + box.height - 110;
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number): Promise<unknown> =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y: y0, id: 1 }],
    });
  await touch('touchStart', x0);
  for (let i = 1; i <= 6; i++) await touch('touchMove', x0 + i * 14);
  await page.waitForTimeout(1500);
  const moved = await canvas.screenshot();
  await shot(page, '02-moving');
  await touch('touchEnd', x0);

  // The camera follows the player, so the world scrolls under a centered player when it moves.
  const moveDiff = diffFraction(idleB, moved);
  expect(moveDiff, `idle diff ${idleDiff}, move diff ${moveDiff}`).toBeGreaterThan(
    Math.max(0.2, idleDiff * 4),
  );

  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});

test('dev routes are not served by the production build', async ({ page }) => {
  const problems = await watchProblems(page);
  for (const path of ['/dev/sprites', '/dev/audio']) {
    await page.goto(path);
    await expect.poll(() => canvasHasWorld(page)).toBe(true);
    await expect(page.locator('[id^="pow-dev-"]')).toHaveCount(0);
  }
  await shot(page, '03-dev-route-in-prod');
  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});

test('worker health endpoint answers with security headers', async ({ request }) => {
  const r = await request.get('/api/health');
  expect(r.status()).toBe(200);
  expect(await r.json()).toMatchObject({ ok: true });
  expect(r.headers()['content-security-policy']).toContain("default-src 'self'");
});
