import { expect, test } from '@playwright/test';
import { diffFraction, shot, watchProblems } from './helpers';

// POW-M4-17: every transient message has one lane. Phone screenshots of the lanes in use. The
// avatar stands next to a Moss patch... any pickup will do: a floater shows over the avatar.
test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

test('the lanes show a floater, notices, a banner, and the chat lane folds and opens', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=slice&nosave=1&foes=0&at=19,43');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1200);
  // The first hint is a notice in the notice lane.
  await expect(page.locator('.pow-notice-hint')).toBeVisible({ timeout: 8000 });
  await shot(page, 'm4-17-hint-notice');
  // The chat lane appears with the first line (scripted at 25 s of play: a dev jump is not needed,
  // the e2e waits it out below).
  const lane = page.locator('.pow-chat-lane');
  await expect(lane).toBeVisible({ timeout: 40_000 });
  // Collapse leaves the unread glyph, and the glyph brings it back.
  await page.locator('.pow-chat-collapse').click();
  await expect(page.locator('.pow-chat-unread')).toBeVisible();
  await shot(page, 'm4-17-chat-collapsed');
  await page.locator('.pow-chat-unread').click();
  await expect(lane).toBeVisible();
  // Tap opens the chat sheet. System is the log. The lines let touches through to the stick, so
  // this is a tap at their spot, as a thumb makes it (force skips the hit-target check).
  await page.locator('.pow-chat-lines').click({ force: true });
  const sheet = page.getByRole('region', { name: 'Chat' });
  await expect(sheet).toBeVisible();
  await shot(page, 'm4-17-chat-sheet');
  await page.getByRole('tab', { name: 'System' }).click();
  await shot(page, 'm4-17-chat-sheet-system');
  await page.getByRole('button', { name: 'Close chat' }).click();
  await expect(sheet).toBeHidden();
  // A drag that starts on the lane walks: the lane sits over the stick's zone and lets it through
  // (owner, 2026-11-27). The sheet stays shut and the world moves under the avatar.
  const box = (await page.locator('.pow-chat-lines').boundingBox())!;
  const sx = box.x + box.width / 2;
  const sy = box.y + box.height / 2;
  const before = await page.screenshot();
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(sx + i * 10, sy - i * 4);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(900);
  await page.mouse.up();
  await expect(sheet).toBeHidden();
  expect(diffFraction(before, await page.screenshot())).toBeGreaterThan(0.05);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});
