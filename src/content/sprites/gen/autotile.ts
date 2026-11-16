import { BLOB_MASKS, quadrants, type Quad } from '../../../shared/autotile';
import { EDGE_H, FULL, INNER } from '../../world/autotile';
import { gridFromDef, TRANSPARENT } from '../grid';
import type { SpriteDef } from '../types';
import { Img, toSprite } from './img';

const transpose = (g: readonly string[]): string[] =>
  g[0]!.split('').map((_, c) => g.map((row) => row[c]).join(''));
const flipX = (g: readonly string[]): string[] => g.map((r) => [...r].reverse().join(''));
const flipY = (g: readonly string[]): string[] => [...g].reverse();

const EDGE_V = transpose(EDGE_H);
const CORNER = EDGE_H.map((row, r) =>
  [...row]
    .map((a, c) => {
      const b = EDGE_V[r]![c]!;
      if (a === '#' && b === '#') return '#';
      if (a === '.' || b === '.') return '.';
      return 'e';
    })
    .join(''),
);

const PIECES: Record<Quad, readonly string[]> = {
  full: FULL,
  edge_h: EDGE_H,
  edge_v: EDGE_V,
  corner: CORNER,
  inner: INNER,
};

/** The 16x16 character mask for a blob index: `#` overlay, `.` base, `e` rim. */
export function blobMask(index: number): string[] {
  const q = quadrants(BLOB_MASKS[index] as number);
  const tl = PIECES[q.tl];
  const tr = flipX(PIECES[q.tr]);
  const bl = flipY(PIECES[q.bl]);
  const br = flipY(flipX(PIECES[q.br]));
  return [...tl.map((r, i) => r + tr[i]), ...bl.map((r, i) => r + br[i])];
}

/** Overlay terrain to build blob sprites for. */
export interface Overlay {
  /** Sprite id of the generated blob set. */
  id: string;
  /** Source sprite whose frames are the overlay texture, one per animation phase. */
  source: SpriteDef;
  frames: readonly string[];
  /** Palette index of the rim pixels. */
  rim: number;
}

/** Frame name for a blob index and animation phase. */
export function blobFrameName(index: number, phase: number): string {
  return `b${String(index).padStart(2, '0')}_${phase}`;
}

/** Builds the 47-blob sprite for an overlay terrain: transparent where the base shows through. */
export function autotileSprite(o: Overlay): SpriteDef {
  const frames: Record<string, Img> = {};
  o.frames.forEach((frameName, phase) => {
    const tex = gridFromDef(o.source, frameName);
    for (let i = 0; i < BLOB_MASKS.length; i++) {
      const mask = blobMask(i);
      const im = new Img(16, 16);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const m = mask[y]![x];
          if (m === '#') {
            const v = tex[y * 16 + x] as number;
            im.set(x, y, v === TRANSPARENT ? null : v);
          } else if (m === 'e') {
            im.set(x, y, o.rim);
          }
        }
      }
      frames[blobFrameName(i, phase)] = im;
    }
  });
  return toSprite(o.id, 'core', [0, 0], frames);
}
