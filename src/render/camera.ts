/** Camera: follows a target, keeps it in the upper region on portrait, clamps to the world. */

/** Fraction of view height (from the top) of the region where the target sits, centered in it. */
export const PORTRAIT_FOCUS_REGION = 0.62;

/**
 * Follow camera. Position handed to the renderer is always whole logical pixels, so tiles never
 * shimmer. `smoothingMs` of 0 locks the camera to the target (default); a positive value eases
 * toward it and snaps the last half pixel so it never oscillates.
 */
export class Camera {
  /** Rounded top-left of the view in world px. Read these each frame. */
  x = 0;
  y = 0;
  private fx = 0;
  private fy = 0;
  private viewW = 1;
  private viewH = 1;
  private focusY = 0;
  private started = false;
  private x0 = 0;
  private y0 = 0;

  constructor(
    private worldW: number,
    private worldH: number,
    private smoothingMs = 0,
  ) {}

  /** Call on resize. `portrait` puts the target in the center of the upper region. */
  setView(w: number, h: number, portrait: boolean): void {
    this.viewW = w;
    this.viewH = h;
    this.focusY = Math.floor(portrait ? (h * PORTRAIT_FOCUS_REGION) / 2 : h / 2);
    this.started = false;
  }

  setWorld(w: number, h: number): void {
    this.setBounds(0, 0, w, h);
  }

  /** Limits the view to a rectangle in world px, for example the room the avatar is in. */
  setBounds(x0: number, y0: number, x1: number, y1: number): void {
    this.x0 = x0;
    this.y0 = y0;
    this.worldW = x1;
    this.worldH = y1;
  }

  /** The next `follow` jumps to the target instead of easing, for room changes. */
  snap(): void {
    this.started = false;
  }

  /** Moves toward the target (world px). `dtMs` is frame time. */
  follow(tx: number, ty: number, dtMs: number): void {
    const wantX = tx - Math.floor(this.viewW / 2);
    const wantY = ty - this.focusY;
    if (!this.started || this.smoothingMs <= 0) {
      this.fx = wantX;
      this.fy = wantY;
      this.started = true;
    } else {
      const k = 1 - Math.exp(-dtMs / this.smoothingMs);
      this.fx += (wantX - this.fx) * k;
      this.fy += (wantY - this.fy) * k;
      if (Math.abs(wantX - this.fx) < 0.5) this.fx = wantX;
      if (Math.abs(wantY - this.fy) < 0.5) this.fy = wantY;
    }
    this.x = this.clamp(Math.round(this.fx), this.viewW, this.x0, this.worldW);
    this.y = this.clamp(Math.round(this.fy), this.viewH, this.y0, this.worldH);
  }

  /** Clamps to the bounds. Bounds smaller than the view are centered. */
  private clamp(v: number, view: number, lo: number, hi: number): number {
    if (hi - lo <= view) return lo + Math.floor((hi - lo - view) / 2);
    return Math.min(Math.max(v, lo), hi - view);
  }
}
