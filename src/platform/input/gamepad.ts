import { INPUT_TUNABLES } from '../../content/balance/input';
import type { ButtonId } from './actions';

/** The slice of the Gamepad API we read. Lets tests pass plain objects. */
export interface PadSnapshot {
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
}

/** Standard-mapping button indices to our buttons. */
const PAD_BUTTONS: readonly [number, ButtonId][] = [
  [0, 'dodge'], // A / cross
  [2, 'tech1'], // X
  [3, 'tech2'], // Y
  [1, 'tech3'], // B
  [5, 'tech4'], // right bumper
  [7, 'attack'], // right trigger
  [6, 'guard'], // left trigger
  [4, 'context'], // left bumper
  [9, 'menu'], // start
  [8, 'bag'], // select
];

/** Radial dead zone with rescale so output starts at 0 at the edge of the dead zone. */
export function applyDeadZone(x: number, y: number, dead: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len <= dead) return { x: 0, y: 0 };
  const mag = Math.min(1, (len - dead) / (1 - dead));
  return { x: (x / len) * mag, y: (y / len) * mag };
}

/** Gamepad source with edge detection between samples. */
export class GamepadState {
  private prev = new Set<ButtonId>();

  /** Reads one snapshot. Returns the move vector, newly pressed buttons, and held buttons. */
  read(pad: PadSnapshot | null): {
    move: { x: number; y: number };
    pressed: ButtonId[];
    held: Set<ButtonId>;
  } {
    const held = new Set<ButtonId>();
    let move = { x: 0, y: 0 };
    if (pad) {
      move = applyDeadZone(pad.axes[0] ?? 0, pad.axes[1] ?? 0, INPUT_TUNABLES.gamepadDeadZone);
      for (const [i, id] of PAD_BUTTONS) if (pad.buttons[i]?.pressed) held.add(id);
      // D-pad overrides a resting stick.
      const dx = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      const dy = (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
      if ((dx !== 0 || dy !== 0) && move.x === 0 && move.y === 0) {
        const len = Math.hypot(dx, dy);
        move = { x: dx / len, y: dy / len };
      }
    }
    const pressed = [...held].filter((b) => !this.prev.has(b));
    this.prev = held;
    return { move, pressed, held };
  }
}
