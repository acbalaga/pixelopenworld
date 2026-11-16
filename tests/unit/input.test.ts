import { describe, expect, it } from 'vitest';
import { INPUT_TUNABLES as T } from '../../src/content/balance/input';
import { TouchController } from '../../src/platform/input/touch';
import { computeLayout, buttonAt } from '../../src/platform/input/layout';
import { quantizeDir } from '../../src/platform/input/actions';
import { InputSampler, toCommands } from '../../src/platform/input/sampler';
import { applyDeadZone } from '../../src/platform/input/gamepad';
import { Dir } from '../../src/sim/kernel/fixed';

const W = 360;
const H = 800;
const layout = () => computeLayout(W, H, false);
const mk = () => new TouchController(layout());

describe('touch stick', () => {
  it('drag right gives a rightward vector that scales with distance and caps at 1', () => {
    const t = mk();
    t.down(1, 100, 600, 0);
    t.move(1, 100 + T.stickDeadZonePx / 2, 600);
    expect(t.sample(10).move).toEqual({ x: 0, y: 0 });
    t.move(1, 100 + 30, 600);
    const mid = t.sample(20).move;
    expect(mid.x).toBeGreaterThan(0.2);
    expect(mid.x).toBeLessThan(0.8);
    expect(mid.y).toBeCloseTo(0);
    t.move(1, 100 + 300, 600);
    expect(Math.hypot(t.sample(30).move.x, t.sample(30).move.y)).toBeCloseTo(1);
  });

  it('does not start a stick above the lower zone', () => {
    const t = mk();
    t.down(1, 100, 100, 0);
    t.move(1, 200, 100);
    expect(t.sample(50).move).toEqual({ x: 0, y: 0 });
  });

  it('coasts for exactly the coast window after the thumb lifts', () => {
    const t = mk();
    t.down(1, 100, 600, 0);
    t.move(1, 160, 600);
    t.sample(500);
    t.up(1, 160, 600, 1000);
    expect(t.sample(1000 + T.coastMs - 1).move.x).toBeGreaterThan(0.5);
    expect(t.sample(1000 + T.coastMs).move).toEqual({ x: 0, y: 0 });
  });
});

describe('flick, tap, hold', () => {
  it('a fast short swipe is a flick with the right direction', () => {
    const t = mk();
    t.down(1, 100, 600, 0);
    t.move(1, 100, 560);
    t.up(1, 100, 560, 100);
    const s = t.sample(110);
    expect(s.dodge).toEqual({ dir: Dir.N });
    expect(s.targetTap).toBeNull();
  });

  it('a slow drag of the same distance is not a flick', () => {
    const t = mk();
    t.down(1, 100, 600, 0);
    t.move(1, 100, 560);
    t.up(1, 100, 560, T.flickMaxMs + 200);
    expect(t.sample(1000).dodge).toBeNull();
  });

  it('a flick is detected in all of four sample directions', () => {
    const cases: [number, number, number][] = [
      [40, 0, Dir.E],
      [0, 40, Dir.S],
      [-40, 0, Dir.W],
      [30, -30, Dir.NE],
    ];
    for (const [dx, dy, dir] of cases) {
      const t = mk();
      t.down(1, 180, 600, 0);
      t.up(1, 180 + dx, 600 + dy, 90);
      expect(t.sample(100).dodge).toEqual({ dir });
    }
  });

  it('a short still touch on open ground is a target tap', () => {
    const t = mk();
    t.down(1, 150, 650, 0);
    t.up(1, 151, 650, 80);
    expect(t.sample(90).targetTap).toEqual({ x: 151, y: 650 });
  });

  it('a tap on a button region fires that button, once', () => {
    const l = layout();
    const r = l.buttons.tech2;
    const t = new TouchController(l);
    t.down(1, r.x + r.w / 2, r.y + r.h / 2, 0);
    t.up(1, r.x + r.w / 2, r.y + r.h / 2, 60);
    const s = t.sample(70);
    expect(s.buttonsPressed).toEqual(['tech2']);
    expect(s.targetTap).toBeNull();
    expect(t.sample(80).buttonsPressed).toEqual([]);
  });

  it('holding a button reports held, and does not fire a press on release', () => {
    const l = layout();
    const r = l.buttons.tech1;
    const c = { x: r.x + 5, y: r.y + 5 };
    const t = new TouchController(l);
    t.down(1, c.x, c.y, 0);
    expect(t.sample(T.holdMs - 1).buttonsHeld.has('tech1')).toBe(false);
    expect(t.sample(T.holdMs).buttonsHeld.has('tech1')).toBe(true);
    t.up(1, c.x, c.y, 900);
    expect(t.sample(910).buttonsPressed).toEqual([]);
  });

  it('a still hold on open ground is a long press, not a tap', () => {
    const t = mk();
    t.down(1, 150, 150, 0);
    expect(t.sample(T.holdMs).longPress).toEqual({ x: 150, y: 150 });
    t.up(1, 150, 150, 700);
    expect(t.sample(710).targetTap).toBeNull();
  });
});

