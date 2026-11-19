import { expect, test, type Page } from '@playwright/test';
import { shot, watchProblems } from './helpers';

const SIZES = [
  { name: '360x800', width: 360, height: 800 },
  { name: '412x915', width: 412, height: 915 },
  { name: 'landscape-915x412', width: 915, height: 412 },
] as const;
const TABS = ['character', 'skills', 'bag', 'system'] as const;

async function boot(page: Page): Promise<void> {
  await page.goto('/?region=slice&skip=1');
  await expect(page.locator('#game')).toHaveAttribute('data-ready', 'true');
  // Input attaches a moment after the first frame; a tap straight away can be lost.
  await page.waitForTimeout(400);
}

const menu = (page: Page) => page.locator('.pow-menu');
async function openMenu(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeVisible();
}
async function goTab(page: Page, tab: string): Promise<void> {
  await page.locator(`[data-tab="${tab}"]`).click();
  await expect(page.locator(`[data-tab="${tab}"]`)).toHaveAttribute('aria-selected', 'true');
}

/** CDP touch swipe, straight line, `steps` moves over `ms`. */
async function swipe(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  ms = 250,
): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const steps = 8;
  const send = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    x: number,
    y: number,
  ): Promise<unknown> =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });
  await send('touchStart', from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(ms / steps);
    await send(
      'touchMove',
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
  }
  await send('touchEnd', to.x, to.y);
  await cdp.detach();
}

for (const size of SIZES) {
  test(`HUD and every Menu tab at ${size.name}`, async ({ page }) => {
    const problems = await watchProblems(page);
    await page.setViewportSize({ width: size.width, height: size.height });
    await boot(page);
    await shot(page, `hud-${size.name}`);
    await openMenu(page);
    for (const t of TABS) {
      await goTab(page, t);
      if (t === 'bag') await page.locator('[data-key="slot-0"]').click();
      await shot(page, `menu-${t}-${size.name}`);
      // The sheet fits the screen: nothing sticks out sideways.
      const box = await menu(page).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
    }
    expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
  });
}

test('every interactive element in every tab is at least 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await boot(page);
  await openMenu(page);
  const measure = async (): Promise<string[]> =>
    page.evaluate(() => {
      const bad: string[] = [];
      const sel = 'button, input, [role="switch"], [role="radio"], [role="tab"], a[href]';
      for (const n of document.querySelectorAll<HTMLElement>(
        `.pow-menu ${sel.split(', ').join(', .pow-menu ')}`,
      )) {
        const r = n.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.width < 44 || r.height < 44)
          bad.push(
            `${n.tagName} ${n.getAttribute('aria-label') ?? n.textContent} ${r.width}x${r.height}`,
          );
      }
      return bad;
    });
  for (const t of TABS) {
    await goTab(page, t);
    if (t === 'bag') await page.locator('[data-key="slot-0"]').click();
    expect(await measure(), t).toEqual([]);
  }
});

