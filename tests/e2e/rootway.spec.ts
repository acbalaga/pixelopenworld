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

// Part two: the screenshots the ticket asks for, on a phone. R2, R4 unlit and lit, R5 with the
// gate down, and R8 in phase 2. They need the creatures on (foes are off in the test above).
test('the fork, the dark gallery lit and unlit, the snare gate and the den in phase two', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  const at = (room: string, x: number, y: number): string => {
    const t = regionTile(room, { x, y });
    return `${t.x},${t.y}`;
  };
  const shot = async (name: string): Promise<void> => {
    const png = await page.screenshot();
    expect(png.length, name).toBeGreaterThan(8_000);
    if (process.env.POW_EVIDENCE) {
      mkdirSync(DIR, { recursive: true });
      await page.screenshot({ path: join(DIR, `${name}.png`) });
    }
  };
  const go = async (room: string, x: number, y: number): Promise<void> => {
    await page.goto(
      `/?region=dawnmeadow&at=${at(room, x, y)}&nosave=1&time=day&weather=clear&kit=dev`,
    );
    await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  };

  await go('r2', 6, 4);
  await page.waitForTimeout(800);
  await shot('r2-fork-phone');

  // The dark gallery: only telegraphs show. A lantern lights a radius.
  await go('r4', 10, 6);
  await page.waitForTimeout(900);
  await shot('r4-unlit-phone');
  await page.evaluate(() =>
    (window as never as { __pow: { wear(i: string): void } }).__pow.wear('item.lantern'),
  );
  await page.waitForTimeout(900);
  await shot('r4-lit-phone');

  // The snare chamber: stepping into it drops the gate behind the avatar and the grubs come up.
  await go('r5', 8, 8);
  await page.waitForTimeout(2200);
  await shot('r5-gate-down-phone');

  // The den, with the boss below half Health: boarlets and roots.
  await go('r8', 10, 9);
  await page.waitForTimeout(600);
  await page.evaluate(() =>
    (window as never as { __pow: { foeHp(p: number): void } }).__pow.foeHp(40),
  );
  await page.waitForTimeout(2600);
  await shot('r8-phase-2-phone');
  expect(problems.console).toEqual([]);
  expect(problems.pageErrors).toEqual([]);
});
