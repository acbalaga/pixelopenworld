import { describe, expect, it } from 'vitest';
import {
  ACCESSORIES,
  ACCESSORY_IDS,
  BROW_COUNT,
  DOLL_FRAMES,
  EYE_COUNT,
  FACIALS,
  HAIR_COLORS,
  HAIR_STAMPS,
  HAIR_STYLES,
  HEIGHTS,
  MARK_COUNT,
  MOUTH_COUNT,
  SKIN_TONES,
  layersFor,
  normalizeDoll,
  randomDoll,
  type DollSpec,
} from '../../src/content/dolls/parts';
import { rng } from '../../src/content/sprites/gen/img';
import { SPRITES } from '../../src/content/sprites';
import { gridFromDef, TRANSPARENT } from '../../src/content/sprites/grid';
import { applyHeight, composeFrame, heightShift } from '../../src/render/doll';

const defs = new Map(SPRITES.map((s) => [s.id, s]));
const provider = (id: string, f: string): Uint8Array => gridFromDef(defs.get(id)!, f);
/** A look saved before M4-19: none of the new fields. */
const OLD: DollSpec = {
  body: 'a',
  skin: 'light',
  hair: 'short',
  hairColor: 'brown',
  top: 'tunic',
  topColor: 'blue',
  bottom: 'trousers',
  bottomColor: 'brown',
  mainHand: 'sword',
  offHand: 'none',
};
const compose = (s: DollSpec, f = 'idle_down'): Uint8Array =>
  composeFrame(provider, layersFor(s), f, s.height ?? 'mid');

describe('M4-19 part counts (design/09)', () => {
  it('has 8 eyes, 6 brows, 5 mouths, 5 marks, 12 hair styles, 11 hair colors and 6 skin tones', () => {
    expect(EYE_COUNT).toBe(8);
    expect(BROW_COUNT).toBe(6);
    expect(MOUTH_COUNT).toBe(5);
    expect(MARK_COUNT).toBe(5);
    expect(HAIR_STYLES).toHaveLength(12);
    expect(Object.keys(HAIR_COLORS)).toHaveLength(11);
    expect(Object.keys(SKIN_TONES)).toHaveLength(6);
    expect(FACIALS).toHaveLength(4);
    expect(ACCESSORY_IDS).toHaveLength(6);
    expect(HEIGHTS).toEqual(['short', 'mid', 'tall']);
  });
});

describe('a look saved before M4-19 draws exactly as it did', () => {
  it('takes the neutral entry for every new field, and no stamp layer', () => {
    const n = normalizeDoll(OLD);
    expect(n).toMatchObject({
      height: 'mid',
      eyes: 0,
      brows: 0,
      mouth: 0,
      mark: 0,
      facial: 'none',
      accessory: 'none',
    });
    expect(n.ownColors).toEqual(['blue', 'brown']);
    expect(layersFor(OLD).some((l) => l.stamp)).toBe(false);
    // Every frame is the baked layers alone, as before.
    for (const f of DOLL_FRAMES) expect(compose(OLD, f)).toEqual(compose({ ...OLD, ...n }, f));
  });
});

