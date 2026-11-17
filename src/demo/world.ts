// Temporary demo: the 3 x 3 chunk test map with the sim avatar and three practice creatures.
// Walk, fight (Flow or Classic, button top right), dodge with a flick or Space, lock by tapping.
// Keys: WASD move, J attack (Classic), Space dodge, 1 and 2 techniques (hold to aim), T scheme.
//   ?fly=1   no collision, fast, no creatures (for crossing all nine chunks)
//   ?auto=1  fly a fixed loop through all nine chunks without input (for the frame-rate check)
//   ?foes=N  number of practice creatures (default 3)
//   ?at=x,y  start at a world tile (for screenshots)
import manifest from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import uiUrl from '../../baked/atlas-ui.png?url';
import { randomDoll } from '../content/dolls/parts';
import { FONTS } from '../content/fonts';
import { PALETTE } from '../content/sprites/palette';
import { attachInput } from '../platform/input/dom';
import { sfxFor, hapticFor, vibrate } from '../platform/combatFx';
import { CommandMapper } from '../platform/input/sampler';
import { computeLayout } from '../platform/input/layout';
import { startBrowserLoop } from '../platform/loop';
import { attachAudioLifecycle, createGameAudio } from '../platform/audio';
import { browserSettingsEnv, SettingsStore } from '../platform/settings';
import { loadAtlas, type Manifest } from '../render/atlas';
import { Camera } from '../render/camera';
import { CombatFeedback } from '../render/feedback';
import { PanelCache } from '../ui/panel';
import { drawCanvasButton, type ButtonKit } from '../ui/hud/canvasButton';
import { drawLockFrame, drawPoolBars } from '../ui/hud/combatHud';
import { PixelFont } from '../ui/text/pixelFont';
import { CREATURES, SPAWNERS } from '../content/creatures';
import { createSpawner } from '../sim/systems/spawner';
import { drawTelegraphs, telegraphOf } from '../render/telegraph';
import { ChunkRenderer, TILE_PX } from '../render/chunks';
import { DollFactory } from '../render/dollSprite';
import type { DevOverlay } from '../dev/overlay';
import { Canvas2DRenderer, Layer } from '../render/renderer';
import { readSafeInsets, watchViewport } from '../render/viewport';
import { createAvatar } from '../sim/avatar';
import { cardinalOf } from '../sim/combat/fighter';
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

const INK = PALETTE[3] as string;
const DARK = PALETTE[0] as string;
const GOLD = PALETTE[47] as string;
const HURT = PALETTE[22] as string;
const LABELS: Record<string, string> = {
  // Technique buttons show what they do: Lunge, Fire (Ember bolt).
  tech1: 'L',
  tech2: 'F',
  tech3: '3',
  tech4: '4',
  dodge: 'D',
  context: 'E',
  menu: 'M',
  bag: 'B',
  attack: 'A',
};
// Anim sets are indexed up, down, right, left; the sim facing is N, E, S, W (0, 2, 4, 6).
const FACE_NAME = { 0: 'up', 2: 'right', 4: 'down', 6: 'left' } as const;

