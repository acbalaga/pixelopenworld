import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(60_000);

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(500);
}

/** Walks into whatever is in that direction to face it, then presses the context key. */
async function use(page: Page, key: 'KeyW' | 'KeyS' | 'KeyA' | 'KeyD'): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(200);
  await page.keyboard.up(key);
  await page.keyboard.press('KeyE');
}

async function openChronicle(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.locator('[data-tab="chronicle"]').click();
}

test('the board posts jobs, one is taken, shown in the log, and pinned on the HUD', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  // Just south of the board in the square.
  await page.goto('/?region=slice&foes=0&at=43,38');
  await ready(page);
  await use(page, 'KeyW');
  const board = page.locator('.pow-board');
  await expect(board).toBeVisible();
  const rows = board.locator('.pow-board-row');
  const posted = await rows.count();
  expect(posted).toBeGreaterThan(0);
  await expect(board.locator('.pow-request-ask').first()).not.toBeEmpty();
  // No place or direction is named anywhere on the board.
  expect(await board.innerText()).not.toMatch(/\b(north|south|east|west)\b|\d+,\s*\d+/i);
  await shot(page, 'requests-board');

  const title = await rows.first().locator('strong').innerText();
  await rows.first().getByRole('button', { name: 'Take it' }).click();
  await expect(rows).toHaveCount(posted - 1);
  await page.keyboard.press('Escape');
  await expect(board).toHaveCount(0);

  // The log is in the Chronicle, not on the Character tab. It shows the asker's words and can be pinned.
  await page.keyboard.press('Escape');
  await page.locator('[data-tab="character"]').click();
  await expect(page.locator('.pow-requests')).toHaveCount(0);
  await page.locator('[data-tab="chronicle"]').click();
  const log = page.locator('.pow-requests');
  await expect(log).toContainText(title);
  await expect(log.locator('.pow-request-ask').first()).not.toBeEmpty();
  await shot(page, 'requests-log');
  await log.getByRole('button', { name: 'Pin' }).first().click();
  await expect(log.getByRole('button', { name: 'Unpin' })).toBeVisible();
  await page.keyboard.press('Escape');
  const pin = page.locator('.pow-pin-line');
  await expect(pin).toBeVisible();
  await expect(pin).not.toBeEmpty();
  await shot(page, 'requests-pinned');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);
});

test('an authored request: accepted from Orla, shown in her words, pinned as her words', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=slice&foes=0&at=50,45');
  await ready(page);
  await use(page, 'KeyW');
  const talk = page.locator('.pow-talk');
  await talk.getByRole('button', { name: 'I will handle it.' }).click();
  await talk.getByRole('button', { name: 'Done' }).click();
  await expect(talk).toHaveCount(0);

  await openChronicle(page);
  const log = page.locator('.pow-requests');
  await expect(log).toContainText('Pests in the meadow');
  await expect(log).toContainText('Mosslings are chewing up the meadow gardens');
  await expect(log).toContainText('Defeat 4 Mosslings');
  await log.getByRole('button', { name: 'Pin' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.pow-pin-line')).toContainText('Mosslings are chewing up');
  expect(problems.pageErrors).toEqual([]);
});
