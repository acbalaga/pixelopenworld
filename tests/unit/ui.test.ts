import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONTS, glyphFrame } from '../../src/content/fonts';
import { SMALL_GLYPHS } from '../../src/content/fonts/small';
import { PALETTE } from '../../src/content/sprites/palette';
import { PANEL_SLICE, uiPanel } from '../../src/content/sprites/ui/panel';
import { SPRITES } from '../../src/content/sprites';
import { SettingsStore } from '../../src/platform/settings';
import { computeViewport } from '../../src/render/viewport';
import {
  FONT_CAP_PX,
  MAX_PIXEL_CHARS,
  MIN_CAP_HEIGHT_MM,
  chooseTextRenderer,
  contrastRatio,
} from '../../src/ui/text/rule';

describe('text rule', () => {
  const ok = 0.53; // a typical phone: 2 CSS px per logical px
  const base = { text: 'HP 120/120', lines: 1, physicalMmPerLogicalPx: ok };

  it('short single line text on a normal phone is pixel text', () => {
    expect(chooseTextRenderer(base)).toEqual({ renderer: 'pixel', font: 'small' });
    expect(chooseTextRenderer({ ...base, font: 'large' })).toEqual({
      renderer: 'pixel',
      font: 'large',
    });
  });

  it('the 24 character threshold: 24 is pixel, 25 is clear', () => {
    expect(chooseTextRenderer({ ...base, text: 'a'.repeat(MAX_PIXEL_CHARS) }).renderer).toBe(
      'pixel',
    );
    expect(chooseTextRenderer({ ...base, text: 'a'.repeat(MAX_PIXEL_CHARS + 1) })).toEqual({
      renderer: 'clear',
      reason: 'too_long',
    });
  });

  it('more than one line is always clear text', () => {
    expect(chooseTextRenderer({ ...base, lines: 2 })).toEqual({
      renderer: 'clear',
      reason: 'multiline',
    });
    expect(chooseTextRenderer({ ...base, text: 'a\nb' })).toEqual({
      renderer: 'clear',
      reason: 'multiline',
    });
  });

  it('the 2.0 mm capital height threshold, per font', () => {
    expect(MIN_CAP_HEIGHT_MM).toBe(2.0);
    const smallEdge = MIN_CAP_HEIGHT_MM / FONT_CAP_PX.small; // about 0.2857 mm per px
    expect(
      chooseTextRenderer({ ...base, physicalMmPerLogicalPx: smallEdge + 0.001 }).renderer,
    ).toBe('pixel');
    expect(chooseTextRenderer({ ...base, physicalMmPerLogicalPx: smallEdge - 0.001 })).toEqual({
      renderer: 'clear',
      reason: 'too_small',
    });
    const largeEdge = MIN_CAP_HEIGHT_MM / FONT_CAP_PX.large; // about 0.222 mm per px
    expect(
      chooseTextRenderer({ ...base, font: 'large', physicalMmPerLogicalPx: largeEdge + 0.001 })
        .renderer,
    ).toBe('pixel');
    expect(
      chooseTextRenderer({ ...base, font: 'large', physicalMmPerLogicalPx: largeEdge - 0.001 })
        .renderer,
    ).toBe('clear');
    // Between the two edges the large font still passes where the small one fails.
    const between = (smallEdge + largeEdge) / 2;
    expect(chooseTextRenderer({ ...base, physicalMmPerLogicalPx: between }).renderer).toBe('clear');
    expect(
      chooseTextRenderer({ ...base, font: 'large', physicalMmPerLogicalPx: between }).renderer,
    ).toBe('pixel');
  });

  it('falls back to clear text automatically on a simulated small-scale device', () => {
    const phone = computeViewport(390, 844, 3);
    const tiny = computeViewport(160, 320, 3); // very small CSS width: each logical pixel is under 0.2 mm
    expect(
      chooseTextRenderer({ ...base, physicalMmPerLogicalPx: phone.mmPerLogicalPx }).renderer,
    ).toBe('pixel');
    expect(tiny.mmPerLogicalPx).toBeLessThan(0.2);
    expect(chooseTextRenderer({ ...base, physicalMmPerLogicalPx: tiny.mmPerLogicalPx })).toEqual({
      renderer: 'clear',
      reason: 'too_small',
    });
  });

  it('counts characters, not UTF-16 units', () => {
    expect(chooseTextRenderer({ ...base, text: '♥'.repeat(24) }).renderer).toBe('pixel');
  });
});

