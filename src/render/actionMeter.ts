import { UI_BALANCE } from '../content/balance/ui';
import { Layer, type Renderer } from './renderer';

/** What the meters draw through: rectangles only, so a fade can wrap it. */
export type Draws = Pick<Renderer, 'drawRect'>;

/** The same renderer with every rect drawn at `alpha` times its own, for the 150 ms fade. */
export function faded(renderer: Draws, alpha: number): Draws {
  return {
    drawRect: (layer, x, y, w, h, color, a = 1) =>
      renderer.drawRect(layer, x, y, w, h, color, a * alpha),
  };
}

/** A rectangle in logical px. */
export interface MeterRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The pieces `meterRect` needs from the viewport. All values are logical px. */
export interface MeterViewport {
  /** Playable area inside the insets. */
  safe: MeterRect;
  /** The meter never rises above this y (the bottom of the status row). */
  topLimit: number;
  /** The top of the thumb zone. The meter never goes below it. */
  zoneTop: number;
}

/** Where the avatar is on screen: the head point (top of the plate) and the feet. */
export interface MeterAnchor {
  x: number;
  headY: number;
  feetY: number;
}

/** A track is a sweep, rhythm or timing bar. A panel is a trace square or a hold bar. */
export type MeterKind = 'track' | 'panel';

const SIDE_MARGIN = 4;

/**
 * The action meter's footprint (design/09 "Action meter"). Centered above the avatar's head, it
 * flips below the feet when it would cross the top limit, is clamped inside the safe area minus
 * 4 px, and never enters the thumb zone. For a panel, `w` is also the square's side and the
 * footprint is taller by the tail that holds the time bar. Pure.
 */
export function meterRect(anchor: MeterAnchor, vp: MeterViewport, kind: MeterKind): MeterRect {
  const b = UI_BALANCE.meter;
  const room = Math.max(1, vp.safe.w - SIDE_MARGIN * 2);
  const roomAbove = anchor.headY - b.gapPx - vp.topLimit;
  const roomBelow = vp.zoneTop - (anchor.feetY + b.flipMarginPx);
  let w = kind === 'track' ? Math.min(b.trackW, room) : Math.min(b.panelMax, room);
  let body = kind === 'track' ? b.trackH : w;
  let above = roomAbove >= body + b.tailPx;
  if (!above && roomBelow < body + b.tailPx) {
    // Neither side holds it. A panel shrinks (never below its minimum) to the roomier side so the
    // avatar stays visible beside it. A track is short enough that this only happens on a tiny view.
    above = roomAbove > roomBelow;
    if (kind === 'panel') {
      w = Math.max(Math.min(w, b.panelMin), Math.min(w, Math.max(roomAbove, roomBelow) - b.tailPx));
      body = w;
    }
  }
  const h = body + b.tailPx;
  const x = Math.min(
    vp.safe.x + vp.safe.w - SIDE_MARGIN - w,
    Math.max(vp.safe.x + SIDE_MARGIN, Math.round(anchor.x - w / 2)),
  );
  let y = above ? anchor.headY - b.gapPx - h : anchor.feetY + b.flipMarginPx;
  if (y + h > vp.zoneTop) y = vp.zoneTop - h;
  return { x, y, w, h: body };
}

/** The sweep of a gather, in ticks: the length of the bar and the window to hit. */
export interface GatherMeterView {
  /** Ticks the bar runs. */
  total: number;
  /** The window, first and last tick. */
  from: number;
  to: number;
  /** Ticks into the bar. */
  t: number;
  /** Sweeps done and sweeps needed, for a node that takes several. */
  swing: number;
  swings: number;
}

export interface GatherMeterColors {
  ink: string;
  dark: string;
  gold: string;
  track: string;
}

/** Draws the gather sweep in `r`, which `meterRect(..., 'track')` returned. */
export function drawGatherMeter(
  renderer: Draws,
  r: MeterRect,
  view: GatherMeterView,
  c: GatherMeterColors,
  alpha = 1,
): void {
  const k = r.w / view.total;
  renderer.drawRect(Layer.Hud, r.x - 1, r.y - 1, r.w + 2, r.h + 2, c.dark, alpha);
  renderer.drawRect(Layer.Hud, r.x, r.y, r.w, r.h, c.track, alpha);
  renderer.drawRect(
    Layer.Hud,
    r.x + Math.round(view.from * k),
    r.y,
    Math.max(1, Math.round((view.to - view.from + 1) * k)),
    r.h,
    c.gold,
    alpha,
  );
  renderer.drawRect(
    Layer.Hud,
    r.x + Math.min(r.w - 2, Math.round(view.t * k)),
    r.y - 1,
    2,
    r.h + 2,
    c.ink,
    alpha,
  );
  // A tree takes several swings: one pip each, lit once done.
  for (let i = 0; i < view.swings && view.swings > 1; i++)
    renderer.drawRect(
      Layer.Hud,
      r.x + i * 6,
      r.y + r.h + 2,
      4,
      2,
      i < view.swing ? c.gold : c.ink,
      alpha,
    );
}

/**
 * A pointer position in CSS px to the trace step's 1000 by 1000 space, through the same rect the
 * trace is drawn in. `k` is logical px per CSS px. The world reads input here and `drawTrace`
 * draws in the rect, so the two cannot disagree. Pure.
 */
export function stepPoint(
  ptr: { x: number; y: number },
  rect: MeterRect,
  k: number,
): { x: number; y: number } {
  return { x: ((ptr.x * k - rect.x) / rect.w) * 1000, y: ((ptr.y * k - rect.y) / rect.h) * 1000 };
}
