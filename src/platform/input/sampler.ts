import { INPUT_TUNABLES } from '../../content/balance/input';
import type { Command } from '../../sim/kernel/commands';
import { emptyRecord, quantizeDir, type ButtonId, type InputRecord } from './actions';
import { GamepadState, type PadSnapshot } from './gamepad';
import { KeyboardState } from './keyboard';
import { TouchController } from './touch';

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
    r.context = pressed.has('context');
    r.menu = pressed.has('menu');
    r.bag = pressed.has('bag');
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
 */
export function toCommands(record: InputRecord, prevDir: number | null): Command[] {
  if (record.moveDir === prevDir) return [];
  return [{ type: 'move', dir: record.moveDir }];
}
