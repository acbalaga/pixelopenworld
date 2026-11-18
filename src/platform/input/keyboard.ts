import type { ButtonId } from './actions';

/** Keyboard source. Feed it `KeyboardEvent.code` strings. Pure. */
export class KeyboardState {
  private down = new Set<string>();
  private pressed: ButtonId[] = [];

  keyDown(code: string): void {
    if (this.down.has(code)) return;
    this.down.add(code);
    const b = KEY_BUTTONS[code];
    if (b) this.pressed.push(b);
  }

  keyUp(code: string): void {
    this.down.delete(code);
  }

  /** Releases everything, for example on window blur. */
  reset(): void {
    this.down.clear();
  }

  /** Current analog-style move vector (diagonals normalized). */
  move(): { x: number; y: number } {
    const x = (this.any('KeyD', 'ArrowRight') ? 1 : 0) - (this.any('KeyA', 'ArrowLeft') ? 1 : 0);
    const y = (this.any('KeyS', 'ArrowDown') ? 1 : 0) - (this.any('KeyW', 'ArrowUp') ? 1 : 0);
    const len = Math.hypot(x, y);
    return len === 0 ? { x: 0, y: 0 } : { x: x / len, y: y / len };
  }

  /** Buttons pressed since the last call. */
  takePressed(): ButtonId[] {
    const out = this.pressed;
    this.pressed = [];
    return out;
  }

  /** The guard key is down. */
  guardHeld(): boolean {
    return this.down.has('KeyK');
  }

  /** Technique slots currently held. */
  held(): ButtonId[] {
    return (['Digit1', 'Digit2', 'Digit3', 'Digit4'] as const)
      .filter((k) => this.down.has(k))
      .map((k) => KEY_BUTTONS[k] as ButtonId);
  }

  private any(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }
}

const KEY_BUTTONS: Record<string, ButtonId> = {
  Digit1: 'tech1',
  Digit2: 'tech2',
  Digit3: 'tech3',
  Digit4: 'tech4',
  Space: 'dodge',
  KeyJ: 'attack',
  KeyK: 'guard',
  KeyE: 'context',
  Escape: 'menu',
  KeyB: 'bag',
  KeyQ: 'swap',
};

/** Key codes the page should stop the browser from acting on. */
export const GAME_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(KEY_BUTTONS),
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);
