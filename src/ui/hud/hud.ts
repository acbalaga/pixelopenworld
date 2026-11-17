import { PALETTE } from '../../content/sprites/palette';
import type { Settings } from '../../platform/settings';
import { Layer, type Renderer } from '../../render/renderer';
import type { SimState } from '../../sim/state';
import { clockView, statusIcons } from '../menu/model';
import type { PixelFont } from '../text/pixelFont';
import { chooseTextRenderer } from '../text/rule';
import { FadeTracker } from './fade';

const INK = PALETTE[3] as string;
const DARK = PALETTE[0] as string;
const GOLD = PALETTE[47] as string;
const BAR_BACK = PALETTE[16] as string;
const HP = PALETTE[21] as string;
const STAMINA = PALETTE[10] as string;
const FOCUS = PALETTE[14] as string;

/** Everything the HUD needs for one frame. */
export interface HudFrame {
  r: Renderer;
  fonts: { small: PixelFont; large: PixelFont };
  state: SimState;
  who: number;
  /** Wall clock, ms. */
  now: number;
  /** Safe area and screen width, logical px. */
  safe: { x: number; y: number; w: number; h: number };
  width: number;
  mmPerLogicalPx: number;
  settings: Readonly<Settings>;
  /** Atlas handle for an icon sprite id. */
  icon: (id: string) => number;
}

/** Height the pool block takes, so other HUD parts can sit under it. */
export const POOLS_HEIGHT = 20;
/** Height the status row takes. */
export const STATUS_HEIGHT = 15;

/**
 * The always-on HUD, drawn on the canvas: pool bars with the Health number, the status icon row,
 * and the clock. Elements fade after a few idle seconds and return on change (design/09), then
 * the player's own HUD opacity is applied on top.
 */
export class Hud {
  readonly fade = new FadeTracker();

  draw(f: HudFrame): void {
    const { r, state, who, now, safe, settings } = f;
    const pools = state.entities.comps.pools[who];
    if (!pools) return;
    const reduced = settings.reducedMotion;
    const op = settings.hudOpacity;
    const x = safe.x + 3;
    const y = safe.y + 3;

    // Low Health keeps the pools lit.
    this.fade.observe('pools', `${pools.hp},${pools.sta},${pools.foc}`, now);
    if (pools.hp * 4 < pools.hpMax) this.fade.wake('pools', now);
    const pa = this.fade.alpha('pools', now, reduced) * op;
    const bar = (by: number, w: number, h: number, frac: number, color: string): void => {
      r.drawRect(Layer.Hud, x - 1, by - 1, w + 2, h + 2, DARK, pa);
      r.drawRect(Layer.Hud, x, by, w, h, BAR_BACK, pa);
      const fill = Math.round(w * Math.min(1, Math.max(0, frac)));
      if (fill > 0) r.drawRect(Layer.Hud, x, by, fill, h, color, pa);
    };
    bar(y, 48, 5, pools.hp / pools.hpMax, HP);
    bar(y + 8, 44, 4, pools.sta / pools.staMax, STAMINA);
    bar(y + 15, 44, 4, pools.foc / pools.focMax, FOCUS);
    const num = String(pools.hp);
    const rule = chooseTextRenderer({
      text: num,
      lines: 1,
      physicalMmPerLogicalPx: f.mmPerLogicalPx,
      font: 'large',
    });
    if (rule.renderer === 'pixel')
      f.fonts.large.draw(r, num, x + 52, y - 2, INK, { outline: DARK, alpha: pa });

    // Status icons, each with a shape and a timer bar.
    const status = statusIcons(state, who);
    this.fade.observe('status', status.map((s) => s.id).join(','), now);
    const sa = this.fade.alpha('status', now, reduced) * op;
    status.forEach((s, i) => {
      const sx = x + i * 15;
      const sy = y + POOLS_HEIGHT + 2;
      r.drawSprite(Layer.Hud, f.icon(s.icon), sx, sy, false, sa);
      if (s.ticksLeft !== null) {
        const total = Math.max(1, s.ticksLeft);
        const w = Math.min(12, Math.max(1, Math.round(total / 450)));
        r.drawRect(Layer.Hud, sx, sy + 13, w, 1, GOLD, sa);
      }
    });

    // Clock, top center, with a small phase shape (sun or moon).
    const clock = clockView(state.tick);
    this.fade.observe('clock', clock.phase, now);
    const ca = this.fade.alpha('clock', now, reduced) * op;
    const label = clock.hhmm;
    // Right of center: the Health number sits on the left and the menu buttons on the right.
    const cx = Math.floor(f.width / 2) + 10;
    const text = chooseTextRenderer({
      text: label,
      lines: 1,
      physicalMmPerLogicalPx: f.mmPerLogicalPx,
    });
    if (text.renderer === 'pixel') {
      const w = f.fonts.small.draw(r, label, cx + 4, safe.y + 3, INK, {
        align: 'center',
        outline: DARK,
        alpha: ca,
      });
      this.phaseGlyph(r, cx - Math.floor(w / 2) - 4, safe.y + 4, clock.phase, ca);
    }
  }

  /** Sun for day, half sun for dawn and dusk, crescent for night. Shapes, not only color. */
  private phaseGlyph(r: Renderer, x: number, y: number, phase: string, a: number): void {
    const sun = PALETTE[46] as string;
    const moon = PALETTE[14] as string;
    if (phase === 'night') {
      r.drawRect(Layer.Hud, x + 1, y, 3, 5, moon, a);
      r.drawRect(Layer.Hud, x + 3, y + 1, 2, 3, DARK, a);
      return;
    }
    if (phase === 'day') {
      r.drawRect(Layer.Hud, x, y, 5, 5, sun, a);
      r.drawRect(Layer.Hud, x + 1, y - 1, 3, 7, sun, a);
      return;
    }
    r.drawRect(Layer.Hud, x, y + 2, 5, 3, sun, a);
    r.drawRect(Layer.Hud, x + 1, y + 1, 3, 1, sun, a);
  }
}

/** Opacity applied to the HUD buttons: the player's setting, nothing else. */
export function buttonOpacity(settings: Readonly<Settings>): number {
  return settings.hudOpacity;
}
