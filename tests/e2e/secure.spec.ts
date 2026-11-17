import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { watchProblems } from './helpers';

test.use({ viewport: { width: 360, height: 800 } });

const WORDS = ['item.', 'inventory', 'skill.', 'creature.', 'coinEarned', 'equipment', 'entities'];

/** The raw bytes of the stored latest snapshot, as an array of numbers. */
const storedLatest = (page: Page): Promise<number[]> =>
  page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const open = indexedDB.open('pow-save', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('slots').objectStore('slots').get('latest');
          req.onsuccess = () => resolve([...(req.result.bytes as Uint8Array)]);
        };
      }),
  );

const saveNow = async (page: Page): Promise<void> => {
  const seq = async (): Promise<number> =>
    Number((await page.locator('#game').getAttribute('data-saved-seq')) ?? '0');
  const before = await seq();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
  await expect.poll(seq).toBeGreaterThan(before);
};

const inWorld = async (page: Page): Promise<void> => {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(400);
};

test('a stored save is sealed: binary header, no readable game text, and it loads again', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByLabel('Handle').fill('Sealed_9');
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await inWorld(page);
  await saveNow(page);

  const bytes = await storedLatest(page);
  expect(bytes.slice(0, 2)).toEqual([0x50, 0x57]);
  const text = Buffer.from(bytes).toString('latin1');
  for (const w of [...WORDS, 'Sealed_9']) expect(text.includes(w), w).toBe(false);

  // The key is stored as a key object, never as bytes a script can read.
  const keyInfo = await page.evaluate(
    () =>
      new Promise<{ extractable: boolean; exportable: boolean }>((resolve, reject) => {
        const open = indexedDB.open('pow-keys', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('keys').objectStore('keys').get('device');
          req.onsuccess = async () => {
            const key = req.result as CryptoKey;
            const exportable = await crypto.subtle.exportKey('raw', key).then(
              () => true,
              () => false,
            );
            resolve({ extractable: key.extractable, exportable });
          };
        };
      }),
  );
  expect(keyInfo).toEqual({ extractable: false, exportable: false });

  await page.goto('/');
  await expect(page.getByText('Signed in as Sealed_9.')).toBeVisible();
  await page.getByRole('button', { name: 'Log In as Sealed_9' }).click();
  await inWorld(page);
  expect(await page.locator('#game').getAttribute('data-loaded-hash')).not.toBeNull();
  expect(problems.pageErrors).toEqual([]);
  expect(problems.console).toEqual([]);
});

test('an M1 save in plain JSON migrates on load and is written back sealed', async ({ page }) => {
  const problems = await watchProblems(page);
  const f2 = JSON.parse(
    readFileSync(join(process.cwd(), 'tests', 'fixtures', 'saves', 'schema-2.json'), 'utf8'),
  ) as { plain: unknown };
  const json = Array.from(Buffer.from(JSON.stringify(f2.plain), 'utf8'));

  // Plant the old record before the game ever opens the database.
  await page.goto('/?skip=1&nosave=1');
  await page.evaluate(async (data) => {
    const bytes = Uint8Array.from(data);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const checksum = [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('pow-save', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('slots', { keyPath: 'slot' });
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('slots', 'readwrite');
        tx.objectStore('slots').put({ slot: 'latest', seq: 12, savedAt: 1, checksum, bytes });
        tx.oncomplete = () => resolve();
      };
    });
  }, json);

  await page.goto('/');
  await expect(page.getByText('Signed in as Fixture_2.')).toBeVisible();
  await page.getByRole('button', { name: 'Log In as Fixture_2' }).click();
  await inWorld(page);
  expect(await page.locator('#game').getAttribute('data-loaded-hash')).not.toBeNull();
  // No recovery screen: this was a normal load, not a fallback.
  await expect(page.locator('.pow-recover')).toHaveCount(0);

  await saveNow(page);
  const bytes = await storedLatest(page);
  expect(bytes.slice(0, 2)).toEqual([0x50, 0x57]);
  const text = Buffer.from(bytes).toString('latin1');
  for (const w of WORDS) expect(text.includes(w), w).toBe(false);

  await page.goto('/');
  await expect(page.getByText('Signed in as Fixture_2.')).toBeVisible();
  expect(problems.pageErrors).toEqual([]);
});

test('a damaged latest save loads the one before it and the recover screen says so', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.getByLabel('Handle').fill('Mend_1');
  await page.getByRole('button', { name: 'Enter the world' }).click();
  await inWorld(page);
  await saveNow(page);
  await saveNow(page);

  // Flip a byte in the stored latest record.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('pow-save', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('slots', 'readwrite');
          const store = tx.objectStore('slots');
          const req = store.get('latest');
          req.onsuccess = () => {
            const row = req.result as { bytes: Uint8Array };
            row.bytes[30] = (row.bytes[30] as number) ^ 0xff;
            store.put(row);
          };
          tx.oncomplete = () => resolve();
        };
      }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'Log In as Mend_1' }).click();
  const recover = page.locator('.pow-recover');
  await expect(recover).toBeVisible();
  await expect(recover).toContainText('Save recovered');
  await expect(recover).toContainText('nothing was deleted');
  await expect(recover).toContainText('Your latest save');
  await recover.getByRole('button', { name: 'Continue' }).click();
  await expect(recover).toHaveCount(0);
  await inWorld(page);
});

test('a browser without gzip streams gets a clear message and stores nothing', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'CompressionStream', { value: undefined, configurable: true });
  });
  await page.goto('/');
  const box = page.locator('.pow-unsupported');
  await expect(box).toBeVisible();
  await expect(box).toContainText('cannot keep a safe save');
  await expect(box).toContainText('CompressionStream');
  await expect(page.locator('#game')).not.toHaveAttribute('data-ready', 'true');
  const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  expect(dbs).not.toContain('pow-save');
});
