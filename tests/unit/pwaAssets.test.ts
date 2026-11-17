import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../../src/content/sprites/palette';
import { decodePng } from '../../tools/bake-assets/png';

const pub = (p: string): Buffer => readFileSync(join(process.cwd(), 'public', p));
const manifest = JSON.parse(pub('manifest.webmanifest').toString('utf8')) as {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};

describe('web app manifest (installability checklist)', () => {
  it('has the fields a browser needs to offer install', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });
  it('takes its colors from the palette', () => {
    expect(PALETTE).toContain(manifest.theme_color);
    expect(manifest.background_color).toBe(manifest.theme_color);
  });
  it('has 192 and 512 icons and a maskable one, all real PNGs of the stated size', () => {
    const purposes = manifest.icons.map((i) => `${i.sizes}:${i.purpose}`).sort();
    expect(purposes).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
    for (const i of manifest.icons) {
      const img = decodePng(pub(i.src.slice(1)));
      expect(`${img.width}x${img.height}`).toBe(i.sizes);
    }
  });
  it('keeps the maskable emblem inside the safe zone, a circle of 40% of the side', () => {
    const maskable = manifest.icons.find((i) => i.purpose === 'maskable');
    const img = decodePng(pub((maskable as { src: string }).src.slice(1)));
    const bg = [...img.data.slice(0, 3)];
    const c = img.width / 2;
    const limit = img.width * 0.4 + 1;
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) {
        const i = (y * img.width + x) * 4;
        if (img.data[i] === bg[0] && img.data[i + 1] === bg[1] && img.data[i + 2] === bg[2])
          continue;
        expect(Math.hypot(x + 0.5 - c, y + 0.5 - c)).toBeLessThanOrEqual(limit);
      }
  });
  it('is linked from the page, with an apple touch icon', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});
