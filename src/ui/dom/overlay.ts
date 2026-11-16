import { PALETTE } from '../../content/sprites/palette';
import type { Settings } from '../../platform/settings';

/**
 * The DOM layer above the canvas. Everything here is built with `textContent` and `createElement`
 * only, and styled through CSS custom properties set via CSSOM (`style.setProperty`), never
 * inline style attributes, so the CSP (`style-src 'self'`) holds.
 */

/** Creates the overlay root once and returns it. */
export function createOverlay(): HTMLElement {
  const root = document.createElement('div');
  root.id = 'ui-root';
  root.className = 'ui-root';
  document.body.appendChild(root);
  return root;
}

/** Publishes the master palette as `--pal-0` to `--pal-47`, so DOM styling uses palette colors only. */
export function applyPaletteVars(el: HTMLElement): void {
  PALETTE.forEach((hex, i) => el.style.setProperty(`--pal-${i}`, hex));
}

/** Publishes the panel frame images for `border-image`. */
export function applyPanelImages(el: HTMLElement, base: string, pressed: string): void {
  el.style.setProperty('--panel-img', `url("${base}")`);
  el.style.setProperty('--panel-pressed-img', `url("${pressed}")`);
}

/** CSS px per logical px, so frames drawn in DOM match the canvas scale. */
export function applyPixelScale(el: HTMLElement, cssPerLogicalPx: number): void {
  el.style.setProperty('--px', `${cssPerLogicalPx}px`);
}

/** Publishes the settings the DOM layer reacts to. Font size follows `rem`, so the OS setting counts too. */
export function applySettings(el: HTMLElement, s: Readonly<Settings>): void {
  el.style.setProperty('--text-scale', String(s.textScale));
  el.style.setProperty('--hud-scale', String(s.hudScale));
  el.classList.toggle('reduced-motion', s.reducedMotion);
}
