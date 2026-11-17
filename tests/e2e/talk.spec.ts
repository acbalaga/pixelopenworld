import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(500);
}

/** Starts next to an NPC, walks into them to face them, and presses the context key. */
async function talkTo(
  page: Page,
  at: string,
  key: 'KeyW' | 'KeyS' | 'KeyA' | 'KeyD',
): Promise<void> {
  await page.goto(`/?foes=0&at=${at}`);
  await ready(page);
  await page.keyboard.down(key);
  await page.waitForTimeout(250);
  await page.keyboard.up(key);
  await page.keyboard.press('KeyE');
}

test('shopkeeper: dialogue sheet, then the shop refuses a purchase with no coin', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await talkTo(page, '40,31', 'KeyW');
  const talk = page.locator('.pow-talk');
  await expect(talk).toBeVisible();
  await expect(talk.locator('.pow-talk-name')).toHaveText('Brin');
  await expect(talk.locator('.pow-talk-log')).toContainText('Looking, buying, or selling');
  await shot(page, 'talk-dialogue');

  await talk.getByRole('button', { name: 'Show me what you have.' }).click();
  const shop = page.locator('.pow-shop');
  await expect(shop).toBeVisible();
  await expect(talk).toHaveCount(0);
  await shot(page, 'talk-shop');

  await shop.getByRole('button', { name: /^Buy Bread/ }).click();
  await expect(shop.locator('.pow-shop-msg')).toHaveText('You do not have enough coin.');

  // Selling works: the starting sword is worth something.
  await shop.getByRole('tab', { name: 'Sell' }).click();
  const coinBefore = await shop.locator('.pow-shop-coin').innerText();
  await shop
    .getByRole('button', { name: /^Sell / })
    .first()
    .click();
  await expect(shop.locator('.pow-shop-msg')).toContainText('Sold');
  expect(await shop.locator('.pow-shop-coin').innerText()).not.toBe(coinBefore);
  await shot(page, 'talk-shop-sold');

  await page.keyboard.press('Escape');
  await expect(shop).toHaveCount(0);
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);
});

test('guard: accepting the request pins a progress line, and the text is clear text', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await talkTo(page, '50,45', 'KeyW');
  // Standing at (50,45), the guard at (50,44) is north of the avatar.
  const talk = page.locator('.pow-talk');
  await expect(talk.locator('.pow-talk-name')).toHaveText('Orla');
  await talk.getByRole('button', { name: 'I will handle it.' }).click();
  await expect(talk.locator('.pow-talk-log')).toContainText('They gather out in the meadow');
  await talk.getByRole('button', { name: 'Done' }).click();
  await expect(talk).toHaveCount(0);
  await page.waitForTimeout(300);
  await shot(page, 'talk-request-pinned');
  // Talking again reports progress.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  await expect(page.locator('.pow-talk-log')).toContainText('Four Mosslings');
  expect(problems.pageErrors).toEqual([]);
});

test('pilgrim: two lines that read as chat messages', async ({ page }) => {
  await talkTo(page, '54,39', 'KeyD');
  const talk = page.locator('.pow-talk.pow-chat');
  await expect(talk).toBeVisible();
  await expect(talk.locator('.pow-line-name').first()).toHaveText('Pilgrim');
  await talk.getByRole('button', { name: 'Continue' }).click();
  await expect(talk.locator('.pow-line-npc')).toHaveCount(2);
  await shot(page, 'talk-chat');
  await talk.getByRole('button', { name: 'Done' }).click();
  await expect(talk).toHaveCount(0);
});

test('cook: teaches the recipe', async ({ page }) => {
  await talkTo(page, '43,42', 'KeyW');
  const talk = page.locator('.pow-talk');
  await talk.getByRole('button', { name: 'Teach me something.' }).click();
  await expect(talk.locator('.pow-talk-log')).toContainText('Sunwort and dewmint');
  await talk.getByRole('button', { name: 'Continue' }).click();
  await expect(talk.locator('.pow-talk-log')).toContainText('sunwort picked at dawn or dusk');
});
