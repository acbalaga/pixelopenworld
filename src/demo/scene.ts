// Temporary demo scene. Real world rendering arrives with M0-07.
import manifest from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import { randomDoll, type DollSpec } from '../content/dolls/parts';
import { BIOMES, type Biome, type Weighted } from '../content/nature/biomes';
import type { DevOverlay } from '../dev/overlay';
import { attachInput } from '../platform/input/dom';
import { toCommands } from '../platform/input/sampler';
import { startBrowserLoop } from '../platform/loop';
import { loadAtlas, type Atlas, type Manifest } from '../render/atlas';
import { Camera } from '../render/camera';
import { DollFactory } from '../render/dollSprite';
import { Interpolator } from '../render/interp';
import { Canvas2DRenderer, Layer, type LayerId, type TileGrid } from '../render/renderer';
import { watchViewport } from '../render/viewport';
import { setComp } from '../sim/kernel/entities';
import { createDemoState, DEMO_BOX } from '../sim/state';
import { step } from '../sim/step';

const TILE = 16;
const KIND = { grass0: 0, grass1: 1, grass2: 2, dirt: 3, water: 4 } as const;
const WORLD = DEMO_BOX.x / 256;

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

/** Biome by quadrant, with a wasteland patch in the north east corner. */
function biomeAt(x: number, y: number): Biome {
  if (x > 800 && y < 200) return BIOMES.wasteland;
  if (x < WORLD / 2) return y < WORLD / 2 ? BIOMES.temperate : BIOMES.autumn_grove;
  return y < WORLD / 2 ? BIOMES.pine_forest : BIOMES.blossom_grove;
}

interface Prop {
  layer: LayerId;
  handle: number;
  x: number;
  y: number;
  /** Second sprite for trees: the canopy, drawn overhead. */
  canopy?: number;
}

