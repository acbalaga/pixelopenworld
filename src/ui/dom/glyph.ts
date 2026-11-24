import { GLYPHS } from '../../content/chat/glyphs';
import { PALETTE } from '../../content/sprites/palette';

/**
 * Inline chat glyphs (D26): the twelve 8 x 8 pixel images of `content/chat/glyphs`, drawn from
 * their data into a small canvas that sits in the line of clear text at the line's height, with
 * the glyph's name as its `alt` (a labelled image for assistive tech). No OS emoji is ever shown.
 */
const BY_ID = new Map(GLYPHS.map((g) => [g.id, g]));

/** A canvas holding the glyph, or null for an id that is not one. */
export function glyphCanvas(id: string): HTMLCanvasElement | null {
  const g = BY_ID.get(id);
  if (!g) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  canvas.className = 'pow-glyph';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', g.id);
  canvas.title = g.id;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const ink = PALETTE[g.ink] as string;
    const edge = PALETTE[0] as string;
    g.rows.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === '.') return;
        ctx.fillStyle = c === '#' ? ink : edge;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  }
  return canvas;
}

/** Text with `:name:` glyph tokens turned into glyph images, as nodes to append. */
export function richNodes(text: string): Node[] {
  const out: Node[] = [];
  let last = 0;
  for (const m of text.matchAll(/:([a-z]+):/g)) {
    const glyph = glyphCanvas(m[1] as string);
    if (!glyph) continue;
    const at = m.index ?? 0;
    if (at > last) out.push(document.createTextNode(text.slice(last, at)));
    out.push(glyph);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(document.createTextNode(text.slice(last)));
  return out;
}
