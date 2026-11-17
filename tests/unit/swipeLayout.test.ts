import { describe, expect, it } from 'vitest';
import { UI_BALANCE } from '../../src/content/balance/ui';
import { INPUT_TUNABLES } from '../../src/content/balance/input';
import { buttonAt, computeLayout, inRect } from '../../src/platform/input/layout';
import { classifySwipe } from '../../src/platform/input/swipe';
import { SettingsStore } from '../../src/platform/settings';

const M = UI_BALANCE.menu;
const H = 800;

describe('swipe up from the bottom edge', () => {
  const up = (x0: number, y0: number, x1: number, y1: number, ms = 200) =>
    classifySwipe({ x: x0, y: y0, t: 0 }, { x: x1, y: y1, t: ms }, H);
  it('opens from the edge strip with a long, mostly vertical, quick swipe', () => {
    expect(up(180, H - 4, 182, H - 4 - M.swipeMinPx - 10)).toBe('edge-up');
    expect(up(180, H - M.edgePx, 180, H - M.edgePx - M.swipeMinPx)).toBe('edge-up');
  });
  it('does not open from above the strip, when short, slow, or mostly sideways', () => {
    expect(up(180, H - M.edgePx - 5, 180, H - 200)).toBeNull();
    expect(up(180, H - 4, 180, H - 4 - M.swipeMinPx + 10)).toBeNull();
    expect(up(180, H - 4, 180, H - 200, M.swipeMaxMs + 1)).toBeNull();
    expect(up(100, H - 4, 300, H - 4 - M.swipeMinPx - 10)).toBeNull();
  });
  it('respects the bottom safe inset', () => {
    const k = classifySwipe(
      { x: 0, y: H - M.edgePx - 20, t: 0 },
      { x: 0, y: H - 300, t: 100 },
      H,
      20,
    );
    expect(k).toBe('edge-up');
  });
  it('a swipe down is reported for the sheet to close on', () => {
    expect(up(180, 100, 182, 100 + M.swipeMinPx + 5)).toBe('down');
    expect(up(180, 100, 180, 100 + M.swipeMinPx - 5)).toBeNull();
  });
});

describe('controls layout and settings', () => {
  const W = 360;
  const base = (o: Parameters<typeof computeLayout>[3] = {}) => computeLayout(W, H, false, o);

  it('every button is at least the touch minimum, at every setting', () => {
    for (const hudScale of [0.8, 1, 1.5])
      for (const buttonScale of [0.8, 1, 1.5])
        for (const left of [false, true]) {
          const l = computeLayout(W, H, left, { hudScale, buttonScale, scheme: 'classic' });
          for (const r of Object.values(l.buttons))
            if (r) {
              expect(r.w).toBeGreaterThanOrEqual(INPUT_TUNABLES.minTargetPx);
              expect(r.h).toBeGreaterThanOrEqual(INPUT_TUNABLES.minTargetPx);
            }
        }
  });
  it('button size scales the action buttons, and menu and bag keep the minimum', () => {
    const small = base({ buttonScale: 0.8 }).buttons;
    const big = base({ buttonScale: 1.5 }).buttons;
    expect(big.tech1.w).toBeGreaterThan(small.tech1.w);
    expect(big.menu.w).toBe(INPUT_TUNABLES.minTargetPx);
  });
  it('left handed mirrors every button across the screen', () => {
    const r = base().buttons;
    const l = computeLayout(W, H, true, {}).buttons;
    for (const id of ['tech1', 'dodge', 'context', 'menu', 'bag'] as const)
      expect(l[id].x).toBe(W - r[id].x - r[id].w);
  });
  it('menu and bag sit in the top corner and do not overlap each other', () => {
    const { menu, bag } = base().buttons;
    expect(menu.y).toBeLessThan(40);
    expect(bag.x + bag.w).toBeLessThanOrEqual(menu.x);
  });
  it('the stick cannot start in the bottom edge strip', () => {
    const l = base();
    expect(inRect(l.stickZone, { x: 100, y: H - M.edgePx - 6 })).toBe(true);
    expect(inRect(l.stickZone, { x: 100, y: H - M.edgePx + 4 })).toBe(false);
    expect(buttonAt(l, { x: l.buttons.menu.x + 2, y: l.buttons.menu.y + 2 })).toBe('menu');
    const withInset = computeLayout(W, H, false, {
      insets: { top: 0, right: 0, bottom: 20, left: 0 },
    });
    expect(inRect(withInset.stickZone, { x: 100, y: H - M.edgePx - 10 })).toBe(false);
  });
  it('settings clamp the new sliders and notify on change', () => {
    const s = new SettingsStore({ prefersReducedMotion: () => false });
    let n = 0;
    s.subscribe(() => n++);
    s.set({ buttonScale: 9, hudOpacity: -1 });
    expect(s.get().buttonScale).toBe(1.5);
    expect(s.get().hudOpacity).toBe(0.3);
    expect(n).toBe(1);
    s.set({ buttonScale: 1.5 });
    expect(n).toBe(1);
  });
});