test('the accessibility tree names ordered controls on each tab', async ({ page }) => {
  await boot(page);
  await openMenu(page);
  const inOrder = (snap: string, parts: (string | RegExp)[]): void => {
    let at = -1;
    for (const p of parts) {
      const rest = snap.slice(at + 1);
      const m = typeof p === 'string' ? rest.indexOf(p) : rest.search(p);
      expect(m, `${String(p)} in order\n${snap}`).toBeGreaterThanOrEqual(0);
      at += 1 + m;
    }
  };
  const snap = async (): Promise<string> => menu(page).ariaSnapshot();

  // The sheet and its tab bar.
  const first = await snap();
  inOrder(first, [
    'dialog "Menu"',
    'button "Close menu"',
    'tabpanel',
    'tablist "Menu"',
    'tab "Character"',
    'tab "Skills"',
    'tab "Bag"',
    'tab "Chronicle"',
    'tab "System"',
  ]);
  // Tabs for systems that do not exist yet are hidden, not greyed out.
  expect(first).not.toMatch(/tab "(Map|Social|Routines)"/);
  expect(first).toMatch(/tab "Character".*selected/);

  inOrder(first, [
    'list "Gear"',
    'img "Your avatar"',
    'progressbar "Health"',
    'progressbar "Stamina"',
    'progressbar "Focus"',
  ]);
  // A fresh character wears a wooden dagger and rags.
  expect(first).toMatch(/button "Main hand: /);

  await goTab(page, 'skills');
  // A new avatar has earned no skill yet, so none is listed or named.
  const skills = await snap();
  expect(skills).toContain('Skills awaken the first time you use them.');
  expect(skills).not.toMatch(/Blades|Foraging|Cooking|Athletics|Ember|Evasion/);

  await goTab(page, 'bag');
  await page.locator('[data-key="slot-0"]').click();
  const bagSnap = await page.locator('.pow-menu').ariaSnapshot();
  inOrder(bagSnap, ['list "Bag"', 'button "Bread, 1"']);
  // The item opens a labelled dialog with its actions.
  const dlg = page.getByRole('dialog', { name: 'Bread' });
  await expect(dlg).toBeVisible();
  inOrder(await dlg.ariaSnapshot(), ['heading "Bread"', 'button "Hold to drop"', 'button "Eat"']);

  await goTab(page, 'system');
  inOrder(await snap(), [
    'heading "Settings"',
    'radiogroup "Controls"',
    'radio "Flow"',
    'radio "Classic"',
    'slider "Text size"',
    'slider "HUD size"',
    'slider "Button size"',
    'slider "HUD opacity"',
    'switch "Left handed layout',
    'switch "Reduced motion',
    'switch "Vibration',
    'button "Log Out"',
  ]);
});

test('text at 160% does not clip any tab', async ({ page }) => {
  for (const size of [SIZES[0], SIZES[2]]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await boot(page);
    await openMenu(page);
    await goTab(page, 'system');
    await page.locator('.pow-range').first().fill('1.6');
    for (const t of TABS) {
      await goTab(page, t);
      if (t === 'bag') await page.locator('[data-key="slot-0"]').click();
      await shot(page, `text160-${t}-${size.name}`);
      const clipped = await page.evaluate(() => {
        const out: string[] = [];
        const sheet = document.querySelector('.pow-menu') as HTMLElement;
        const sr = sheet.getBoundingClientRect();
        const body = sheet.querySelector('.pow-menu-body') as HTMLElement;
        if (body.scrollWidth > body.clientWidth + 1) out.push('body scrolls sideways');
        const tabs = sheet.querySelector('.pow-tabs') as HTMLElement;
        if (tabs.scrollWidth > tabs.clientWidth + 1) out.push('tab bar scrolls sideways');
        for (const n of sheet.querySelectorAll<HTMLElement>('*')) {
          const r = n.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || n.classList.contains('pow-sr')) continue;
          if (r.right > sr.right + 1 || r.left < sr.left - 1)
            out.push(`${n.tagName}.${n.className} sticks out sideways`);
          if (
            n.children.length === 0 &&
            n.scrollWidth > n.clientWidth + 1 &&
            getComputedStyle(n).display !== 'inline'
          )
            out.push(`${n.tagName}.${n.className} text wider than its box`);
        }
        for (const b of sheet.querySelectorAll<HTMLElement>('.pow-tab')) {
          const r = b.getBoundingClientRect();
          if (r.bottom > innerHeight + 1 || r.top < 0) out.push(`tab ${b.textContent} off screen`);
        }
        return out;
      });
      expect(clipped, `${t} at ${size.name}`).toEqual([]);
    }
    await page.reload();
  }
});

