/**
 * The Map tab (POW-M4-06). A canvas that shows the picture from `MapImage`, with pan (drag or
 * arrow keys), pinch zoom (two fingers, the wheel, the buttons or + and -), marks for the avatar,
 * landmarks, Waystones, rumors and notes, and under it a list of what is marked in clear text.
 * Names are never drawn on the canvas: they are in the list, which reads at any text scale.
 *
 * The pane lives as long as the Menu does. It is mounted when the tab shows and `update` redraws
 * it only when something it shows changed, so panning is never interrupted by a refresh.
 */
import { MAP_BALANCE } from '../../content/balance/map';
import { MAP_STRINGS as S } from '../../content/strings/map';
import { MAP_MARK, MAP_PAPER } from '../../content/world/mapStyle';
import { PALETTE } from '../../content/sprites/palette';
import { fill } from '../../content/strings/skills';
import type { MapImage } from '../../render/mapImage';
import type { Command } from '../../sim/kernel/commands';
import { cleanNoteText } from '../../sim/kernel/commands';
import type { SimState } from '../../sim/state';
import type { Fog } from '../../sim/world/fog';
import { mapView, type MapContext, type MapView, type PlaceView } from '../menu/mapModel';
import { el, put } from './parts/dom';
import { emptyState } from './parts/emptyState';
import { header } from './parts/header';

export interface MapPaneDeps {
  ctx: MapContext;
  image: MapImage;
  read: () => { state: SimState; who: number };
  send: (c: Command) => void;
  /** Reads the cells of chunks the picture lacks (from the chunk cache). Resolves when they are in. */
  fill: (chunks: { cx: number; cy: number }[]) => Promise<void>;
}

const CELL_TILES = MAP_BALANCE.cellTiles;
const MIN_SCALE = 1;
const MAX_SCALE = 10;

const color = (i: number): string => PALETTE[i] as string;

export class MapPane {
  readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly bitmap: HTMLCanvasElement;
  private readonly status: HTMLElement;
  private readonly places: HTMLElement;
  private readonly notes: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly add: HTMLButtonElement;
  private view: MapView | null = null;
  /** Screen px per map cell, and where cell (0, 0) sits on the canvas, in css px. */
  private scale = 3;
  private ox = 0;
  private oy = 0;
  private placed = false;
  private bitmapSig = '';
  private listSig = '';
  private filling = false;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;

