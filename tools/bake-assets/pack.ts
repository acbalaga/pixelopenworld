/** Deterministic shelf packer. */

export interface PackItem {
  key: string;
  w: number;
  h: number;
}

export interface Placed extends PackItem {
  x: number;
  y: number;
}

const PAD = 1;
export const MAX_ATLAS = 2048;

/** Packs items into a power-of-two-wide atlas. Sort order is fixed, so output never varies. */
export function pack(items: readonly PackItem[]): {
  width: number;
  height: number;
  placed: Placed[];
} {
  const sorted = [...items].sort(
    (a, b) => b.h - a.h || b.w - a.w || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  const widest = sorted.reduce((m, i) => Math.max(m, i.w + PAD * 2), 0);
  const area = sorted.reduce((s, i) => s + (i.w + PAD) * (i.h + PAD), 0);
  let width = 64;
  while ((width < widest || width * width < area * 1.3) && width < MAX_ATLAS) width *= 2;

  const placed: Placed[] = [];
  let x = PAD;
  let y = PAD;
  let rowH = 0;
  for (const it of sorted) {
    if (x + it.w + PAD > width) {
      x = PAD;
      y += rowH + PAD;
      rowH = 0;
    }
    placed.push({ ...it, x, y });
    x += it.w + PAD;
    rowH = Math.max(rowH, it.h);
  }
  const height = y + rowH + PAD;
  if (height > MAX_ATLAS)
    throw new Error(`atlas needs ${width}x${height}, over the ${MAX_ATLAS} limit; split the group`);
  return { width, height, placed };
}
