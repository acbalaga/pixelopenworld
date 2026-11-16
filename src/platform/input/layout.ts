import { INPUT_TUNABLES } from '../../content/balance/input';
import type { ButtonId, ScreenPoint } from './actions';

/** A rectangle in CSS px. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Computed control layout for a screen size. */
export interface ControlLayout {
  /** Where a floating stick may begin. */
  stickZone: Rect;
  buttons: Readonly<Record<ButtonId, Rect>>;
}

/** True if the point is inside the rect. */
export function inRect(r: Rect, p: ScreenPoint): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

const BUTTON: ButtonId[] = ['tech1', 'tech2', 'tech3', 'tech4'];

/**
 * Lays controls out for a screen of `width` x `height` CSS px. The stick is on the left by
 * default, buttons on the right. `leftHanded` mirrors horizontally. Every button is at least
 * the minimum touch target.
 */
export function computeLayout(
  width: number,
  height: number,
  leftHanded: boolean,
  opts: {
    hudScale?: number;
    insets?: { top: number; right: number; bottom: number; left: number };
  } = {},
): ControlLayout {
  const min = INPUT_TUNABLES.minTargetPx;
  const size = Math.max(min, Math.round(Math.min(width, height) * 0.14 * (opts.hudScale ?? 1)));
  const gap = Math.round(size * 0.2);
  const margin = 12;
  const ins = opts.insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  // Right side and top are mirrored together with the buttons, so insets are applied before mirroring.
  const mirror = (r: Rect): Rect => (leftHanded ? { ...r, x: width - r.x - r.w } : r);

  const buttons = {} as Record<ButtonId, Rect>;
  // Technique buttons in an arc above the right thumb rest.
  const baseX = width - margin - ins.right - size;
  const baseY = height - margin - ins.bottom - size;
  const arc: [number, number][] = [
    [0, -(size + gap) * 2],
    [-(size + gap) * 0.75, -(size + gap) * 1.5],
    [-(size + gap) * 1.5, -(size + gap) * 0.75],
    [-(size + gap) * 2, 0],
  ];
  BUTTON.forEach((id, i) => {
    const a = arc[i] as [number, number];
    buttons[id] = mirror({ x: baseX + a[0], y: baseY + a[1], w: size, h: size });
  });
  buttons.dodge = mirror({ x: baseX, y: baseY - (size + gap), w: size, h: size });
  buttons.context = mirror({ x: baseX, y: baseY, w: size, h: size });
  buttons.menu = mirror({
    x: width - margin - ins.right - min,
    y: margin + ins.top,
    w: min,
    h: min,
  });
  buttons.bag = mirror({
    x: width - margin - ins.right - min * 2 - gap,
    y: margin + ins.top,
    w: min,
    h: min,
  });

  const zoneH = Math.round(height * INPUT_TUNABLES.stickZoneFraction);
  const stickZone: Rect = { x: 0, y: height - zoneH, w: width, h: zoneH };
  return { stickZone, buttons };
}

/** Finds the button under a point. Later buttons win on overlap. */
export function buttonAt(layout: ControlLayout, p: ScreenPoint): ButtonId | null {
  let hit: ButtonId | null = null;
  for (const id of Object.keys(layout.buttons) as ButtonId[]) {
    if (inRect(layout.buttons[id], p)) hit = id;
  }
  return hit;
}