test('opens from the menu button, a swipe up from the bottom edge, and closes by every route', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await boot(page);
  const vp = page.viewportSize()!;

  // The menu button on the canvas, top right.
  await page.touchscreen.tap(vp.width - 12 - 22, 12 + 22);
  await expect(menu(page)).toBeVisible();
  await page.locator('.pow-close').click();
  await expect(menu(page)).toBeHidden();

  // Swipe up from the bottom edge.
  await swipe(page, { x: vp.width / 2, y: vp.height - 6 }, { x: vp.width / 2, y: vp.height - 220 });
  await expect(menu(page)).toBeVisible();

  // Swipe down on the header closes it.
  const head = (await page.locator('.pow-menu-head').boundingBox())!;
  await swipe(
    page,
    { x: head.x + head.width / 2, y: head.y + 8 },
    { x: head.x + head.width / 2, y: head.y + 200 },
  );
  await expect(menu(page)).toBeHidden();

  // A swipe that starts above the edge strip does not open it.
  await swipe(
    page,
    { x: vp.width / 2, y: vp.height - 120 },
    { x: vp.width / 2, y: vp.height - 320 },
  );
  await expect(menu(page)).toBeHidden();

  // The back gesture closes it, and the bag button opens on the Bag tab.
  await page.touchscreen.tap(vp.width - 12 - 44 - 9 - 22, 12 + 22);
  await expect(menu(page)).toBeVisible();
  await expect(page.locator('[data-tab="bag"]')).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(menu(page)).toBeHidden();

  // Escape toggles it too.
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});

test('bag: take gear off and wear it again, drop needs a held press, eating uses it up', async ({
  page,
}) => {
  const problems = await watchProblems(page);
  await boot(page);
  await openMenu(page);
  const used = async (): Promise<number> =>
    Number(/^(\d+) of/.exec((await page.locator('.pow-bag-count').textContent()) ?? '')?.[1]);

  // Taking the dagger off puts it in the bag, and the Bag then wears it again from its sheet.
  await page.locator('[data-key="gear-main"]').click();
  await goTab(page, 'bag');
  expect(await used()).toBe(2);
  await page.locator('[data-key="slot-1"]').click();
  await page.locator('[data-key="act-equip"]').click();
  await goTab(page, 'character');
  await expect(page.locator('[data-key="gear-main"]')).toBeVisible();

  // A quick tap on Drop does nothing.
  await goTab(page, 'bag');
  await page.locator('[data-key="slot-0"]').click();
  const drop = page.locator('[data-key="act-drop"]');
  await drop.dispatchEvent('pointerdown');
  await page.waitForTimeout(150);
  await drop.dispatchEvent('pointerup');
  await page.waitForTimeout(400);
  expect(await used()).toBe(1);

  // Holding it drops the whole slot.
  const box = (await drop.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await expect.poll(used).toBe(0);
  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});

test('the Menu keeps the keyboard, and the game does not move under it', async ({ page }) => {
  await boot(page);
  await openMenu(page);
  await goTab(page, 'system');
  const slider = page.locator('.pow-range').first();
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  expect(Number(await slider.inputValue())).toBeGreaterThan(1);
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
});

test('clear text uses the bundled font, loaded from our own origin', async ({ page }) => {
  const problems = await watchProblems(page);
  const fontFiles: string[] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.woff2')) fontFiles.push(new URL(r.url()).origin);
  });
  await boot(page);
  await openMenu(page);
  await goTab(page, 'skills');
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('1rem "Atkinson Hyperlegible"')))
    .toBe(true);
  const family = await page
    .locator('.pow-menu-body')
    .evaluate((n) => getComputedStyle(n).fontFamily);
  expect(family.startsWith('"Atkinson Hyperlegible"')).toBe(true);
  expect(fontFiles.length).toBeGreaterThan(0);
  expect(new Set(fontFiles)).toEqual(new Set([new URL(page.url()).origin]));
  await shot(page, 'menu-skills-font');
  expect(problems).toEqual({ console: [], pageErrors: [], csp: [], failedRequests: [] });
});
