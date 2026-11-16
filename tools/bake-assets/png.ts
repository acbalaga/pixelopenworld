import { PNG } from 'pngjs';

/** An RGBA image. */
export interface Rgba {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Creates a transparent image. */
export function newImage(width: number, height: number): Rgba {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Parses `#rrggbb`. */
export function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

/** Sets one pixel. Out of range is ignored. */
export function put(
  img: Rgba,
  x: number,
  y: number,
  rgb: readonly [number, number, number],
  a = 255,
): void {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = rgb[0];
  img.data[i + 1] = rgb[1];
  img.data[i + 2] = rgb[2];
  img.data[i + 3] = a;
}

/** Fills a rectangle. */
export function fill(
  img: Rgba,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: readonly [number, number, number],
): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(img, x + i, y + j, rgb);
}

export function encodePng(img: Rgba): Uint8Array {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  return new Uint8Array(PNG.sync.write(png, { deflateLevel: 9, colorType: 6 }));
}

/** Decodes a PNG to raw RGBA. The drift check compares pixels, so it does not depend on zlib. */
export function decodePng(bytes: Uint8Array): Rgba {
  const png = PNG.sync.read(Buffer.from(bytes));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}
