import type { Direction } from '../../sim/kernel/fixed';

/** Where a pointer-style action happened, in CSS px relative to the game surface. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** Buttons that live on screen. */
export type ButtonId = 'tech1' | 'tech2' | 'tech3' | 'tech4' | 'context' | 'menu' | 'bag' | 'dodge';

/**
 * One tick of abstract input. Every source (touch, keyboard, gamepad) fills this same record.
 * Edge actions are true for exactly one sample.
 */
export interface InputRecord {
  /** Analog move vector, each axis -1..1, length at most 1. */
  move: { x: number; y: number };
  /** 8-way quantization of `move`, or null when idle. */
  moveDir: Direction | null;
  /**
   * An analog source (touch stick, gamepad) is at full extent. Holding it counts toward sprint.
   * Keyboard is never full: it has no analog extent, so it never sprints by holding a key.
   */
  full: boolean;
  /** Technique 1 to 4 pressed this sample (index 0 to 3). */
  technique: [boolean, boolean, boolean, boolean];
  /** Technique held (aim) per slot. */
  techniqueHeld: [boolean, boolean, boolean, boolean];
  /** Dodge requested this sample, with a direction when one is known. */
  dodge: { dir: Direction | null } | null;
  context: boolean;
  menu: boolean;
  bag: boolean;
  /** Tap on the game surface outside any button. Caller converts to world position. */
  targetTap: ScreenPoint | null;
  /** Long press on a point, for detail popups where desktop would hover. */
  longPress: ScreenPoint | null;
}

/** An all-idle record. */
export function emptyRecord(): InputRecord {
  return {
    move: { x: 0, y: 0 },
    moveDir: null,
    full: false,
    technique: [false, false, false, false],
    techniqueHeld: [false, false, false, false],
    dodge: null,
    context: false,
    menu: false,
    bag: false,
    targetTap: null,
    longPress: null,
  };
}

/** Quantizes an analog vector to one of 8 directions, or null under the threshold. */
export function quantizeDir(x: number, y: number, threshold: number): Direction | null {
  if (Math.hypot(x, y) < threshold) return null;
  // Screen y grows downward, so north is -y. Angle 0 = north, clockwise.
  const angle = Math.atan2(x, -y);
  const sector = Math.round(angle / (Math.PI / 4));
  return (((sector % 8) + 8) % 8) as Direction;
}
