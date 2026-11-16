import {
  DOLL_FRAMES,
  DOLL_ORIGIN,
  DOLL_SIZE,
  layersFor,
  type DollSpec,
} from '../content/dolls/parts';
import { PALETTE } from '../content/sprites/palette';
import { TRANSPARENT } from '../content/sprites/grid';
import { Atlas, type Manifest } from './atlas';
import { composeFrame } from './doll';

const [W, H] = DOLL_SIZE;
const COLS = 5;

const RGB_TO_INDEX = new Map<number, number>(
  PALETTE.map((hex, i) => [
    (parseInt(hex.slice(1, 3), 16) << 16) |
      (parseInt(hex.slice(3, 5), 16) << 8) |
      parseInt(hex.slice(5, 7), 16),
    i,
  ]),
);

/**
 * Builds composed characters from the baked atlas. Layer pixels are read back once (and cached
 * as palette indices), so composing a new look never touches the network or the content data.
 */
export class DollFactory {
  private cache = new Map<string, Uint8Array>();
  private ctx: CanvasRenderingContext2D;

  constructor(
    private readonly atlas: Atlas,
    private readonly manifest: Manifest,
  ) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
  }

  private layerFrame = (layerId: string, frame: string): Uint8Array => {
    const key = `${layerId}#${frame}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const r = this.manifest.sprites[layerId]?.frames[frame];
    if (!r) throw new Error(`doll layer ${layerId} has no frame ${frame}`);
    const c = this.ctx.canvas;
    c.width = W;
    c.height = H;
    this.ctx.clearRect(0, 0, W, H);
    this.ctx.drawImage(
      this.atlas.image(this.atlas.frame(layerId, frame)),
      r.x,
      r.y,
      W,
      H,
      0,
      0,
      W,
      H,
    );
    const data = this.ctx.getImageData(0, 0, W, H).data;
    const out = new Uint8Array(W * H).fill(TRANSPARENT);
    for (let i = 0; i < W * H; i++) {
      if ((data[i * 4 + 3] as number) === 0) continue;
      const rgb =
        ((data[i * 4] as number) << 16) |
        ((data[i * 4 + 1] as number) << 8) |
        (data[i * 4 + 2] as number);
      out[i] = RGB_TO_INDEX.get(rgb) ?? TRANSPARENT;
    }
    this.cache.set(key, out);
    return out;
  };

  /** Creates a character sprite registered in the atlas under `id`. Call `draw` to (re)dress it. */
  create(id: string, spec: DollSpec): { draw: (spec: DollSpec) => void } {
    const canvas = document.createElement('canvas');
    const rows = Math.ceil(DOLL_FRAMES.length / COLS);
    canvas.width = COLS * W;
    canvas.height = rows * H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');

    const walkFrames = (d: string): string[] => [0, 1, 2, 3].map((n) => `walk_${d}_${n}`);
    const frames: Manifest['sprites'][string]['frames'] = {};
    DOLL_FRAMES.forEach((name, i) => {
      frames[name] = { x: (i % COLS) * W, y: Math.floor(i / COLS) * H, w: W, h: H };
    });
    this.atlas.addSprite(id, canvas, {
      group: 'dynamic',
      size: [W, H],
      origin: [DOLL_ORIGIN[0], DOLL_ORIGIN[1]],
      frames,
      anims: {
        walk_down: { fps: 8, frames: walkFrames('down') },
        walk_up: { fps: 8, frames: walkFrames('up') },
        walk_right: { fps: 8, frames: walkFrames('right') },
        walk_left: { fps: 8, flipX: true, frames: walkFrames('right') },
        idle_down: { fps: 2, frames: ['idle_down', 'walk_down_1'] },
        idle_up: { fps: 2, frames: ['idle_up', 'walk_up_1'] },
        idle_right: { fps: 2, frames: ['idle_right', 'walk_right_1'] },
        idle_left: { fps: 2, flipX: true, frames: ['idle_right', 'walk_right_1'] },
      },
    });

    const draw = (s: DollSpec): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const layers = layersFor(s);
      const img = ctx.createImageData(W, H);
      DOLL_FRAMES.forEach((name, i) => {
        const px = composeFrame(this.layerFrame, layers, name);
        for (let j = 0; j < px.length; j++) {
          const v = px[j] as number;
          const hex = v === TRANSPARENT ? null : (PALETTE[v] as string);
          img.data[j * 4] = hex ? parseInt(hex.slice(1, 3), 16) : 0;
          img.data[j * 4 + 1] = hex ? parseInt(hex.slice(3, 5), 16) : 0;
          img.data[j * 4 + 2] = hex ? parseInt(hex.slice(5, 7), 16) : 0;
          img.data[j * 4 + 3] = hex ? 255 : 0;
        }
        ctx.putImageData(img, (i % COLS) * W, Math.floor(i / COLS) * H);
      });
    };
    draw(spec);
    return { draw };
  }
}
