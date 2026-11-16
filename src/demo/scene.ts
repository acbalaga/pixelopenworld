// Temporary demo scene. Real world rendering arrives with M0-06 and M0-07.
import { attachInput } from '../platform/input/dom';
import { toCommands } from '../platform/input/sampler';
import { startBrowserLoop } from '../platform/loop';
import { Camera } from '../render/camera';
import { Interpolator } from '../render/interp';
import { Canvas2DRenderer, Layer, type TileGrid } from '../render/renderer';
import { watchViewport } from '../render/viewport';
import { setComp } from '../sim/kernel/entities';
import { createDemoState, DEMO_BOX } from '../sim/state';
import { step } from '../sim/step';

const TILE = 16;

function groundGrid(): TileGrid {
  const cols = DEMO_BOX.x / 256 / TILE;
  const rows = DEMO_BOX.y / 256 / TILE;
  const tiles = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles[r * cols + c] = (r + c) % 2;
  return { cols, rows, size: TILE, tiles, colors: ['#2f6b3a', '#3a7a45'], x: 0, y: 0 };
}

/** Runs the demo: entity 0 (yellow) follows input, the rest drift. `?n=500` sets the count. */
export function startScene(canvas: HTMLCanvasElement): { meter: () => unknown } {
  const n = Number(new URLSearchParams(location.search).get('n')) || 30;
  const state = createDemoState(1, n);
  setComp(state.entities, 0, 'vel', { x: 0, y: 0 });
  const worldW = DEMO_BOX.x / 256;
  const worldH = DEMO_BOX.y / 256;

  const renderer = new Canvas2DRenderer(canvas);
  const camera = new Camera(worldW, worldH);
  const interp = new Interpolator();
  const ground = groundGrid();
  const probe = document.getElementById('safe-probe');
  if (!probe) throw new Error('safe-area probe missing');
  const fit = (v: Parameters<Canvas2DRenderer['resize']>[0]): void => {
    renderer.resize(v);
    camera.setView(v.width, v.height, v.portrait);
  };
  const vp = watchViewport(probe, fit);
  fit(vp.current);

  const input = attachInput(canvas, { leftHanded: () => false });
  let prevDir: number | null = null;

  let meter: { begin(t: number): void; end(t: number): void; stats(): unknown } | null = null;
  if (import.meta.env.DEV) {
    void import('../dev/frameMeter').then((m) => {
      const fm = new m.FrameMeter();
      fm.show();
      meter = fm;
    });
  }

  let lastFrame = performance.now();
  startBrowserLoop({
    tick: () => {
      interp.capture(state.entities.comps.pos);
      const rec = input.sampler.sample(performance.now());
      step(state, { commands: toCommands(rec, prevDir) });
      prevDir = rec.moveDir;
    },
    render: (alpha) => {
      const now = performance.now();
      meter?.begin(now);
      const { pos } = state.entities.comps;
      const p0 = pos[0];
      if (p0)
        camera.follow(
          Math.round(interp.x(0, p0.x, alpha)),
          Math.round(interp.y(0, p0.y, alpha)),
          now - lastFrame,
        );
      lastFrame = now;
      renderer.begin(camera.x, camera.y);
      renderer.drawTiles(Layer.Ground, ground);
      for (let id = 0; id < pos.length; id++) {
        const p = pos[id];
        if (!p) continue;
        const x = Math.round(interp.x(id, p.x, alpha));
        const y = Math.round(interp.y(id, p.y, alpha));
        if (id === 0) renderer.drawRect(Layer.Objects, x - 4, y - 8, 8, 8, '#ffd23f');
        else renderer.drawRect(Layer.Objects, x - 3, y - 6, 6, 6, '#e8e8e8');
      }
      renderer.drawRect(Layer.Overhead, 100, 100, 40, 20, 'rgba(20,40,20,0.7)');
      renderer.end();
      meter?.end(performance.now());
    },
  });
  return { meter: () => meter?.stats() };
}
