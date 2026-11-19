import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/platform/input/layout';
import { meterRect } from '../../src/render/actionMeter';
import { computeViewport } from '../../src/render/viewport';
import { UI_BALANCE } from '../../src/content/balance/ui';
import { avatarOnScreen, lanesFor, overlaps } from '../../src/ui/messages/layout';
import { POOLS_HEIGHT, STATUS_HEIGHT } from '../../src/ui/hud/hud';

/** Phones the plan names: three portrait sizes and one landscape, at the DPRs they ship with. */
const SIZES: [number, number, number][] = [
  [360, 800, 3],
  [390, 844, 3],
  [412, 915, 2.625],
  [915, 412, 2.625],
];

for (const scheme of ['flow', 'classic'] as const)
  for (const hand of [false, true])
    describe(`lanes never overlap (${scheme}, ${hand ? 'left' : 'right'}-handed)`, () => {
      for (const [w, h, dpr] of SIZES) {
        it(`${w} x ${h}`, () => {
          const v = computeViewport(w, h, dpr);
          const controls = computeLayout(w, h, hand, { scheme, guard: true });
          const insets = { top: 0, right: 0, bottom: 0, left: 0 };
          const lanes = lanesFor(v, controls, insets);
          const k = v.cssWidth / v.width;
          // The action meter at its largest (a panel), over the avatar, in CSS px.
          const a = avatarOnScreen(v.width, v.height, v.portrait);
          const m = meterRect(
            a,
            {
              safe: v.safe,
              topLimit: Math.max(
                v.safe.y + 3 + POOLS_HEIGHT + STATUS_HEIGHT + 4,
                Math.ceil(lanes.meterTop / k),
              ),
              zoneTop: Math.round(controls.stickZone.y / k),
            },
            'track',
          );
          const meter = {
            x: m.x * k,
            y: m.y * k,
            w: m.w * k,
            h: (m.h + UI_BALANCE.meter.tailPx) * k,
          };
          const zone = controls.stickZone;
          const named: [string, { x: number; y: number; w: number; h: number }][] = [
            ['banner', lanes.banner],
            ['notices', lanes.notices],
            ['chat', lanes.chat],
            ['floaters', lanes.floaters],
            ['meter', meter],
            ['thumb zone', zone],
          ];
          const bad: string[] = [];
          for (let i = 0; i < named.length; i++)
            for (let j = i + 1; j < named.length; j++) {
              const [an, ar] = named[i]!;
              const [bn, br] = named[j]!;
              // A banner and the notices share their slot: notices wait while a banner shows.
              if (an === 'banner' && bn === 'notices') continue;
              if (overlaps(ar, br)) bad.push(`${an} x ${bn}`);
            }
          expect(bad).toEqual([]);
          // And none of them runs off the screen.
          for (const [n, r] of named.slice(0, 4))
            expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h, n).toBe(true);
        });
      }
    });

describe('lanes keep clear of the HUD buttons', () => {
  it('banner and notices are clear of the menu, bag and swap buttons', () => {
    for (const [w, h, dpr] of SIZES) {
      const v = computeViewport(w, h, dpr);
      const c = computeLayout(w, h, false, { scheme: 'flow' });
      const lanes = lanesFor(v, c, { top: 0, right: 0, bottom: 0, left: 0 });
      for (const b of [c.buttons.menu, c.buttons.bag, c.buttons.swap, c.buttons.context])
        for (const r of [lanes.banner, lanes.notices, lanes.chat])
          expect(overlaps(r, b), `${w}x${h}`).toBe(false);
    }
  });
});
