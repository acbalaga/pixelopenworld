import { expect, test, type Page } from '@playwright/test';
import { ITEM_STRINGS } from '../../src/content/strings/items';
import { watchProblems } from './helpers';

// POW-M4-22A: the hand-in flow for a standing gather job. It lives apart from requests.spec.ts
// because it uses the dev-only `window.__pow.giveItem`, so it runs against the dev server.
test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(60_000);

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(500);
}

async function use(page: Page, key: 'KeyW'): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(200);
  await page.keyboard.up(key);
  await page.keyboard.press('KeyE');
}

test('a gather job is handed in at the board: items in the bag count and are taken', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=slice&foes=0&at=43,38');
  await ready(page);
  await use(page, 'KeyW');
  const board = page.locator('.pow-board');
  await expect(board).toBeVisible();
  // The posted gather jobs are deliveries to the board. Find one by its step line.
  const job = board.locator('.pow-board-row', { hasText: /to the board/ }).first();
  await expect(job).toBeVisible();
  const step = await job.locator('.pow-step').first().innerText();
  const m = /^Bring (\d+) (.+) to the board$/.exec(step);
  expect(m, step).not.toBeNull();
  const qty = Number(m![1]);
  const name = m![2]!;
  await job.getByRole('button', { name: 'Take it' }).click();
  const mine = board.locator('.pow-board-mine');
  await expect(mine.first()).toContainText(`of ${qty} in your bag`);
  // Nothing to hand in yet.
  await expect(board.getByRole('button', { name: 'Hand in' })).toHaveCount(0);
  // Put the items in the bag, by the id behind the display name, then hand in.
  const item = Object.keys(ITEM_STRINGS)
    .filter((k) => k.endsWith('.name') && ITEM_STRINGS[k] === name)
    .map((k) => k.slice(0, -'.name'.length))[0];
  expect(item, `item id for ${name}`).toBeTruthy();
  await page.evaluate(
    ([i, q]) =>
      (
        window as unknown as { __pow: { giveItem(item: string, qty: number): void } }
      ).__pow.giveItem(i as string, q as number),
    [item, qty],
  );
  await board.getByRole('button', { name: 'Hand in' }).click();
  await expect(board.getByRole('button', { name: 'Hand in' })).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
});
