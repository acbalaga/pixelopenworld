/**
 * The minimap (POW-M4-06): a small window of the map around the avatar, top right. It is a
 * button, so a tap opens the Map tab, and it can be reached with a keyboard. It is DOM so it
 * is part of the focus order, and it follows the control layout so it never sits under a button.
 */
import { MAP_BALANCE } from '../../content/balance/map';
import { MAP_STRINGS as S } from '../../content/strings/map';
import { MAP_MARK, MAP_PAPER } from '../../content/world/mapStyle';
import { PALETTE } from '../../content/sprites/palette';
import type { MapImage } from '../../render/mapImage';
import type { Fog } from '../../sim/world/fog';
import { el } from './parts/dom';

/** Cells across the minimap. */
const SPAN = MAP_BALANCE.mini.halfCells * 2;

export class Minimap {
  readonly button: HTMLButtonElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly data = new Uint8ClampedArray(SPAN * SPAN * 4);
  private sig = '';

  constructor(
    host: HTMLElement,
    private readonly image: MapImage,
    onOpen: () => void,
  ) {
    this.button = el('button', 'pow-minimap');
    this.button.type = 'button';
    this.button.setAttribute('aria-label', S.minimap);
    // Hidden until the game places it beside the Bag button.
    this.button.hidden = true;
    this.canvas = el('canvas', 'pow-minimap-canvas');
    this.canvas.width = SPAN;
    this.canvas.height = SPAN;
    this.canvas.setAttribute('aria-hidden', 'true');
    this.button.appendChild(this.canvas);
    this.button.addEventListener('click', onOpen);
    host.appendChild(this.button);
  }

  set hidden(v: boolean) {
    this.button.hidden = v;
  }

  /** Places the button at a css px position from the page's top left. */
  place(left: number, top: number): void {
    this.button.style.setProperty('--mm-left', `${Math.round(left)}px`);
    this.button.style.setProperty('--mm-top', `${Math.round(top)}px`);
  }

  /** Redraws around tile (tx, ty). `revealed` lets it skip a frame when nothing changed. */
  update(fog: Fog, tx: number, ty: number, revealed: number): void {
    const cx = Math.floor(tx / MAP_BALANCE.cellTiles);
    const cy = Math.floor(ty / MAP_BALANCE.cellTiles);
    const sig = `${cx},${cy},${revealed},${this.image.cw}`;
    if (sig === this.sig) return;
    this.sig = sig;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const half = MAP_BALANCE.mini.halfCells;
    this.image.paint(fog, cx - half, cy - half, SPAN, SPAN, this.data);
    ctx.fillStyle = PALETTE[MAP_PAPER] as string;
    ctx.fillRect(0, 0, SPAN, SPAN);
    // Put the picture over the paper through a second canvas, so fog stays paper.
    const layer = this.layer();
    layer.putImageData(new ImageData(this.data, SPAN, SPAN), 0, 0);
    ctx.drawImage(layer.canvas, 0, 0);
    // The avatar: a ringed dot in the middle.
    ctx.fillStyle = PALETTE[MAP_MARK.ink] as string;
    ctx.fillRect(half - 2, half - 2, 5, 5);
    ctx.fillStyle = PALETTE[MAP_MARK.player] as string;
    ctx.fillRect(half - 1, half - 1, 3, 3);
  }

  private scratch: CanvasRenderingContext2D | null = null;
  private layer(): CanvasRenderingContext2D {
    if (!this.scratch) {
      const c = document.createElement('canvas');
      c.width = SPAN;
      c.height = SPAN;
      this.scratch = c.getContext('2d') as CanvasRenderingContext2D;
    }
    return this.scratch;
  }
}