  constructor(private readonly deps: MapPaneDeps) {
    this.root = el('div', 'pow-map');
    this.canvas = el('canvas', 'pow-map-canvas');
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('role', 'img');
    this.bitmap = document.createElement('canvas');
    this.bitmap.width = deps.image.cw;
    this.bitmap.height = deps.image.ch;
    this.status = el('p', 'pow-map-status');
    this.status.setAttribute('aria-live', 'polite');

    const bar = el('div', 'pow-map-bar');
    const btn = (label: string, key: string, on: () => void): HTMLButtonElement => {
      const b = el('button', 'pow-button pow-map-btn', label);
      b.type = 'button';
      b.dataset.key = key;
      b.addEventListener('click', on);
      return b;
    };
    put(
      bar,
      btn('+', 'map-in', () => this.zoom(1.5)),
      btn('-', 'map-out', () => this.zoom(1 / 1.5)),
      btn(S.center, 'map-center', () => this.centerOn(this.view?.player ?? null, true)),
    );
    bar.children[0]?.setAttribute('aria-label', S.zoomIn);
    bar.children[1]?.setAttribute('aria-label', S.zoomOut);

    this.places = el('div', 'pow-map-places');
    this.notes = el('div', 'pow-map-notes');
    const form = el('form', 'pow-map-form');
    this.input = el('input', 'pow-map-input');
    this.input.type = 'text';
    this.input.maxLength = MAP_BALANCE.notes.maxLength;
    this.input.placeholder = S.notePlaceholder;
    this.input.setAttribute('aria-label', S.noteLabel);
    this.input.autocomplete = 'off';
    this.add = el('button', 'pow-button', S.noteAdd);
    this.add.type = 'submit';
    this.add.dataset.key = 'map-note-add';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addNote();
    });
    put(form, this.input, this.add);
    // Keys typed in the field never reach the game or the map's own shortcuts.
    this.input.addEventListener('keydown', (e) => e.stopPropagation());

    put(this.root, header(S.title), this.status, this.canvas, bar, this.places, form, this.notes);
    this.wire();
  }

  // ---- Input ----

  private wire(): void {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pinch = this.spread();
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 1) {
        this.ox += dx;
        this.oy += dy;
      } else if (this.pointers.size === 2) {
        const now = this.spread();
        const mid = this.midpoint();
        if (this.pinch > 0 && now > 0) this.zoomAt(now / this.pinch, mid.x, mid.y);
        this.pinch = now;
        this.ox += dx / 2;
        this.oy += dy / 2;
      }
      this.clamp();
      this.draw();
    });
    const up = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId);
      this.pinch = this.spread();
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = c.getBoundingClientRect();
        this.zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top);
        this.draw();
      },
      { passive: false },
    );
    c.addEventListener('keydown', (e) => {
      const step = 32;
      const move: Record<string, [number, number]> = {
        ArrowLeft: [step, 0],
        ArrowRight: [-step, 0],
        ArrowUp: [0, step],
        ArrowDown: [0, -step],
      };
      const m = move[e.key];
      if (m) {
        this.ox += m[0];
        this.oy += m[1];
        this.clamp();
        this.draw();
      } else if (e.key === '+' || e.key === '=') this.zoom(1.5);
      else if (e.key === '-' || e.key === '_') this.zoom(1 / 1.5);
      else return;
      e.preventDefault();
    });
  }

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private midpoint(): { x: number; y: number } {
    const [a, b] = [...this.pointers.values()];
    const r = this.canvas.getBoundingClientRect();
    return a && b ? { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top } : { x: 0, y: 0 };
  }

  // ---- View ----

  private size(): { w: number; h: number } {
    const r = this.canvas.getBoundingClientRect();
    return { w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) };
  }

  /** Zooms about the middle of the canvas. */
  private zoom(f: number): void {
    const { w, h } = this.size();
    this.zoomAt(f, w / 2, h / 2);
    this.draw();
  }

  /** Zooms about a canvas point, keeping the ground under it where it is. */
  private zoomAt(f: number, x: number, y: number): void {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * f));
    const k = next / this.scale;
    this.ox = x - (x - this.ox) * k;
    this.oy = y - (y - this.oy) * k;
    this.scale = next;
    this.clamp();
  }

  /** Keeps some of the map on screen. */
  private clamp(): void {
    const { w, h } = this.size();
    const mw = this.deps.image.cw * this.scale;
    const mh = this.deps.image.ch * this.scale;
    const keep = 24;
    this.ox = Math.min(w - keep, Math.max(keep - mw, this.ox));
    this.oy = Math.min(h - keep, Math.max(keep - mh, this.oy));
  }

  /** Puts a tile at the middle of the canvas. */
  private centerOn(t: { x: number; y: number } | null, redraw: boolean): void {
    if (!t) return;
    const { w, h } = this.size();
    this.ox = w / 2 - (t.x / CELL_TILES) * this.scale;
    this.oy = h / 2 - (t.y / CELL_TILES) * this.scale;
    this.clamp();
    if (redraw) this.draw();
  }

  private toScreen(tx: number, ty: number): { x: number; y: number } {
    return {
      x: this.ox + (tx / CELL_TILES) * this.scale,
      y: this.oy + (ty / CELL_TILES) * this.scale,
    };
  }

  // ---- Drawing ----

  /** Called when the tab shows and on the Menu's refresh. Redraws only if something changed. */
  update(): void {
    const { state, who } = this.deps.read();
    const v = mapView(state, who, this.deps.ctx);
    this.view = v;
    const fog = state.map.fog[v.region] ?? {};
    const missing = this.deps.image.missing(fog);
    if (missing.length > 0 && !this.filling) {
      this.filling = true;
      void this.deps
        .fill(missing)
        .catch(() => {})
        .finally(() => {
          this.filling = false;
          this.bitmapSig = '';
          if (this.root.isConnected) this.update();
        });
    }
    const sig = `${v.revealed}|${missing.length}`;
    const dirty = sig !== this.bitmapSig;
    if (dirty) this.paintBitmap(fog, sig);
    if (!this.placed) {
      this.placed = true;
      this.fit();
      this.centerOn(v.player, false);
    }
    this.fillText(v);
    this.draw();
  }

  /** Sizes the canvas buffer to the screen and picks a first zoom. */
  private fit(): void {
    const { w } = this.size();
    this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((w / 64) * 2) / 2));
  }

  private paintBitmap(fog: Fog, sig: string): void {
    const { image } = this.deps;
    const data = new Uint8ClampedArray(image.cw * image.ch * 4);
    image.paint(fog, 0, 0, image.cw, image.ch, data);
    const ctx = this.bitmap.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(data, image.cw, image.ch), 0, 0);
    this.bitmapSig = sig;
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d');
    const v = this.view;
    if (!ctx || !v) return;
    const { w, h } = this.size();
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // The ground not yet uncovered is dark paper. The picture sits on it.
    ctx.fillStyle = color(MAP_PAPER);
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(
      this.bitmap,
      this.ox,
      this.oy,
      this.deps.image.cw * this.scale,
      this.deps.image.ch * this.scale,
    );
    for (const n of v.notes) this.mark(ctx, 'note', n.x, n.y);
    for (const p of v.places) this.mark(ctx, p.kind, p.x, p.y);
    if (v.player) this.mark(ctx, 'player', v.player.x, v.player.y);
    this.canvas.setAttribute('aria-label', fill(S.canvasLabel, { region: v.regionName }));
  }

  /** Draws one mark. Each kind has its own shape, so none depends on color alone. */
  private mark(
    ctx: CanvasRenderingContext2D,
    kind: PlaceView['kind'] | 'player' | 'note',
    tx: number,
    ty: number,
  ): void {
    const { x, y } = this.toScreen(tx, ty);
    const r = Math.max(4, Math.round(this.scale * 1.4));
    const ink = color(MAP_MARK.ink);
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    if (kind === 'player') {
      ctx.fillStyle = color(MAP_MARK.player);
      ctx.moveTo(x, y - r - 1);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x, y + r / 2);
      ctx.lineTo(x - r, y + r);
    } else if (kind === 'landmark') {
      ctx.fillStyle = color(MAP_MARK.landmark);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.lineTo(x - r, y + r);
    } else if (kind === 'waystone') {
      ctx.fillStyle = color(MAP_MARK.waystone);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
    } else if (kind === 'note') {
      ctx.fillStyle = color(MAP_MARK.note);
      ctx.rect(x - r / 2, y - r, r, r);
    } else {
      // A rumor is a dashed ring with a question mark: it says where someone thinks the place is.
      ctx.fillStyle = color(MAP_MARK.rumor);
      ctx.setLineDash([2, 2]);
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color(3);
      ctx.font = `bold ${Math.round(r * 1.5)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x, y + 1);
      return;
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (kind === 'note') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + r / 2);
      ctx.stroke();
    }
  }

  // ---- Text ----

  private fillText(v: MapView): void {
    this.status.textContent = fill(S.regionLine, { region: v.regionName, pct: v.percent });
    const sig = JSON.stringify([v.places, v.notes, v.player && 1]);
    if (sig === this.listSig) return;
    this.listSig = sig;

    this.places.textContent = '';
    put(this.places, el('h4', 'pow-part-section-title', S.places));
    if (v.places.length === 0) put(this.places, emptyState(S.placesNone));
    else {
      const ul = el('ul', 'pow-map-list');
      for (const p of v.places) {
        const li = el('li');
        const b = el('button', 'pow-map-place');
        b.type = 'button';
        b.dataset.key = `place-${p.key}`;
        put(
          b,
          el('span', 'pow-map-place-name', p.name),
          el('span', 'pow-map-place-tag', p.kind === 'rumor' ? S.heard : S.seen),
        );
        b.addEventListener('click', () => this.centerOn(p, true));
        li.appendChild(b);
        ul.appendChild(li);
      }
      put(this.places, ul);
      if (v.places.some((p) => p.kind === 'rumor'))
        put(this.places, el('p', 'pow-part-hint', S.heardHint));
    }

    this.notes.textContent = '';
    put(this.notes, el('h4', 'pow-part-section-title', S.notes));
    if (v.notes.length === 0) put(this.notes, emptyState(S.notesNone));
    else {
      const ul = el('ul', 'pow-map-list');
      for (const n of v.notes) {
        const li = el('li', 'pow-map-note');
        const go = el('button', 'pow-map-place');
        go.type = 'button';
        go.dataset.key = `note-${n.id}`;
        put(
          go,
          el('span', 'pow-map-place-name', n.text),
          el('span', 'pow-map-place-tag', fill(S.noteAt, { x: n.x, y: n.y })),
        );
        go.addEventListener('click', () => this.centerOn(n, true));
        const del = el('button', 'pow-button pow-map-del', 'x');
        del.type = 'button';
        del.dataset.key = `note-del-${n.id}`;
        del.setAttribute('aria-label', fill(S.noteRemove, { text: n.text }));
        del.addEventListener('click', () => this.deps.send({ type: 'noteRemove', id: n.id }));
        put(li, go, del);
        ul.appendChild(li);
      }
      put(this.notes, ul);
    }
  }

  private addNote(): void {
    const v = this.view;
    const text = cleanNoteText(this.input.value);
    if (!v?.player || text === null) return;
    if (v.notes.length >= MAP_BALANCE.notes.max) {
      this.status.textContent = S.noteFull;
      return;
    }
    this.deps.send({ type: 'noteAdd', x: v.player.x, y: v.player.y, text });
    this.input.value = '';
  }
}
