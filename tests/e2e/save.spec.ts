import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });
test.setTimeout(90_000);

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(400);
}

/** Pretends the tab was hidden, which is one of the autosave triggers. */
async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

const attr = (page: Page, name: string): Promise<string | null> =>
  page.locator('#game').getAttribute(name);

test('play, gain an item and XP, reload: the state is identical', async ({ page }) => {
  const problems = await watchProblems(page);
  // Start by Brin the shopkeeper with the dummy nearby, in a fresh browser profile.
  await page.goto('/?region=slice&at=40,31');
  await ready(page);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(250);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  await page.getByRole('button', { name: 'Show me what you have.' }).click();
  // Sell the starting bread: an item and coin change. (A new character holds only a wooden dagger
  // worn and one bread, and Brin pays less for bread than he asks, so it cannot be bought back.)
  await page.getByRole('tab', { name: 'Sell' }).click();
  await page.getByRole('button', { name: /^Sell Bread/ }).click();
  await expect(page.locator('.pow-shop-msg')).toContainText('Sold');
  await page.keyboard.press('Escape');
  // Write it down before leaving the page, so the next page starts from it.
  const seq0 = Number((await attr(page, 'data-saved-seq')) ?? '0');
  await hide(page);
  await expect
    .poll(async () => Number((await attr(page, 'data-saved-seq')) ?? '0'))
    .toBeGreaterThan(seq0);

  // Skill XP: switch to Classic, face the training dummy one tile north, and swing at it.
  await page.goto('/?region=slice&foes=1&at=53,39');
  await ready(page);
  await page.keyboard.press('KeyT');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyW');
  for (let i = 0; i < 26; i++) {
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(450);
  }

  // Save (the page being hidden is a trigger), and note what was written.
  const seqBefore = Number((await attr(page, 'data-saved-seq')) ?? '0');
  await hide(page);
  await expect
    .poll(async () => Number((await attr(page, 'data-saved-seq')) ?? '0'))
    .toBeGreaterThan(seqBefore);
  const savedHash = await attr(page, 'data-saved-hash');
  const savedSeq = await attr(page, 'data-saved-seq');
  expect(savedHash).toMatch(/^[0-9a-f]{14}$/);
  await shot(page, 'save-before-reload');

  // Reload without the unload saves, so the latest save is exactly the one just noted. (Those
  // saves are real and are what keep progress in normal play; here they would only move the goalposts.)
  await page.evaluate(() => {
    const stop = (e: Event): void => e.stopImmediatePropagation();
    window.addEventListener('pagehide', stop, true);
    document.addEventListener('visibilitychange', stop, true);
  });
  // No `?at=`, which would move the loaded avatar. `skip` goes past the title.
  await page.goto('/?region=slice&skip=1');
  await ready(page);
  expect(await attr(page, 'data-loaded-seq')).toBe(savedSeq);
  expect(await attr(page, 'data-loaded-hash')).toBe(savedHash);
  // What was done is still there: the bread is gone, a skill has ranked up.
  await page.keyboard.press('KeyB');
  await expect(page.getByRole('button', { name: /^Bread/ })).toHaveCount(0);
  await page.locator('[data-tab="skills"]').click();
  await expect(page.locator('.pow-menu-body')).not.toContainText(
    'Skills awaken the first time you use them.',
  );
  await shot(page, 'save-after-reload');
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);
});

test('a killed save leaves the latest readable: an aborted IndexedDB transaction changes nothing', async ({
  page,
}) => {
  await page.goto('/?region=slice&foes=0&at=48,41');
  await ready(page);
  await hide(page);
  await expect
    .poll(async () => Number((await attr(page, 'data-saved-seq')) ?? '0'))
    .toBeGreaterThan(0);
  const before = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('pow-save', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('slots', 'readonly');
          const req = tx.objectStore('slots').get('latest');
          req.onsuccess = () => resolve(`${req.result.seq}:${req.result.checksum}`);
        };
      }),
  );
  // Start a write that replaces latest with junk, then abort it, as a killed tab would.
  const after = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('pow-save', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('slots', 'readwrite');
          tx.objectStore('slots').put({
            slot: 'latest',
            seq: 999,
            savedAt: 1,
            checksum: 'junk',
            bytes: new Uint8Array([1, 2, 3]),
          });
          tx.abort();
          tx.onabort = () => {
            const t2 = db.transaction('slots', 'readonly');
            const req = t2.objectStore('slots').get('latest');
            req.onsuccess = () => resolve(`${req.result.seq}:${req.result.checksum}`);
          };
        };
      }),
  );
  expect(after).toBe(before);
  await page.reload();
  await ready(page);
  expect(await attr(page, 'data-loaded-hash')).not.toBeNull();
});

test('a damaged latest save is skipped with the recover screen, and the game still loads', async ({
  page,
}) => {
  await page.goto('/?region=slice&foes=0&at=48,41');
  await ready(page);
  await hide(page);
  await expect
    .poll(async () => Number((await attr(page, 'data-saved-seq')) ?? '0'))
    .toBeGreaterThan(0);
  // A second save, so there is a previous one to fall back to.
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('pow-save', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('slots', 'readwrite');
          const store = tx.objectStore('slots');
          const get = store.get('latest');
          get.onsuccess = () => {
            const rec = get.result;
            // Make sure a previous exists, then flip a byte of latest.
            store.put({ ...rec, slot: 'previous' });
            const bytes = new Uint8Array(rec.bytes);
            bytes[5] = bytes[5]! ^ 0xff;
            store.put({ ...rec, bytes, slot: 'latest', seq: rec.seq + 1 });
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  // The recover screen names what happened, and the game starts when the player continues.
  const recover = page.locator('.pow-recover');
  await expect(recover).toContainText('Save recovered');
  await expect(recover).toContainText('the save before your latest');
  await recover.getByRole('button', { name: 'Continue' }).click();
  await ready(page);
  expect(await attr(page, 'data-loaded-hash')).not.toBeNull();
});
