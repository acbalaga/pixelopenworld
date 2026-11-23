import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { watchProblems } from '../../../tests/e2e/helpers';

// A fresh character plays Dawnmeadow in real time: walks a long loop, swings, interacts, and every
// cycle saves, closes, reopens and logs back in. Each reopen checks the seal on the title screen and
// that the loaded state hashes the same as the one written. Screenshots go to OUT.
const OUT = process.env.SOAK_OUT ?? join(process.cwd(), 'e2e-screenshots', 'soak');
const CYCLES = Number(process.env.SOAK_CYCLES ?? 8);

const attr = (page: Page, n: string): Promise<string | null> =>
  page.locator('#game').getAttribute(n);
async function inWorld(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await page.waitForTimeout(500);
}
async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
async function hold(page: Page, keys: string[], ms: number): Promise<void> {
  for (const k of keys) await page.keyboard.down(k);
  await page.waitForTimeout(ms);
  for (const k of keys) await page.keyboard.up(k);
}

// A walk out of the wake point and back, with turns, so the bot crosses chunk edges every cycle.
const LEGS: [string[], number][] = [
  [['KeyD'], 3500],
  [['KeyS'], 2500],
  [['KeyD', 'KeyS'], 2000],
  [['KeyA'], 4000],
  [['KeyW'], 3000],
  [['KeyW', 'KeyA'], 2000],
  [['KeyD'], 2500],
];

test('soak: play, save, reopen, repeat', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  const problems = await watchProblems(page);
  const log: Record<string, unknown>[] = [];
  await page.goto('/');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByLabel('Handle').fill('Soak_Bot');
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await inWorld(page);
  writeFileSync(join(OUT, '00-arrival.png'), await page.screenshot());

  for (let c = 1; c <= CYCLES; c++) {
    const t0 = Date.now();
    for (const [i, [keys, ms]] of LEGS.entries()) {
      await hold(page, keys, ms);
      // Swing and interact at whatever is in front: trees, foes, signs, people.
      await page.keyboard.press('KeyJ');
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(250);
      // Close anything the interact opened, so the next leg moves the avatar.
      if (await page.locator('[role="dialog"]:visible').count())
        await page.keyboard.press('Escape');
      if (i === 3)
        writeFileSync(join(OUT, `${String(c).padStart(2, '0')}-mid.png`), await page.screenshot());
    }
    const seq0 = Number((await attr(page, 'data-saved-seq')) ?? '0');
    await hide(page);
    await expect
      .poll(async () => Number((await attr(page, 'data-saved-seq')) ?? '0'))
      .toBeGreaterThan(seq0);
    const saved = await attr(page, 'data-saved-hash');
    await page.goto('/');
    const seal = page.locator('.pow-seal');
    await expect(seal).toBeVisible();
    const sealClass = (await seal.getAttribute('class')) ?? '';
    writeFileSync(join(OUT, `${String(c).padStart(2, '0')}-title.png`), await page.screenshot());
    await page.getByRole('button', { name: 'Log In as Soak_Bot' }).click();
    await inWorld(page);
    const loaded = await attr(page, 'data-loaded-hash');
    writeFileSync(join(OUT, `${String(c).padStart(2, '0')}-back.png`), await page.screenshot());
    const row = {
      cycle: c,
      seconds: Math.round((Date.now() - t0) / 1000),
      seal: /flagged/.test(sealClass) ? 'flagged' : /intact/.test(sealClass) ? 'intact' : sealClass,
      hashMatch: saved !== null && saved === loaded,
      saved,
      loaded,
      pageErrors: problems.pageErrors.length,
      console: problems.console.length,
    };
    log.push(row);
    console.log(JSON.stringify(row));
  }
  writeFileSync(join(OUT, 'soak.json'), JSON.stringify({ log, problems }, null, 1));
  expect(log.every((r) => r.seal === 'intact' && r.hashMatch)).toBe(true);
  expect(problems.pageErrors).toEqual([]);
});
