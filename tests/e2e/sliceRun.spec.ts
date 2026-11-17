import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// The Gate G1 scripted run (POW-M1-11): create an avatar, take the guard's request, finish it,
// turn it in, cook a dish, and reload. Runs against the dev server because it uses the dev-only
// `window.__pow` view and foe placement. Everything else is the shipped UI and rules.
test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(120_000);

interface Snap {
  scheme: string;
  requests: Record<string, { state: string; progress: number }>;
  coin: number;
  recipes: string[];
  held: Record<string, number>;
}
const snap = (page: Page): Promise<Snap> =>
  page.evaluate(() => (window as unknown as { __pow: { snapshot(): Snap } }).__pow.snapshot());

async function inWorld(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(500);
}

const savedSeq = async (page: Page): Promise<number> =>
  Number((await page.locator('#game').getAttribute('data-saved-seq')) ?? '0');

/** Forces an autosave the way a hidden tab does, and waits until it has been written. */
async function saveNow(page: Page): Promise<void> {
  const seq0 = await savedSeq(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
  await expect.poll(() => savedSeq(page)).toBeGreaterThan(seq0);
}

/** Walks a short burst in a direction so the avatar faces it. */
async function face(page: Page, key: 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD', ms = 250): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test('slice run: create, take the request, fight, turn in, cook, reload', async ({ page }) => {
  const problems = await watchProblems(page);

  // Create an avatar.
  await page.goto('/');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByLabel('Handle').fill('Runner_1');
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await inWorld(page);
  await saveNow(page);

  // Back in, skipping the title with a developer parameter, standing south of the guard. The saved avatar moves to `?at=`.
  await page.goto('/?at=50,45');
  await inWorld(page);

  // Take the guard's request.
  await face(page, 'KeyW');
  await page.keyboard.press('KeyE');
  const talk = page.locator('.pow-talk');
  await expect(talk.locator('.pow-talk-name')).toHaveText('Orla');
  await talk.getByRole('button', { name: 'I will handle it.' }).click();
  await talk.getByRole('button', { name: 'Done' }).click();
  await expect(talk).toHaveCount(0);
  await expect
    .poll(async () => (await snap(page)).requests['request.clear_pests']?.state)
    .toBe('active');

  // Fight four Mosslings, one at a time, in front of the avatar. Face south, away from Orla.
  await face(page, 'KeyS');
  for (let i = 1; i <= 4; i++) {
    await page.evaluate(() =>
      (window as unknown as { __pow: { spawnFoeAhead(id: string): void } }).__pow.spawnFoeAhead(
        'creature.mossling',
      ),
    );
    await expect
      .poll(
        async () => {
          await page.keyboard.press('KeyJ');
          return (await snap(page)).requests['request.clear_pests']?.progress ?? 0;
        },
        { timeout: 30_000, intervals: [150] },
      )
      .toBeGreaterThanOrEqual(i);
  }
  await expect
    .poll(async () => (await snap(page)).requests['request.clear_pests']?.state)
    .toBe('ready');
  await shot(page, 'run-request-ready');

  // Turn it in. The reward pays coin once.
  const coinBefore = (await snap(page)).coin;
  await face(page, 'KeyW');
  await page.keyboard.press('KeyE');
  await expect(talk).toBeVisible();
  await talk.getByRole('button').first().click();
  await expect
    .poll(async () => (await snap(page)).requests['request.clear_pests']?.state)
    .toBe('done');
  expect((await snap(page)).coin).toBeGreaterThan(coinBefore);
  await page.keyboard.press('Escape');
  await saveNow(page);

  // Cook at the camp pot: stand south of it, face it, press the cook key.
  await page.goto('/?at=42,41');
  await inWorld(page);
  await face(page, 'KeyW', 60);
  // Gathering is covered by the sim tests. Here the bag is stocked as if the herbs were picked.
  await page.evaluate(() => {
    const pow = (window as unknown as { __pow: { giveItem(item: string, qty: number): void } })
      .__pow;
    pow.giveItem('item.sunwort', 1);
    pow.giveItem('item.dewmint', 1);
  });
  await page.keyboard.press('KeyC');
  await expect.poll(async () => (await snap(page)).held['item.herb_tea'] ?? 0).toBe(1);
  expect((await snap(page)).recipes).toContain('recipe.herb_tea');
  await shot(page, 'run-cooked');

  // Reload: the request stays done, the recipe and coin stay as they were.
  await saveNow(page);
  const saved = await snap(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Log In as Runner_1' }).click();
  await inWorld(page);
  const after = await snap(page);
  expect(after.requests['request.clear_pests']?.state).toBe('done');
  expect(after.recipes).toEqual(saved.recipes);
  expect(after.coin).toBe(saved.coin);

  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
  expect(problems.csp).toEqual([]);
});

test('the dev scheme toggle switches Flow and Classic', async ({ page }) => {
  await page.goto('/?skip=1');
  const btn = page.locator('#pow-dev-scheme');
  await expect(btn).toHaveText('Scheme: flow');
  await btn.click();
  await expect(btn).toHaveText('Scheme: classic');
  expect((await snap(page)).scheme).toBe('classic');
  await btn.click();
  await expect(btn).toHaveText('Scheme: flow');
});
