import { describe, expect, it } from 'vitest';
import { computeViewport } from '../../src/render/viewport';
import { Camera } from '../../src/render/camera';

const PHONES: [string, number, number, number][] = [
  ['360x800', 360, 800, 3],
  ['390x844', 390, 844, 3],
  ['412x915', 412, 915, 2.625],
  ['320x568 dpr2', 320, 568, 2],
  ['430x932', 430, 932, 3],
];

describe('viewport fit', () => {
  it.each(PHONES)('portrait %s: integer scale, logical width in 180..239', (_n, w, h, dpr) => {
    const v = computeViewport(w, h, dpr);
    expect(Number.isInteger(v.scale)).toBe(true);
    expect(v.width).toBeGreaterThanOrEqual(180);
    expect(v.width).toBeLessThanOrEqual(239);
    expect(v.physWidth).toBe(v.width * v.scale);
    expect(v.physWidth).toBeLessThanOrEqual(Math.floor(w * dpr));
    expect(Math.floor(w * dpr) - v.physWidth).toBeLessThan(v.scale);
    expect(v.height).toBeGreaterThan(v.width);
  });

  it('landscape phone and desktop extend width and keep height in 180..239', () => {
    for (const [w, h, dpr] of [
      [844, 390, 3],
      [1440, 900, 1],
      [1920, 1080, 1],
    ] as const) {
      const v = computeViewport(w, h, dpr);
      expect(v.portrait).toBe(false);
      expect(v.height).toBeGreaterThanOrEqual(180);
      expect(v.height).toBeLessThanOrEqual(239);
      expect(v.width).toBeGreaterThan(v.height);
      expect(Number.isInteger(v.scale)).toBe(true);
    }
  });

  it('re-fits on rotation without stretching (same scale logic, swapped axes)', () => {
    const a = computeViewport(390, 844, 3);
    const b = computeViewport(844, 390, 3);
    expect(a.scale).toBe(b.scale);
    expect(a.width).toBe(b.height);
  });

  it('safe insets shrink the safe rect and never go negative', () => {
    const v = computeViewport(390, 844, 3, { top: 47, right: 0, bottom: 34, left: 0 });
    expect(v.safe.y).toBeGreaterThan(0);
    expect(v.safe.y + v.safe.h).toBeLessThan(v.height);
    expect(v.safe.x).toBe(0);
    expect(v.safe.w).toBe(v.width);
    const none = computeViewport(390, 844, 3);
    expect(none.safe).toEqual({ x: 0, y: 0, w: none.width, h: none.height });
  });

  it('estimates physical size from CSS px', () => {
    const v = computeViewport(390, 844, 3);
    // 1 logical px = scale/dpr css px = 2 css px = about 0.53 mm.
    expect(v.mmPerLogicalPx).toBeCloseTo((v.scale / 3) * (25.4 / 96), 6);
  });
});

describe('camera', () => {
  it('portrait: target sits in the center of the upper 62%, in whole pixels', () => {
    const cam = new Camera(1000, 1000);
    cam.setView(195, 422, true);
    cam.follow(500, 500, 16);
    expect(cam.x).toBe(500 - 97);
    expect(500 - cam.y).toBe(Math.floor((422 * 0.62) / 2));
    expect(Number.isInteger(cam.x) && Number.isInteger(cam.y)).toBe(true);
  });

  it('clamps to world bounds and centers a world smaller than the view', () => {
    const cam = new Camera(1000, 1000);
    cam.setView(200, 400, true);
    cam.follow(0, 0, 16);
    expect([cam.x, cam.y]).toEqual([0, 0]);
    cam.follow(5000, 5000, 16);
    expect([cam.x, cam.y]).toEqual([800, 600]);
    const small = new Camera(100, 100);
    small.setView(200, 400, true);
    small.follow(50, 50, 16);
    expect(small.x).toBe(-50);
  });

  it('smoothing eases in whole pixels and settles exactly without oscillation', () => {
    const cam = new Camera(2000, 2000, 100);
    cam.setView(200, 400, false);
    cam.follow(500, 500, 16);
    cam.follow(600, 500, 16);
    expect(cam.x).toBeGreaterThan(400);
    expect(cam.x).toBeLessThan(500);
    for (let i = 0; i < 200; i++) {
      cam.follow(600, 500, 16);
      expect(Number.isInteger(cam.x)).toBe(true);
    }
    expect(cam.x).toBe(600 - 100);
  });
});
