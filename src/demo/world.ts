// Temporary demo: walk the 3 x 3 chunk test map as the sim avatar (movement, collision, sprint).
//   ?fly=1   no collision, fast (for crossing all nine chunks)
//   ?auto=1  fly a fixed loop through all nine chunks without input (for the frame-rate check)
//   ?at=x,y  start at a world tile (for screenshots)
import manifest from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import { randomDoll } from '../content/dolls/parts';
import { attachInput } from '../platform/input/dom';
import { toCommands } from '../platform/input/sampler';
import { startBrowserLoop } from '../platform/loop';
import { loadAtlas, type Manifest } from '../render/atlas';
import { Camera } from '../render/camera';
import { ChunkRenderer, TILE_PX } from '../render/chunks';
import { DollFactory } from '../render/dollSprite';
import type { DevOverlay } from '../dev/overlay';
import { Canvas2DRenderer, Layer } from '../render/renderer';
import { watchViewport } from '../render/viewport';
import { createAvatar } from '../sim/avatar';
import { px } from '../sim/kernel/fixed';
import { setComp, spawn } from '../sim/kernel/entities';
import { createDemoState } from '../sim/state';
import { stepWorld } from '../sim/step';
import { contextTarget } from '../sim/systems/interact';
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
  // Anim sets are indexed up, down, right, left; the sim facing is N, E, S, W (0, 2, 4, 6).
  const animOfFacing = (f: number): number => (f === 0 ? 0 : f === 4 ? 1 : f === 2 ? 2 : 3);

  const probe = document.getElementById('safe-probe');
  if (!probe) throw new Error('safe-area probe missing');
  const fit = (v: Parameters<Canvas2DRenderer['resize']>[0]): void => {
    renderer.resize(v);
    camera.setView(v.width, v.height, v.portrait);
  };
  const vp = watchViewport(probe, fit);
  fit(vp.current);
  const input = attachInput(canvas, { leftHanded: () => false });

  // The avatar lives in the sim. Feet position is the bottom center of its 10 x 8 box.
  const spawnTile = chunks.flatMap((c) =>
    c.objects
      .filter((o) => o.kind === 'spawn.player')
      .map((o) => ({ x: c.cx * 32 + o.x, y: c.cy * 32 + o.y })),
  )[0] ?? { x: 48, y: 48 };
  const at = params.get('at')?.split(',').map(Number);
  if (at && at.length === 2 && at.every(Number.isFinite)) {
    spawnTile.x = at[0] as number;
    spawnTile.y = at[1] as number;
  }
  const state = createDemoState(1, 0);
  state.world = world;
  const who = createAvatar(state, px(spawnTile.x * TILE_PX + 8), px(spawnTile.y * TILE_PX + 14));
  // A rock to bump into and use: solid, and the context target when faced.
  const rockSprite = atlas.frame('prop.rock', 'base');
  const rock = spawn(state.entities);
  setComp(state.entities, rock, 'pos', {
    x: px(spawnTile.x * TILE_PX + 8 + 48),
    y: px(spawnTile.y * TILE_PX + 14),
  });
  setComp(state.entities, rock, 'body', { w: px(12), h: px(8), solid: true });
  setComp(state.entities, rock, 'interactable', { kind: 'rock' });

  const avatar = state.entities.comps.avatar[who];
  const apos = state.entities.comps.pos[who];
  const avel = state.entities.comps.vel[who];
  if (!avatar || !apos || !avel) throw new Error('avatar missing');
  let prev = { x: apos.x, y: apos.y };
  let prevDir: number | null = null;
  let prevFull = false;
  let waypoint = 0;
  const speedPx = auto ? 10 : 8;

  let meter: DevOverlay | null = null;
  if (import.meta.env.DEV) {
    void import('../dev/overlay').then((m) => {
      meter = new m.DevOverlay(() => ({
        entities: 1,
        drawCalls: renderer.drawCalls,
        logicalWidth: renderer.width,
        logicalHeight: renderer.height,
        scale: vp.current.scale,
        extra: `chunks ${chunks.length} built ${chunkRenderer.chunksBuilt} | terrain blits ${renderer.terrainBlits}`,
      }));
    });
  }

  let lastFrame = performance.now();
  startBrowserLoop({
    tick: () => {
      meter?.tickBegin(performance.now());
      prev = { x: apos.x, y: apos.y };
      if (fly) {
        // Free flight for the frame-rate check and for crossing the map: no collision, no sim step.
        let mx = 0;
        let my = 0;
        if (auto) {
          const target = LOOP[waypoint] as readonly [number, number];
          const dx = target[0] - apos.x / 256;
          const dy = target[1] - (apos.y / 256 - 14);
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
        apos.x += Math.round(mx * speedPx * 256);
        apos.y += Math.round(my * speedPx * 256);
        avatar.intent = mx !== 0 || my !== 0 ? 0 : null;
        if (mx !== 0 || my !== 0)
          avatar.facing = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 2 : 6) : my > 0 ? 4 : 0;
      } else {
        const rec = input.sampler.sample(performance.now());
        stepWorld(state, who, { commands: toCommands(rec, prevDir, prevFull) });
        prevDir = rec.moveDir;
        prevFull = rec.full;
      }
      meter?.tickEnd(performance.now());
    },
    render: (alpha) => {
      const now = performance.now();
      meter?.frameBegin(now);
      const dt = now - lastFrame;
      lastFrame = now;
      const fx = (prev.x + (apos.x - prev.x) * alpha) / 256;
      const fy = (prev.y + (apos.y - prev.y) * alpha) / 256;
      const pxX = Math.round(fx);
      const pxY = Math.round(fy);
      camera.follow(pxX, pxY - 14, dt);
      renderer.begin(camera.x, camera.y);
      chunkRenderer.drawVisible(
        renderer,
        camera.x,
        camera.y,
        renderer.width,
        renderer.height,
        Math.floor(now / 500),
        { x: pxX, y: pxY },
        dt,
      );
      const rp = state.entities.comps.pos[rock];
      if (rp)
        renderer.drawSprite(
          Layer.Objects,
          rockSprite,
          Math.round(rp.x / 256),
          Math.round(rp.y / 256),
        );
      const moving = avel.x !== 0 || avel.y !== 0 || (fly && avatar.intent !== null);
      const set = moving ? walk : idle;
      const anim = set[animOfFacing(avatar.facing)] as number;
      renderer.drawSprite(
        Layer.Objects,
        atlas.animFrame(anim, now),
        pxX,
        pxY,
        atlas.animFlip(anim),
      );
      const target = contextTarget(state, who);
      const tp = target === null ? undefined : state.entities.comps.pos[target];
      if (tp) {
        // Stand-in for the HUD context button (M1-06): a marker above whatever can be used.
        const mx = Math.round(tp.x / 256);
        const my = Math.round(tp.y / 256) - 20;
        renderer.drawRect(Layer.Objects, mx - 2, my - 2, 4, 4, '#ffd96a');
      }
      renderer.end();
      meter?.frameEnd(performance.now());
    },
  });
}
