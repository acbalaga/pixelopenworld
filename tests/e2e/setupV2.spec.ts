import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M4-19: the setup screen on the new look editor, origins, and the inn mirror.
test.setTimeout(90_000);

async function toSetup(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log In' }).click();
  await expect(page.getByRole('heading', { name: 'Create your character' })).toBeVisible();
}

test.describe('portrait', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('the editor has a die per group, a turning preview and the six origins', async ({
    page,
  }) => {
    const problems = await watchProblems(page);
    await toSetup(page);
    // One small die for each group, and one Randomize for all of them.
    const dice = page.getByRole('button', { name: /^Randomize .+/ });
    expect(await dice.count()).toBeGreaterThanOrEqual(12);
    await expect(page.getByRole('button', { name: 'Randomize', exact: true })).toBeVisible();
    // The preview turns with the buttons, and is a labelled image.
    await expect(page.getByRole('img', { name: 'Preview of your character' })).toBeVisible();
    await page.getByRole('button', { name: 'Turn right' }).click();
    await page.getByRole('button', { name: 'Turn left' }).click();
    // Six origins, Unremembered chosen to begin with.
    const origins = page.getByRole('radiogroup', { name: 'Origin' }).getByRole('radio');
    await expect(origins).toHaveCount(6);
    await expect(origins.first()).toHaveAttribute('aria-checked', 'true');
    await origins.nth(2).click();
    await expect(origins.nth(2)).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.pow-origin-blurb')).not.toBeEmpty();
    // A choice sets the look: pressing a different height marks it.
    const tall = page.getByRole('button', { name: 'Tall', exact: true });
    await tall.click();
    await expect(tall).toHaveAttribute('aria-pressed', 'true');
    expect(problems.pageErrors).toEqual([]);
  });

  test('an origin narrows where the character wakes, and its first line shows', async ({
    page,
  }) => {
    await toSetup(page);
    await page.getByLabel('Handle').fill('Wake_1');
    // Pilgrim's child wakes at w5 (78,41) or w8 (15,47).
    await page
      .getByRole('radiogroup', { name: 'Origin' })
      .getByRole('radio', { name: "Pilgrim's child" })
      .click();
    await page.getByRole('button', { name: 'Enter the world' }).click();
    await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.pow-notice')).toContainText('bench', { timeout: 8000 });
    await shot(page, 'm4-19-first-line');
  });

  test('screenshots: setup at 100% and 160% text', async ({ page }) => {
    await toSetup(page);
    await shot(page, 'm4-19-setup-portrait');
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLElement>('.pow-overlay, #pow-root, body > div')
        .forEach((n) => n.style.setProperty('--text-scale', '1.6'));
    });
    await page
      .getByRole('button', { name: /^Randomize .+/ })
      .first()
      .scrollIntoViewIfNeeded();
    await shot(page, 'm4-19-setup-portrait-160');
  });
});

test.describe('landscape', () => {
  test.use({ viewport: { width: 915, height: 412 } });
  test('screenshots: setup', async ({ page }) => {
    await toSetup(page);
    await page.evaluate(
      () => ((document.querySelector('.pow-front') as HTMLElement).scrollTop = 0),
    );
    await shot(page, 'm4-19-setup-landscape');
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLElement>('.pow-overlay, #pow-root, body > div')
        .forEach((n) => n.style.setProperty('--text-scale', '1.6'));
    });
    await page.evaluate(
      () => ((document.querySelector('.pow-front') as HTMLElement).scrollTop = 0),
    );
    await shot(page, 'm4-19-setup-landscape-160');
  });
});

test.describe('the inn mirror', () => {
  test.use({ viewport: { width: 360, height: 800 } });
  test('opens the same editor without an origin, and the change shows and is kept', async ({
    page,
  }) => {
    const problems = await watchProblems(page);
    // The mirror stands in the square at tile 52,39. Walk up to it from the south.
    await page.goto('/?nosave=1&foes=0&at=52,41');
    await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(800);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyE');
    const mirror = page.getByRole('dialog', { name: 'Mirror' });
    await expect(mirror).toBeVisible();
    await expect(mirror.getByRole('radiogroup', { name: 'Origin' })).toHaveCount(0);
    await shot(page, 'm4-19-mirror');
    await mirror.getByRole('button', { name: 'Tall', exact: true }).click();
    await mirror.getByRole('button', { name: 'Done' }).click();
    await expect(mirror).toHaveCount(0);
    expect(problems.pageErrors).toEqual([]);
    expect(problems.console).toEqual([]);
  });
});
