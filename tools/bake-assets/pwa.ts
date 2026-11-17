/**
 * PWA assets from one authored pixel emblem (tech/03 "Icons and PWA assets"): the icons at integer
 * scales, a maskable icon with the safe zone respected, and the web app manifest. Colors come from
 * the master palette. Output goes to `public/`, where Vite copies it to the site root.
 */
import { PALETTE } from '../../src/content/sprites/palette';
import { encodePng, fill, hex, newImage, put, type Rgba } from './png';

/** Palette indices used by the emblem. */
const BG = 0;
const SUN = [22, 23];
const PEAK = [17, 18, 19];
const HILL = [9, 10];
const WATER = [13, 14];

/** The emblem: a sun rising over stone peaks, a green rise and a stream. 16 by 16, palette indices. */
export function emblem(): (number | null)[][] {
  const g: (number | null)[][] = Array.from({ length: 16 }, () =>
    Array<number | null>(16).fill(BG),
  );
  const set = (x: number, y: number, c: number): void => {
    if (x >= 0 && x < 16 && y >= 0 && y < 16) (g[y] as (number | null)[])[x] = c;
  };
  // Sun: a 4 by 4 disc with the corners cut, lit toward the top left.
  for (let y = 2; y < 6; y++)
    for (let x = 9; x < 13; x++) {
      const corner = (x === 9 || x === 12) && (y === 2 || y === 5);
      if (!corner) set(x, y, x + y < 14 ? (SUN[1] as number) : (SUN[0] as number));
    }
  // Peaks: two triangles, the right one lower, shaded on their right faces.
  const peak = (cx: number, top: number, base: number): void => {
    for (let y = top; y <= base; y++) {
      const half = y - top;
      for (let x = cx - half; x <= cx + half; x++)
        set(
          x,
          y,
          x > cx ? (PEAK[0] as number) : x === cx ? (PEAK[1] as number) : (PEAK[1] as number),
        );
      set(cx - half, y, PEAK[2] as number);
    }
    set(cx, top, PEAK[2] as number);
  };
  peak(5, 5, 11);
  peak(10, 8, 11);
  // Green rise across the foot of the peaks.
  for (let x = 0; x < 16; x++) {
    const h = 11 + (x % 5 === 2 ? -1 : 0);
    for (let y = h; y < 14; y++) set(x, y, y === h ? (HILL[1] as number) : (HILL[0] as number));
  }
  // A stream.
  for (let x = 0; x < 16; x++) {
    set(x, 14, WATER[0] as number);
    set(x, 15, (x + 1) % 4 < 2 ? (WATER[1] as number) : (WATER[0] as number));
  }
  return g;
}

/** Draws the emblem at an integer scale, centred on a square canvas of `size` px over `bg`. */
function render(size: number, scale: number, bgHex: string): Rgba {
  const img = newImage(size, size);
  fill(img, 0, 0, size, size, hex(bgHex));
  const off = Math.floor((size - 16 * scale) / 2);
  const g = emblem();
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const c = g[y]?.[x];
      if (c === null || c === undefined) continue;
      const rgb = hex(PALETTE[c] as string);
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++)
          put(img, off + x * scale + dx, off + y * scale + dy, rgb);
    }
  return img;
}

/** The colors the manifest and the page share. Both come from the palette. */
export const THEME = PALETTE[BG] as string;

export const MANIFEST = {
  name: 'Pixel Open World',
  short_name: 'Pixel World',
  description: 'A pixel RPG that plays in the browser and keeps playing offline.',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'any',
  background_color: THEME,
  theme_color: THEME,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: '/icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
} as const;

/** Every generated PWA file, keyed by path under `public/`. */
export function bakePwa(): Map<string, Uint8Array | string> {
  const out = new Map<string, Uint8Array | string>();
  // 12 x 16 = 192, 32 x 16 = 512. The maskable icon keeps the emblem inside the central 80%
  // (a circle of radius 40% of the side, 204 px): 18 x 16 = 288 px has a half diagonal of 204.
  out.set('icons/icon-192.png', encodePng(render(192, 12, THEME)));
  out.set('icons/icon-512.png', encodePng(render(512, 32, THEME)));
  out.set('icons/icon-maskable-512.png', encodePng(render(512, 18, THEME)));
  out.set('manifest.webmanifest', `${JSON.stringify(MANIFEST, null, 2)}\n`);
  return out;
}
