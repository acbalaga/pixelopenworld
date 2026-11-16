// Temporary demo scene. Real world rendering arrives with M0-06 and M0-07.
import { attachInput } from '../platform/input/dom';
import { toCommands } from '../platform/input/sampler';
import { startBrowserLoop } from '../platform/loop';
import { Camera } from '../render/camera';
import { Interpolator } from '../render/interp';
import { Canvas2DRenderer, Layer, type TileGrid } from '../render/renderer';
import { watchViewport } from '../render/viewport';
import { loadAtlas, type Manifest } from '../render/atlas';
import manifest from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import { setComp } from '../sim/kernel/entities';
import { createDemoState, DEMO_BOX } from '../sim/state';
import { step } from '../sim/step';

const TILE = 16;
const KIND = { grass0: 0, grass1: 1, grass2: 2, dirt: 3, water: 4 } as const;

function kindAt(c: number, r: number): number {
  if (c >= 40 && c <= 51 && r >= 40 && r <= 49) return KIND.water;
  if (c === 30 || c === 31 || r === 20 || r === 21) return KIND.dirt;
  const h = Math.imul(c * 73856093, 1) ^ Math.imul(r * 19349663, 1);
  return (h >>> 7) % 3;
}

function groundGrid(frameOf: (kind: number) => number): TileGrid {
  const cols = DEMO_BOX.x / 256 / TILE;
  const rows = DEMO_BOX.y / 256 / TILE;
  const tiles = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles[r * cols + c] = kindAt(c, r);
  return { cols, rows, size: TILE, tiles, frameOf, x: 0, y: 0 };
}

/** Deterministic scatter of props, away from the start point. */
function scatter(count: number, seed: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let s = seed;
  while (out.length < count) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const x = 40 + (s % 940);
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const y = 40 + (s % 940);
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    const k = kindAt(c, r);
    if (k === KIND.water || k === KIND.dirt) continue;
    if (Math.hypot(x - 512, y - 512) < 60) continue;
    out.push({ x, y });
  }
  return out;
}

const FACING = { N: 'up', S: 'down', E: 'right', W: 'left' } as const;
function facingOf(dir: number): keyof typeof FACING {
  if (dir === 0) return 'N';
  if (dir === 4) return 'S';
  return dir >= 1 && dir <= 3 ? 'E' : 'W';
}

/** Runs the demo: entity 0 (yellow) follows input, the rest drift. `?n=500` sets the count. */
export async function startScene(canvas: HTMLCanvasElement): Promise<void> {
  const atlas = await loadAtlas(manifest as Manifest, { core: coreUrl });
  const n = Number(new URLSearchParams(location.search).get('n')) || 30;
  const state = createDemoState(1, n);
  setComp(state.entities, 0, 'vel', { x: 0, y: 0 });
  const worldW = DEMO_BOX.x / 256;
  const worldH = DEMO_BOX.y / 256;

  const renderer = new Canvas2DRenderer(canvas);
  const camera = new Camera(worldW, worldH);
  const interp = new Interpolator();
  renderer.setAtlas(atlas);
  const tileFrames = [
    atlas.frame('tile.grass_0', 'base'),
    atlas.frame('tile.grass_1', 'base'),
    atlas.frame('tile.grass_2', 'base'),
    atlas.frame('tile.dirt', 'base'),
  ];
  const waterAnim = atlas.anim('tile.water', 'flow');
  let clock = 0;
  const ground = groundGrid((k) =>
    k === KIND.water ? atlas.animFrame(waterAnim, clock) : (tileFrames[k] as number),
  );
  const trunk = atlas.frame('prop.tree_trunk', 'base');
  const canopy = atlas.frame('prop.tree_canopy', 'base');
  const rock = atlas.frame('prop.rock', 'base');
  const trees = scatter(28, 11);
  const rocks = scatter(14, 29);
  const hum = 'char.placeholder_humanoid';
  const walk = {
    up: atlas.anim(hum, 'walk_up'),
    down: atlas.anim(hum, 'walk_down'),
    right: atlas.anim(hum, 'walk_right'),
    left: atlas.anim(hum, 'walk_left'),
  };
  const idle = {
    up: atlas.anim(hum, 'idle_up'),
    down: atlas.anim(hum, 'idle_down'),
    right: atlas.anim(hum, 'idle_right'),
    left: atlas.anim(hum, 'idle_left'),
  };
  let facing: keyof typeof FACING = 'S';
  let moving = false;
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
      moving = rec.moveDir !== null;
      if (rec.moveDir !== null) facing = facingOf(rec.moveDir);
    },
    render: (alpha) => {
      const now = performance.now();
      clock = now;
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
        if (id === 0) {
          const set = moving ? walk : idle;
          const anim = set[FACING[facing]];
          renderer.drawSprite(
            Layer.Objects,
            atlas.animFrame(anim, now),
            x,
            y,
            atlas.animFlip(anim),
          );
        } else renderer.drawRect(Layer.Objects, x - 3, y - 6, 6, 6, '#e8e8e8');
      }
      for (const t of trees) {
        renderer.drawSprite(Layer.Objects, trunk, t.x, t.y);
        renderer.drawSprite(Layer.Overhead, canopy, t.x, t.y - 8);
      }
      for (const r of rocks) renderer.drawSprite(Layer.Objects, rock, r.x, r.y);
      renderer.end();
      meter?.end(performance.now());
    },
  });
}
