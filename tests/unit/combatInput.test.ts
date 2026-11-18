import { describe, expect, it } from 'vitest';
import { emptyRecord, type InputRecord } from '../../src/platform/input/actions';
import { computeLayout, buttonAt } from '../../src/platform/input/layout';
import { CommandMapper, InputSampler } from '../../src/platform/input/sampler';
import { TouchController } from '../../src/platform/input/touch';
import { validateCommand } from '../../src/sim/kernel/commands';

const rec = (patch: Partial<InputRecord>): InputRecord => ({ ...emptyRecord(), ...patch });

describe('CommandMapper', () => {
  it('maps attack, dodge and a world tap to lock', () => {
    const m = new CommandMapper((p) => ({ x: p.x / 2, y: p.y / 2 }));
    const out = m.map(rec({ attack: true, dodge: { dir: 2 }, targetTap: { x: 100, y: 60 } }));
    expect(out).toEqual([
      { type: 'attack' },
      { type: 'dodge', dir: 2 },
      { type: 'lock', x: 50, y: 30 },
    ]);
  });

  it('maps the context button to interact', () => {
    expect(new CommandMapper().map(rec({ context: true }))).toEqual([{ type: 'interact' }]);
  });

  it('a tap that is not on the world sends no lock', () => {
    const m = new CommandMapper(() => null);
    expect(m.map(rec({ targetTap: { x: 1, y: 1 } }))).toEqual([]);
  });

  it('a quick tap on a technique button presses; holding aims and release fires', () => {
    const m = new CommandMapper();
    expect(m.map(rec({ technique: [true, false, false, false] }))).toEqual([
      { type: 'technique', slot: 0, phase: 'press', aim: null },
    ]);
    const hold = rec({ techniqueHeld: [false, true, false, false], moveDir: 2 });
    expect(m.map(hold)).toEqual([
      { type: 'move', dir: 2 },
      { type: 'technique', slot: 1, phase: 'aim', aim: 2 },
    ]);
    expect(m.map(hold)).toEqual([]);
    expect(m.map(rec({ moveDir: 2 }))).toEqual([
      { type: 'technique', slot: 1, phase: 'release', aim: 2 },
    ]);
  });

  it('a keyboard key (press and hold on the same sample) aims, it does not also fire on press', () => {
    const m = new CommandMapper();
    const down = rec({
      technique: [false, true, false, false],
      techniqueHeld: [false, true, false, false],
    });
    expect(m.map(down)).toEqual([{ type: 'technique', slot: 1, phase: 'aim', aim: null }]);
    expect(m.map(rec({}))).toEqual([{ type: 'technique', slot: 1, phase: 'release', aim: null }]);
  });

  it('every command it can produce passes validation', () => {
    const m = new CommandMapper(() => ({ x: 10, y: 10 }));
    const cmds = m.map(
      rec({
        moveDir: 3,
        full: true,
        attack: true,
        dodge: { dir: null },
        targetTap: { x: 1, y: 1 },
        technique: [true, false, false, false],
      }),
    );
    for (const c of cmds) expect(validateCommand(c).ok).toBe(true);
  });
});

describe('attack input', () => {
  it('keyboard J and the gamepad trigger press attack', () => {
    const s = new InputSampler(new TouchController(computeLayout(360, 800, false)));
    s.keyboard.keyDown('KeyJ');
    expect(s.sample(0).attack).toBe(true);
    expect(s.sample(1).attack).toBe(false);
  });

  it('Classic has an attack button under the thumb and moves context beside it; Flow has none', () => {
    const flow = computeLayout(360, 800, false, { scheme: 'flow' });
    const classic = computeLayout(360, 800, false, { scheme: 'classic' });
    expect(flow.buttons.attack).toBeUndefined();
    const c = classic.buttons.attack!;
    expect(buttonAt(classic, { x: c.x + 2, y: c.y + 2 })).toBe('attack');
    expect(c.w).toBeGreaterThanOrEqual(44);
    expect(classic.buttons.context.x).toBeLessThan(c.x);
    expect(classic.buttons.context.w).toBeGreaterThanOrEqual(44);
  });
});

describe('command validation for combat', () => {
  it('accepts well formed combat commands and rejects malformed ones', () => {
    expect(validateCommand({ type: 'attack' }).ok).toBe(true);
    expect(validateCommand({ type: 'dodge', dir: 4 }).ok).toBe(true);
    expect(validateCommand({ type: 'dodge', dir: 9 }).ok).toBe(false);
    expect(validateCommand({ type: 'lock', x: 10, y: -4 }).ok).toBe(true);
    expect(validateCommand({ type: 'lock', x: 1.5, y: 0 }).ok).toBe(false);
    expect(validateCommand({ type: 'lock', x: 1e12, y: 0 }).ok).toBe(false);
    expect(validateCommand({ type: 'technique', slot: 3, phase: 'release', aim: null }).ok).toBe(
      true,
    );
    expect(validateCommand({ type: 'technique', slot: 4, phase: 'press', aim: null }).ok).toBe(
      false,
    );
    expect(validateCommand({ type: 'technique', slot: 0, phase: 'hold', aim: null }).ok).toBe(
      false,
    );
    expect(validateCommand({ type: 'scheme', scheme: 'classic' }).ok).toBe(true);
    expect(validateCommand({ type: 'scheme', scheme: 'auto' }).ok).toBe(false);
  });
});

