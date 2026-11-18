import { INPUT_TUNABLES } from '../../content/balance/input';
import type { Command } from '../../sim/kernel/commands';
import { emptyRecord, quantizeDir, type ButtonId, type InputRecord } from './actions';
import { GamepadState, type PadSnapshot } from './gamepad';
import { KeyboardState } from './keyboard';
import { TouchController } from './touch';

/** Stick magnitude at or above this counts as full extent (sprint hold). */
const FULL_EXTENT = 0.95;

const TECH: ButtonId[] = ['tech1', 'tech2', 'tech3', 'tech4'];

/** Merges touch, keyboard and gamepad into one {@link InputRecord} per sample. */
export class InputSampler {
  readonly keyboard = new KeyboardState();
  readonly gamepad = new GamepadState();

  constructor(
    readonly touch: TouchController,
    private readonly readPad: () => PadSnapshot | null = () => null,
  ) {}

  /** Call once per sim tick. Clears all edge events. */
  sample(now: number): InputRecord {
    const r = emptyRecord();
    const t = this.touch.sample(now);
    const k = this.keyboard.move();
    const g = this.gamepad.read(this.readPad());

    // Largest-magnitude source wins, so sources never fight or add past 1.
    const sources = [t.move, k, g.move];
    r.move = sources.reduce((best, s) =>
      Math.hypot(s.x, s.y) > Math.hypot(best.x, best.y) ? s : best,
    );
    r.moveDir = quantizeDir(r.move.x, r.move.y, INPUT_TUNABLES.directionThreshold);
    r.full = r.moveDir !== null && r.move !== k && Math.hypot(r.move.x, r.move.y) >= FULL_EXTENT;

    const pressed = new Set<ButtonId>([
      ...t.buttonsPressed,
      ...this.keyboard.takePressed(),
      ...g.pressed,
    ]);
    const held = new Set<ButtonId>([...t.buttonsHeld, ...this.keyboard.held(), ...g.held]);
    TECH.forEach((id, i) => {
      r.technique[i] = pressed.has(id);
      r.techniqueHeld[i] = held.has(id);
    });
    r.attack = pressed.has('attack');
    r.guardTouch = t.buttonsDown.has('guard');
    r.guardHeld = this.keyboard.guardHeld() || g.held.has('guard');
    r.context = pressed.has('context');
    r.menu = pressed.has('menu');
    r.bag = pressed.has('bag');
    r.swap = pressed.has('swap');
    if (t.dodge) r.dodge = t.dodge;
    else if (pressed.has('dodge')) r.dodge = { dir: r.moveDir };
    r.targetTap = t.targetTap;
    r.longPress = t.longPress;
    return r;
  }
}

/**
 * Turns a record into sim commands. The sim never sees DOM events or this record's source.
 * Only commands the sim understands today are produced. Others arrive with their systems.
 * `prevDir` and `prevFull` are what the last tick sent; a command is produced only on change.
 */
export function toCommands(
  record: InputRecord,
  prevDir: number | null,
  prevFull = false,
): Command[] {
  const full = record.full;
  if (record.moveDir === prevDir && full === prevFull) return [];
  return [
    full
      ? { type: 'move', dir: record.moveDir, full: true }
      : { type: 'move', dir: record.moveDir },
  ];
}

/** Where a screen point is in the world, in whole px, or null if it is not on the world. */
export type ScreenToWorld = (p: { x: number; y: number }) => { x: number; y: number } | null;

/**
 * Turns input records into sim commands, keeping the little memory it needs (last move, held
 * technique buttons). One per avatar.
 */
export class CommandMapper {
  private dir: number | null = null;
  private full = false;
  private held = [false, false, false, false];
  private guardUp = false;
  private touchWas = false;
  private toggled = false;
  /** Touch guard: a tap raises it and the next tap lowers it, or it stays up only while held. */
  guardToggle = true;

  constructor(private readonly toWorld: ScreenToWorld = () => null) {}

  /**
   * Tells the mapper whether the sim still has the guard up. A guard the sim dropped (out of
   * Stamina, a guard break) ends a toggle. A held button stays down until it is released.
   */
  syncGuard(simGuard: boolean): void {
    if (!simGuard && this.guardUp && this.guardToggle) {
      this.guardUp = false;
      this.toggled = false;
    }
  }

  /** Commands for one sample. Move first, then actions in a fixed order. */
  map(r: InputRecord): Command[] {
    const out = toCommands(r, this.dir, this.full);
    this.dir = r.moveDir;
    this.full = r.full;
    // Guard. Keys and pad hold it. Touch holds it too, or toggles it with a tap.
    const rise = r.guardTouch && !this.touchWas;
    this.touchWas = r.guardTouch;
    if (this.guardToggle) {
      if (rise) this.toggled = !this.toggled;
    } else {
      this.toggled = false;
    }
    const wantGuard = r.guardHeld || (this.guardToggle ? this.toggled : r.guardTouch);
    if (wantGuard !== this.guardUp) {
      this.guardUp = wantGuard;
      out.push({ type: 'guard', on: wantGuard });
    }
    if (r.attack) out.push({ type: 'attack' });
    if (r.dodge) out.push({ type: 'dodge', dir: r.dodge.dir });
    if (r.context) out.push({ type: 'interact' });
    if (r.swap) out.push({ type: 'loadout' });
    if (r.targetTap) {
      const w = this.toWorld(r.targetTap);
      if (w) out.push({ type: 'lock', x: w.x, y: w.y });
    }
    for (let slot = 0; slot < 4; slot++) {
      const pressed = r.technique[slot] === true;
      const held = r.techniqueHeld[slot] === true;
      const was = this.held[slot] === true;
      // A key gives press and hold on the same sample: that is a hold, so it aims.
      if (held && !was) out.push({ type: 'technique', slot, phase: 'aim', aim: r.moveDir });
      else if (pressed && !held && !was)
        out.push({ type: 'technique', slot, phase: 'press', aim: r.moveDir });
      else if (!held && was)
        out.push({ type: 'technique', slot, phase: 'release', aim: r.moveDir });
      this.held[slot] = held;
    }
    return out;
  }
}
