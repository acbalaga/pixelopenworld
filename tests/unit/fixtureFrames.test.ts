import { describe, expect, it } from 'vitest';
import { FIXTURES } from '../../src/content/world/fixtures';
import { SPRITES } from '../../src/content/sprites';
import { fixtureFrame } from '../../src/render/fixtureFrame';

// A fixture asks the atlas for a frame by its type. A frame the sprite does not have throws inside
// the render loop and the game stops drawing (a vent on the plate sprite did exactly that).
describe('fixture sprite frames', () => {
  const sheet = new Map(SPRITES.map((s) => [s.id, new Set(Object.keys(s.frames))]));

  it('every fixture that is drawn has the frame its type asks for, shut and open', () => {
    const missing: string[] = [];
    for (const [kind, def] of Object.entries(FIXTURES)) {
      if (!def.sprite || def.type === 'waystone') continue;
      const frames = sheet.get(def.sprite);
      if (!frames) {
        missing.push(`${kind}: no sprite ${def.sprite}`);
        continue;
      }
      for (const open of [false, true]) {
        const f = fixtureFrame(def.type, open);
        if (!frames.has(f)) missing.push(`${kind} (${def.type}, open ${open}): ${def.sprite}#${f}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
