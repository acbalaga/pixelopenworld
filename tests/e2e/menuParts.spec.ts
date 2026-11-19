import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

// POW-M4-18: the Menu on shared parts. Navigation, focus, remembered state, touch sizes.
test.setTimeout(90_000);

const menu = (page: Page) => page.locator('.pow-menu');
const sheet = (page: Page) => page.locator('.pow-part-sheet');

/** Boots next to the training dummy and lets a few swings land, so Blades awakens. */
async function withSkill(page: Page): Promise<void> {
  await page.goto('/?nosave=1&foes=1&at=53,37');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(4500);
}
async function openMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeVisible();
}
async function goTab(page: Page, tab: string): Promise<void> {
  await page.locator(`[data-tab="${tab}"]`).click();
  await expect(page.locator(`[data-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
}

test.describe('portrait', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('Back closes the sheet first, then the Menu', async ({ page }) => {
    const problems = await watchProblems(page);
    await withSkill(page);
    await openMenu(page);
    await goTab(page, 'skills');
    await page.locator('[data-key^="skill-"]').first().click();
    await expect(sheet(page)).toBeVisible();
    await page.goBack();
    await expect(sheet(page)).toBeHidden();
    await expect(menu(page)).toBeVisible();
    await page.goBack();
    await expect(menu(page)).toBeHidden();
    expect(problems.pageErrors).toEqual([]);
    expect(problems.console).toEqual([]);
  });

  test('Escape closes the sheet first, then the Menu', async ({ page }) => {
    await withSkill(page);
    await openMenu(page);
    await goTab(page, 'bag');
    await page.locator('[data-key="slot-0"]').click();
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(menu(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
  });

  test('a sheet is a labelled dialog, and focus returns to the row that opened it', async ({
    page,
  }) => {
    await withSkill(page);
    await openMenu(page);
    await goTab(page, 'skills');
    const row = page.locator('[data-key^="skill-"]').first();
    const key = await row.getAttribute('data-key');
    await row.click();
    const dlg = page.getByRole('dialog', { name: /Blades|Evasion|Athletics/ });
    await expect(dlg).toBeVisible();
    await page.getByRole('button', { name: 'Close details' }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(page.locator(`[data-key="${key}"]`)).toBeFocused();
    // The same from the bag, closed with Escape.
    await goTab(page, 'bag');
    await page.locator('[data-key="slot-0"]').click();
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-key="slot-0"]')).toBeFocused();
  });

  test('the Menu reopens on the last tab and scroll, and a folded section stays folded', async ({
    page,
  }) => {
    await withSkill(page);
    await openMenu(page);
    await goTab(page, 'skills');
    // Fold the first section.
    const first = page.locator('.pow-part-section-btn').first();
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await goTab(page, 'system');
    await page.locator('.pow-menu-body').evaluate((n) => (n.scrollTop = 160));
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    await openMenu(page);
    await expect(page.locator('[data-tab="system"]')).toHaveAttribute('aria-selected', 'true');
    const top = await page.locator('.pow-menu-body').evaluate((n) => n.scrollTop);
    expect(top).toBeGreaterThan(100);
    await goTab(page, 'skills');
    await expect(page.locator('.pow-part-section-btn').first()).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  test('every row and cell is at least 48 px tall, and the tab bar has an icon and a label', async ({
    page,
  }) => {
    await withSkill(page);
    await openMenu(page);
    const tooShort = async (): Promise<string[]> =>
      page.evaluate(() => {
        const bad: string[] = [];
        for (const n of document.querySelectorAll<HTMLElement>(
          '.pow-menu .pow-part-row, .pow-menu .pow-part-cell, .pow-menu .pow-part-section-btn',
        )) {
          const r = n.getBoundingClientRect();
          if (r.height === 0) continue;
          if (r.height < 47.5 || r.width < 47.5) bad.push(`${n.className} ${r.width}x${r.height}`);
        }
        return bad;
      });
    for (const t of ['skills', 'bag']) {
      await goTab(page, t);
      expect(await tooShort(), t).toEqual([]);
    }
    for (const t of ['character', 'skills', 'bag', 'system']) {
      const tab = page.locator(`[data-tab="${t}"]`);
      await expect(tab.locator('svg.pow-tab-icon')).toBeVisible();
      await expect(tab.locator('.pow-tab-label')).toBeVisible();
    }
  });

  test('screenshots: each tab and a detail sheet, at 100% and 160% text', async ({ page }) => {
    await withSkill(page);
    await openMenu(page);
    for (const t of ['character', 'skills', 'bag', 'system']) {
      await goTab(page, t);
      await shot(page, `m4-18-after-${t}-portrait`);
    }
    await goTab(page, 'skills');
    await page.locator('[data-key^="skill-"]').first().click();
    await page.waitForTimeout(300);
    await shot(page, 'm4-18-after-skill-sheet-portrait');
    await page.keyboard.press('Escape');
    await goTab(page, 'bag');
    await page.locator('[data-key="slot-0"]').click();
    await page.waitForTimeout(300);
    await shot(page, 'm4-18-after-item-sheet-portrait');
    await page.keyboard.press('Escape');
    await goTab(page, 'system');
    await page.locator('.pow-range').first().fill('1.6');
    for (const t of ['character', 'skills', 'bag']) {
      await goTab(page, t);
      await shot(page, `m4-18-after-${t}-portrait-160`);
    }
    await goTab(page, 'skills');
    await page.locator('[data-key^="skill-"]').first().click();
    await page.waitForTimeout(300);
    await shot(page, 'm4-18-after-skill-sheet-portrait-160');
  });
});

test.describe('speed', () => {
  test.use({ viewport: { width: 360, height: 800 } });
  test('opening the Menu paints in under 100 ms on a 4x CPU throttle', async ({ page }) => {
    await withSkill(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const times: number[] = [];
    for (let i = 0; i < 4; i++) {
      // From the key press to the second frame after the Menu is shown (its first paint).
      const ms = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const menu = document.querySelector('.pow-menu') as HTMLElement;
            const t0 = performance.now();
            const mo = new MutationObserver(() => {
              if (menu.hidden) return;
              mo.disconnect();
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve(performance.now() - t0)),
              );
            });
            mo.observe(menu, { attributes: true, attributeFilter: ['hidden'] });
            window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }));
          }),
      );
      times.push(ms);
      await page.keyboard.press('Escape');
      await expect(menu(page)).toBeHidden();
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    // The first open builds the tab bar's icons; later opens reuse them. The median is the claim.
    times.sort((a, b) => a - b);
    console.log('menu open ms (4x throttle):', times.map((t) => Math.round(t)).join(', '));
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(100);
  });
});

test.describe('landscape', () => {
  test.use({ viewport: { width: 915, height: 412 } });
  test('screenshots: each tab and a detail sheet', async ({ page }) => {
    await withSkill(page);
    await openMenu(page);
    for (const t of ['character', 'skills', 'bag', 'system']) {
      await goTab(page, t);
      await shot(page, `m4-18-after-${t}-landscape`);
    }
    await goTab(page, 'skills');
    await page.locator('[data-key^="skill-"]').first().click();
    await page.waitForTimeout(300);
    await shot(page, 'm4-18-after-skill-sheet-landscape');
  });
});
