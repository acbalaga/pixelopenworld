import { Img, toSprite } from '../sprites/gen/img';
import type { SpriteDef } from '../sprites/types';
import { SMALL_GLYPHS } from './small';

/** Palette index glyphs are drawn in (off-white). Text is tinted at runtime, so this is the base. */
export const GLYPH_INK = 3;

/** Describes a pixel font for the runtime. Part of the manifest. */
export interface FontInfo {
  /** Sprite id holding one frame per glyph, named `u` plus the 4 digit hex code point. */
  sprite: string;
  /** Cell size of every glyph frame. */
  cell: [number, number];
  /** Capital letter height in logical px. The text rule works from this. */
  cap: number;
  /** Line height in logical px. */
  line: number;
  /** Advance in px per code point, spacing included. */
  advances: Record<number, number>;
}

/** Frame name for a character. */
export function glyphFrame(code: number): string {
  return `u${code.toString(16).padStart(4, '0')}`;
}

/** Widens 5 columns to 7 by repeating columns 1 and 3, and 7 rows to 9 by repeating rows 2 and 4. */
function enlarge(rows: readonly string[]): string[] {
  const cols = (r: string): string =>
    [...r].flatMap((c, i) => (i === 1 || i === 3 ? [c, c] : [c])).join('');
  return rows.flatMap((r, i) => (i === 2 || i === 4 ? [cols(r), cols(r)] : [cols(r)]));
}

function advance(rows: readonly string[], space: number): number {
  let right = -1;
  for (const r of rows) right = Math.max(right, r.lastIndexOf('#'));
  return right < 0 ? space : right + 2;
}

function build(
  id: string,
  glyphs: Readonly<Record<string, readonly string[]>>,
  cell: [number, number],
  cap: number,
  space: number,
): { sprite: SpriteDef; info: FontInfo } {
  const frames: Record<string, Img> = {};
  const advances: Record<number, number> = {};
  for (const [ch, rows] of Object.entries(glyphs)) {
    const code = ch.codePointAt(0) as number;
    const im = new Img(cell[0], cell[1]);
    rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && im.set(x, y, GLYPH_INK)));
    frames[glyphFrame(code)] = im;
    advances[code] = advance(rows, space);
  }
  return {
    sprite: toSprite(id, 'ui', [0, 0], frames),
    info: { sprite: id, cell, cap, line: cell[1] + 2, advances },
  };
}

const small = build('font.small', SMALL_GLYPHS, [5, 7], 7, 3);
const large = build(
  'font.large',
  Object.fromEntries(Object.entries(SMALL_GLYPHS).map(([ch, rows]) => [ch, enlarge(rows)])),
  [7, 9],
  9,
  4,
);

/** Font sprites for the bake. */
export const FONT_SPRITES: readonly SpriteDef[] = [small.sprite, large.sprite];

/** Font info by name, for the manifest. */
export const FONTS: Readonly<Record<'small' | 'large', FontInfo>> = {
  small: small.info,
  large: large.info,
};