describe('every new part is drawn, on both bodies, all heights and every frame', () => {
  const variants: [string, Partial<DollSpec>][] = [
    ...Array.from({ length: EYE_COUNT - 1 }, (_, i): [string, Partial<DollSpec>] => [
      `eyes ${i + 1}`,
      { eyes: i + 1 },
    ]),
    ...Array.from({ length: BROW_COUNT - 1 }, (_, i): [string, Partial<DollSpec>] => [
      `brows ${i + 1}`,
      { brows: i + 1 },
    ]),
    ...Array.from({ length: MOUTH_COUNT - 1 }, (_, i): [string, Partial<DollSpec>] => [
      `mouth ${i + 1}`,
      { mouth: i + 1 },
    ]),
    ...Array.from({ length: MARK_COUNT - 1 }, (_, i): [string, Partial<DollSpec>] => [
      `mark ${i + 1}`,
      { mark: i + 1, markColor: 'red' },
    ]),
    ...FACIALS.slice(1).map((f): [string, Partial<DollSpec>] => [`facial ${f}`, { facial: f }]),
    ...Object.keys(ACCESSORIES).map((a): [string, Partial<DollSpec>] => [
      a,
      { accessory: a as NonNullable<DollSpec['accessory']> },
    ]),
    ...Object.keys(HAIR_STAMPS).map((h): [string, Partial<DollSpec>] => [
      h,
      { hair: h as DollSpec['hair'] },
    ]),
  ];
  it('changes the picture from the neutral look', () => {
    for (const [name, patch] of variants) {
      const changed = DOLL_FRAMES.some((f) => {
        const a = compose(OLD, f);
        const b = compose({ ...OLD, ...patch }, f);
        return a.some((v, i) => v !== b[i]);
      });
      expect(changed, name).toBe(true);
    }
  });
  it('stays on the canvas with its outline, on both bodies and at every height', () => {
    for (const [name, patch] of variants)
      for (const body of ['a', 'b'] as const)
        for (const height of HEIGHTS)
          for (const f of DOLL_FRAMES) {
            const px = compose({ ...OLD, ...patch, body, height }, f);
            for (let x = 0; x < 24; x++) {
              expect(px[x], `${name} ${body} ${height} ${f} top`).toBe(TRANSPARENT);
              expect(px[31 * 24 + x], `${name} ${body} ${height} ${f} bottom`).toBe(TRANSPARENT);
            }
            for (let y = 0; y < 32; y++) {
              expect(px[y * 24], `${name} ${f} left`).toBe(TRANSPARENT);
              expect(px[y * 24 + 23], `${name} ${f} right`).toBe(TRANSPARENT);
            }
          }
  });
  it('a second hair color changes the lit steps of the hair', () => {
    const a = compose(OLD);
    const b = compose({ ...OLD, hairStyle2Color: 'rose' });
    expect(a.some((v, i) => v !== b[i])).toBe(true);
  });
});

describe('height is one pixel of leg either way', () => {
  it('short loses a row of leg, tall gains one, and the head and torso do not move', () => {
    const rows = (px: Uint8Array): number[] =>
      Array.from({ length: 32 }, (_, y) =>
        px.slice(y * 24, y * 24 + 24).some((v) => v !== TRANSPARENT) ? y : -1,
      ).filter((y) => y >= 0);
    // Nothing held, because a held item does not change height with the body.
    const bare = { ...OLD, mainHand: 'none' as const };
    const base = compose(bare, 'idle_down');
    const short = compose({ ...bare, height: 'short' }, 'idle_down');
    const tall = compose({ ...bare, height: 'tall' }, 'idle_down');
    const [top, bottom] = [rows(base)[0] as number, rows(base).at(-1) as number];
    expect(rows(short)[0]).toBe(top);
    expect(rows(tall)[0]).toBe(top);
    expect(rows(short).at(-1)).toBe(bottom - 1);
    expect(rows(tall).at(-1)).toBe(bottom + 1);
    // The rows above the cut are untouched.
    expect(short.slice(0, 24 * 24)).toEqual(base.slice(0, 24 * 24));
    expect(tall.slice(0, 24 * 24)).toEqual(base.slice(0, 24 * 24));
    expect([heightShift('short'), heightShift('mid'), heightShift('tall')]).toEqual([-1, 0, 1]);
    expect(applyHeight(base, 'mid')).toBe(base);
  });
});

describe('randomDoll', () => {
  it('fills the new fields, repeatably, and draws', () => {
    const a = randomDoll(rng(9));
    const b = randomDoll(rng(9));
    expect(a).toEqual(b);
    expect(a.height).toBeDefined();
    for (let i = 0; i < 40; i++) {
      const s = randomDoll(rng(100 + i));
      for (const f of DOLL_FRAMES.slice(0, 6)) expect(compose(s, f).length).toBe(24 * 32);
    }
  });
});
