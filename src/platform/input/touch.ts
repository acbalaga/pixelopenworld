import { INPUT_TUNABLES, type InputTunables } from '../../content/balance/input';
import { quantizeDir, type ButtonId, type ScreenPoint } from './actions';
import { buttonAt, inRect, type ControlLayout } from './layout';
import type { Direction } from '../../sim/kernel/fixed';

/** Gesture outputs gathered between samples. */
export interface TouchOutput {
  move: { x: number; y: number };
  buttonsPressed: ButtonId[];
  buttonsHeld: ReadonlySet<ButtonId>;
  /** Buttons with a finger on them now, without the hold delay. Guard reads this. */
  buttonsDown: ReadonlySet<ButtonId>;
  dodge: { dir: Direction | null } | null;
  targetTap: ScreenPoint | null;
  longPress: ScreenPoint | null;
}

interface Pointer {
  id: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  t0: number;
  button: ButtonId | null;
  /** Owns the floating stick. */
  stick: boolean;
  moved: boolean;
  holdFired: boolean;
}

/**
 * Pure touch gesture recognizer. Feed it pointer events with timestamps in ms, call `sample(now)`
 * once per tick. No DOM access, so it is unit tested with synthetic sequences.
 */
export class TouchController {
  private pointers = new Map<number, Pointer>();
  private stickPointer: number | null = null;
  private coastVec: { x: number; y: number } | null = null;
  private coastUntil = 0;
  private pressed: ButtonId[] = [];
  private dodge: { dir: Direction | null } | null = null;
  private tap: ScreenPoint | null = null;
  private long: ScreenPoint | null = null;

  constructor(
    private layout: ControlLayout,
    private readonly tun: InputTunables = INPUT_TUNABLES,
  ) {}

  /** Replace the layout after a resize or handedness change. */
  setLayout(layout: ControlLayout): void {
    this.layout = layout;
  }

  down(id: number, x: number, y: number, t: number): void {
    const p: Pointer = {
      id,
      startX: x,
      startY: y,
      x,
      y,
      t0: t,
      button: buttonAt(this.layout, { x, y }),
      stick: false,
      moved: false,
      holdFired: false,
    };
    if (!p.button && this.stickPointer === null && inRect(this.layout.stickZone, { x, y })) {
      p.stick = true;
      this.stickPointer = id;
      this.coastVec = null;
    }
    this.pointers.set(id, p);
  }

  move(id: number, x: number, y: number): void {
    const p = this.pointers.get(id);
    if (!p) return;
    p.x = x;
    p.y = y;
    if (Math.hypot(x - p.startX, y - p.startY) > this.tun.tapMaxDistPx) p.moved = true;
  }

  up(id: number, x: number, y: number, t: number): void {
    const p = this.pointers.get(id);
    if (!p) return;
    this.move(id, x, y);
    this.pointers.delete(id);
    const dx = x - p.startX;
    const dy = y - p.startY;
    const dist = Math.hypot(dx, dy);
    const dur = t - p.t0;

    if (p.stick) {
      this.stickPointer = null;
      const v = this.stickVector(p);
      if (v.x !== 0 || v.y !== 0) {
        this.coastVec = v;
        this.coastUntil = t + this.tun.coastMs;
      }
    }

    if (p.button) {
      const stillOn = buttonAt(this.layout, { x, y }) === p.button;
      if (stillOn && !p.holdFired && dur <= this.tun.tapMaxMs) this.pressed.push(p.button);
      return;
    }

    if (
      this.tun.flickDodge &&
      dist >= this.tun.flickMinDistPx &&
      dist <= this.tun.flickMaxDistPx &&
      dur <= this.tun.flickMaxMs
    ) {
      this.dodge = { dir: quantizeDir(dx, dy, 1) };
      this.coastVec = null;
      return;
    }
    if (!p.moved && dur <= this.tun.tapMaxMs && !p.holdFired) {
      this.tap = { x, y };
    }
  }

  cancel(id: number): void {
    const p = this.pointers.get(id);
    if (p?.stick) this.stickPointer = null;
    this.pointers.delete(id);
  }

  private stickVector(p: Pointer): { x: number; y: number } {
    const dx = p.x - p.startX;
    const dy = p.y - p.startY;
    const len = Math.hypot(dx, dy);
    if (len <= this.tun.stickDeadZonePx) return { x: 0, y: 0 };
    const mag = Math.min(
      1,
      (len - this.tun.stickDeadZonePx) / (this.tun.stickMaxRadiusPx - this.tun.stickDeadZonePx),
    );
    return { x: (dx / len) * mag, y: (dy / len) * mag };
  }

  /** Where the floating stick base is drawn, or null when no stick is active. */
  stickBase(): { origin: ScreenPoint; thumb: ScreenPoint } | null {
    if (this.stickPointer === null) return null;
    const p = this.pointers.get(this.stickPointer);
    return p ? { origin: { x: p.startX, y: p.startY }, thumb: { x: p.x, y: p.y } } : null;
  }

  /** Reads and clears edge events. Holds are evaluated against `now`. */
  sample(now: number): TouchOutput {
    const held = new Set<ButtonId>();
    const down = new Set<ButtonId>();
    for (const p of this.pointers.values()) {
      if (p.button) down.add(p.button);
      if (!p.moved && !p.holdFired && now - p.t0 >= this.tun.holdMs) {
        p.holdFired = true;
        if (!p.button) this.long = { x: p.x, y: p.y };
      }
      if (p.button && p.holdFired) held.add(p.button);
    }

    let move = { x: 0, y: 0 };
    if (this.stickPointer !== null) {
      const p = this.pointers.get(this.stickPointer);
      if (p) move = this.stickVector(p);
    } else if (this.coastVec && now < this.coastUntil) {
      move = this.coastVec;
    } else {
      this.coastVec = null;
    }

    const out: TouchOutput = {
      move,
      buttonsPressed: this.pressed,
      buttonsHeld: held,
      buttonsDown: down,
      dodge: this.dodge,
      targetTap: this.tap,
      longPress: this.long,
    };
    this.pressed = [];
    this.dodge = null;
    this.tap = null;
    this.long = null;
    return out;
  }
}
