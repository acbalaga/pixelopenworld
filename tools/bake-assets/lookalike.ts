import { ALL_RAMPS } from '../../src/content/sprites/palette';
import type { SpriteDef } from '../../src/content/sprites/types';

/**
 * The look-alike check (POW-M4-22E, extended to item icons by POW-M4-22F). Two sprites that
 * differ in fewer than `LOOKALIKE_MIN` of their pixels are too alike to tell apart at a glance.
 * These are art thresholds, not gameplay numbers, so they live here and not in `balance/`.
 */
export const LOOKALIKE_MIN = 0.2;

/** Members of one tier line (`ICON_VARIANT_GROUPS`) may share a silhouette, so they need less. */
export const LOOKALIKE_VARIANT_MIN = 0.1;

/** A grid of palette indices, `null` for transparent. */
function grid(s: SpriteDef, frame = 'base'): (number | null)[][] {
  return (s.frames[frame] ?? []).map((row) =>
    [...row].map((ch) => (s.key[ch] === undefined ? null : s.key[ch])),
  ) as (number | null)[][];
}

/**
 * The share of pixels that differ between two sprites. Transparent counts as its own value.
 * Sprites of different sizes are lined up bottom center (where their feet are) on the larger
 * canvas.
 */
export function pixelDistance(a: SpriteDef, b: SpriteDef, frame = 'base'): number {
  const ga = grid(a, frame);
  const gb = grid(b, frame);
  const w = Math.max(a.size[0], b.size[0]);
  const h = Math.max(a.size[1], b.size[1]);
  const at = (g: (number | null)[][], s: SpriteDef, x: number, y: number): number | null => {
    const gx = x - Math.floor((w - s.size[0]) / 2);
    const gy = y - (h - s.size[1]);
    return g[gy]?.[gx] ?? null;
  };
  let diff = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (at(ga, a, x, y) !== at(gb, b, x, y)) diff++;
  return diff / (w * h);
}

export interface AlikePair {
  a: string;
  b: string;
  d: number;
}

/** Every pair from `as` against `bs` under the threshold. Pass the same list twice for one set. */
export function lookAlikePairs(
  as: readonly SpriteDef[],
  bs: readonly SpriteDef[],
  min = LOOKALIKE_MIN,
): AlikePair[] {
  const out: AlikePair[] = [];
  const same = as === bs;
  for (let i = 0; i < as.length; i++)
    for (let j = same ? i + 1 : 0; j < bs.length; j++) {
      const a = as[i] as SpriteDef;
      const b = bs[j] as SpriteDef;
      if (a.id === b.id) continue;
      const d = pixelDistance(a, b);
      if (d < min) out.push({ a: a.id, b: b.id, d });
    }
  return out.sort((x, y) => x.d - y.d);
}

const RAMP_OF = new Map<number, string>(
  ALL_RAMPS.flatMap((r) => r.indices.map((i) => [i, r.name] as const)),
);

/**
 * The ramp that most of the differing pixels of two sprites belong to, taken in each sprite. A
 * tier variant must differ in metal or wood color, so this has to differ between the two.
 */
export function differingRamps(a: SpriteDef, b: SpriteDef, frame = 'base'): [string, string] {
  const ga = grid(a, frame);
  const gb = grid(b, frame);
  const count = (g: (number | null)[][], other: (number | null)[][]): string => {
    const n = new Map<string, number>();
    g.forEach((row, y) =>
      row.forEach((c, x) => {
        // Outlines (index 0) and unchanged pixels say nothing about the metal or wood.
        if (c === null || c === 0 || other[y]?.[x] === c) return;
        const r = RAMP_OF.get(c) ?? '';
        n.set(r, (n.get(r) ?? 0) + 1);
      }),
    );
    return [...n].sort((x, y) => y[1] - x[1])[0]?.[0] ?? '';
  };
  return [count(ga, gb), count(gb, ga)];
}