export async function startWorldDemo(canvas: HTMLCanvasElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const auto = params.get('auto') === '1';
  const fly = auto || params.get('fly') === '1';
  const m = manifest as unknown as Manifest & {
    fonts: typeof FONTS;
    tiles: Record<string, { sprite: string; frame: string; offset?: [number, number] }>;
  };
  const atlas = await loadAtlas(m, { core: coreUrl, ui: uiUrl });
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
  const chunkRenderer = new ChunkRenderer(atlas, world, m.tiles);

  const rand = ((): (() => number) => {
    let s = (Math.random() * 1e9) >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  const dolls = new DollFactory(atlas, m);
  const player = dolls.create('char.player', {
    ...randomDoll(rand),
    mainHand: 'sword',
    offHand: 'none',
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && !e.repeat)
      player.draw({ ...randomDoll(rand), mainHand: 'sword', offHand: 'none' });
  });
  // Anim handles by sprite, action and facing, looked up once. A missing action (a rooted plant
  // has no walk) falls back to idle.
  const animCache = new Map<string, number>();
  const animOf = (id: string, name: string, facing: number): number => {
    const dir = FACE_NAME[facing as 0 | 2 | 4 | 6];
    const key = `${id}#${name}#${dir}`;
    let h = animCache.get(key);
    if (h === undefined) {
      try {
        h = atlas.anim(id, `${name}_${dir}`);
      } catch {
        h = atlas.anim(id, `idle_${dir}`);
      }
      animCache.set(key, h);
    }
    return h;
  };

  const settings = new SettingsStore(browserSettingsEnv());
  const uiImage = atlas.image(atlas.frame('ui.panel', 'base')) as HTMLImageElement;
  const panels = new PanelCache(atlas);
  const fonts = {
    small: new PixelFont(atlas, m, m.fonts.small, uiImage),
    large: new PixelFont(atlas, m, m.fonts.large, uiImage),
  };

  const probe = document.getElementById('safe-probe');
  if (!probe) throw new Error('safe-area probe missing');
  const fit = (v: Parameters<Canvas2DRenderer['resize']>[0]): void => {
    renderer.resize(v);
    camera.setView(v.width, v.height, v.portrait);
  };
  const vp = watchViewport(probe, fit);
  fit(vp.current);
  const input = attachInput(canvas, {
    leftHanded: () => settings.get().handedness === 'left',
    scheme: () => settings.get().controlScheme,
    hudScale: () => settings.get().hudScale,
    insets: () => readSafeInsets(probe),
  });

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
  const feet = { x: spawnTile.x * TILE_PX + 8, y: spawnTile.y * TILE_PX + 14 };
  const who = createAvatar(state, px(feet.x), px(feet.y));
  // A rock to bump into and use: solid, and the context target when faced.
  const rockSprite = atlas.frame('prop.rock', 'base');
  const rock = spawn(state.entities);
  setComp(state.entities, rock, 'pos', { x: px(feet.x + 48), y: px(feet.y - 40) });
  setComp(state.entities, rock, 'body', { w: px(12), h: px(8), solid: true });
  setComp(state.entities, rock, 'interactable', { kind: 'rock' });

  // Spawners come from the map's objects (`spawner.*`). `?foes=0` turns them off.
  if (!fly && params.get('foes') !== '0') {
    for (const c of chunks)
      for (const o of c.objects)
        if (o.kind.startsWith('spawner.') && SPAWNERS[o.kind])
          createSpawner(
            state,
            o.kind,
            (c.cx * 32 + o.x) * TILE_PX + 8,
            (c.cy * 32 + o.y) * TILE_PX + 14,
          );
  }
  const lastDrawn = new Map<number, { x: number; y: number }>();

  const avatar = state.entities.comps.avatar[who];
  const apos = state.entities.comps.pos[who];
  const avel = state.entities.comps.vel[who];
  const afight = state.entities.comps.fighter[who];
  if (!avatar || !apos || !avel || !afight) throw new Error('avatar missing');

  // Scheme button, standing in for the settings screen (M1-06). T on a keyboard.
  const schemeButton = document.createElement('button');
  schemeButton.type = 'button';
  schemeButton.className = 'scheme-icon';
  schemeButton.id = 'scheme-toggle';
  const SVG = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(SVG, 'svg');
  icon.setAttribute('viewBox', '0 0 16 16');
  const path = document.createElementNS(SVG, 'path');
  icon.appendChild(path);
  schemeButton.appendChild(icon);
  const pendingCommands: { type: 'scheme'; scheme: 'flow' | 'classic' }[] = [];
  const syncScheme = (): void => {
    const sc = settings.get().controlScheme;
    // Flow is a wave (move and explore). Classic is crossed blades (fight).
    path.setAttribute(
      'd',
      sc === 'flow'
        ? 'M1 6q2-3 3.5 0t3.5 0 3.5 0 3.5 0M1 11q2-3 3.5 0t3.5 0 3.5 0 3.5 0'
        : 'M3 3l10 10M13 3L3 13M2 11l3 3M11 2l3 3',
    );
    schemeButton.setAttribute(
      'aria-label',
      sc === 'flow' ? 'Flow controls. Switch to Classic' : 'Classic controls. Switch to Flow',
    );
    schemeButton.title = schemeButton.getAttribute('aria-label') ?? '';
    pendingCommands.push({ type: 'scheme', scheme: sc });
  };
  settings.subscribe(syncScheme);
  syncScheme();
  const toggleScheme = (): void =>
    settings.set({ controlScheme: settings.get().controlScheme === 'flow' ? 'classic' : 'flow' });
  schemeButton.addEventListener('click', toggleScheme);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat) toggleScheme();
  });
  document.body.appendChild(schemeButton);

  // Screen tap to world px, for target lock.
  const mapper = new CommandMapper((p) => {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0) return null;
    const k = renderer.width / r.width;
    return { x: Math.round(p.x * k + camera.x), y: Math.round(p.y * k + camera.y) };
  });

  const audio = createGameAudio();
  attachAudioLifecycle(audio);
  const feedback = new CombatFeedback({ hit: INK, crit: GOLD, hurt: HURT });
  const centerOf = (id: number): { x: number; y: number } | null => {
    const p = state.entities.comps.pos[id];
    return p ? { x: Math.round(p.x / 256), y: Math.round(p.y / 256) - 4 } : null;
  };

  let prev = { x: apos.x, y: apos.y };
  let waypoint = 0;
  const speedPx = auto ? 10 : 8;

  let meter: DevOverlay | null = null;
  if (import.meta.env.DEV) {
    void import('../dev/overlay').then((mod) => {
      meter = new mod.DevOverlay(() => ({
        entities: state.entities.capacity - state.entities.free.length,
        drawCalls: renderer.drawCalls,
        logicalWidth: renderer.width,
        logicalHeight: renderer.height,
        scale: vp.current.scale,
        extra: `chunks ${chunks.length} built ${chunkRenderer.chunksBuilt} | terrain blits ${renderer.terrainBlits}`,
      }));
    });
  }

  const drawActor = (spriteId: string, id: number, now: number, x: number, y: number): void => {
    const f = state.entities.comps.fighter[id];
    const v = state.entities.comps.vel[id];
    const facing = state.entities.comps.avatar[id]?.facing ?? (f ? cardinalOf(f.aim) : 4);
    let name = 'idle';
    let t = now;
    const last = lastDrawn.get(id);
    lastDrawn.set(id, { x, y });
    const walking = last !== undefined && (last.x !== x || last.y !== y);
    if (f?.state === 'attack') {
      name = 'attack';
      t = Math.min(Math.max(0, f.t) * (1000 / 30), 249);
    } else if (f?.state === 'dodge') {
      name = 'dodge';
      t = Math.min(Math.max(0, f.t) * (1000 / 30), 249);
    } else if (f?.state === 'hurt' || f?.state === 'stagger' || f?.state === 'dead') name = 'hurt';
    else if ((v && (v.x !== 0 || v.y !== 0)) || (!state.entities.comps.avatar[id] && walking))
      name = 'walk';
    const a = animOf(spriteId, name, facing);
    const dead = f?.state === 'dead';
    // A creature winding up an attack flashes: the telegraph for close strikes.
    const winding = f?.team === 1 && f.state === 'attack' && telegraphOf(state, id) !== null;
    const blink = feedback.flashing(id, now) || (winding && Math.floor(now / 90) % 2 === 0);
    renderer.drawSprite(
      Layer.Objects,
      atlas.animFrame(a, t),
      x,
      y,
      atlas.animFlip(a),
      dead ? 0.35 : blink ? 0.45 : 1,
    );
  };

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
        stepWorld(state, who, { commands: [...pendingCommands.splice(0), ...mapper.map(rec)] });
        const now = performance.now();
        feedback.onEvents(state.events.list, now, centerOf, who, settings.get().reducedMotion);
        for (const e of state.events.list) {
          const sfx = sfxFor(e, who);
          if (sfx) audio.playSfx(sfx);
          const h = hapticFor(e, who);
          if (h !== null) vibrate(h, settings.get().haptics);
        }
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
      const shake = feedback.shake(now);
      renderer.begin(camera.x + shake.x, camera.y + shake.y);
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
      drawTelegraphs(renderer, state);
      for (const id of state.entities.comps.ai.keys()) {
        const ai = state.entities.comps.ai[id];
        const p = state.entities.comps.pos[id];
        const def = ai ? CREATURES[ai.creature] : undefined;
        if (ai && p && def && state.entities.alive[id])
          drawActor(def.sprite, id, now, Math.round(p.x / 256), Math.round(p.y / 256));
      }
      if (fly) {
        const moving = avatar.intent !== null;
        const a = animOf('char.player', moving ? 'walk' : 'idle', avatar.facing);
        renderer.drawSprite(Layer.Objects, atlas.animFrame(a, now), pxX, pxY, atlas.animFlip(a));
      } else drawActor('char.player', who, now, pxX, pxY);
      const target = contextTarget(state, who);
      const tp = target === null ? undefined : state.entities.comps.pos[target];
      if (tp) {
        // Stand-in for the HUD context button (M1-06): a marker above whatever can be used.
        const mx = Math.round(tp.x / 256);
        const my = Math.round(tp.y / 256) - 20;
        renderer.drawRect(Layer.Objects, mx - 2, my - 2, 4, 4, '#ffd96a');
      }
      for (const id of state.entities.comps.projectile.keys()) {
        const bp = state.entities.comps.pos[id];
        if (bp && state.entities.comps.projectile[id]) {
          const bx = Math.round(bp.x / 256);
          const by = Math.round(bp.y / 256);
          renderer.drawRect(Layer.Objects, bx - 3, by - 3, 6, 6, '#c2402a');
          renderer.drawRect(Layer.Objects, bx - 2, by - 2, 4, 4, '#ef8a2e');
          renderer.drawRect(Layer.Objects, bx - 1, by - 1, 2, 2, '#ffd96a');
        }
      }
      for (const id of state.entities.comps.echo.keys()) {
        const ep = state.entities.comps.pos[id];
        if (ep && state.entities.comps.echo[id])
          renderer.drawRect(
            Layer.Objects,
            Math.round(ep.x / 256) - 3,
            Math.round(ep.y / 256) - 6,
            6,
            6,
            '#ffd96a',
          );
      }
      feedback.drawNumbers(
        renderer,
        fonts.large,
        camera.x + shake.x,
        camera.y + shake.y,
        now,
        DARK,
      );

      // Screen space: bars, lock frame, controls.
      const v = vp.current;
      drawPoolBars(renderer, state, who, v.safe.x + 3, v.safe.y + 3);
      drawLockFrame(renderer, fonts.small, state, who, Math.floor(v.width / 2), v.safe.y + 3);
      if (!fly) {
        const k = v.dpr / v.scale;
        const css = canvas.getBoundingClientRect();
        const layout = computeLayout(css.width, css.height, settings.get().handedness === 'left', {
          scheme: settings.get().controlScheme,
          hudScale: settings.get().hudScale,
          insets: readSafeInsets(probe),
        });
        const kit: ButtonKit = {
          panels,
          fonts,
          mmPerLogicalPx: v.mmPerLogicalPx,
          ink: INK,
          outline: DARK,
        };
        const held = new Set<string>(input.sampler.keyboard.held());
        const slotOf: Record<string, number> = { tech1: 0, tech2: 1, tech3: 2, tech4: 3 };
        const hasTarget = contextTarget(state, who) !== null;
        for (const [id, r] of Object.entries(layout.buttons)) {
          if (id === 'menu' || id === 'bag') continue;
          // Slots with no technique and a context button with nothing to use are not shown.
          const slot = slotOf[id];
          if (slot !== undefined && !afight.slots[slot]) continue;
          if (id === 'context' && !hasTarget) continue;
          const rect = {
            x: Math.round(r.x * k),
            y: Math.round(r.y * k),
            w: Math.round(r.w * k),
            h: Math.round(r.h * k),
          };
          const cooling = slot !== undefined && (afight.cooldowns[slot] ?? 0) > 0;
          drawCanvasButton(renderer, kit, rect, LABELS[id] ?? '?', held.has(id) || cooling);
        }
      }
      renderer.end();
      meter?.frameEnd(performance.now());
    },
  });
}
