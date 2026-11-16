/** Viewport fitting: integer-scaled logical canvas, safe area, physical size estimate. */

/** Minimum logical size on the short-side-driven axis (design/09). */
export const MIN_LOGICAL = 180;

/** Device safe-area insets in CSS px. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** A rectangle in logical px, relative to the logical canvas. */
export interface LogicalRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything derived from the window size. */
export interface ViewportInfo {
  /** Logical canvas size. */
  width: number;
  height: number;
  /** Physical pixels per logical pixel, always an integer. */
  scale: number;
  dpr: number;
  portrait: boolean;
  /** Canvas size in physical px (width * scale, height * scale) and in CSS px. */
  physWidth: number;
  physHeight: number;
  cssWidth: number;
  cssHeight: number;
  /** Area inside the device safe insets, in logical px. Interactive things stay inside it. */
  safe: LogicalRect;
  /** Best estimate of one logical pixel's physical size, from CSS px (96 per inch). */
  mmPerLogicalPx: number;
}

const MM_PER_CSS_PX = 25.4 / 96;

/**
 * Computes the fit. Portrait: scale is the largest integer keeping logical width at or above
 * 180, so logical width lands in 180 to 239 on real phones. Landscape and desktop apply the same
 * rule to logical height, and the width extends. Leftover device pixels (under one scale step)
 * become a letterbox, centered by CSS.
 */
export function computeViewport(
  cssW: number,
  cssH: number,
  dpr: number,
  insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 },
): ViewportInfo {
  const physW = Math.max(1, Math.floor(cssW * dpr));
  const physH = Math.max(1, Math.floor(cssH * dpr));
  const portrait = cssH >= cssW;
  const key = portrait ? physW : physH;
  const scale = Math.max(1, Math.floor(key / MIN_LOGICAL));
  const width = Math.max(1, Math.floor(physW / scale));
  const height = Math.max(1, Math.floor(physH / scale));
  const physWidth = width * scale;
  const physHeight = height * scale;
  // Canvas is centered, so the letterbox on each side is half the leftover.
  const offX = (physW - physWidth) / 2;
  const offY = (physH - physHeight) / 2;
  const toLogical = (cssInset: number, off: number): number =>
    Math.max(0, Math.ceil((cssInset * dpr - off) / scale));
  const left = toLogical(insets.left, offX);
  const top = toLogical(insets.top, offY);
  const right = toLogical(insets.right, offX);
  const bottom = toLogical(insets.bottom, offY);
  return {
    width,
    height,
    scale,
    dpr,
    portrait,
    physWidth,
    physHeight,
    cssWidth: physWidth / dpr,
    cssHeight: physHeight / dpr,
    safe: {
      x: left,
      y: top,
      w: Math.max(0, width - left - right),
      h: Math.max(0, height - top - bottom),
    },
    mmPerLogicalPx: (scale / dpr) * MM_PER_CSS_PX,
  };
}

/** Reads `env(safe-area-inset-*)` through a probe element styled in style.css. */
export function readSafeInsets(probe: HTMLElement): Insets {
  const cs = getComputedStyle(probe);
  const n = (v: string): number => Number.parseFloat(v) || 0;
  return {
    top: n(cs.paddingTop),
    right: n(cs.paddingRight),
    bottom: n(cs.paddingBottom),
    left: n(cs.paddingLeft),
  };
}

/**
 * Watches window size, visual viewport (address bar), and rotation, and calls `onChange` with a
 * fresh {@link ViewportInfo}. Returns the first value and a stop function.
 */
export function watchViewport(
  probe: HTMLElement,
  onChange: (v: ViewportInfo) => void,
): { current: ViewportInfo; stop: () => void } {
  const measure = (): ViewportInfo => {
    const vv = window.visualViewport;
    const w = vv?.width ?? window.innerWidth;
    const h = vv?.height ?? window.innerHeight;
    return computeViewport(w, h, window.devicePixelRatio || 1, readSafeInsets(probe));
  };
  const ac = new AbortController();
  let last = measure();
  const update = (): void => {
    const next = measure();
    if (
      next.width !== last.width ||
      next.height !== last.height ||
      next.scale !== last.scale ||
      next.dpr !== last.dpr
    ) {
      last = next;
      onChange(next);
    }
  };
  window.addEventListener('resize', update, { signal: ac.signal });
  window.addEventListener('orientationchange', update, { signal: ac.signal });
  window.visualViewport?.addEventListener('resize', update, { signal: ac.signal });
  return {
    get current() {
      return last;
    },
    stop: () => ac.abort(),
  };
}