describe('contrast', () => {
  const p = (i: number): string => PALETTE[i] as string;
  it('computes WCAG ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('every text and panel color pair the UI uses is at least 4.5:1', () => {
    const fill = p(16);
    for (const [name, ink] of [
      ['body text', p(3)],
      ['title', p(47)],
      ['pixel ink on outline', p(3)],
    ] as const) {
      const bg = name === 'pixel ink on outline' ? p(0) : fill;
      expect(contrastRatio(ink, bg), name).toBeGreaterThanOrEqual(4.5);
    }
    // The pool colors the HUD draws on the dark outline.
    for (const i of [22, 14, 47])
      expect(contrastRatio(p(i), p(0)), `palette ${i}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe('pixel fonts', () => {
  const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));

  it('cover printable ASCII and the game symbols, with the right cell size', () => {
    for (const ch of ascii) expect(SMALL_GLYPHS[ch], ch).toBeDefined();
    for (const ch of ['×', '·', '♥', '→', '•']) expect(SMALL_GLYPHS[ch], ch).toBeDefined();
    for (const [name, [w, h]] of [
      ['font.small', [5, 7]],
      ['font.large', [7, 9]],
    ] as const) {
      const f = SPRITES.find((s) => s.id === name)!;
      expect(f.size).toEqual([w, h]);
      expect(Object.keys(f.frames)).toHaveLength(Object.keys(SMALL_GLYPHS).length);
      for (const rows of Object.values(f.frames)) {
        expect(rows).toHaveLength(h);
        for (const r of rows) expect(r).toHaveLength(w);
      }
    }
  });

  it('declare cap heights that match the text rule, and an advance for every glyph', () => {
    expect(FONTS.small.cap).toBe(FONT_CAP_PX.small);
    expect(FONTS.large.cap).toBe(FONT_CAP_PX.large);
    for (const font of [FONTS.small, FONTS.large]) {
      for (const ch of ascii)
        expect(font.advances[ch.codePointAt(0) as number], ch).toBeGreaterThanOrEqual(2);
      expect(font.advances[0x69]).toBeLessThan(font.advances[0x6d] as number); // i narrower than m
    }
  });

  it('draw capitals on the top rows so cap height is the cell height', () => {
    for (const ch of 'ABEHMTW') {
      const rows = SMALL_GLYPHS[ch]!;
      expect(rows[0]).toMatch(/#/);
      expect(rows[6]).toMatch(/#/);
    }
  });

  it('the baked manifest carries the font info and the frames exist', () => {
    const m = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'baked', 'manifest.json'), 'utf8'),
    ) as {
      fonts: typeof FONTS;
      sprites: Record<string, { frames: Record<string, unknown> }>;
    };
    expect(m.fonts).toEqual(JSON.parse(JSON.stringify(FONTS)));
    for (const code of [0x41, 0x61, 0x37, 0x2665])
      expect(m.sprites['font.small']!.frames[glyphFrame(code)]).toBeDefined();
  });
});

describe('panel frame', () => {
  it('is a 7 x 7 nine-slice with a 2 px border and a middle the slicer can tile', () => {
    expect(uiPanel.size).toEqual([7, 7]);
    expect(PANEL_SLICE).toBe(2);
    expect(7 - PANEL_SLICE * 2).toBeGreaterThan(0);
    for (const rows of Object.values(uiPanel.frames))
      expect(rows.every((r) => r.length === 7) && rows.length === 7).toBe(true);
    // Corners are symmetric in outline so a mirrored frame matches.
    const f = uiPanel.frames.base!;
    expect(f[0]).toBe(f[6]);
    expect(f[1]![0]).toBe(f[1]![6]);
  });
});

describe('settings store', () => {
  it('starts from the OS reduced motion preference', () => {
    expect(new SettingsStore({ prefersReducedMotion: () => true }).get().reducedMotion).toBe(true);
    expect(new SettingsStore({ prefersReducedMotion: () => false }).get().reducedMotion).toBe(
      false,
    );
  });

  it('clamps scales, notifies on change only, and unsubscribes', () => {
    const s = new SettingsStore({ prefersReducedMotion: () => false });
    const seen: number[] = [];
    const off = s.subscribe((v) => seen.push(v.textScale));
    s.set({ textScale: 5 });
    expect(s.get().textScale).toBe(1.6);
    s.set({ textScale: 0.1 });
    expect(s.get().textScale).toBe(0.8);
    s.set({ textScale: 0.8 });
    expect(seen).toEqual([1.6, 0.8]);
    s.set({ hudScale: 9, handedness: 'left' });
    expect(s.get()).toMatchObject({ hudScale: 1.5, handedness: 'left' });
    expect(seen).toEqual([1.6, 0.8, 0.8]); // the hud and handedness change notified too
    off();
    s.set({ textScale: 1 });
    expect(seen).toHaveLength(3);
  });
});
