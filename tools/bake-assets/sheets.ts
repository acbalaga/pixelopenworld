import { ALL_RAMPS, PALETTE } from '../../src/content/sprites/palette';
import type { SpriteDef } from '../../src/content/sprites/types';
import { GLYPHS } from './font3x5';
import { layersFor, type DollSpec } from '../../src/content/dolls/parts';
import { gridFromDef, TRANSPARENT } from '../../src/content/sprites/grid';
import { composeFrame } from '../../src/render/doll';
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

/** Family key: variants of one thing share a row (`prop.tree_oak_1_trunk` joins `prop.tree_oak`). */
function family(id: string): string {
  return id.replace(/_\d+(_trunk|_canopy)?$/, (m) =>
    m.endsWith('trunk') ? '_trunk' : m.endsWith('canopy') ? '_canopy' : '',
  );
}

/**
 * Contact sheet: every frame of every sprite at 1x and 4x, labeled, on a light and a dark
 * background. Variants of one family (grass_0, grass_1, ...) share a block.
 */
export function contactSheet(sprites: readonly SpriteDef[]): Rgba {
  const M = 6;
  type Cell = { name: string; img: Rgba };
  type Block = {
    title: string;
    cw: number;
    ch: number;
    perRow: number;
    cells: Cell[];
    w: number;
    h: number;
  };
  const fam = new Map<string, SpriteDef[]>();
  for (const s of sprites) fam.set(family(s.id), [...(fam.get(family(s.id)) ?? []), s]);
  const blocks: Block[] = [...fam.entries()].map(([title, members]) => {
    const maxW = Math.max(...members.map((m) => m.size[0]));
    const maxH = Math.max(...members.map((m) => m.size[1]));
    const cells: Cell[] = members.flatMap((m) =>
      Object.keys(m.frames).map((f) => ({
        name:
          members.length > 1
            ? `${m.id.slice(title.length).replace(/^_/, '')} ${f === 'base' ? '' : f}`.trim() || f
            : f,
        img: renderFrame(m, f),
      })),
    );
    const cw = Math.max(maxW * 4, 40) + 6;
    const ch = maxH * 5 + 22;
    const perRow = Math.max(1, Math.floor((MAX_W - M * 2) / cw));
    return {
      title,
      cw,
      ch,
      perRow,
      cells,
      w: Math.min(cells.length, perRow) * cw + 6,
      h: Math.ceil(cells.length / perRow) * ch + 6,
    };
  });
  const half = Math.max(...blocks.map((b) => b.w), 120);
  const width = M * 3 + half * 2;
  const height = M + blocks.reduce((sum, b) => sum + 14 + b.h + M, 0);
  const img = newImage(width, height);
  fill(img, 0, 0, width, height, hex('#9a9488'));

  let y = M;
  for (const b of blocks) {
    text(img, b.title, M, y, 2, hex('#f1ebdf'));
    y += 14;
    for (const [bgIdx, bg] of [LIGHT, DARK].entries()) {
      const bx = M + bgIdx * (half + M);
      fill(img, bx, y, half, b.h, bg);
      const label = bgIdx === 0 ? LABEL_ON_LIGHT : LABEL_ON_DARK;
      b.cells.forEach((cell, n) => {
        const cx = bx + 6 + (n % b.perRow) * b.cw;
        const cy = y + 6 + Math.floor(n / b.perRow) * b.ch;
        blit(img, cell.img, cx, cy, 4);
        blit(img, cell.img, cx, cy + cell.img.height * 4 + 3, 1);
        text(img, cell.name, cx, cy + cell.img.height * 5 + 8, 1, label);
      });
    }
    y += b.h + M;
  }
  return img;
}

