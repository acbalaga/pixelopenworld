import { describe, expect, it } from 'vitest';
import type { Renderer } from '../../src/render/renderer';
import { drawFloaters } from '../../src/ui/messages/floaters';
import { MessageRouter } from '../../src/ui/messages/router';
import type { PixelFont } from '../../src/ui/text/pixelFont';

describe('floaters are pixel text in their column', () => {
  it('draws newest at the bottom, one row apart, inside the column', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.post({ lane: 'floater', text: 'Moss', key: 'moss', amount: 2 });
    r.post({ lane: 'floater', text: 'Oak', key: 'oak', amount: 1 });
    const drawn: { text: string; x: number; y: number }[] = [];
    const font = {
      draw: (_r: Renderer, text: string, x: number, y: number) => drawn.push({ text, x, y }),
    } as unknown as PixelFont;
    const col = { x: 120, y: 90, h: 30 };
    drawFloaters({} as Renderer, font, r, col, 10);
    expect(drawn.map((d) => d.text)).toEqual(['+2 Moss', '+1 Oak']);
    // Oak is the newest, so it is the bottom row; Moss sits one row above it.
    expect(drawn[1]!.y).toBe(col.y + col.h - 10);
    expect(drawn[0]!.y).toBe(drawn[1]!.y - 10);
    for (const d of drawn) {
      expect(d.x).toBe(col.x);
      expect(d.y).toBeGreaterThanOrEqual(col.y);
    }
  });

  it('draws nothing while a panel is open, and the pickups are there afterwards', () => {
    const r = new MessageRouter();
    r.update(0, false);
    r.update(50, true);
    r.post({ lane: 'floater', text: 'Moss', amount: 3 });
    const drawn: string[] = [];
    const font = { draw: (_r: Renderer, t: string) => drawn.push(t) } as unknown as PixelFont;
    drawFloaters({} as Renderer, font, r, { x: 0, y: 0, h: 30 });
    expect(drawn).toEqual([]);
    r.update(100, false);
    drawFloaters({} as Renderer, font, r, { x: 0, y: 0, h: 30 });
    expect(drawn).toEqual(['+3 Moss']);
  });
});
