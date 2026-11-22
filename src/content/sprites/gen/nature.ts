import type { SpriteDef } from '../types';
import { Img, alignBottom, rng, toSprite } from './img';

/**
 * Seeded generators for trees, bushes and flowers (art bible "Generators"). Each species has its
 * own palette tones, silhouette rule and trunk. A seed changes the shape; the species decides
 * the theme. Output is baked and reviewed on the contact sheet like any other art.
 */

/** Tones lightest last: [deepest, dark, mid, light, highlight]. */
type Tones = readonly [number, number, number, number, number];

export const TREE_SPECIES = ['oak', 'pine', 'birch', 'autumn', 'blossom', 'dead'] as const;
export type TreeSpecies = (typeof TREE_SPECIES)[number];
export const BUSH_KINDS = ['green', 'berry', 'autumn', 'blossom', 'dry'] as const;
export type BushKind = (typeof BUSH_KINDS)[number];
export const FLOWER_COLORS = ['rose', 'ochre', 'violet', 'white'] as const;
export type FlowerColor = (typeof FLOWER_COLORS)[number];
/** Variants generated per species, kind and color. */
export const VARIANTS = 3;

const LEAF: Record<Exclude<TreeSpecies, 'pine' | 'dead'>, Tones> = {
  oak: [8, 9, 10, 11, 47],
  birch: [9, 10, 11, 47, 47],
  autumn: [20, 21, 22, 46, 47],
  blossom: [40, 41, 42, 43, 3],
};

const SIZE = 32;

function inMask(m: boolean[][], x: number, y: number): boolean {
  return m[y]?.[x] === true;
}

/** Shades a mask like foliage: light from the top left, leaf clumps lit above and dark below. */
function shadeLeaves(
  mask: boolean[][],
  tones: Tones,
  r: () => number,
  cx: number,
  cy: number,
  spread: number,
  clumps: number,
): Img {
  const im = new Img(SIZE, SIZE);
  const level = new Int8Array(SIZE * SIZE).fill(-1);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!inMask(mask, x, y)) continue;
      const l = (-(x - cx) * 0.55 - (y - cy) * 0.85) / spread;
      level[y * SIZE + x] = l > 0.55 ? 3 : l > 0.1 ? 2 : l > -0.4 ? 1 : 0;
    }
  }
  for (let k = 0; k < clumps; k++) {
    const px = Math.floor(r() * SIZE);
    const py = Math.floor(r() * SIZE);
    if (!inMask(mask, px, py)) continue;
    const rad = 2 + Math.floor(r() * 2);
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy > rad * rad + 1) continue;
        const i = (py + dy) * SIZE + (px + dx);
        if (
          px + dx < 0 ||
          px + dx >= SIZE ||
          py + dy < 0 ||
          py + dy >= SIZE ||
          (level[i] as number) < 0
        )
          continue;
        if (dx + dy <= -rad) level[i] = Math.min(4, (level[i] as number) + 1);
        else if (dx + dy >= rad) level[i] = Math.max(0, (level[i] as number) - 1);
      }
    }
  }
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = level[y * SIZE + x] as number;
      if (v < 0) continue;
      // Shadow rim: bottom and right edges of the mass take the deepest tone.
      const rim = !inMask(mask, x, y + 1) || !inMask(mask, x + 1, y);
      const lifted = v === 3 && r() < 0.15 ? 4 : v;
      im.set(x, y, tones[rim ? 0 : lifted] as number);
    }
  }
  return im;
}

function roundCanopy(seed: number, tones: Tones, scale: number): Img {
  const r = rng(seed);
  const mask: boolean[][] = Array.from({ length: SIZE }, () => Array<boolean>(SIZE).fill(false));
  const blobs = 5 + Math.floor(r() * 3);
  const list: [number, number, number][] = [[16, 14, 10 * scale + r() * 2]];
  for (let i = 0; i < blobs; i++)
    list.push([
      16 + (r() - 0.5) * 16 * scale,
      14 + (r() - 0.5) * 12 * scale,
      (5 + r() * 4) * scale,
    ]);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      for (const [bx, by, rr] of list)
        if ((x - bx) ** 2 + (y - by) ** 2 <= rr * rr) mask[y]![x] = true;
    }
  }
  // Ragged silhouette: nibble some edge pixels so the outline is not a smooth dome.
  for (let y = 1; y < SIZE - 1; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const edge =
        !inMask(mask, x - 1, y) ||
        !inMask(mask, x + 1, y) ||
        !inMask(mask, x, y - 1) ||
        !inMask(mask, x, y + 1);
      if (mask[y]![x] && edge && r() < 0.18) mask[y]![x] = false;
    }
  }
  return shadeLeaves(mask, tones, r, 16, 13, 14, 16 + Math.floor(r() * 6));
}

