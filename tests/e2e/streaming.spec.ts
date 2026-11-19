import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { watchProblems } from './helpers';

// Chunk streaming (POW-M4-03). The frame-rate checks run on the dev server (`dev_stress` is a dev
// region, absent from the production build). The offline check runs on the production build.
test.use({ viewport: { width: 360, height: 640 } });

/** Samples every animation frame's length into `window.__frames`, from before the page starts. */
async function sampleFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: number[]; __t0: number };
    w.__frames = [];
    let last = 0;
    const loop = (t: number): void => {
      if (last) w.__frames.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

const frames = (page: Page): Promise<number[]> =>
  page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice());

async function throttle(page: Page, rate: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
}

interface Stats {
  n: number;
  meanMs: number;
  fps: number;
  p99Ms: number;
  maxMs: number;
  over32: number;
  over32Pct: number;
}

const stats = (f: number[]): Stats => {
  const sorted = [...f].sort((a, b) => a - b);
  const mean = f.reduce((a, b) => a + b, 0) / f.length;
  const over32 = f.filter((x) => x > 32).length;
  return {
    n: f.length,
    meanMs: +mean.toFixed(2),
    fps: +(1000 / mean).toFixed(1),
    p99Ms: +(sorted[Math.floor(sorted.length * 0.99)] as number).toFixed(1),
    maxMs: +Math.max(...f).toFixed(1),
    over32,
    over32Pct: +((100 * over32) / f.length).toFixed(2),
  };
};

/** Frame series for a run, kept as evidence when POW_EVIDENCE=1. */
function keep(name: string, series: Record<string, Stats>): void {
  console.log(name, JSON.stringify(series));
  if (!process.env.POW_EVIDENCE) return;
  const dir = join(process.cwd(), 'docs', 'ops', 'evidence', 'pow-m4-03');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.json`), `${JSON.stringify(series, null, 2)}\n`);
}

/** Loads a page under the 4x throttle, waits for the start window, and records frames for `ms`. */
async function record(
  page: Page,
  url: string,
  ms: number,
  act?: () => Promise<void>,
): Promise<Stats> {
  await sampleFrames(page);
  await throttle(page, 4);
  await page.goto(url);
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  // Let the start window paint before measuring.
  await page.waitForTimeout(3000);
  const from = (await frames(page)).length;
  await act?.();
  await page.waitForTimeout(ms);
  return stats((await frames(page)).slice(from));
}

test.describe('dev server', () => {
  test.use({ baseURL: 'http://127.0.0.1:5173' });
  test.setTimeout(180_000);

  // The pass line. A 60 Hz frame that misses its slot lasts 33 ms, so "no frame over 32 ms" is
  // "no dropped frame". This container drops a few frames at random even when nothing moves
  // (the idle run below shows how many), so the check compares against that run and allows a
  // small share, and it holds the longest frame to under 100 ms so a real hitch still fails.
  test('crossing a six chunk region at speed on a 4x throttled CPU holds 60 fps', async ({
    page,
    browser,
  }) => {
    const problems = await watchProblems(page);
    const crossing = await record(page, '/?region=dev_stress&auto=1&nosave=1', 20_000);
    // Same page, same throttle, nothing moving: the floor this machine sets.
    const idlePage = await browser.newPage({ viewport: { width: 360, height: 640 } });
    const idle = await record(idlePage, '/?region=dev_stress&fly=1&nosave=1', 20_000);
    await idlePage.close();
    keep('crossing-4x', { crossing, idle });
    expect(crossing.fps, 'mean fps').toBeGreaterThanOrEqual(55);
    expect(crossing.over32Pct, 'dropped frames, percent').toBeLessThanOrEqual(idle.over32Pct + 2.5);
    expect(crossing.maxMs, 'longest frame').toBeLessThan(100);
    expect(problems.pageErrors).toEqual([]);
    expect(problems.csp).toEqual([]);
  });

  test('walking across chunk edges in the sim places and removes objects without a hitch', async ({
    page,
  }) => {
    // Start at a chunk edge so the first steps cross it, with the sim running (no free flight).
    const walking = await record(
      page,
      '/?region=dev_stress&at=30,90&nosave=1&foes=0',
      12_000,
      async () => {
        await page.keyboard.down('KeyD');
      },
    );
    await page.keyboard.up('KeyD');
    keep('walking-4x', { walking });
    expect(walking.fps).toBeGreaterThanOrEqual(55);
    expect(walking.over32Pct).toBeLessThanOrEqual(4);
    expect(walking.maxMs).toBeLessThan(100);
  });
});
