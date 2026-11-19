import { CHUNK_TILES, createChunk, tileIndex, type Chunk } from '../sim/world/chunk';
import { resolveStamp, type ResolvedStamp, type StampV2 } from '../sim/world/stamp';

/** The tile layers a stamp authors. */
export type LayerName = 'ground' | 'detail' | 'object' | 'overhead';
export const LAYER_NAMES: readonly LayerName[] = ['ground', 'detail', 'object', 'overhead'];

/** Legend characters that give a value in `layer`: the ones the editor can paint there. */
export function paintChars(stamp: StampV2, layer: LayerName): string[] {
  return Object.keys(stamp.legend).filter((c) => stamp.legend[c]?.[layer] !== undefined);
}

/** The size of a stamp in tiles, read from its first layer. */
export function stampSize(stamp: StampV2): { w: number; h: number } {
  for (const n of LAYER_NAMES) {
    const rows = stamp.layers[n];
    if (rows) return { w: rows[0]?.length ?? 0, h: rows.length };
  }
  return { w: 0, h: 0 };
}

/**
 * Paints one cell of one layer with a legend character, or clears it with a space. Returns a new
 * stamp, so the editor can keep an undo list. The anchor character is left alone unless it is
 * painted over on purpose. A layer the stamp does not have yet is created blank.
 */
export function paintCell(
  stamp: StampV2,
  layer: LayerName,
  x: number,
  y: number,
  ch: string,
): StampV2 {
  const { w, h } = stampSize(stamp);
  if (x < 0 || y < 0 || x >= w || y >= h) throw new Error(`(${x}, ${y}) is outside the stamp`);
  if (ch !== ' ' && !paintChars(stamp, layer).includes(ch))
    throw new Error(`'${ch}' has no ${layer} value in this stamp's legend`);
  const rows = [...(stamp.layers[layer] ?? Array.from({ length: h }, () => ' '.repeat(w)))];
  const row = rows[y] as string;
  rows[y] = row.slice(0, x) + ch + row.slice(x + 1);
  return { ...stamp, layers: { ...stamp.layers, [layer]: rows } };
}

const quote = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/**
 * The `layers` block of a stamp as source text, ready to paste into the stamp's file in a PR. The
 * legend is not exported: the editor only paints characters the legend already has.
 */
export function exportLayers(stamp: StampV2): string {
  const lines = ['layers: {'];
  for (const n of LAYER_NAMES) {
    const rows = stamp.layers[n];
    if (!rows) continue;
    lines.push(`  ${n}: [`);
    for (const r of rows) lines.push(`    ${quote(r)},`);
    lines.push('  ],');
  }
  lines.push('},');
  return lines.join('\n');
}

/**
 * Builds the tile chunks a resolved stamp covers, with the stamp's top left at world tile (0, 0).
 * This is what the editor draws, and it must match what the baker writes for the same stamp, which
 * a test checks.
 */
export function stampToChunks(
  r: ResolvedStamp,
  collisionOf: (cell: NonNullable<ResolvedStamp['cells'][number]>) => number,
): Chunk[] {
  const out = new Map<string, Chunk>();
  const at = (cx: number, cy: number): Chunk => {
    const k = `${cx},${cy}`;
    let c = out.get(k);
    if (!c) out.set(k, (c = createChunk(cx, cy)));
    return c;
  };
  for (let y = 0; y < r.h; y++)
    for (let x = 0; x < r.w; x++) {
      const cell = r.cells[y * r.w + x];
      if (!cell) continue;
      const c = at(Math.floor(x / CHUNK_TILES), Math.floor(y / CHUNK_TILES));
      const i = tileIndex(x % CHUNK_TILES, y % CHUNK_TILES);
      c.ground[i] = cell.ground;
      c.detail[i] = cell.detail ?? 0;
      c.object[i] = cell.object ?? 0;
      c.overhead[i] = cell.overhead ?? 0;
      c.collision[i] = collisionOf(cell);
    }
  return [...out.values()];
}

/** Resolves a stamp for the editor. A bad stamp throws the baker's error, naming layer and cell. */
export function resolveForEditor(stamp: StampV2): ResolvedStamp {
  return resolveStamp(stamp);
}

/**
 * Reads an {@link exportLayers} block back into layers. It understands exactly what the export
 * writes (one quoted row per line), so a pasted block can be checked without evaluating code.
 */
export function parseLayers(text: string): StampV2['layers'] {
  const out: Record<string, string[]> = {};
  let current: string[] | null = null;
  for (const line of text.split('\n')) {
    const head = /^\s*(ground|detail|object|overhead): \[$/.exec(line);
    if (head) {
      current = out[head[1] as string] = [];
      continue;
    }
    if (/^\s*\],?$/.test(line)) {
      current = null;
      continue;
    }
    const row = /^\s*'((?:[^'\\]|\\.)*)',$/.exec(line);
    if (row && current) current.push((row[1] as string).replace(/\\(.)/g, '$1'));
  }
  return out as StampV2['layers'];
}
