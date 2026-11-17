import { chooseTextRenderer, type PixelFontSize } from '../text/rule';
import type { PixelFont } from '../text/pixelFont';
import type { PanelCache } from '../panel';
import { Layer, type Renderer } from '../../render/renderer';

/** A button rectangle in logical px. */
export interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** An icon drawn in place of a label. `size` is its width and height in logical px. */
export interface ButtonIcon {
  handle: number;
  size: number;
  alpha?: number;
}

/** Everything a canvas button needs to draw. */
export interface ButtonKit {
  panels: PanelCache;
  fonts: Record<PixelFontSize, PixelFont>;
  /** From the viewport, for the text rule. */
  mmPerLogicalPx: number;
  /** Label color and shade. */
  ink: string;
  outline: string;
}

/**
 * Draws a canvas button: a 9-slice panel, with a pixel label centered on it. The label obeys the
 * text rule. When the device is too small for pixel text, no pixel label is drawn and the result
 * says so, so the caller can show clear text (a DOM label) instead.
 */
export function drawCanvasButton(
  r: Renderer,
  kit: ButtonKit,
  rect: ButtonRect,
  label: string,
  pressed: boolean,
  font: PixelFontSize = 'small',
  icon?: ButtonIcon,
): { pixelLabel: boolean } {
  kit.panels.draw(r, rect.x, rect.y, rect.w, rect.h, pressed ? 'pressed' : 'base');
  if (icon) {
    // An icon replaces the label: it reads at a glance and needs no text rule.
    r.drawSprite(
      Layer.Hud,
      icon.handle,
      rect.x + Math.floor((rect.w - icon.size) / 2),
      rect.y + Math.floor((rect.h - icon.size) / 2) + (pressed ? 1 : 0),
      false,
      icon.alpha ?? 1,
    );
    return { pixelLabel: false };
  }
  const rule = chooseTextRenderer({
    text: label,
    lines: 1,
    physicalMmPerLogicalPx: kit.mmPerLogicalPx,
    font,
  });
  if (rule.renderer !== 'pixel') return { pixelLabel: false };
  const f = kit.fonts[rule.font];
  const nudge = pressed ? 1 : 0;
  f.draw(
    r,
    label,
    rect.x + Math.floor(rect.w / 2),
    rect.y + Math.floor((rect.h - f.capHeight) / 2) + nudge,
    kit.ink,
    { align: 'center' },
  );
  return { pixelLabel: true };
}
