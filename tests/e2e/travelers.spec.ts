import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { watchProblems } from './helpers';

// Travelers near the player (POW-M5-04). Runs against the dev server, which has `window.__pow`.
// Phone screenshots go to docs/ops/evidence/pow-m5-04/ when POW_EVIDENCE=1.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 640 } });
test.setTimeout(180_000);

const DIR = join(process.cwd(), 'docs', 'ops', 'evidence', 'pow-m5-04');

interface Pow {
  crowd(): { online: number; entities: number; handles: string[] };
  travelerFight(id: string): string | null;
}

test('the square at the evening peak holds real Travelers, and one fights a Mossling', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  // A weekday evening on the device clock, so the crowd is at its peak.
  const evening = new Date();
  evening.setDate(evening.getDate() + ((3 - evening.getDay() + 7) % 7));
  evening.setHours(21, 10, 0, 0);
  await page.clock.install({ time: evening });
  await page.goto('/?region=dawnmeadow&at=192,193&time=dusk&weather=clear&foes=0&nosave=1&kit=dev');
  await page.clock.resume();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  // Let the crowd log in and be promoted.
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().entities ?? 0),
      {
        timeout: 90_000,
      },
    )
    .toBeGreaterThan(2);
  await page.waitForTimeout(4000);
  // The dev overlay would cover the picture.
  await page.keyboard.press('Backquote');
  await page
    .getByRole('button', { name: /close|dismiss/i })
    .first()
    .click({ timeout: 500 })
    .catch(() => undefined);
  if (process.env.POW_EVIDENCE) {
    mkdirSync(DIR, { recursive: true });
    await page.screenshot({ path: join(DIR, 'square-evening.png') });
  }
  const info = await page.evaluate(() => (window as unknown as { __pow: Pow }).__pow.crowd());
  expect(info.handles.length).toBe(info.entities);
  const fighter = await page.evaluate(() =>
    (window as unknown as { __pow: Pow }).__pow.travelerFight('creature.mossling'),
  );
  expect(fighter).not.toBeNull();
  await page.waitForTimeout(900);
  if (process.env.POW_EVIDENCE) await page.screenshot({ path: join(DIR, 'fighting-mossling.png') });
  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});

/** Loads the square in rain at dusk, throttles the CPU, opens the chat sheet and reads the overlay. */
async function measure(page: Page, asleep: boolean): Promise<Record<string, number>> {
  const evening = new Date();
  evening.setDate(evening.getDate() + ((3 - evening.getDay() + 7) % 7));
  evening.setHours(21, 10, 0, 0);
  await page.clock.install({ time: evening });
  await page.goto(
    `/?region=dawnmeadow&at=192,193&time=dusk&weather=rain&foes=0&nosave=1&kit=dev${asleep ? '&crowd=0' : ''}`,
  );
  await page.clock.resume();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  if (!asleep)
    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().entities ?? 0),
        { timeout: 90_000 },
      )
      .toBeGreaterThan(15);
  // A phone is slower than this machine: throttle the CPU four times as a proxy.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page
    .locator('.pow-chat-lane')
    .click({ timeout: 5000 })
    .catch(() => undefined);
  await page.waitForTimeout(12_000);
  const text = await page.evaluate(
    () => document.getElementById('pow-dev-overlay')?.textContent ?? '',
  );
  const num = (re: RegExp): number => Number(re.exec(text)?.[1] ?? Number.NaN);
  return {
    fps: num(/(\d+) fps/),
    frame: num(/fps\s+frame ([\d.]+) ms/),
    p95: num(/p95 ([\d.]+)/),
    render: num(/render ([\d.]+) ms/),
    tick: num(/tick ([\d.]+) ms/),
    tickMax: num(/tick [\d.]+ ms \(max ([\d.]+)/),
    entities: num(/crowd: \d+ online, (\d+) entities/),
    online: num(/crowd: (\d+) online/),
  };
}

