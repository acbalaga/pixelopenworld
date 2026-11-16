// Temporary demo for M0-07: walk or fly around the 3 x 3 chunk test map.
//   ?fly=1   no collision, fast (for crossing all nine chunks)
//   ?auto=1  fly a fixed loop through all nine chunks without input (for the frame-rate check)
//   ?at=x,y  start at a world tile (for screenshots)
import manifest from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import { randomDoll } from '../content/dolls/parts';
import { attachInput } from '../platform/input/dom';
import { startBrowserLoop } from '../platform/loop';
import { loadAtlas, type Manifest } from '../render/atlas';
import { Camera } from '../render/camera';
import { ChunkRenderer, TILE_PX } from '../render/chunks';
import { DollFactory } from '../render/dollSprite';
import { Canvas2DRenderer, Layer } from '../render/renderer';
import { watchViewport } from '../render/viewport';
import { moveBox, type Box } from '../sim/systems/collision';
import { decodeChunk } from '../sim/world/chunk';
import { TileWorld } from '../sim/world/world';

const chunkUrls = import.meta.glob('../../baked/chunk-test-*.bin', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Auto flight: a loop through the nine chunks, in world px, one waypoint per entry. */
const LOOP: readonly [number, number][] = [
  [200, 200],
  [768, 200],
  [1340, 200],
  [1340, 768],
  [1340, 1340],
  [768, 1340],
  [200, 1340],
  [200, 768],
  [768, 768],
];

export async function startWorldDemo(canvas: HTMLCanvasElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const auto = params.get('auto') === '1';
  const fly = auto || params.get('fly') === '1';
  const atlas = await loadAtlas(manifest as Manifest, { core: coreUrl });
  const chunks = await Promise.all(
    Object.values(chunkUrls).map(async (url) =>
      decodeChunk(new Uint8Array(await (await fetch(url)).arrayBuffer())),
    ),
  );
  const world = new TileWorld(chunks);
  const bounds = world.bounds();
  if (!bounds) throw new Error('no chunks loaded');
  const worldW = (bounds.x1 - bounds.x0) * TILE_PX;
  const worldH = (bounds.y1 - bounds.y0) * TILE_PX;

  const renderer = new Canvas2DRenderer(canvas);
  renderer.setAtlas(atlas);
  const camera = new Camera(worldW, worldH);
  const tiles = (
    manifest as unknown as {
      tiles: Record<string, { sprite: string; frame: string; offset?: [number, number] }>;
    }
  ).tiles;
  const chunkRenderer = new ChunkRenderer(atlas, world, tiles);

  const dolls = new DollFactory(atlas, manifest as Manifest);
  const rand = ((): (() => number) => {
    let s = (Math.random() * 1e9) >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  const player = dolls.create('char.player', randomDoll(rand));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && !e.repeat) player.draw(randomDoll(rand));
  });
  const walk = (['up', 'down', 'right', 'left'] as const).map((d) =>
    atlas.anim('char.player', `walk_${d}`),
  );
  const idle = (['up', 'down', 'right', 'left'] as const).map((d) =>
    atlas.anim('char.player', `idle_${d}`),
  );
  const animIndex = { up: 0, down: 1, right: 2, left: 3 } as const;

  const probe = document.getElementById('safe-probe');
  if (!probe) throw new Error('safe-area probe missing');
  const fit = (v: Parameters<Canvas2DRenderer['resize']>[0]): void => {
    renderer.resize(v);
    camera.setView(v.width, v.height, v.portrait);
  };
  const vp = watchViewport(probe, fit);
  fit(vp.current);
  const input = attachInput(canvas, { leftHanded: () => false });

  // The player is a 10 x 6 px box at the feet, in sub-pixel units. Spawn at the map's spawn object.
  const spawn = chunks.flatMap((c) =>
    c.objects
      .filter((o) => o.kind === 'spawn.player')
      .map((o) => ({ x: c.cx * 32 + o.x, y: c.cy * 32 + o.y })),
  )[0] ?? { x: 48, y: 48 };
  const at = params.get('at')?.split(',').map(Number);
  if (at && at.length === 2 && at.every(Number.isFinite)) {
    spawn.x = at[0] as number;
    spawn.y = at[1] as number;
  }
  const W = 10 * 256;
  const H = 6 * 256;
  let box: Box = {
    x: spawn.x * TILE_PX * 256 + 8 * 256 - W / 2,
    y: spawn.y * TILE_PX * 256 + 14 * 256 - H,
    w: W,
    h: H,
  };
  let prev = { x: box.x, y: box.y };
  let facing: keyof typeof animIndex = 'down';
  let moving = false;
  let waypoint = 0;
  const speedPx = fly ? (auto ? 10 : 8) : 2.5;

  let meter: { begin(t: number): void; end(t: number, extra?: string): void } | null = null;
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
      prev = { x: box.x, y: box.y };
      let mx = 0;
      let my = 0;
      if (auto) {
        const target = LOOP[waypoint] as readonly [number, number];
        const fx = (box.x + W / 2) / 256;
        const fy = (box.y + H) / 256 - 14;
        const dx = target[0] - fx;
        const dy = target[1] - fy;
        const d = Math.hypot(dx, dy);
        if (d < 12) waypoint = (waypoint + 1) % LOOP.length;
        else {
          mx = dx / d;
          my = dy / d;
        }
      } else {
        const rec = input.sampler.sample(performance.now());
        mx = rec.move.x;
        my = rec.move.y;
      }
      moving = mx !== 0 || my !== 0;
      if (moving)
        facing = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : my > 0 ? 'down' : 'up';
      const dx = Math.round(mx * speedPx * 256);
      const dy = Math.round(my * speedPx * 256);
      if (fly) box = { ...box, x: box.x + dx, y: box.y + dy };
      else box = moveBox(world, box, dx, dy);
    },
    render: (alpha) => {
      const now = performance.now();
      meter?.begin(now);
      const dt = now - lastFrame;
      lastFrame = now;
      const fx = (prev.x + (box.x - prev.x) * alpha + W / 2) / 256;
      const fy = (prev.y + (box.y - prev.y) * alpha + H) / 256;
      const px = Math.round(fx);
      const py = Math.round(fy);
      camera.follow(px, py - 14, dt);
      renderer.begin(camera.x, camera.y);
      chunkRenderer.drawVisible(
        renderer,
        camera.x,
        camera.y,
        renderer.width,
        renderer.height,
        Math.floor(now / 500),
        { x: px, y: py },
        dt,
      );
      const anim = (moving ? walk : idle)[animIndex[facing]] as number;
      renderer.drawSprite(Layer.Objects, atlas.animFrame(anim, now), px, py, atlas.animFlip(anim));
      renderer.end();
      meter?.end(
        performance.now(),
        `chunks ${chunks.length} built ${chunkRenderer.chunksBuilt} | terrain blits ${renderer.terrainBlits} | calls ${renderer.drawCalls}`,
      );
    },
  });
}
