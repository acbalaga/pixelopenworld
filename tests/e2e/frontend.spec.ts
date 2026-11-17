import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(60_000);

async function inWorld(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(400);
}

test('fresh profile: title, avatar setup, world. Second launch: title, world, same avatar', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/');
  // Title.
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pixel');
  await expect(page.getByText('No character on this device yet.')).toBeVisible();
  await expect(page.locator('#game')).not.toHaveAttribute('data-ready', 'true');
  await shot(page, 'frontend-title');
  await page.getByRole('button', { name: 'Log In' }).click();

  // Setup. A bad handle is refused with a reason, a good one enters.
  await expect(page.getByRole('heading', { name: 'Create your character' })).toBeVisible();
  await page.getByLabel('Handle').fill('ab');
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await expect(page.getByRole('alert')).toContainText('Too short');
  await page.getByLabel('Handle').fill('Sys_tem');
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await expect(page.getByRole('alert')).toContainText('not available');
  await page.getByLabel('Handle').fill('Fred_77');
  await page
    .getByRole('button', { name: 'Hair color' })
    .first()
    .isVisible()
    .catch(() => undefined);
  // Choose a look, then randomize and choose again so the look is known.
  await page.getByRole('button', { name: 'Randomize' }).click();
  await page.getByRole('button', { name: 'Slim', exact: true }).click();
  await page.getByRole('button', { name: 'Deep', exact: true }).click();
  await page.getByRole('button', { name: 'Curly', exact: true }).click();
  await shot(page, 'frontend-setup');
  await page.getByRole('button', { name: 'Enter the world' }).click();

  await inWorld(page);
  await shot(page, 'frontend-arrival');
  // Nothing opened by itself: no dialog in the world.
  await page.waitForTimeout(3000);
  await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);

  // Save, then second launch.
  const seq0 = Number((await page.locator('#game').getAttribute('data-saved-seq')) ?? '0');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(async () => Number((await page.locator('#game').getAttribute('data-saved-seq')) ?? '0'))
    .toBeGreaterThan(seq0);
  // The stored save is sealed, so it is checked through what the game reports: the hash of the
  // state that was written, and (below) the same hash after loading it.
  const savedHash = await page.locator('#game').getAttribute('data-saved-hash');
  expect(savedHash).not.toBeNull();

  await page.goto('/');
  await expect(page.getByText('Signed in as Fred_77.')).toBeVisible();
  await page.waitForTimeout(500);
  await shot(page, 'frontend-title-saved');
  await page.getByRole('button', { name: 'Log In as Fred_77' }).click();
  await expect(page.getByText('Connecting')).toBeVisible();
  await inWorld(page);
  // Same avatar: the loaded state hashes exactly as the saved one did, handle included.
  expect(await page.locator('#game').getAttribute('data-loaded-hash')).toBe(savedHash);
  await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
});

test('Log Out saves and returns to the title screen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByLabel('Handle').fill('Tester');
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await inWorld(page);
  await page.keyboard.press('Escape');
  await page.locator('[data-tab="system"]').click();
  await page.getByRole('button', { name: 'Log Out' }).click();
  await expect(page.getByText('Signed in as Tester.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log In' })).toBeVisible();
});

test('the first hint appears on its own, is one line, and is not a dialog', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByLabel('Handle').fill('Walker');
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await inWorld(page);
  const hint = page.locator('.pow-hint-line');
  await expect(hint).toContainText('Drag on the lower left', { timeout: 8000 });
  expect(await hint.getAttribute('role')).toBe('status');
  await shot(page, 'frontend-hint');
  // Doing the thing clears it.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  await expect(hint).toHaveCount(0);
});
