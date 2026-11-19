import type { Atlas } from '../render/atlas';
import type { Renderer } from '../render/renderer';

/**
 * A minimal immediate renderer for the dev tools: just enough of {@link Renderer} for the chunk
 * renderer (blits and sprites), drawn straight onto a 2D context at any zoom, with no integer
 * scale. Dev only.
 */
export class DevRenderer {
  camX = 0;
  camY = 0;
  zoom = 1;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    private readonly atlas: Atlas,
  ) {}

  get width(): number {
    return this.ctx.canvas.width / this.zoom;
  }
  get height(): number {
    return this.ctx.canvas.height / this.zoom;
  }

  /** Clears the canvas and sets the view: the world px at its top left, and the zoom. */
  begin(camX: number, camY: number, zoom: number): void {
    this.camX = camX;
    this.camY = camY;
    this.zoom = zoom;
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14121f';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.imageSmoothingEnabled = false;
  }

  drawBlit(_layer: number, source: CanvasImageSource, x: number, y: number): void {
    const s = source as HTMLCanvasElement;
    this.ctx.drawImage(
      source,
      Math.round((x - this.camX) * this.zoom),
      Math.round((y - this.camY) * this.zoom),
      s.width * this.zoom,
      s.height * this.zoom,
    );
  }

  drawSprite(
    _layer: number,
    handle: number,
    x: number,
    y: number,
    flip?: boolean,
    alpha = 1,
  ): void {
    void flip;
    const a = this.atlas;
    const w = a.width(handle);
    const h = a.height(handle);
    if (alpha < 1) this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(
      a.image(handle),
      a.srcX(handle),
      a.srcY(handle),
      w,
      h,
      Math.round((x - a.originX(handle) - this.camX) * this.zoom),
      Math.round((y - a.originY(handle) - this.camY) * this.zoom),
      w * this.zoom,
      h * this.zoom,
    );
    if (alpha < 1) this.ctx.globalAlpha = 1;
  }

  /** The chunk renderer wants a {@link Renderer}. It calls only the two methods above. */
  asRenderer(): Renderer {
    return this as unknown as Renderer;
  }
}
