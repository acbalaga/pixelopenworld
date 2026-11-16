// Temporary demo for M0-09: pixel HUD text, on-screen controls, and a clear text dialogue sheet.
//   ?text=1.6  start with a text scale
import manifest from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import uiUrl from '../../baked/atlas-ui.png?url';
import panelBase from '../../baked/ui-panel-base.png?url';
import panelPressed from '../../baked/ui-panel-pressed.png?url';
import { PALETTE } from '../content/sprites/palette';
import { FONTS } from '../content/fonts';
import { attachInput } from '../platform/input/dom';
import { computeLayout } from '../platform/input/layout';
import { startBrowserLoop } from '../platform/loop';
import { browserSettingsEnv, SettingsStore } from '../platform/settings';
import { loadAtlas, type Manifest } from '../render/atlas';
import { Canvas2DRenderer, Layer } from '../render/renderer';
import { readSafeInsets, watchViewport, type ViewportInfo } from '../render/viewport';
import { PanelCache } from '../ui/panel';
import { drawCanvasButton, type ButtonKit } from '../ui/hud/canvasButton';
import { PixelFont } from '../ui/text/pixelFont';
import { chooseTextRenderer } from '../ui/text/rule';
import {
  applyPaletteVars,
  applyPanelImages,
  applyPixelScale,
  applySettings,
  createOverlay,
} from '../ui/dom/overlay';
import { ClearTextPanel, createDomButton } from '../ui/dom/clearTextPanel';

const INK = PALETTE[3] as string;
const DARK = PALETTE[0] as string;
const GOLD = PALETTE[47] as string;
const RED = PALETTE[22] as string;
const BLUE = PALETTE[14] as string;

const LABELS: Record<string, string> = {
  tech1: '1',
  tech2: '2',
  tech3: '3',
  tech4: '4',
  dodge: 'D',
  context: 'E',
  menu: 'M',
  bag: 'B',
};

