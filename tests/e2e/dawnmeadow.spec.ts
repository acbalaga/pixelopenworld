import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { watchProblems } from './helpers';

// Dawnmeadow (POW-M4-04): the baked region plays at `?region=dawnmeadow`. Phone screenshots of
// every settlement and district go to docs/ops/evidence/pow-m4-04/ when POW_EVIDENCE=1.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 640 } });
test.setTimeout(240_000);

const DIR = join(process.cwd(), 'docs', 'ops', 'evidence', 'pow-m4-04', 'phone');

/** Where to stand (region tiles), by name. Town tiles are the town origin (164, 164) plus the stamp's. */
const SPOTS: { name: string; at: [number, number]; time?: string }[] = [
  { name: 'hearthford-square', at: [192, 193] },
  { name: 'hearthford-craft-row', at: [205, 176] },
  { name: 'hearthford-craft-row-south', at: [205, 186] },
  { name: 'hearthford-rune-house', at: [175, 187] },
  { name: 'hearthford-bell-tower', at: [188, 178] },
  { name: 'hearthford-guard-yard', at: [175, 201] },
  { name: 'hearthford-inn-yard', at: [175, 215] },
  { name: 'hearthford-market-street', at: [188, 209] },
  { name: 'hearthford-homes', at: [212, 202] },
  { name: 'hearthford-north-gate-practice-field', at: [192, 152] },
  { name: 'millbrook', at: [282, 117] },
  { name: 'reedmouth', at: [307, 246] },
  { name: 'stonecrop', at: [176, 52] },
  { name: 'wayside-chapel', at: [176, 270] },
  { name: 'fernside-arch', at: [96, 175] },
  { name: 'cairnmoor-ring', at: [49, 53] },
  { name: 'fernside-climb', at: [50, 114] },
  { name: 'sight-floating-stones', at: [112, 14] },
  { name: 'sight-lit-window-night', at: [59, 29], time: 'night' },
  { name: 'sight-far-den', at: [336, 268] },
];

test('every settlement and district loads and draws, and the screenshots are kept', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  for (const s of SPOTS) {
    const t = s.time ? `&time=${s.time}` : '&time=day';
    await page.goto(
      `/?region=dawnmeadow&at=${s.at[0]},${s.at[1]}${t}&weather=clear&foes=0&nosave=1`,
    );
    await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(1200);
    const png = await page.screenshot();
    expect(png.length, s.name).toBeGreaterThan(20_000);
    if (process.env.POW_EVIDENCE) {
      mkdirSync(DIR, { recursive: true });
      writeFileSync(join(DIR, `${s.name}.png`), png);
    }
  }
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);
});

test('the region streams: walking from Hearthford to the east gate loads and drops chunks', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await page.goto('/?region=dawnmeadow&at=212,193&time=day&weather=clear&foes=0&nosave=1');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(6000);
  await page.keyboard.up('KeyD');
  expect(problems.pageErrors).toEqual([]);
});

/** Where creatures stand by zone (M4-05): a spawner of the zone, found from the bake. */
const ZONE_SPOTS: { name: string; at: [number, number]; time: 'day' | 'night' }[] = [
  { name: 'commons-day', at: [133, 165], time: 'day' },
  { name: 'commons-night', at: [133, 165], time: 'night' },
  { name: 'millbrook-day', at: [346, 108], time: 'day' },
  { name: 'millbrook-barn-night', at: [274, 121], time: 'night' },
  { name: 'hollow-day', at: [41, 265], time: 'day' },
  { name: 'hollow-night', at: [41, 265], time: 'night' },
  { name: 'marsh-day', at: [322, 195], time: 'day' },
  { name: 'rise-day', at: [122, 34], time: 'day' },
  { name: 'fernside-night', at: [28, 127], time: 'night' },
  { name: 'cairnmoor-day', at: [28, 39], time: 'day' },
];

test('every zone loads with its creatures standing in it, and the screenshots are kept', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const EV = join(process.cwd(), 'docs', 'ops', 'evidence', 'pow-m4-05', 'zones');
  for (const s of ZONE_SPOTS) {
    await page.goto(
      `/?region=dawnmeadow&at=${s.at[0]},${s.at[1]}&time=${s.time}&weather=clear&nosave=1`,
    );
    await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(3500);
    const png = await page.screenshot();
    expect(png.length, s.name).toBeGreaterThan(20_000);
    if (process.env.POW_EVIDENCE) {
      mkdirSync(EV, { recursive: true });
      writeFileSync(join(EV, `${s.name}.png`), png);
    }
  }
  expect(problems.pageErrors).toEqual([]);
  expect(problems.csp).toEqual([]);
});
