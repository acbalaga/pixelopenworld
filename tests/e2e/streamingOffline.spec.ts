import { expect, test, type Page } from '@playwright/test';
import { watchProblems } from './helpers';

// Offline play of a downloaded region (POW-M4-03). Runs on the production build, which is what
// ships: the service worker, the chunk worker and IndexedDB together.
test.use({ viewport: { width: 360, height: 640 } });

/** How many of the slice's chunk files are in the IndexedDB cache. */
const cachedChunks = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('pow-world');
        open.onerror = () => resolve(0);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('files')) return resolve(0);
          const r = db.transaction('files').objectStore('files').getAllKeys();
          r.onsuccess = () =>
            resolve((r.result as string[]).filter((k) => /^slice\/\d+,\d+\//.test(k)).length);
          r.onerror = () => resolve(0);
        };
      }),
  );

test('a downloaded region plays with no network, even where the avatar has not been', async ({
  page,
  context,
}) => {
  const problems = await watchProblems(page);
  // The first start is near the top of the slice. Its window covers the outdoor chunks only.
  await page.goto('/?region=slice&at=40,20&nosave=1');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  // The first visit installs the worker. A reload puts the page under it.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  // The region downloads in the background (a setting, on by default). All 15 chunks.
  await expect.poll(() => cachedChunks(page), { timeout: 30_000 }).toBe(15);

  await context.setOffline(true);
  // Start in the cave, three chunk rows from where the avatar was: only the download has them.
  await page.goto('/?region=slice&at=40,130&nosave=1');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1500);
  expect(problems.pageErrors).toEqual([]);
  await context.setOffline(false);
});