export async function startUiDemo(canvas: HTMLCanvasElement): Promise<void> {
  const m = manifest as unknown as Manifest & { fonts: typeof FONTS };
  const atlas = await loadAtlas(m, { core: coreUrl, ui: uiUrl });
  const uiImage = atlas.image(atlas.frame('ui.panel', 'base')) as HTMLImageElement;

  const settings = new SettingsStore(browserSettingsEnv());
  const initial = Number(new URLSearchParams(location.search).get('text'));
  if (initial) settings.set({ textScale: initial });

  const root = createOverlay();
  applyPaletteVars(document.documentElement);
  applyPanelImages(document.documentElement, panelBase, panelPressed);
  applySettings(root, settings.get());
  settings.subscribe((s) => applySettings(root, s));

  new ClearTextPanel(root, {
    title: 'Mara, ferry keeper',
    paragraphs: [
      'The river runs high this time of year. If you are headed for the east bank, take the lower road past the mill and keep to the left, where the planks are newer.',
      'Come back with a few coins and I will see about a crossing. Mind the third post, it wobbles.',
    ],
    className: 'pow-dialogue',
  });
  const row = document.createElement('div');
  row.className = 'pow-row';
  root.appendChild(row);
  for (const [label, scale] of [
    ['Text 80%', 0.8],
    ['Text 100%', 1],
    ['Text 160%', 1.6],
  ] as const)
    createDomButton(row, label, () => settings.set({ textScale: scale }));

  const renderer = new Canvas2DRenderer(canvas);
  renderer.setAtlas(atlas);
  const panels = new PanelCache(atlas);
  const fonts = {
    small: new PixelFont(atlas, m, m.fonts.small, uiImage),
    large: new PixelFont(atlas, m, m.fonts.large, uiImage),
  };
  const grass = ['tile.grass_0', 'tile.grass_1', 'tile.grass_2'].map((id) =>
    atlas.frame(id, 'base'),
  );

  const probe = document.getElementById('safe-probe');
  if (!probe) throw new Error('safe-area probe missing');
  let vpInfo: ViewportInfo;
  const fit = (v: ViewportInfo): void => {
    vpInfo = v;
    renderer.resize(v);
    applyPixelScale(document.documentElement, v.scale / v.dpr);
  };
  const vp = watchViewport(probe, fit);
  fit(vp.current);

  const input = attachInput(canvas, {
    leftHanded: () => settings.get().handedness === 'left',
    hudScale: () => settings.get().hudScale,
    insets: () => readSafeInsets(probe),
  });
  const flash = new Map<string, number>();
  let hp = 120;
  let tick = 0;

  startBrowserLoop({
    tick: () => {
      tick++;
      const rec = input.sampler.sample(performance.now());
      const now = performance.now();
      rec.technique.forEach((on, i) => on && flash.set(`tech${i + 1}`, now + 140));
      if (rec.dodge) flash.set('dodge', now + 140);
      if (rec.context) flash.set('context', now + 140);
      if (rec.menu) flash.set('menu', now + 140);
      if (rec.bag) flash.set('bag', now + 140);
      if (tick % 45 === 0) hp = hp <= 20 ? 120 : hp - 10;
    },
    render: () => {
      const now = performance.now();
      const v = vpInfo;
      renderer.begin(0, 0);
      for (let ty = 0; ty * 16 < v.height; ty++)
        for (let tx = 0; tx * 16 < v.width; tx++)
          renderer.drawSprite(
            Layer.Ground,
            grass[(tx * 7 + ty * 13) % 3] as number,
            tx * 16,
            ty * 16,
          );

      // HUD row: pools in pixel text, top left, inside the safe rect.
      const sx = v.safe.x + 3;
      const sy = v.safe.y + 3;
      const kit: ButtonKit = {
        panels,
        fonts,
        mmPerLogicalPx: v.mmPerLogicalPx,
        ink: INK,
        outline: DARK,
      };
      const hudLine = (label: string, value: string, y: number, color: string): void => {
        const rule = chooseTextRenderer({
          text: `${label} ${value}`,
          lines: 1,
          physicalMmPerLogicalPx: v.mmPerLogicalPx,
          font: 'small',
        });
        if (rule.renderer !== 'pixel') return;
        fonts.small.draw(renderer, label, sx, y + 1, INK, { outline: DARK });
        fonts.large.draw(renderer, value, sx + 20, y - 1, color, { outline: DARK });
      };
      hudLine('HP', `${hp}/120`, sy, RED);
      hudLine('MP', '45/60', sy + 14, BLUE);
      fonts.small.draw(renderer, 'DAY 4  09:41', sx, sy + 30, INK, { outline: DARK });
      fonts.small.draw(renderer, '♥ 3   GOLD 1,250', sx, sy + 41, GOLD, { outline: DARK });

      // Controls, in logical px, from the same layout the input uses.
      const k = v.dpr / v.scale;
      const css = canvas.getBoundingClientRect();
      const layout = computeLayout(css.width, css.height, settings.get().handedness === 'left', {
        hudScale: settings.get().hudScale,
        insets: readSafeInsets(probe),
      });
      const held = new Set<string>(input.sampler.keyboard.held());
      for (const [id, r] of Object.entries(layout.buttons)) {
        const rect = {
          x: Math.round(r.x * k),
          y: Math.round(r.y * k),
          w: Math.round(r.w * k),
          h: Math.round(r.h * k),
        };
        const pressed = (flash.get(id) ?? 0) > now || held.has(id);
        drawCanvasButton(renderer, kit, rect, LABELS[id] ?? '?', pressed);
      }
      const stick = input.sampler.touch.stickBase();
      if (stick) {
        const o = { x: Math.round(stick.origin.x * k), y: Math.round(stick.origin.y * k) };
        const t = { x: Math.round(stick.thumb.x * k), y: Math.round(stick.thumb.y * k) };
        const lim = 18;
        const dx = Math.max(-lim, Math.min(lim, t.x - o.x));
        const dy = Math.max(-lim, Math.min(lim, t.y - o.y));
        panels.draw(renderer, o.x - 16, o.y - 16, 32, 32);
        panels.draw(renderer, o.x + dx - 7, o.y + dy - 7, 14, 14, 'pressed');
      }
      renderer.end();
    },
  });
}