function pineCanopy(seed: number): Img {
  const r = rng(seed);
  const im = new Img(SIZE, SIZE);
  const tiers = 3 + (r() < 0.4 ? 1 : 0);
  const tones: Tones = [8, 8, 9, 10, 11];
  let y = 2;
  for (let t = 0; t < tiers; t++) {
    const height = 8 + Math.floor(r() * 2);
    const maxHalf = 5 + t * 2 + Math.floor(r() * 2);
    for (let i = 0; i < height; i++) {
      const half = Math.max(1, Math.round((maxHalf * (i + 1)) / height) + (r() < 0.3 ? 1 : 0));
      const yy = y + i;
      for (let x = 16 - half; x <= 15 + half; x++) {
        const side = (x - 16) / half;
        const lit = side < -0.35 ? 3 : side < 0.3 ? 2 : 1;
        const bottomEdge = i >= height - 1;
        im.set(x, yy, bottomEdge ? tones[0] : (tones[lit] as number));
      }
      if (i % 3 === 1) im.set(16 - half, yy, tones[4]);
    }
    y += height - 3;
  }
  return im;
}

function trunk(species: TreeSpecies, seed: number): Img {
  const r = rng(seed);
  const im = new Img(16, 16);
  const wood: Tones =
    species === 'birch'
      ? [1, 1, 2, 3, 3]
      : species === 'dead'
        ? [1, 1, 2, 17, 18]
        : [4, 4, 5, 6, 7];
  const half = species === 'pine' ? 2 : species === 'birch' ? 2 : 2 + (seed % 2);
  const top = 0;
  for (let y = top; y <= 13; y++) {
    const flare = y >= 12 ? 1 : 0;
    const lean = species === 'dead' ? Math.round(Math.sin(y * 0.6 + seed) * 0.8) : 0;
    for (let x = 8 - half - flare + lean; x <= 7 + half + flare + lean; x++) {
      const side = x - (8 + lean);
      im.set(x, y, side < -half + 1 ? wood[3] : side >= half - 1 ? wood[1] : wood[2]);
    }
  }
  if (species === 'birch') {
    for (let y = 1; y < 13; y += 2 + Math.floor(r() * 2)) {
      im.set(7 + Math.floor(r() * 2), y, 0);
      if (r() < 0.5) im.set(8, y, 1);
    }
  } else {
    for (let y = 3; y < 12; y += 3 + Math.floor(r() * 2))
      im.set(8 + Math.floor(r() * 2), y, wood[0]);
  }
  im.rect(6, 14, 9, 14, wood[0]);
  for (let x = 4; x <= 11; x++) if (r() < 0.8) im.set(x, 15, 8);
  return im;
}

function deadBranches(seed: number): Img {
  const r = rng(seed);
  const im = new Img(SIZE, SIZE);
  const wood: Tones = [0, 0, 1, 2, 3];
  const branch = (x: number, y: number, dx: number, len: number): void => {
    for (let i = 0; i < len; i++) {
      im.set(x, y, i < 2 ? wood[2] : wood[1]);
      y -= 1;
      if (r() < 0.55) x += dx;
      if (i === 3 && len > 6 && r() < 0.7) branch(x, y, -dx, Math.floor(len / 2));
    }
  };
  branch(16, 30, 0, 14);
  branch(16, 28, -1, 11 + Math.floor(r() * 4));
  branch(16, 27, 1, 10 + Math.floor(r() * 4));
  if (r() < 0.6) branch(15, 22, -1, 6);
  return im;
}

