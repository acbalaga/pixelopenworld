import { ALL_RAMPS, PALETTE } from '../../src/content/sprites/palette';
import type { SpriteDef } from '../../src/content/sprites/types';
import { GLYPHS } from './font3x5';
import { fill, hex, newImage, put, type Rgba } from './png';

const LIGHT = hex('#e6e0d2');
const DARK = hex('#20242e');
const LABEL_ON_LIGHT = hex('#1a1614');
const LABEL_ON_DARK = hex('#f1ebdf');

/** Draws text with the 3x5 font at an integer scale. Returns the width used. */
export function text(
  img: Rgba,
  s: string,
  x: number,
  y: number,
  scale: number,
  rgb: readonly [number, number, number],
): number {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS['?'] ?? GLYPHS[' '];
    g?.forEach((row, j) => {
      for (let i = 0; i < 3; i++)
        if (row[i] === '#') fill(img, cx + i * scale, y + j * scale, scale, scale, rgb);
    });
    cx += 4 * scale;
  }
  return cx - x;
}

function frameRgba(sprite: SpriteDef, rows: readonly string[]): Rgba {
  const [w, h] = sprite.size;
  const img = newImage(w, h);
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const idx = sprite.key[row[x] as string];
      if (idx !== null && idx !== undefined) put(img, x, y, hex(PALETTE[idx] as string));
    }
  });
  return img;
}

/** Renders one sprite frame to RGBA. */
export function renderFrame(sprite: SpriteDef, frame: string): Rgba {
  return frameRgba(sprite, sprite.frames[frame] as readonly string[]);
}

function blit(dst: Rgba, src: Rgba, x: number, y: number, scale: number): void {
  for (let j = 0; j < src.height; j++) {
    for (let i = 0; i < src.width; i++) {
      const k = (j * src.width + i) * 4;
      if (src.data[k + 3] === 0) continue;
      fill(dst, x + i * scale, y + j * scale, scale, scale, [
        src.data[k] as number,
        src.data[k + 1] as number,
        src.data[k + 2] as number,
      ]);
    }
  }
}

const MAX_W = 640;

/**
 * Contact sheet for a group: every frame of every sprite at 1x and 4x, labeled with its id, on a
 * light and a dark background.
 */
export function contactSheet(sprites: readonly SpriteDef[]): Rgba {
  const M = 6;
  type Block = { sprite: SpriteDef; cells: { name: string; img: Rgba }[]; w: number; h: number };
  const blocks: Block[] = sprites.map((sprite) => {
    const cells = Object.keys(sprite.frames).map((name) => ({
      name,
      img: renderFrame(sprite, name),
    }));
    const cw = Math.max(sprite.size[0] * 4, 40) + 6;
    const perRow = Math.max(1, Math.floor((MAX_W - M * 2) / cw));
    const rows = Math.ceil(cells.length / perRow);
    const ch = sprite.size[1] * 4 + sprite.size[1] + 22;
    return { sprite, cells, w: Math.min(cells.length, perRow) * cw + 6, h: rows * ch + 6 };
  });
  const width = M * 2 + Math.max(...blocks.map((b) => b.w), 120) * 2 + M;
  const height = M + blocks.reduce((s, b) => s + 14 + b.h + M, 0);
  const img = newImage(width, height);
  fill(img, 0, 0, width, height, hex('#9a9488'));

  let y = M;
  for (const b of blocks) {
    text(img, b.sprite.id, M, y, 2, hex('#f1ebdf'));
    y += 14;
    const half = Math.max(...blocks.map((bb) => bb.w), 120);
    for (const [bgIdx, bg] of [LIGHT, DARK].entries()) {
      const bx = M + bgIdx * (half + M);
      fill(img, bx, y, half, b.h, bg);
      const label = bgIdx === 0 ? LABEL_ON_LIGHT : LABEL_ON_DARK;
      const cw = Math.max(b.sprite.size[0] * 4, 40) + 6;
      const perRow = Math.max(1, Math.floor((MAX_W - M * 2) / cw));
      const ch = b.sprite.size[1] * 4 + b.sprite.size[1] + 22;
      b.cells.forEach((cell, n) => {
        const cx = bx + 6 + (n % perRow) * cw;
        const cy = y + 6 + Math.floor(n / perRow) * ch;
        blit(img, cell.img, cx, cy, 4);
        blit(img, cell.img, cx, cy + b.sprite.size[1] * 4 + 3, 1);
        text(img, cell.name, cx, cy + b.sprite.size[1] * 5 + 8, 1, label);
      });
    }
    y += b.h + M;
  }
  return img;
}

/** The palette swatch sheet for owner review: ramps by row, index and hex under each swatch. */
export function swatchSheet(): Rgba {
  const SW = 64;
  const left = 190;
  const rowH = SW + 30;
  const width = left + 4 * (SW + 8) + 8;
  const height = 8 + ALL_RAMPS.length * rowH + 8;
  const img = newImage(width, height);
  fill(img, 0, 0, width, height, hex('#d8d2c4'));
  ALL_RAMPS.forEach((ramp, r) => {
    const y = 8 + r * rowH;
    text(img, ramp.name, 8, y + 4, 2, hex('#1a1614'));
    ramp.indices.forEach((idx, i) => {
      const x = left + i * (SW + 8);
      const c = PALETTE[idx] as string;
      fill(img, x, y, SW, SW, hex(c));
      text(img, `${idx} ${c}`, x, y + SW + 4, 1, hex('#1a1614'));
    });
  });
  return img;
}
