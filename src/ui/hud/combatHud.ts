import { PALETTE } from '../../content/sprites/palette';
import { Layer, type Renderer } from '../../render/renderer';
import type { SimState } from '../../sim/state';
import type { PixelFont } from '../text/pixelFont';

const INK = PALETTE[3] as string;
const DARK = PALETTE[0] as string;
const BAR_BACK = PALETTE[16] as string;
const HP = PALETTE[21] as string;
const STAGGER = PALETTE[22] as string;

function bar(
  r: Renderer,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string,
): void {
  r.drawRect(Layer.Hud, x - 1, y - 1, w + 2, h + 2, DARK);
  r.drawRect(Layer.Hud, x, y, w, h, BAR_BACK);
  const fill = Math.round(w * Math.min(1, Math.max(0, frac)));
  if (fill > 0) r.drawRect(Layer.Hud, x, y, fill, h, color);
}

/**
 * The target lock frame: name, Health and stagger bar of the locked target, top center
 * (design/04). Draws nothing without a lock.
 */
export function drawLockFrame(
  r: Renderer,
  font: PixelFont,
  state: SimState,
  who: number,
  centerX: number,
  y: number,
): void {
  const f = state.entities.comps.fighter[who];
  if (!f || f.lock === null) return;
  const id = f.lock;
  const p = state.entities.comps.pools[id];
  const c = state.entities.comps.combatant[id];
  if (!p || !c) return;
  const w = 64;
  const x = centerX - (w >> 1);
  font.draw(r, c.name, centerX, y, INK, { align: 'center', outline: DARK });
  bar(r, x, y + font.lineHeight + 1, w, 5, p.hp / p.hpMax, HP);
  const s = state.entities.comps.stagger[id];
  if (s) bar(r, x, y + font.lineHeight + 8, w, 3, s.cur / s.max, STAGGER);
}
