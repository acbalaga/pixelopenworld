import { PALETTE } from '../../content/sprites/palette';
import type { Renderer } from '../../render/renderer';
import type { PixelFont } from '../text/pixelFont';
import type { MessageRouter } from './router';

const INK = PALETTE[3] as string;
const DARK = PALETTE[0] as string;

/**
 * Draws the floaters in their column (logical px): pixel text, newest at the bottom, one row
 * every `rowH`. The column is `LaneRects.floaters` divided by the CSS-per-logical scale.
 */
export function drawFloaters(
  r: Renderer,
  font: PixelFont,
  router: MessageRouter,
  col: { x: number; y: number; h: number },
  rowH = 10,
): void {
  const list = router.floaters();
  const bottom = col.y + col.h;
  list.forEach((f, i) => {
    const row = list.length - 1 - i;
    font.draw(r, f.text, Math.round(col.x), Math.round(bottom - rowH * (row + 1)), INK, {
      outline: DARK,
    });
  });
}
