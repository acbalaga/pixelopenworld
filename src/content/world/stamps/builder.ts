import type { StampCell, StampV2 } from '../../../sim/world/stamp';
import { Terrain, tilesetId } from '../tileset';

/** A placed object: a fixture, node, person or spawner by kind, at a tile of the stamp. */
export interface PlacedObject {
  x: number;
  y: number;
  kind: string;
}

/** A named rectangle of a stamp, in the stamp's own tiles. Used to check what sits where. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!"#$%&()*+,-./:;<=>?[]^_{|}~'.split(
    '',
  );

/**
 * Builds a v2 stamp from tile calls instead of hand-drawn rows. The result is an ordinary
 * {@link StampV2} (a legend and four layers of rows), so the baker, the dev map and the stamp editor
 * treat it like any other. Content only: nothing here runs in the game client.
 */
export class StampBuilder {
  private readonly cells: StampCell[];
  readonly objects: PlacedObject[] = [];
  private readonly claims: { rect: Rect; label: string }[] = [];

  constructor(
    readonly w: number,
    readonly h: number,
    /** Ground under every tile, or 0 to leave the region's own terrain showing where nothing is drawn. */
    base: number = Terrain.None,
  ) {
    this.cells = Array.from({ length: w * h }, () => ({ ground: base }));
  }

  private at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h)
      throw new Error(`(${x}, ${y}) is outside the ${this.w} x ${this.h} stamp`);
    return y * this.w + x;
  }

  get(x: number, y: number): StampCell {
    return this.cells[this.at(x, y)] as StampCell;
  }

  private patch(x: number, y: number, p: Partial<StampCell>): void {
    this.cells[this.at(x, y)] = { ...this.get(x, y), ...p };
  }

  ground(x: number, y: number, t: number): this {
    this.patch(x, y, { ground: t });
    return this;
  }

  /** Fills a rectangle of ground. */
  rect(x: number, y: number, w: number, h: number, t: number): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.ground(i, j, t);
    return this;
  }

  detail(x: number, y: number, tile: string): this {
    this.patch(x, y, { detail: tilesetId(tile) });
    return this;
  }

  object(x: number, y: number, tile: string): this {
    this.patch(x, y, { object: tilesetId(tile) });
    return this;
  }

  overhead(x: number, y: number, tile: string): this {
    this.patch(x, y, { overhead: tilesetId(tile) });
    return this;
  }

  /** Puts a fixture, node, person or spawner on a tile. */
  place(kind: string, x: number, y: number): this {
    this.at(x, y);
    this.objects.push({ x, y, kind });
    return this;
  }

  /** Claims a rectangle for a named thing. Two claims that overlap throw, so a layout error fails the build. */
  claim(x: number, y: number, w: number, h: number, label: string): Rect {
    const rect = { x, y, w, h };
    for (const c of this.claims)
      if (
        x < c.rect.x + c.rect.w &&
        c.rect.x < x + w &&
        y < c.rect.y + c.rect.h &&
        c.rect.y < y + h
      )
        throw new Error(`${label} overlaps ${c.label}`);
    this.claims.push({ rect, label });
    return rect;
  }

  /**
   * A building facade: `h` rows of wall with a roof over the top two. The door and windows are on
   * the bottom wall row. Solid (walls are object tiles), roof in the overhead layer so it fades
   * when the avatar stands behind it.
   */
  building(
    x: number,
    y: number,
    w: number,
    h: number,
    o: { roof: 'red' | 'slate'; door: number; shop?: boolean; label: string },
  ): this {
    this.claim(x, y, w, h, o.label);
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const front = j === h - 1;
        const wall = !front
          ? 'tile.wall_plaster'
          : i === o.door
            ? o.shop
              ? 'tile.wall_shop'
              : 'tile.wall_door'
            : i % 2 === 1 && i !== o.door
              ? 'tile.wall_window'
              : 'tile.wall_plaster';
        this.ground(x + i, y + j, Terrain.Cobble);
        this.object(x + i, y + j, wall);
        if (j < 2) {
          const col = i === 0 ? 'l' : i === w - 1 ? 'r' : 'm';
          this.overhead(x + i, y + j, `tile.roof_${o.roof}_${j}${col}`);
        }
      }
    return this;
  }

  /** A fence (or low wall) along a line, with posts at the ends and gaps left open. */
  fence(x0: number, y0: number, x1: number, y1: number, gaps: readonly number[] = []): this {
    const horizontal = y0 === y1;
    const n = horizontal ? x1 - x0 : y1 - y0;
    for (let k = 0; k <= n; k++) {
      if (gaps.includes(k)) continue;
      const x = horizontal ? x0 + k : x0;
      const y = horizontal ? y0 : y0 + k;
      const post = k === 0 || k === n || gaps.includes(k - 1) || gaps.includes(k + 1);
      this.object(x, y, post ? 'tile.fence_post' : horizontal ? 'tile.fence_h' : 'tile.fence_v');
    }
    return this;
  }

  /** Turns the calls into a stamp, assigning one legend character to each distinct cell. */
  toStamp(id: string, extra: Partial<StampV2> = {}): StampV2 {
    const legend: Record<string, StampCell> = {};
    const byKey = new Map<string, string>();
    const rows = {
      ground: [] as string[],
      detail: [] as string[],
      object: [] as string[],
      overhead: [] as string[],
    };
    // A cell is split by layer so a legend character only needs the layer it appears in.
    const charFor = (layer: 'ground' | 'detail' | 'object' | 'overhead', c: StampCell): string => {
      const v = c[layer];
      if (v === undefined || v === 0) return ' ';
      const k = `${layer}:${v}`;
      let ch = byKey.get(k);
      if (!ch) {
        ch = CHARS[byKey.size] as string;
        if (!ch) throw new Error(`stamp ${id} needs more than ${CHARS.length} distinct tiles`);
        byKey.set(k, ch);
        legend[ch] = { ground: layer === 'ground' ? (v as number) : 0, [layer]: v } as StampCell;
      }
      return ch;
    };
    for (let y = 0; y < this.h; y++) {
      const line = { ground: '', detail: '', object: '', overhead: '' };
      for (let x = 0; x < this.w; x++) {
        const c = this.get(x, y);
        for (const layer of ['ground', 'detail', 'object', 'overhead'] as const)
          line[layer] += charFor(layer, c);
      }
      for (const layer of ['ground', 'detail', 'object', 'overhead'] as const)
        rows[layer].push(line[layer]);
    }
    const layers: StampV2['layers'] = {
      ground: rows.ground,
      ...(rows.detail.some((r) => r.trim()) ? { detail: rows.detail } : {}),
      ...(rows.object.some((r) => r.trim()) ? { object: rows.object } : {}),
      ...(rows.overhead.some((r) => r.trim()) ? { overhead: rows.overhead } : {}),
    };
    return { version: 2, id, legend, layers, objects: this.objects, ...extra };
  }
}