describe('Guard button', () => {
  it('exists only with a shield, beside dodge, and overlaps no other button in Classic', () => {
    for (const [w, h] of [
      [360, 800],
      [915, 412],
    ] as const) {
      expect(computeLayout(w, h, false, { scheme: 'flow' }).buttons.guard).toBeUndefined();
      for (const scheme of ['flow', 'classic'] as const) {
        const l = computeLayout(w, h, false, { scheme, guard: true });
        const g = l.buttons.guard!;
        expect(g.w).toBeGreaterThanOrEqual(44);
        for (const [id, r] of Object.entries(l.buttons)) {
          if (id === 'guard' || id === 'menu' || id === 'bag') continue;
          const ox = Math.max(0, Math.min(g.x + g.w, r.x + r.w) - Math.max(g.x, r.x));
          const oy = Math.max(0, Math.min(g.y + g.h, r.y + r.h) - Math.max(g.y, r.y));
          // Flow's one neighbour, technique 3, is clipped by a few percent. Classic has none.
          const share = (ox * oy) / (g.w * g.h);
          expect(share, `${scheme} ${w}x${h} ${id}`).toBeLessThan(
            scheme === 'classic' ? 0.001 : 0.1,
          );
        }
        // Mirrored for the left hand.
        const m = computeLayout(w, h, true, { scheme, guard: true }).buttons.guard!;
        expect(m.x).toBeCloseTo(w - g.x - g.w);
        expect(m.y).toBe(g.y);
        expect(buttonAt(l, { x: g.x + 3, y: g.y + 3 })).toBe('guard');
      }
    }
  });

  it('touch reports a finger on Guard at once, with no hold delay', () => {
    const l = computeLayout(360, 800, false, { guard: true });
    const g = l.buttons.guard!;
    const t = new TouchController(l);
    t.down(1, g.x + 5, g.y + 5, 0);
    expect(t.sample(1).buttonsDown.has('guard')).toBe(true);
    t.up(1, g.x + 5, g.y + 5, 50);
    expect(t.sample(60).buttonsDown.has('guard')).toBe(false);
  });

  it('hold mode keeps the guard up while the finger is down, and lowers it on release', () => {
    const m = new CommandMapper();
    m.guardToggle = false;
    expect(m.map(rec({ guardTouch: true }))).toEqual([{ type: 'guard', on: true }]);
    expect(m.map(rec({ guardTouch: true }))).toEqual([]);
    expect(m.map(rec({ guardTouch: false }))).toEqual([{ type: 'guard', on: false }]);
  });

  it('toggle mode raises on one tap and lowers on the next, so a thumb is free to move', () => {
    const m = new CommandMapper();
    m.guardToggle = true;
    expect(m.map(rec({ guardTouch: true }))).toEqual([{ type: 'guard', on: true }]);
    // The finger lifts: the guard stays up, and the stick can be used.
    expect(m.map(rec({ guardTouch: false, move: { x: 1, y: 0 }, moveDir: 2 }))).toEqual([
      { type: 'move', dir: 2 },
    ]);
    expect(m.map(rec({ guardTouch: true, moveDir: 2 }))).toEqual([{ type: 'guard', on: false }]);
  });

  it('a toggled guard the sim dropped is down in the mapper too', () => {
    const m = new CommandMapper();
    m.guardToggle = true;
    m.map(rec({ guardTouch: true }));
    m.map(rec({}));
    m.syncGuard(false);
    // The next tap raises it again instead of lowering what is already down.
    expect(m.map(rec({ guardTouch: true }))).toEqual([{ type: 'guard', on: true }]);
  });

  it('the guard key and the pad always hold, whatever the touch setting', () => {
    const m = new CommandMapper();
    m.guardToggle = true;
    expect(m.map(rec({ guardHeld: true }))).toEqual([{ type: 'guard', on: true }]);
    expect(m.map(rec({ guardHeld: false }))).toEqual([{ type: 'guard', on: false }]);
  });

  it('the sampler reads the guard key', () => {
    const s = new InputSampler(new TouchController(computeLayout(360, 800, false)));
    s.keyboard.keyDown('KeyK');
    expect(s.sample(0).guardHeld).toBe(true);
    s.keyboard.keyUp('KeyK');
    expect(s.sample(1).guardHeld).toBe(false);
  });

  it('validates the guard command', () => {
    expect(validateCommand({ type: 'guard', on: true }).ok).toBe(true);
    expect(validateCommand({ type: 'guard', on: 1 }).ok).toBe(false);
    expect(validateCommand({ type: 'guard' }).ok).toBe(false);
  });
});
