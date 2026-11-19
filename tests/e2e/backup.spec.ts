import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { watchProblems } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

const WORDS = ['item.', 'inventory', 'skill.', 'creature.', 'coinEarned', 'entities', 'Exporter_1'];

const attr = (page: Page, name: string): Promise<string | null> =>
  page.locator('#game').getAttribute(name);

const inWorld = async (page: Page): Promise<void> => {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(400);
};

const saveNow = async (page: Page): Promise<void> => {
  const before = Number((await attr(page, 'data-saved-seq')) ?? '0');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    // The tab is back: tell the game, or it stays paused and ignores input.
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(async () => Number((await attr(page, 'data-saved-seq')) ?? '0'))
    .toBeGreaterThan(before);
};

async function newCharacter(page: Page, handle: string): Promise<void> {
  await page.goto('/?region=slice');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByLabel('Handle').fill(handle);
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await inWorld(page);
}

/** Opens Menu, System, and clicks Export. Returns the downloaded file's path and bytes. */
async function exportFile(page: Page): Promise<{ path: string; bytes: Buffer; name: string }> {
  await page.keyboard.press('Escape');
  await page.locator('[data-tab="system"]').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export save file' }).click();
  const d = await download;
  const dir = mkdtempSync(join(tmpdir(), 'pow-export-'));
  const path = join(dir, d.suggestedFilename());
  await d.saveAs(path);
  return { path, bytes: readFileSync(path), name: d.suggestedFilename() };
}

/** The menu button on the canvas, top right, then the System tab. */
async function openSystem(page: Page): Promise<void> {
  await page.touchscreen.tap(360 - 12 - 22, 12 + 22);
  await page.locator('[data-tab="system"]').click();
}

const fresh = async (browser: Browser): Promise<Page> => {
  // The same phone as the other tests, with its own empty storage.
  const ctx = await browser.newContext({
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 800 },
  });
  return ctx.newPage();
};

test('export in one profile, import in a fresh profile with the network blocked: same state, Intact', async ({
  page,
  browser,
}) => {
  await newCharacter(page, 'Exporter_1');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  const file = await exportFile(page);
  await expect(page.locator('.pow-backup-status')).toHaveText('Save exported.');

  // The file: named for the handle and date, binary, nothing readable inside.
  expect(file.name).toMatch(/^pow-Exporter_1-\d{4}-\d{2}-\d{2}\.powsave$/);
  expect(file.bytes.subarray(0, 4).toString('latin1')).toBe('POWS');
  const text = file.bytes.toString('latin1');
  for (const w of WORDS) expect(text.includes(w), w).toBe(false);
  const exportedHash = await attr(page, 'data-saved-hash');
  expect(exportedHash).not.toBeNull();

  // A fresh profile: nothing stored. Take the network away once the page has loaded.
  const other = await fresh(browser);
  const problems = await watchProblems(other);
  await other.goto('/?region=slice');
  await expect(other.getByText('No character on this device yet.')).toBeVisible();
  await other.waitForTimeout(1500);
  await other.context().setOffline(true);

  const chooser = other.waitForEvent('filechooser');
  await other.getByRole('button', { name: 'Import save file' }).click();
  await (await chooser).setFiles(file.path);
  const dialog = other.locator('.pow-import');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Exporter_1');
  await expect(dialog).toContainText('Save sealed');
  await expect(dialog).toContainText('no save on this device');
  await dialog.getByRole('button', { name: 'Import' }).click();

  await inWorld(other);
  expect(await attr(other, 'data-loaded-hash')).toBe(exportedHash);
  expect(problems.pageErrors).toEqual([]);
  await other.context().close();
});

test('a file with one flipped byte is refused with a clear message and changes nothing', async ({
  page,
  browser,
}) => {
  await newCharacter(page, 'Exporter_1');
  const file = await exportFile(page);
  for (const at of [2, 5, 10, 30, 60, file.bytes.length - 1]) {
    const bad = Buffer.from(file.bytes);
    bad[at] = (bad[at] as number) ^ 0x01;
    const path = join(mkdtempSync(join(tmpdir(), 'pow-bad-')), 'bad.powsave');
    writeFileSync(path, bad);

    const other = await fresh(browser);
    await other.goto('/?region=slice');
    await expect(other.getByText('No character on this device yet.')).toBeVisible();
    const chooser = other.waitForEvent('filechooser');
    await other.getByRole('button', { name: 'Import save file' }).click();
    await (await chooser).setFiles(path);
    await expect(other.locator('.pow-front-status')).toContainText(
      /damaged or has been changed|not a Pixel Open World save|different version|newer version/,
    );
    await expect(other.locator('.pow-import')).toHaveCount(0);
    // Nothing was imported: there is still no character to log in as.
    await expect(other.getByRole('button', { name: /Log In as/ })).toHaveCount(0);
    await other.context().close();
  }
});

test('importing over a save asks first, Cancel changes nothing, and Import keeps the old save', async ({
  page,
  browser,
}) => {
  await newCharacter(page, 'Exporter_1');
  const file = await exportFile(page);

  const other = await fresh(browser);
  await newCharacter(other, 'Second_2');
  await saveNow(other);

  await openSystem(other);
  const importFrom = async (): Promise<void> => {
    const chooser = other.waitForEvent('filechooser');
    await other.getByRole('button', { name: 'Import save file' }).click();
    await (await chooser).setFiles(file.path);
  };

  // Cancel.
  await importFrom();
  const dialog = other.locator('.pow-import');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Exporter_1');
  await expect(dialog).toContainText('replaces the save on this device');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await other.goto('/?region=slice');
  await expect(other.getByText('Signed in as Second_2.')).toBeVisible();

  // Import: the page reloads onto the imported character, and the old save is still stored.
  await other.getByRole('button', { name: 'Log In as Second_2' }).click();
  await inWorld(other);
  await openSystem(other);
  await importFrom();
  await other.locator('.pow-import').getByRole('button', { name: 'Import' }).click();
  await expect(other.getByText('Signed in as Exporter_1.')).toBeVisible();
  const slots = await other.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('pow-save', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('slots').objectStore('slots').getAllKeys();
          req.onsuccess = () => resolve(req.result as string[]);
        };
      }),
  );
  expect(slots).toEqual(expect.arrayContaining(['latest', 'previous', 'replaced']));
  await other.context().close();
});

test('the backup reminder appears after 5 hours of play since the last export, and can be dismissed', async ({
  page,
}) => {
  // Make the stored record say the last export was long ago in play time.
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k: string): string | null {
      return k.startsWith('pow-backup:')
        ? '{"exportedAt":-30000,"dismissedAt":-30000}'
        : get.call(this, k);
    };
  });
  await newCharacter(page, 'Reminded_1');
  const banner = page.locator('.pow-reminder');
  await expect(banner).toBeVisible({ timeout: 10_000 });
  await expect(banner).toContainText('over 5 hours of play');
  await banner.getByRole('button', { name: 'Dismiss' }).click();
  await expect(banner).toHaveCount(0);
});
