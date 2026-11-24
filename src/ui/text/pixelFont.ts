import type { FontInfo } from '../../content/fonts';
import { glyphFrame } from '../../content/fonts';
import type { Atlas, Manifest } from '../../render/atlas';
import { Layer, type Renderer } from '../../render/renderer';

export type Align = 'left' | 'center' | 'right';

export interface DrawTextOptions {
  align?: Align;
  /** Outline color. Combat numbers and anything over the world use one. */
  outline?: string;
  /** Opacity 0 to 1. Default 1. */
  alpha?: number;
}

/**
 * Bitmap font drawing on the canvas. Glyphs are baked in the off-white base ink; each requested
 * color gets a tinted copy of the font sprite, made once and registered in the atlas, so drawing
 * a glyph is an ordinary sprite draw.
 */
export class PixelFont {
  private tinted = new Map<string, Map<number, number>>();
  private fallback: number;

  constructor(
    private readonly atlas: Atlas,
    private readonly manifest: Manifest,
    private readonly info: FontInfo,
    private readonly uiImage: CanvasImageSource & { width: number; height: number },
  ) {
    this.fallback = '?'.codePointAt(0) as number;
  }

  /** Line height in logical px. */
  get lineHeight(): number {
    return this.info.line;
  }

  /** Capital letter height in logical px. */
  get capHeight(): number {
    return this.info.cap;
  }

  /** Width of a string in logical px. The last glyph's spacing is not counted. */
  measure(text: string): number {
    let w = 0;
    for (let i = 0; i < text.length; i++) w += this.advance(text.charCodeAt(i));
    return Math.max(0, w - 1);
  }

  private advance(code: number): number {
    return this.info.advances[code] ?? (this.info.advances[this.fallback] as number);
  }

  private handles(color: string): Map<number, number> {
    let m = this.tinted.get(color);
    if (m) return m;
    const id = `${this.info.sprite}@${color}`;
    const canvas = document.createElement('canvas');
    canvas.width = this.uiImage.width;
    canvas.height = this.uiImage.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(this.uiImage, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const entry = this.manifest.sprites[this.info.sprite];
    if (!entry) throw new Error(`font sprite ${this.info.sprite} missing from the manifest`);
    this.atlas.addSprite(id, canvas, entry);
    m = new Map();
    for (const code of Object.keys(this.info.advances))
      m.set(Number(code), this.atlas.frame(id, glyphFrame(Number(code))));
    this.tinted.set(color, m);
    return m;
  }

  private run(r: Renderer, text: string, x: number, y: number, color: string, alpha = 1): void {
    const handles = this.handles(color);
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const code = handles.has(text.charCodeAt(i)) ? text.charCodeAt(i) : this.fallback;
      r.drawSprite(Layer.Hud, handles.get(code) as number, cx, y, false, alpha);
      cx += this.advance(code);
    }
  }

  /** Draws text with its top left (after alignment) at screen (x, y), in logical px. Returns the width. */
  draw(
    r: Renderer,
    text: string,
    x: number,
    y: number,
    color: string,
    opts: DrawTextOptions = {},
  ): number {
    const w = this.measure(text);
    const left =
      opts.align === 'center' ? x - Math.floor(w / 2) : opts.align === 'right' ? x - w : x;
    if (opts.outline) {
      for (const [dx, dy] of [
        [-1, -1],
        [0, -1],
        [1, -1],
        [-1, 0],
        [1, 0],
        [-1, 1],
        [0, 1],
        [1, 1],
      ] as const)
        this.run(r, text, left + dx, y + dy, opts.outline, opts.alpha);
    }
    this.run(r, text, left, y, color, opts.alpha);
    return w;
  }

  private baked = new Map<string, number>();

  /**
   * Bakes outlined text into one sprite and returns its atlas handle, so a label that is drawn
   * every frame (a name over a head) costs one draw instead of nine glyph runs. The sprite has its
   * origin at the top left and is one pixel larger than the text on every side for the outline.
   * Cached by text and colors.
   */
  bake(text: string, color: string, outline: string): number {
    const key = `${color}|${outline}|${text}`;
    const hit = this.baked.get(key);
    if (hit !== undefined) return hit;
    const w = this.measure(text) + 2;
    const h = this.info.cell[1] + 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, w);
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.imageSmoothingEnabled = false;
    const run = (ink: string, ox: number, oy: number): void => {
      const handles = this.handles(ink);
      let cx = ox;
      for (let i = 0; i < text.length; i++) {
        const code = handles.has(text.charCodeAt(i)) ? text.charCodeAt(i) : this.fallback;
        const g = handles.get(code) as number;
        ctx.drawImage(
          this.atlas.image(g),
          this.atlas.srcX(g),
          this.atlas.srcY(g),
          this.atlas.width(g),
          this.atlas.height(g),
          cx,
          oy,
          this.atlas.width(g),
          this.atlas.height(g),
        );
        cx += this.advance(code);
      }
    };
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ] as const)
      run(outline, 1 + dx, 1 + dy);
    run(color, 1, 1);
    const id = `label.${this.baked.size}.${this.info.sprite}`;
    this.atlas.addSprite(id, canvas, {
      group: 'dynamic',
      size: [canvas.width, h],
      origin: [0, 0],
      frames: { base: { x: 0, y: 0, w: canvas.width, h } },
      anims: {},
    });
    const handle = this.atlas.frame(id, 'base');
    this.baked.set(key, handle);
    return handle;
  }
}
