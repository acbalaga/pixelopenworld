import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { watchProblems } from './helpers';

// Time, weather and lighting (POW-M4-09). Runs on the dev server because `?time=` and `?weather=`
// exist only there. Screenshots go to docs/ops/evidence/pow-m4-09/ when POW_EVIDENCE=1.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 640 } });
test.setTimeout(180_000);

const DIR = join(process.cwd(), 'docs', 'ops', 'evidence', 'pow-m4-09');
const SPOT = 'at=40,31';

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(1800);
}

/** Mean brightness (0 to 255) of a PNG's pixels. */
function luma(png: Buffer): number {
  const img = PNG.sync.read(png);
  let sum = 0;
  for (let i = 0; i < img.data.length; i += 4)
    sum +=
      0.2126 * (img.data[i] as number) +
      0.7152 * (img.data[i + 1] as number) +
      0.0722 * (img.data[i + 2] as number);
  return sum / (img.data.length / 4);
}

async function shot(page: Page, name: string): Promise<Buffer> {
  const png = await page.screenshot();
  if (process.env.POW_EVIDENCE) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, `${name}.png`), png);
  }
  return png;
}

test('the same spot at four times of day, in rain and in fog', async ({ page }) => {
  const problems = await watchProblems(page);
  const light: Record<string, number> = {};
  for (const time of ['dawn', 'day', 'dusk', 'night']) {
    await page.goto(`/?${SPOT}&time=${time}&weather=clear&foes=0&nosave=1`);
    await ready(page);
    light[time] = luma(await shot(page, `time-${time}`));
  }
  // The day is brightest and the night darkest, with dawn and dusk between.
  expect(light.day).toBeGreaterThan(light.dawn!);
  expect(light.dawn).toBeGreaterThan(light.night!);
  expect(light.dusk).toBeGreaterThan(light.night!);
  expect(light.day).toBeGreaterThan(light.dusk!);
  for (const weather of ['rain', 'fog', 'storm']) {
    await page.goto(`/?${SPOT}&time=day&weather=${weather}&foes=0&nosave=1`);
    await ready(page);
    light[weather] = luma(await shot(page, `weather-${weather}`));
  }
  expect(light.rain).toBeLessThan(light.day!);
  expect(light.storm).toBeLessThan(light.rain!);
  console.log('mean brightness', JSON.stringify(light));
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);
});

test('System shows the calendar', async ({ page }) => {
  await page.goto(`/?${SPOT}&time=day&weather=rain&foes=0&nosave=1`);
  await ready(page);
  await page.keyboard.press('Escape');
  await page.locator('[data-tab="system"]').click();
  const cal = page.locator('[data-key="calendar"]');
  await expect(cal).toBeVisible();
  await expect(cal).toContainText('Spring');
  await expect(cal).toContainText('Weather today: Rain');
  await shot(page, 'calendar');
});

/** Samples every animation frame's length into `window.__frames`. */
async function sampleFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = 0;
    const loop = (t: number): void => {
      if (last) w.__frames.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

async function record(page: Page, url: string, ms: number) {
  await sampleFrames(page);
  await page.goto(url);
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(3000);
  const from = await page.evaluate(
    () => (window as unknown as { __frames: number[] }).__frames.length,
  );
  await page.waitForTimeout(ms);
  const f = (
    await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames)
  ).slice(from);
  const over32 = f.filter((x) => x > 32).length;
  const mean = f.reduce((a, b) => a + b, 0) / f.length;
  return {
    n: f.length,
    meanMs: +mean.toFixed(2),
    fps: +(1000 / mean).toFixed(1),
    maxMs: +Math.max(...f).toFixed(1),
    over32,
    over32Pct: +((100 * over32) / f.length).toFixed(2),
  };
}

// As in the streaming check, this container drops a few frames even when nothing changes, so the
// storm is held against a clear day in the same run.
test('a night storm with lights on a 4x throttled CPU holds the frame budget', async ({
  page,
  browser,
}) => {
  const storm = await record(page, `/?${SPOT}&time=night&weather=storm&foes=0&nosave=1`, 20_000);
  const other = await browser.newPage({ viewport: { width: 360, height: 640 } });
  const clear = await record(other, `/?${SPOT}&time=day&weather=clear&foes=0&nosave=1`, 20_000);
  await other.close();
  console.log('storm', JSON.stringify(storm), 'clear', JSON.stringify(clear));
  if (process.env.POW_EVIDENCE) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, 'storm-4x.json'), `${JSON.stringify({ storm, clear }, null, 2)}\n`);
  }
  expect(storm.fps).toBeGreaterThanOrEqual(55);
  expect(storm.over32Pct).toBeLessThanOrEqual(clear.over32Pct + 2.5);
  expect(storm.maxMs).toBeLessThan(100);
});
