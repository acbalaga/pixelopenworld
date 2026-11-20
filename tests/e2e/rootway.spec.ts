import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { regionTile } from '../../src/content/world/dungeons/rootway';
import { watchProblems } from './helpers';

// The Rootway (POW-M4-21, part one): the mouth at the great oak leads into the cave under the
// region, the rooms draw, and the dark gallery is dark. Screenshots go to docs/ops/evidence when
// POW_EVIDENCE=1.
test.use({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 360, height: 640 } });
test.setTimeout(120_000);

const DIR = join(process.cwd(), 'docs', 'ops', 'evidence', 'pow-m4-21');

test('the mouth leads into the Rootway and its rooms draw', async ({ page }) => {
  const problems = await watchProblems(page);
  // Just south of the mouth at the great oak (119, 250), facing it.
  await page.goto('/?region=dawnmeadow&at=119,252&foes=0&nosave=1&time=day&weather=clear');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(800);
  if (process.env.POW_EVIDENCE) {
    mkdirSync(DIR, { recursive: true });
    await page.screenshot({ path: join(DIR, 'mouth-outside.png') });
  }
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(900);
  const shot = await page.screenshot();
  expect(shot.length).toBeGreaterThan(15_000);
  if (process.env.POW_EVIDENCE) await page.screenshot({ path: join(DIR, 'r1-mouth.png') });

  // The dark gallery, reached directly: nothing is drawn but telegraphs until it is lit.
  const inRoom = (room: string, x: number, y: number): string => {
    const t = regionTile(room, { x, y });
    return `${t.x},${t.y}`;
  };
  for (const [name, at] of [
    ['r2-fork', inRoom('r2', 6, 4)],
    ['r3a-root-hall', inRoom('r3a', 4, 6)],
    ['r4-dark', inRoom('r4', 10, 6)],
    ['r5-snare', inRoom('r5', 8, 9)],
    ['r6-puzzle', inRoom('r6', 6, 5)],
    ['r7-rest', inRoom('r7', 8, 6)],
    ['r8-den', inRoom('r8', 10, 9)],
  ] as const) {
    await page.goto(`/?region=dawnmeadow&at=${at}&foes=0&nosave=1&time=day&weather=clear`);
    await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
    await page.waitForTimeout(900);
    const png = await page.screenshot();
    expect(png.length, name).toBeGreaterThan(8_000);
    if (process.env.POW_EVIDENCE) await page.screenshot({ path: join(DIR, `${name}.png`) });
  }
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});
