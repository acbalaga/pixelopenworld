/**
 * The text rule from design/09: one function decides, for every label, whether pixel text or
 * clear text is used. Pure, so it is unit tested and used the same way everywhere.
 */

/** Minimum physical height of a capital letter for pixel text, in millimeters. */
export const MIN_CAP_HEIGHT_MM = 2.0;
/** Longest string pixel text may show. */
export const MAX_PIXEL_CHARS = 24;
/** Capital heights of the two pixel fonts, in logical px (cells 5x7 and 7x9). */
export const FONT_CAP_PX = { small: 7, large: 9 } as const;

export type PixelFontSize = keyof typeof FONT_CAP_PX;

export interface TextRuleInput {
  text: string;
  /** Number of lines the text would need. */
  lines: number;
  /** Physical size of one logical pixel, from the viewport. */
  physicalMmPerLogicalPx: number;
  /** Which pixel font the element wants. Defaults to the small one. */
  font?: PixelFontSize;
}

export type TextRuleResult =
  | { renderer: 'pixel'; font: PixelFontSize }
  | { renderer: 'clear'; reason: 'multiline' | 'too_long' | 'too_small' };

/**
 * Pixel text only when the text is a single line of at most 24 characters and its capital letters
 * are at least 2.0 mm tall on this device at this scale. Otherwise clear text.
 */
export function chooseTextRenderer(input: TextRuleInput): TextRuleResult {
  const font = input.font ?? 'small';
  if (input.lines > 1 || input.text.includes('\n'))
    return { renderer: 'clear', reason: 'multiline' };
  if ([...input.text].length > MAX_PIXEL_CHARS) return { renderer: 'clear', reason: 'too_long' };
  const capMm = FONT_CAP_PX[font] * input.physicalMmPerLogicalPx;
  if (capMm < MIN_CAP_HEIGHT_MM) return { renderer: 'clear', reason: 'too_small' };
  return { renderer: 'pixel', font };
}

/** WCAG contrast ratio of two `#rrggbb` colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