/** Composed trees: each species and variant with canopy over trunk, as placed in the world. */
export function treeSheet(sprites: readonly SpriteDef[]): Rgba {
  const byId = new Map(sprites.map((s) => [s.id, s]));
  const species = [
    ...new Set(
      sprites
        .filter((s) => /^prop\.tree_.*_trunk$/.test(s.id))
        .map((s) => s.id.replace(/^prop\.tree_/, '').replace(/_\d+_trunk$/, '')),
    ),
  ];
  const variants = sprites.filter(
    (s) => s.id.startsWith(`prop.tree_${species[0]}_`) && s.id.endsWith('_trunk'),
  ).length;
  const SC = 4;
  const cw = 32 * SC + 8;
  const rh = 52 * SC + 22;
  const width = 6 + 2 * (variants * cw + 6) + 6;
  const height = 6 + species.length * rh;
  const img = newImage(width, height);
  fill(img, 0, 0, width, height, hex('#9a9488'));
  species.forEach((sp, r) => {
    const y = 6 + r * rh;
    text(img, sp, 6, y, 2, hex('#f1ebdf'));
    for (const [bi, bg] of [LIGHT, DARK].entries()) {
      const bx = 6 + bi * (variants * cw + 6);
      fill(img, bx, y + 12, variants * cw, rh - 16, bg);
      for (let v = 0; v < variants; v++) {
        const t = byId.get(`prop.tree_${sp}_${v}_trunk`);
        const c = byId.get(`prop.tree_${sp}_${v}_canopy`);
        if (!t || !c) continue;
        const ox = bx + 4 + v * cw;
        // Trunk origin at (16, 46); canopy sits 8 px above it.
        blit(
          img,
          renderFrame(t, 'base'),
          ox + (16 - t.origin[0]) * SC,
          y + 16 + (46 - t.origin[1]) * SC,
          SC,
        );
        blit(
          img,
          renderFrame(c, 'base'),
          ox + (16 - c.origin[0]) * SC,
          y + 16 + (38 - c.origin[1]) * SC,
          SC,
        );
      }
    }
  });
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

const CHARACTER_FRAMES = ['idle_down', 'idle_up', 'idle_right', 'walk_right_0', 'walk_right_2'];

/** A short label for a character spec. */
export function describeDoll(s: DollSpec): string {
  return `${s.body} ${s.skin} ${s.hair} ${s.hairColor} ${s.top} ${s.topColor} ${s.bottom} ${s.bottomColor}`;
}

/** Contact sheet of composed characters: idle in three directions and two walk poses, light and dark. */
export function characterSheet(
  entries: readonly DollSpec[],
  defs: ReadonlyMap<string, SpriteDef>,
): Rgba {
  const SC = 3;
  const cw = 24 * SC + 6;
  const bandW = CHARACTER_FRAMES.length * cw + 6;
  const rowH = 32 * SC + 22;
  const width = 6 + bandW * 2 + 6 + 6;
  const height = 6 + entries.length * rowH + 6;
  const img = newImage(width, height);
  fill(img, 0, 0, width, height, hex('#9a9488'));
  const provider = (id: string, frame: string): Uint8Array =>
    gridFromDef(defs.get(id) as SpriteDef, frame);
  entries.forEach((spec, n) => {
    const y = 6 + n * rowH;
    text(img, describeDoll(spec), 6, y, 1, hex('#f1ebdf'));
    for (const [bi, bg] of [LIGHT, DARK].entries()) {
      const bx = 6 + bi * (bandW + 6);
      fill(img, bx, y + 8, bandW, 32 * SC + 8, bg);
      CHARACTER_FRAMES.forEach((frame, fi) => {
        const px = composeFrame(provider, layersFor(spec), frame);
        for (let j = 0; j < 32; j++) {
          for (let i = 0; i < 24; i++) {
            const v = px[j * 24 + i] as number;
            if (v !== TRANSPARENT)
              fill(
                img,
                bx + 3 + fi * cw + i * SC,
                y + 12 + j * SC,
                SC,
                SC,
                hex(PALETTE[v] as string),
              );
          }
        }
      });
    }
  });
  return img;
}
