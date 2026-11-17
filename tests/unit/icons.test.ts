import { describe, expect, it } from 'vitest';
import { TECHNIQUES } from '../../src/content/combat/attacks';
import { SPRITES } from '../../src/content/sprites';
import { BUTTON_ICONS, UI_ICONS } from '../../src/content/sprites/ui/icons';
import { gridFromDef, TRANSPARENT } from '../../src/content/sprites/grid';
import { BUILD_ID, BUILD_LABEL, BUILD_TIME } from '../../src/shared/version';

const byId = new Map(SPRITES.map((s) => [s.id, s]));

describe('button icons', () => {
  it('every icon is a 12 x 12 sprite in the ui group with drawn pixels', () => {
    expect(UI_ICONS.length).toBeGreaterThanOrEqual(5);
    for (const s of UI_ICONS) {
      expect(s.size).toEqual([12, 12]);
      expect(s.group).toBe('ui');
      const px = gridFromDef(s, 'base');
      expect(px.filter((v) => v !== TRANSPARENT).length, s.id).toBeGreaterThan(12);
      expect(byId.has(s.id)).toBe(true);
    }
  });
  it('every technique and every on-screen button with an icon names a sprite that exists', () => {
    for (const t of Object.values(TECHNIQUES)) expect(byId.has(t.icon), t.id).toBe(true);
    for (const id of Object.values(BUTTON_ICONS)) expect(byId.has(id), id).toBe(true);
  });
  it('the icons are all different pictures', () => {
    const pics = UI_ICONS.map((s) => gridFromDef(s, 'base').join());
    expect(new Set(pics).size).toBe(pics.length);
  });
});

describe('build label', () => {
  it('is the short commit id and the build time', () => {
    expect(BUILD_ID.length).toBeLessThanOrEqual(7);
    expect(BUILD_LABEL).toBe(`${BUILD_ID} ${BUILD_TIME}`);
    expect(BUILD_TIME).toMatch(/^\d\d-\d\d \d\d:\d\d$/);
  });
});