function bush(kind: BushKind, seed: number): Img {
  const r = rng(seed);
  const im = new Img(16, 16);
  const tones: Tones =
    kind === 'autumn'
      ? [20, 21, 22, 46, 47]
      : kind === 'blossom'
        ? [40, 41, 42, 43, 3]
        : kind === 'dry'
          ? [4, 5, 6, 44, 45]
          : [8, 9, 10, 11, 47];
  const mask: boolean[][] = Array.from({ length: 16 }, () => Array<boolean>(16).fill(false));
  const blobs: [number, number, number][] = [[8, 9, 4.2 + r() * 1.2]];
  for (let i = 0; i < 3; i++)
    blobs.push([8 + (r() - 0.5) * 7, 9 + (r() - 0.5) * 3, 2.6 + r() * 1.6]);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      for (const [bx, by, rr] of blobs)
        if ((x - bx) ** 2 + (y - by) ** 2 <= rr * rr && y <= 13) mask[y]![x] = true;
  for (let x = 3; x <= 13; x++) if (r() < 0.8) im.set(x, 14, 8);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!mask[y]![x]) continue;
      if (kind === 'dry' && r() < 0.22) continue;
      const l = (-(x - 8) * 0.6 - (y - 8) * 0.9) / 5;
      let v = l > 0.5 ? 3 : l > 0.05 ? 2 : l > -0.45 ? 1 : 0;
      if (!mask[y + 1]?.[x] || !mask[y]![x + 1]) v = 0;
      else if (r() < 0.12) v = Math.min(4, v + 1);
      im.set(x, y, tones[v] as number);
    }
  }
  // No berries: a bush you cannot pick never looks like one you can (POW-M4-22E). The berry kind
  // is a plain bush with a few light leaves.
  if (kind === 'berry')
    for (let i = 0; i < 4; i++) {
      const x = 4 + Math.floor(r() * 8);
      const y = 5 + Math.floor(r() * 6);
      if (im.get(x, y) !== null) im.set(x, y, 11);
    }
  return im;
}

function flower(color: FlowerColor, seed: number): Img {
  const r = rng(seed);
  const im = new Img(8, 8);
  const [main, lit]: [number, number] =
    color === 'rose'
      ? [42, 43]
      : color === 'ochre'
        ? [46, 47]
        : color === 'violet'
          ? [26, 27]
          : [2, 3];
  // A head of at least 3 x 3 petal pixels on a dark green stem. No light green (dewmint's) and
  // no sunwort yellow beside it, so no flower copies a gatherable herb.
  const x = 3 + Math.floor(r() * 2);
  im.rect(x - 1, 1, x + 1, 3, main);
  im.set(x, 2, lit);
  im.set(x, 0, main);
  im.rect(x, 4, x, 7, 9);
  im.set(x - 1, 6, 9);
  return im;
}

const GROUND: [number, number] = [8, 14];

/** Every generated nature sprite. */
export function natureSprites(): SpriteDef[] {
  const out: SpriteDef[] = [];
  for (const sp of TREE_SPECIES) {
    for (let v = 0; v < VARIANTS; v++) {
      const seed = 1000 + TREE_SPECIES.indexOf(sp) * 97 + v * 13;
      const drawn =
        sp === 'pine'
          ? pineCanopy(seed)
          : sp === 'dead'
            ? deadBranches(seed)
            : roundCanopy(seed, LEAF[sp], sp === 'birch' ? 0.8 : 1);
      // Leafy canopies end on row 30 so the trunk shows below them. Bare branches keep their rows.
      const canopy = sp === 'dead' ? drawn : alignBottom(drawn, 30);
      out.push(
        toSprite(`prop.tree_${sp}_${v}_trunk`, 'core', GROUND, { base: trunk(sp, seed + 1) }),
      );
      out.push(toSprite(`prop.tree_${sp}_${v}_canopy`, 'core', [16, 32], { base: canopy }));
    }
  }
  for (const kind of BUSH_KINDS) {
    for (let v = 0; v < VARIANTS; v++)
      out.push(
        toSprite(`prop.bush_${kind}_${v}`, 'core', GROUND, {
          base: bush(kind, 5000 + BUSH_KINDS.indexOf(kind) * 31 + v * 7),
        }),
      );
  }
  for (const c of FLOWER_COLORS) {
    for (let v = 0; v < 2; v++)
      out.push(
        toSprite(`prop.flower_${c}_${v}`, 'core', [4, 7], {
          base: flower(c, 9000 + FLOWER_COLORS.indexOf(c) * 5 + v),
        }),
      );
  }
  return out;
}