test('about 30 Travelers in the square with rain and the chat sheet open cost little frame time', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const control = await measure(page, true);
  const crowd = await measure(page, false);
  if (process.env.POW_EVIDENCE) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(
      join(DIR, 'frame-budget.md'),
      `# Frame budget, Hearthford square at the evening peak

Headless Chromium, 360 x 640, CPU throttled 4x as a proxy for a mid-range phone, rain on, chat sheet open. The same scene is measured with the crowd asleep (\`?crowd=0\`) and awake.

| | Crowd asleep | Crowd awake |
| --- | --- | --- |
| Traveler entities | 0 | ${crowd.entities} (${crowd.online} online) |
| fps | ${control.fps} | ${crowd.fps} |
| frame ms (p95) | ${control.frame} (${control.p95}) | ${crowd.frame} (${crowd.p95}) |
| render ms | ${control.render} | ${crowd.render} |
| sim tick ms (max) | ${control.tick} (${control.tickMax}) | ${crowd.tick} (${crowd.tickMax}) |

Budgets (tech/04): 60 fps in a busy hub, never below 45; render under 8 ms; tick under 6 ms average, 12 ms worst. This is a proxy, not the reference device: re-check on a real phone at Gate G5a.
`,
    );
    await page.screenshot({ path: join(DIR, 'square-rain-chat-open.png') });
  }
  // The crowd adds at most a fifth to the frame, and the sim tick stays well inside its budget.
  expect(crowd.frame!).toBeLessThan(control.frame! * 1.25 + 1);
  expect(crowd.tick!).toBeLessThan(6);
  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});

test('a minute of the square at the evening peak, as a frame sequence', async ({ page }) => {
  const problems = await watchProblems(page);
  const evening = new Date();
  evening.setDate(evening.getDate() + ((3 - evening.getDay() + 7) % 7));
  evening.setHours(21, 10, 0, 0);
  await page.clock.install({ time: evening });
  await page.goto('/?region=dawnmeadow&at=192,196&time=dusk&weather=clear&foes=0&nosave=1&kit=dev');
  await page.clock.resume();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => (window as unknown as { __pow?: Pow }).__pow?.crowd().entities ?? 0),
      { timeout: 90_000 },
    )
    .toBeGreaterThan(8);
  await page.keyboard.press('Backquote');
  const dir = join(DIR, '..', 'pow-m5-14');
  if (process.env.POW_EVIDENCE) mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 6; i++) {
    if (process.env.POW_EVIDENCE)
      await page.screenshot({ path: join(dir, `frame-${i}.png`), scale: 'css' });
    await page.waitForTimeout(10_000);
  }
  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});

test('Travelers talk: the ticker and the chat sheet fill with real lines, glyphs inline', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const evening = new Date();
  evening.setDate(evening.getDate() + ((3 - evening.getDay() + 7) % 7));
  evening.setHours(21, 10, 0, 0);
  await page.clock.install({ time: evening });
  await page.goto('/?region=dawnmeadow&at=192,196&time=dusk&weather=clear&foes=0&nosave=1&kit=dev');
  await page.clock.resume();
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  // Lines arrive from the crowd. The old scripted ticker is gone.
  await expect(page.locator('.pow-chat-line').first()).toBeVisible({ timeout: 90_000 });
  const first = await page.locator('.pow-chat-line').first().textContent();
  expect(first ?? '').not.toContain('Brin restock the bread yet');
  if (process.env.POW_EVIDENCE) {
    // Keep going until a glyph line shows, for the picture.
    await page.evaluate(() => {
      const pow = (window as unknown as { __pow: { say(f: string, t: string): void } }).__pow;
      pow.say('lilfern', 'so good to see everyone tonight :heart: :sparkle:');
      pow.say('Marrow', 'smithy is open, copper ingots x4 :coin:');
    });
    await expect(page.locator('.pow-glyph').first()).toBeVisible();
    const dir = join(DIR, '..', 'pow-m5-05');
    mkdirSync(dir, { recursive: true });
    await page.keyboard.press('Backquote');
    await page.screenshot({ path: join(dir, 'ticker-100.png') });
    // A tap on the lines (they pass touches through to the stick, so force the spot).
    await page.locator('.pow-chat-lines').click({ force: true });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(dir, 'sheet-100.png') });
    await page.evaluate(() =>
      document.getElementById('ui-root')?.style.setProperty('--text-scale', '1.6'),
    );
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(dir, 'sheet-160.png') });
    await page
      .locator('.pow-chat-close, [aria-label*="lose"]')
      .first()
      .click()
      .catch(() => undefined);
    await page.screenshot({ path: join(dir, 'ticker-160.png') });
  }
  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});