function lcg(seed: number): () => number {
  let s = Math.imul(seed >>> 0, 2654435761) >>> 0;
  for (let i = 0; i < 8; i++) s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function weighted<T>(r: () => number, table: Weighted<T>): T {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let roll = r() * total;
  for (const [item, w] of table) {
    roll -= w;
    if (roll < 0) return item;
  }
  return (table[table.length - 1] as readonly [T, number])[0];
}

/** Seeded scatter by biome: species and variant by seed, never on water, road or the start. */
function scatterProps(atlas: Atlas, seed: number): Prop[] {
  const r = lcg(seed);
  const out: Prop[] = [];
  const free = (x: number, y: number): boolean => {
    const k = kindAt(Math.floor(x / TILE), Math.floor(y / TILE));
    return k !== KIND.water && k !== KIND.dirt && Math.hypot(x - 512, y - 512) > 70;
  };
  const place = (count: number, make: (b: Biome) => Prop | null): void => {
    for (let i = 0; i < count; i++) {
      const x = 24 + r() * (WORLD - 48);
      const y = 40 + r() * (WORLD - 60);
      if (!free(x, y)) continue;
      const p = make(biomeAt(x, y));
      if (p) out.push({ ...p, x: Math.round(x), y: Math.round(y) });
    }
  };
  const area = (WORLD * WORLD) / 10000;
  place(Math.round(area * 0.55 * 4), (b) => {
    if (r() > b.treeDensity / 0.7) return null;
    const sp = weighted(r, b.trees);
    const v = Math.floor(r() * 3);
    return {
      layer: Layer.Objects,
      handle: atlas.frame(`prop.tree_${sp}_${v}_trunk`, 'base'),
      canopy: atlas.frame(`prop.tree_${sp}_${v}_canopy`, 'base'),
      x: 0,
      y: 0,
    };
  });
  place(Math.round(area * 0.5 * 4), (b) => {
    if (r() > b.bushDensity / 0.55) return null;
    const k = weighted(r, b.bushes);
    return {
      layer: Layer.Objects,
      handle: atlas.frame(`prop.bush_${k}_${Math.floor(r() * 3)}`, 'base'),
      x: 0,
      y: 0,
    };
  });
  place(Math.round(area * 1.6 * 4), (b) => {
    if (b.flowers.length === 0 || r() > b.flowerDensity / 1.6) return null;
    const c = weighted(r, b.flowers);
    return {
      layer: Layer.Detail,
      handle: atlas.frame(`prop.flower_${c}_${Math.floor(r() * 2)}`, 'base'),
      x: 0,
      y: 0,
    };
  });
  const rock = atlas.frame('prop.rock', 'base');
  place(60, () => ({ layer: Layer.Objects, handle: rock, x: 0, y: 0 }));
  return out;
}

const FACING = { N: 'up', S: 'down', E: 'right', W: 'left' } as const;
function facingOf(dir: number): keyof typeof FACING {
  if (dir === 0) return 'N';
  if (dir === 4) return 'S';
  return dir >= 1 && dir <= 3 ? 'E' : 'W';
}

function animSet(
  atlas: Atlas,
  id: string,
  prefix: 'walk' | 'idle',
): Record<'up' | 'down' | 'right' | 'left', number> {
  return {
    up: atlas.anim(id, `${prefix}_up`),
    down: atlas.anim(id, `${prefix}_down`),
    right: atlas.anim(id, `${prefix}_right`),
    left: atlas.anim(id, `${prefix}_left`),
  };
}

function describe(s: DollSpec): string {
  return `body ${s.body}, ${s.skin} skin, ${s.hair} ${s.hairColor} hair, ${s.topColor} ${s.top}, ${s.bottomColor} ${s.bottom}`;
}

/** Runs the demo: entity 0 follows input, the rest drift. `?n=500` sets the count. */
export async function startScene(canvas: HTMLCanvasElement): Promise<void> {
  const atlas = await loadAtlas(manifest as Manifest, { core: coreUrl });
  const n = Number(new URLSearchParams(location.search).get('n')) || 30;
  const state = createDemoState(1, n);
  setComp(state.entities, 0, 'pos', { x: 512 * 256, y: 512 * 256 });
  setComp(state.entities, 0, 'vel', { x: 0, y: 0 });

  const renderer = new Canvas2DRenderer(canvas);
  const camera = new Camera(WORLD, WORLD);
  const interp = new Interpolator();
  renderer.setAtlas(atlas);
  const tileFrames = ['tile.grass_0', 'tile.grass_1', 'tile.grass_2', 'tile.dirt'].map((id) =>
    atlas.frame(id, 'base'),
  );
  const waterAnim = atlas.anim('tile.water', 'flow');
  let clock = 0;
  const ground = groundGrid((k) =>
    k === KIND.water ? atlas.animFrame(waterAnim, clock) : (tileFrames[k] as number),
  );
  const props = scatterProps(atlas, 11);

  // Characters: the player, plus a row of villagers standing near the start to show variety.
  const dolls = new DollFactory(atlas, manifest as Manifest);
  const pick = lcg(Math.floor(Math.random() * 1e9));
  let look = randomDoll(pick);
  const player = dolls.create('char.player', look);
  const walk = animSet(atlas, 'char.player', 'walk');
  const idle = animSet(atlas, 'char.player', 'idle');
  const villagers = Array.from({ length: 10 }, (_, i) => {
    const id = `char.villager_${i}`;
    dolls.create(id, randomDoll(lcg(100 + i * 7)));
    return { anim: atlas.anim(id, 'idle_down'), x: 452 + i * 14, y: 470 + (i % 2) * 6 };
  });

  const label = document.createElement('div');
  label.className = 'dev-label';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'dev-button';
  button.textContent = 'Randomize character (R)';
  const reroll = (): void => {
    look = randomDoll(pick);
    player.draw(look);
    label.textContent = describe(look);
  };
  button.addEventListener('click', reroll);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && !e.repeat) reroll();
  });
  label.textContent = describe(look);
  document.body.appendChild(button);
  document.body.appendChild(label);

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
  let facing: keyof typeof FACING = 'S';
  let moving = false;

  let meter: DevOverlay | null = null;
  if (import.meta.env.DEV) {
    void import('../dev/overlay').then((m) => {
      meter = new m.DevOverlay(() => ({
        entities: state.entities.comps.pos.length,
        drawCalls: renderer.drawCalls,
        logicalWidth: renderer.width,
        logicalHeight: renderer.height,
        scale: vp.current.scale,
      }));
    });
  }

  let lastFrame = performance.now();
  startBrowserLoop({
    tick: () => {
      meter?.tickBegin(performance.now());
      interp.capture(state.entities.comps.pos);
      const rec = input.sampler.sample(performance.now());
      step(state, { commands: toCommands(rec, prevDir) });
      prevDir = rec.moveDir;
      moving = rec.moveDir !== null;
      if (rec.moveDir !== null) facing = facingOf(rec.moveDir);
      meter?.tickEnd(performance.now());
    },
    render: (alpha) => {
      const now = performance.now();
      clock = now;
      meter?.frameBegin(now);
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
          const anim = (moving ? walk : idle)[FACING[facing]];
          renderer.drawSprite(
            Layer.Objects,
            atlas.animFrame(anim, now),
            x,
            y,
            atlas.animFlip(anim),
          );
        } else {
          renderer.drawRect(Layer.Objects, x - 3, y - 6, 6, 6, '#e8e8e8');
        }
      }
      for (const v of villagers)
        renderer.drawSprite(Layer.Objects, atlas.animFrame(v.anim, now), v.x, v.y);
      for (const p of props) {
        renderer.drawSprite(p.layer, p.handle, p.x, p.y);
        if (p.canopy !== undefined) renderer.drawSprite(Layer.Overhead, p.canopy, p.x, p.y - 8);
      }
      renderer.end();
      meter?.frameEnd(performance.now());
    },
  });
}
