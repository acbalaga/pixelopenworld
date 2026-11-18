import { describe, expect, it } from 'vitest';
import { UI_BALANCE } from '../../src/content/balance/ui';
import { CRAFTING } from '../../src/content/balance/crafting';
import { gradeTrace } from '../../src/sim/crafting';
import { meterRect, stepPoint, type MeterViewport } from '../../src/render/actionMeter';
import { DOLL_ANIMS, DOLL_FRAMES, WORK_ANIMS } from '../../src/content/dolls/parts';
import { NODES } from '../../src/content/items/recipes';
import { STATIONS } from '../../src/content/items/stations';

const vp = (w: number, h = 400): MeterViewport => ({
  safe: { x: 0, y: 0, w, h },
  topLimit: 30,
  zoneTop: 250,
});
const at = (x: number, feetY: number): { x: number; headY: number; feetY: number } => ({
  x,
  headY: feetY - UI_BALANCE.meter.headDy,
  feetY,
});
const b = UI_BALANCE.meter;

describe('meterRect', () => {
  it('sits centered above the head with the gap', () => {
    const r = meterRect(at(180, 200), vp(360), 'track');
    expect(r.w).toBe(b.trackW);
    expect(r.x + r.w / 2).toBe(180);
    expect(r.y + r.h + b.tailPx).toBe(200 - b.headDy - b.gapPx);
    expect(r.w).toBeGreaterThanOrEqual(72);
    expect(r.h).toBeGreaterThanOrEqual(7);
  });

  it('flips below the feet near the top edge', () => {
    const r = meterRect(at(180, 60), vp(360), 'track');
    expect(r.y).toBe(60 + b.flipMarginPx);
  });

  it('clamps at both side edges, 4 px inside the safe area', () => {
    expect(meterRect(at(0, 200), vp(360), 'track').x).toBe(4);
    const right = meterRect(at(360, 200), vp(360), 'track');
    expect(right.x + right.w).toBe(360 - 4);
  });

  it('never enters the thumb zone, even flipped with the avatar low on the screen', () => {
    for (const kind of ['track', 'panel'] as const)
      for (const feet of [40, 120, 200, 240, 300]) {
        const r = meterRect(at(180, feet), vp(360), kind);
        const bottom = r.y + r.h + b.tailPx;
        expect(bottom, `${kind} ${feet}`).toBeLessThanOrEqual(250);
      }
  });

  it('fits a panel up to 120 px and a track at 180 and 239 px logical width', () => {
    for (const w of [180, 239]) {
      const t = meterRect(at(w / 2, 200), vp(w), 'track');
      const p = meterRect(at(w / 2, 200), vp(w), 'panel');
      expect(t.x).toBeGreaterThanOrEqual(4);
      expect(t.x + t.w).toBeLessThanOrEqual(w - 4);
      expect(p.w).toBe(b.panelMax);
      expect(p.h).toBe(p.w);
      expect(p.x).toBeGreaterThanOrEqual(4);
      expect(p.x + p.w).toBeLessThanOrEqual(w - 4);
    }
  });

  it('shrinks a panel to fit a phone view and keeps the avatar visible', () => {
    // 360 x 800 phone: 180 x 400 logical, feet at 135, thumb zone from 248, status row to 30.
    const a = at(90, 135);
    const p = meterRect(
      a,
      { safe: { x: 0, y: 0, w: 180, h: 400 }, topLimit: 30, zoneTop: 248 },
      'panel',
    );
    expect(p.w).toBeLessThan(b.panelMax);
    expect(p.w).toBeGreaterThanOrEqual(b.panelMin);
    expect(p.y + p.h + b.tailPx).toBeLessThanOrEqual(248);
    // Clear of the avatar (feet up to head), above or below it.
    const clear = p.y >= a.feetY || p.y + p.h + b.tailPx <= a.headY;
    expect(clear).toBe(true);
  });

  it('shrinks a panel to the room when the screen is narrower than it', () => {
    const p = meterRect(at(60, 200), vp(100), 'panel');
    expect(p.w).toBe(92);
  });
});

describe('trace input and drawing share one rect', () => {
  const path = CRAFTING.paths.tailoring as readonly [number, number][];
  const k = 2.5;
  const rect = meterRect(at(180, 220), vp(360), 'panel');

  it('a pointer at the rect center is the center of the 1000 by 1000 space', () => {
    const c = stepPoint({ x: (rect.x + rect.w / 2) / k, y: (rect.y + rect.h / 2) / k }, rect, k);
    expect(c.x).toBeCloseTo(500, 6);
    expect(c.y).toBeCloseTo(500, 6);
  });

  it('pointer samples drawn along the path grade the same as the path itself', () => {
    const direct: number[] = [];
    const viaPointer: number[] = [];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1] as [number, number];
      const c = path[i] as [number, number];
      for (let j = 0; j < 12; j++) {
        const x = a[0] + ((c[0] - a[0]) * j) / 12;
        const y = a[1] + ((c[1] - a[1]) * j) / 12;
        direct.push(x, y);
        // The pointer sits on the screen where the drawing puts that point.
        const css = {
          x: (rect.x + (x / 1000) * rect.w) / k,
          y: (rect.y + (y / 1000) * rect.h) / k,
        };
        const p = stepPoint(css, rect, k);
        viaPointer.push(p.x, p.y);
      }
    }
    expect(gradeTrace(path, viaPointer)).toBe(gradeTrace(path, direct));
    expect(gradeTrace(path, viaPointer)).toBeGreaterThan(0);
  });
});

describe('work animations', () => {
  it('every work anim has four frames in all four facings', () => {
    for (const w of WORK_ANIMS)
      for (const f of ['down', 'up', 'left', 'right'])
        expect(DOLL_ANIMS[`${w}_${f}`]?.frames, `${w}_${f}`).toHaveLength(4);
    expect(DOLL_ANIMS.work_swing_left?.flipX).toBe(true);
    for (const w of WORK_ANIMS) expect(DOLL_FRAMES).toContain(`${w}_down_3`);
  });

  it('every node and station names a work anim that exists', () => {
    for (const n of Object.values(NODES)) expect(WORK_ANIMS, n.id).toContain(n.workAnim);
    for (const s of Object.values(STATIONS)) expect(WORK_ANIMS, s.kind).toContain(s.workAnim);
  });
});
