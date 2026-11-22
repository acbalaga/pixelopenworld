import { expect, test, type Page } from '@playwright/test';
import { RECIPES } from '../../src/content/items/recipes';
import { shot } from './helpers';

// POW-M4-22C: the station sheet fits on one phone screen. Dev server: it uses `__pow`.
test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

type Pow = { giveItem(i: string, q: number): void; learnRecipe(r: string): void };

const POT = Object.values(RECIPES)
  .filter((r) => r.station === 'camp_pot')
  .slice(0, 10);
const NEEDS = [...new Set(POT.flatMap((r) => r.ingredients.map((i) => i.item)))];
const SHORT = POT.find((r) => r.ingredients.some((i) => i.qty >= 2));

async function open(page: Page): Promise<void> {
  await page.goto('/?region=slice&foes=0&at=42,41');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(60);
  await page.keyboard.up('KeyW');
  // 20 different items, 10 known recipes. Items that could be an ingredient come first.
  const filler = [
    'item.copper_ore',
    'item.coal',
    'item.iron_ore',
    'item.oak_log',
    'item.fish_river',
  ];
  const items = [...new Set([...NEEDS, ...filler])].slice(0, 20);
  await page.evaluate(
    ([its, recs]) => {
      const p = (window as unknown as { __pow: Pow }).__pow;
      for (const i of its as string[]) p.giveItem(i, 1);
      for (const r of recs as string[]) p.learnRecipe(r);
    },
    [items, POT.map((r) => r.id)],
  );
  await page.keyboard.press('KeyE');
  await expect(page.locator('.pow-station')).toBeVisible();
}

const inView = async (page: Page, sel: string): Promise<void> => {
  const b = (await page.locator(sel).boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(800);
};

test('the tray and Craft stay in view, and the sheet does not scroll', async ({ page }) => {
  await open(page);
  const sheet = page.locator('.pow-station');
  const fits = async (): Promise<void> => {
    expect(await sheet.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
    await inView(page, '[data-key="craft-go"]');
    await inView(page, '.pow-station-cells');
  };
  await fits();
  await shot(page, 'station-recipes');
  await page.locator('.pow-station-list').evaluate((e) => (e.scrollTop = e.scrollHeight));
  await fits();
  await page.locator('[data-key="view-bag"]').click();
  await fits();
  await page.locator('.pow-station-list').evaluate((e) => (e.scrollTop = e.scrollHeight));
  await fits();
  await shot(page, 'station-bag');
  // Gear, tools and keys are not offered as ingredients.
  await expect(page.locator('[data-key^="add-item.sword"]')).toHaveCount(0);
});

test('a short recipe shows what is missing and leaves the tray empty', async ({ page }) => {
  await open(page);
  expect(SHORT).toBeTruthy();
  await page.locator(`[data-key="recipe-${SHORT!.id}"]`).click();
  await expect(page.locator('.pow-station-line')).toContainText('Missing:');
  await expect(page.locator('[data-key^="picked-"]')).toHaveCount(0);
  await expect(page.locator('[data-key="craft-go"]')).toBeDisabled();
});