describe('layout', () => {
  it('every button is at least the minimum target, on small phones too', () => {
    for (const [w, h] of [
      [320, 568],
      [360, 800],
      [844, 390],
    ] as const) {
      for (const left of [false, true]) {
        const l = computeLayout(w, h, left);
        for (const r of Object.values(l.buttons)) {
          expect(r.w).toBeGreaterThanOrEqual(T.minTargetPx);
          expect(r.h).toBeGreaterThanOrEqual(T.minTargetPx);
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(w);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.y + r.h).toBeLessThanOrEqual(h);
        }
      }
    }
  });

  it('left-handed mirrors every button horizontally', () => {
    const a = computeLayout(360, 800, false);
    const b = computeLayout(360, 800, true);
    for (const id of Object.keys(a.buttons) as (keyof typeof a.buttons)[]) {
      expect(b.buttons[id].x).toBe(360 - a.buttons[id].x - a.buttons[id].w);
      expect(b.buttons[id].y).toBe(a.buttons[id].y);
    }
    const r = a.buttons.context;
    expect(buttonAt(a, { x: r.x + 1, y: r.y + 1 })).toBe('context');
  });
});

describe('sources share one action layer', () => {
  const sampler = () => new InputSampler(mk(), () => pad.current);
  const pad: { current: { axes: number[]; buttons: { pressed: boolean }[] } | null } = {
    current: null,
  };

  it('keyboard WASD and arrows give 8-way directions and normalized diagonals', () => {
    const s = sampler();
    s.keyboard.keyDown('KeyD');
    expect(s.sample(0).moveDir).toBe(Dir.E);
    s.keyboard.keyDown('KeyW');
    const r = s.sample(1);
    expect(r.moveDir).toBe(Dir.NE);
    expect(Math.hypot(r.move.x, r.move.y)).toBeCloseTo(1);
    s.keyboard.keyUp('KeyD');
    s.keyboard.keyUp('KeyW');
    s.keyboard.keyDown('ArrowLeft');
    expect(s.sample(2).moveDir).toBe(Dir.W);
  });

  it('keyboard buttons are edge-triggered and map to the same actions', () => {
    const s = sampler();
    s.keyboard.keyDown('Digit3');
    s.keyboard.keyDown('KeyE');
    s.keyboard.keyDown('Escape');
    const r = s.sample(0);
    expect(r.technique).toEqual([false, false, true, false]);
    expect(r.context).toBe(true);
    expect(r.menu).toBe(true);
    s.keyboard.keyDown('Digit3'); // auto-repeat while held
    expect(s.sample(1).technique[2]).toBe(false);
    expect(s.sample(2).techniqueHeld[2]).toBe(true);
  });

  it('space dodges toward the current heading', () => {
    const s = sampler();
    s.keyboard.keyDown('KeyS');
    s.keyboard.keyDown('Space');
    expect(s.sample(0).dodge).toEqual({ dir: Dir.S });
  });

  it('gamepad stick moves through the same record, with a dead zone', () => {
    const s = sampler();
    pad.current = { axes: [0.1, 0.1], buttons: [] };
    expect(s.sample(0).moveDir).toBeNull();
    pad.current = { axes: [1, 0], buttons: [{ pressed: true }] };
    const r = s.sample(1);
    expect(r.moveDir).toBe(Dir.E);
    expect(r.dodge).toEqual({ dir: Dir.E });
    expect(s.sample(2).dodge).toBeNull();
    pad.current = null;
  });

  it('every source produces the same sim command', () => {
    const k = sampler();
    k.keyboard.keyDown('KeyD');
    pad.current = { axes: [0.9, 0], buttons: [] };
    const g = sampler();
    const t = mk();
    t.down(1, 100, 600, 0);
    t.move(1, 180, 600);
    const ts = new InputSampler(t);
    pad.current = null;
    const kr = k.sample(0);
    const tr = ts.sample(10);
    expect(toCommands(kr, null)).toEqual([{ type: 'move', dir: Dir.E }]);
    expect(toCommands(tr, null)).toEqual([{ type: 'move', dir: Dir.E }]);
    expect(toCommands(tr, Dir.E)).toEqual([]);
    expect(g).toBeDefined();
  });
});

describe('helpers', () => {
  it('quantizeDir covers all eight sectors and the idle threshold', () => {
    expect(quantizeDir(0, -1, 0.3)).toBe(Dir.N);
    expect(quantizeDir(1, 1, 0.3)).toBe(Dir.SE);
    expect(quantizeDir(-1, 0, 0.3)).toBe(Dir.W);
    expect(quantizeDir(-1, -1, 0.3)).toBe(Dir.NW);
    expect(quantizeDir(0.1, 0.1, 0.3)).toBeNull();
  });
  it('applyDeadZone rescales', () => {
    expect(applyDeadZone(0.2, 0, 0.25)).toEqual({ x: 0, y: 0 });
    expect(applyDeadZone(1, 0, 0.25).x).toBeCloseTo(1);
  });
});
