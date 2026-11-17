// Temporary demo: the 3 x 3 chunk test map with the sim avatar and three practice creatures.
// Walk, fight (Flow or Classic, button top right), dodge with the button or Space, lock by tapping.
// Keys: WASD move, J attack (Classic), Space dodge, 1 and 2 techniques (hold to aim), T scheme.
//   ?fly=1   no collision, fast, no creatures (for crossing all nine chunks)
//   ?auto=1  fly a fixed loop through all nine chunks without input (for the frame-rate check)
//   ?foes=N  number of practice creatures (default 3)
//   ?at=x,y  start at a world tile (for screenshots)
import manifest from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import uiUrl from '../../baked/atlas-ui.png?url';
import panelBase from '../../baked/ui-panel-base.png?url';
import panelPressed from '../../baked/ui-panel-pressed.png?url';
import { randomDoll } from '../content/dolls/parts';
import { FONTS } from '../content/fonts';
import { PALETTE } from '../content/sprites/palette';
import { BUTTON_ICONS } from '../content/sprites/ui/icons';
import { TECHNIQUES } from '../content/combat/attacks';
import { BUILD_LABEL } from '../shared/version';
import { attachInput } from '../platform/input/dom';
import { sfxFor, hapticFor, vibrate } from '../platform/combatFx';
import { CommandMapper } from '../platform/input/sampler';
import { computeLayout } from '../platform/input/layout';
import { startBrowserLoop } from '../platform/loop';
import { attachAudioLifecycle, createGameAudio } from '../platform/audio';
import { browserSettingsEnv, SettingsStore } from '../platform/settings';
import { loadAtlas, type Manifest } from '../render/atlas';
import { Camera } from '../render/camera';
import { Notices } from '../ui/dom/notices';
import { FIXTURES } from '../content/world/fixtures';
import { roomAt, OUTDOORS } from '../content/world/rooms';
import { spawnFixture } from '../sim/systems/fixtures';
import { UI_STRINGS } from '../content/strings/ui';
import { DIALOGUE_STRINGS } from '../content/strings/dialogue';
import { fill } from '../content/strings/skills';
import { NPCS } from '../content/dialogue';
import { spawnNpc } from '../sim/systems/npcs';
import { newJournal, pinnedRequest } from '../sim/journal';
import { TalkSheet } from '../ui/dom/talk';
import { ChatTicker, HintLine } from '../ui/dom/ambient';
import { runFrontEnd, type FrontEndResult } from '../ui/dom/frontEnd';
import {
  AutoSaver,
  createStorage,
  JsonCodec,
  newSaveId,
  SaveManager,
  type SaveReason,
} from '../save';
import { findAvatar } from '../shared/summary';
import { CombatFeedback } from '../render/feedback';
import { PanelCache } from '../ui/panel';
import { drawCanvasButton, type ButtonKit } from '../ui/hud/canvasButton';
import { drawLockFrame } from '../ui/hud/combatHud';
import { Hud, POOLS_HEIGHT, STATUS_HEIGHT } from '../ui/hud/hud';
import { MenuSheet } from '../ui/dom/menu';
import {
  applyPaletteVars,
  applyPanelImages,
  applyPixelScale,
  applySettings,
  createOverlay,
} from '../ui/dom/overlay';
import { attachSwipe } from '../platform/input/swipe';
import { SkillFeed } from '../ui/hud/skillFeed';
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
import { ITEMS_BALANCE } from '../content/balance/items';
import { ITEMS } from '../content/items';
import { NODES, RECIPES } from '../content/items/recipes';
import { dollWithGear } from '../render/gearDoll';
import { addItem, countItem, newInventory, spawnCampPot, spawnNode } from '../sim/items';
import type { Command } from '../sim/kernel/commands';
import { cardinalOf } from '../sim/combat/fighter';
import { px } from '../sim/kernel/fixed';
import { createDemoState, deserializeState, hashState, type SimState } from '../sim/state';
import { stepWorld } from '../sim/step';
import { contextTarget } from '../sim/systems/interact';
import { decodeChunk } from '../sim/world/chunk';
import { TileWorld } from '../sim/world/world';

const chunkUrls = import.meta.glob('../../baked/chunk-slice-*.bin', {
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
const GREY = PALETTE[2] as string;
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

/** The avatar component of a state, or null. */
function state0Avatar(st: SimState): { handle: string } | null {
  const id = findAvatar(st);
  return id === null ? null : (st.entities.comps.avatar[id] ?? null);
}

export async function startWorldDemo(canvas: HTMLCanvasElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const auto = params.get('auto') === '1';
  const fly = auto || params.get('fly') === '1';
  // Saves: `?nosave=1` turns loading and saving off (for screenshots and tools). Free flight never saves.
  const saves =
    fly || params.get('nosave') === '1'
      ? null
      : new SaveManager({
          codec: new JsonCodec(),
          storage: createStorage(),
          now: () => Date.now(),
          newId: newSaveId,
        });
  let loaded = null as Awaited<ReturnType<SaveManager['load']>>;
  let loadFailed = false;
  if (saves) {
    try {
      loaded = await saves.load();
    } catch {
      loadFailed = true;
    }
  }
  let restored: SimState | null = null;
  if (loaded) {
    try {
      restored = deserializeState(loaded.plain.sim);
      if (findAvatar(restored) === null) restored = null;
    } catch {
      restored = null;
    }
  }
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

  const startGear0 = { ...newInventory().equipment };
  const rand = ((): (() => number) => {
    let s = (Math.random() * 1e9) >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  })();
  const dolls = new DollFactory(atlas, m);
  // Audio exists from the start so the first tap, on the title screen, can unlock it.
  const audio = createGameAudio();
  attachAudioLifecycle(audio);
  // The DOM layer comes up first: the title and setup screens are DOM too.
  const root = createOverlay();
  applyPaletteVars(document.documentElement);
  applyPanelImages(document.documentElement, panelBase, panelPressed);

  // The front end: title, then setup for a new character or a short connecting beat for a saved
  // one. Developer parameters (`?at=`, `?foes=`, `?nosave=`, `?fly=`, `?skip=1`) go straight in.
  const direct = fly || ['at', 'foes', 'nosave', 'skip'].some((k) => params.has(k));
  let entry: Extract<FrontEndResult, { mode: 'new' }> | null = null;
  if (!direct) {
    const savedAvatar = restored ? state0Avatar(restored) : null;
    const previewDolls = dolls.create('char.setup', randomDoll(rand));
    const result = await runFrontEnd({
      root,
      save:
        restored && savedAvatar && loaded
          ? {
              handle: savedAvatar.handle,
              playSeconds: loaded.plain.playSeconds,
              look: loaded.plain.look,
            }
          : null,
      drawPreview: (canvas, look) => {
        previewDolls.draw(dollWithGear(look, startGear0));
        const h = atlas.animFrame(atlas.anim('char.setup', 'idle_down'), 0);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          atlas.image(h),
          atlas.srcX(h),
          atlas.srcY(h),
          atlas.width(h),
          atlas.height(h),
          0,
          0,
          atlas.width(h),
          atlas.height(h),
        );
      },
      rand,
    });
    if (result.mode === 'new') {
      entry = result;
      // A new character starts a new game, even if an unreadable save was lying around.
      restored = null;
    }
  }
  let baseDoll = entry ? entry.look : restored && loaded ? loaded.plain.look : randomDoll(rand);
  const startGear = startGear0;
  const player = dolls.create('char.player', dollWithGear(baseDoll, startGear));
  for (const n of Object.values(NPCS)) dolls.create(`char.${n.id}`, n.doll);
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
  // Fetch the clear text font now, so the Menu does not flash in the fallback the first time.
  void document.fonts?.load('400 1rem "Atkinson Hyperlegible"');
  void document.fonts?.load('700 1rem "Atkinson Hyperlegible"');
  // The DOM layer: the Menu and anything else read as clear text.
  applySettings(root, settings.get());
  settings.subscribe((st) => applySettings(root, st));
  const notices = new Notices(root);
  const hintLine = new HintLine(root);
  const fit = (v: Parameters<Canvas2DRenderer['resize']>[0]): void => {
    renderer.resize(v);
    applyPixelScale(root, v.scale / v.dpr);
    camera.setView(v.width, v.height, v.portrait);
  };
  const vp = watchViewport(probe, fit);
  fit(vp.current);
  const input = attachInput(canvas, {
    leftHanded: () => settings.get().handedness === 'left',
    scheme: () => settings.get().controlScheme,
    hudScale: () => settings.get().hudScale,
    buttonScale: () => settings.get().buttonScale,
    keysEnabled: () => !menuOpen && !notices.tabletOpen && !talkOpen,
    insets: () => readSafeInsets(probe),
  });
  let menuOpen = false;
  let talkOpen = false;

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
  const state = restored ?? createDemoState(1, 0);
  state.world = world;
  const feet = { x: spawnTile.x * TILE_PX + 8, y: spawnTile.y * TILE_PX + 14 };
  const who = restored
    ? (findAvatar(restored) as number)
    : createAvatar(state, px(feet.x), px(feet.y), entry?.handle);
  // `?at=` also moves a loaded avatar, for screenshots and tests.
  if (restored && at && at.length === 2 && at.every(Number.isFinite)) {
    const p = state.entities.comps.pos[who];
    if (p) {
      p.x = px(feet.x);
      p.y = px(feet.y);
    }
  }
  // A loaded save already holds every entity, so the map is only populated for a new game.
  // Map objects: fixtures, gathering nodes and the camp pot. `?foes=0` turns spawners off below.
  for (const c of restored ? [] : chunks)
    for (const o of c.objects) {
      const tx = c.cx * 32 + o.x;
      const ty = c.cy * 32 + o.y;
      if (o.kind.startsWith('fixture.') && FIXTURES[o.kind]) spawnFixture(state, o.kind, tx, ty);
      else if (o.kind.startsWith('node.') && NODES[o.kind])
        spawnNode(state, o.kind, tx * TILE_PX + 8, ty * TILE_PX + 14);
      else if (o.kind.startsWith('npc.') && NPCS[o.kind]) spawnNpc(state, o.kind, tx, ty);
      else if (o.kind === 'prop.camp_pot') spawnCampPot(state, tx * TILE_PX + 8, ty * TILE_PX + 14);
    }
  const bag = restored ? null : state.entities.comps.inventory[who];
  if (bag) {
    addItem(bag, 'item.sword_iron', 1);
    addItem(bag, 'item.outfit_leather', 1);
    addItem(bag, 'item.shield_wood', 1);
    addItem(bag, 'item.raw_meat', 2);
  }
  // Demo keys until the Menu exists (M1-06): G wear the next piece of gear, F eat, C cook a
  // recipe from what the bag holds, or experiment with what it has.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const inv = state.entities.comps.inventory[who];
    if (!inv) return;
    if (e.code === 'KeyR') {
      baseDoll = randomDoll(rand);
      player.draw(dollWithGear(baseDoll, inv.equipment));
    } else if (e.code === 'KeyG') {
      const slot = inv.slots.findIndex((x) => x && ITEMS[x.item]?.equip);
      if (slot >= 0) pendingCommands.push({ type: 'equip', slot });
    } else if (e.code === 'KeyF') {
      const slot = inv.slots.findIndex((x) => x && ITEMS[x.item]?.food);
      if (slot >= 0) pendingCommands.push({ type: 'use', slot });
    } else if (e.code === 'KeyC') {
      const ok = Object.values(RECIPES).find((r) =>
        r.ingredients.every(
          (i) => countItem(inv, i) >= r.ingredients.filter((x) => x === i).length,
        ),
      );
      if (ok) pendingCommands.push({ type: 'cook', items: [...ok.ingredients] });
    }
  });

  // Spawners come from the map's objects (`spawner.*`). `?foes=0` turns them off.
  if (!fly && !restored && params.get('foes') !== '0') {
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

  // Item icons, looked up once.
  const iconCache = new Map<string, number>();
  const iconOf = (id: string): number => {
    let h = iconCache.get(id);
    if (h === undefined) {
      h = atlas.frame(id, 'base');
      iconCache.set(id, h);
    }
    return h;
  };
  /** Nodes, the camp pot and drops lying in the world. Drops arc out for a few ticks. */
  const drawItemsWorld = (): void => {
    const e = state.entities;
    for (const id of e.comps.node.keys()) {
      const n = e.comps.node[id];
      const p = e.comps.pos[id];
      const def = n ? NODES[n.kind] : undefined;
      if (!n || !p || !def) continue;
      const sprite = state.tick >= n.readyAt ? def.sprite.ready : def.sprite.spent;
      renderer.drawSprite(
        Layer.Objects,
        iconOf(sprite),
        Math.round(p.x / 256) - 6,
        Math.round(p.y / 256) - 10,
      );
    }
    for (const id of e.comps.interactable.keys()) {
      const it = e.comps.interactable[id];
      const p = e.comps.pos[id];
      if (it?.kind !== 'camp_pot' || !p) continue;
      const x = Math.round(p.x / 256);
      const y = Math.round(p.y / 256);
      renderer.drawRect(Layer.Objects, x - 5, y - 6, 10, 6, DARK);
      renderer.drawRect(Layer.Objects, x - 4, y - 5, 8, 4, '#7a8088');
      renderer.drawRect(Layer.Objects, x - 3, y - 3, 6, 1, '#3a3f46');
      renderer.drawRect(Layer.Objects, x - 1, y - 1, 2, 2, '#ef8a2e');
    }
    for (const id of e.comps.pickup.keys()) {
      const k = e.comps.pickup[id];
      const p = e.comps.pos[id];
      if (!k || !p) continue;
      const pop = ITEMS_BALANCE.loot.popTicks;
      const t = Math.min(1, Math.max(0, k.age / pop));
      const lift = k.age >= pop ? 0 : Math.round(10 * 4 * t * (1 - t));
      const icon = ITEMS[k.item]?.icon;
      if (icon)
        renderer.drawSprite(
          Layer.Objects,
          iconOf(icon),
          Math.round(p.x / 256) - 6,
          Math.round(p.y / 256) - 10 - lift,
        );
    }
  };

  /** Doors, gates, plates, blocks, chests, the tablet and the Waystone. Portals have no art. */
  const fixtureHandle = new Map<string, number>();
  const spriteFrame = (sprite: string, frame: string): number => {
    const key = `${sprite}#${frame}`;
    let h = fixtureHandle.get(key);
    if (h === undefined) {
      h = atlas.frame(sprite, frame);
      fixtureHandle.set(key, h);
    }
    return h;
  };
  const drawFixtures = (now: number): void => {
    const e = state.entities;
    for (const id of e.comps.fixture.keys()) {
      const f = e.comps.fixture[id];
      const p = e.comps.pos[id];
      const def = f ? FIXTURES[f.kind] : undefined;
      if (!f || !p || !def?.sprite) continue;
      const x = Math.round(p.x / 256);
      const y = Math.round(p.y / 256);
      if (def.type === 'waystone') {
        const key = `${def.sprite}#glow`;
        let a = fixtureHandle.get(key);
        if (a === undefined) {
          a = atlas.anim(def.sprite, 'glow');
          fixtureHandle.set(key, a);
        }
        renderer.drawSprite(Layer.Objects, atlas.animFrame(a, now), x, y);
        continue;
      }
      const frame =
        def.type === 'plate'
          ? f.open
            ? 'down'
            : 'up'
          : def.type === 'door' || def.type === 'gate' || def.type === 'chest'
            ? f.open
              ? 'open'
              : 'closed'
            : 'base';
      const layer =
        def.type === 'plate' || (def.type === 'door' && f.open) ? Layer.Detail : Layer.Objects;
      renderer.drawSprite(layer, spriteFrame(def.sprite, frame), x, y);
    }
  };

  // Rooms: the camera is held to the room the avatar is in and snaps when it changes.
  const ROOM_PX = TILE_PX;
  const startPos = state.entities.comps.pos[who];
  let room =
    (restored && startPos
      ? roomAt(Math.floor(startPos.x / 256 / TILE_PX), Math.floor((startPos.y / 256 - 1) / TILE_PX))
      : roomAt(spawnTile.x, spawnTile.y)) ?? OUTDOORS;
  const enterRoom = (r: typeof OUTDOORS): void => {
    room = r;
    camera.setBounds(r.x0 * ROOM_PX, r.y0 * ROOM_PX, r.x1 * ROOM_PX, r.y1 * ROOM_PX);
    camera.snap();
  };
  if (!fly) enterRoom(room);
  const FADE_MS = 300;
  // Arriving: a short fade up from black, and the avatar materializes in a column of light.
  const MATERIALIZE_MS = 1100;
  const arriveAt = performance.now();
  let fadeAt = arriveAt;
  const born = (now: number): number => (fly ? 1 : Math.min(1, (now - arriveAt) / MATERIALIZE_MS));
  const W_STR = UI_STRINGS.world;

  const avatar = state.entities.comps.avatar[who];
  const apos = state.entities.comps.pos[who];
  const avel = state.entities.comps.vel[who];
  const afight = state.entities.comps.fighter[who];
  if (!avatar || !apos || !avel || !afight) throw new Error('avatar missing');

  // Control scheme changes from the Menu or the T key go to the sim as a command.
  const pendingCommands: Command[] = [];
  const syncScheme = (): void => {
    pendingCommands.push({ type: 'scheme', scheme: settings.get().controlScheme });
  };
  settings.subscribe(syncScheme);
  syncScheme();
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyT' && !e.repeat && !menuOpen)
      settings.set({ controlScheme: settings.get().controlScheme === 'flow' ? 'classic' : 'flow' });
  });

  // The Menu (DOM). The sim is read through `read` and changed only through commands.
  const blit = (canvas: HTMLCanvasElement, handle: number): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      atlas.image(handle),
      atlas.srcX(handle),
      atlas.srcY(handle),
      atlas.width(handle),
      atlas.height(handle),
      0,
      0,
      atlas.width(handle),
      atlas.height(handle),
    );
  };
  const menu = new MenuSheet(root, {
    read: () => ({ state, who }),
    send: (c) => pendingCommands.push(c),
    settings,
    drawIcon: (canvas, id) => blit(canvas, atlas.frame(id, 'base')),
    drawAvatar: (canvas) => blit(canvas, atlas.animFrame(animOf('char.player', 'idle', 4), 0)),
    // Log Out saves, then returns to the title screen (a fresh page start shows it).
    onLogOut: () => {
      void (async () => {
        if (saves) {
          saver.request('manual');
          await saver.idle();
        }
        location.reload();
      })();
    },
    onOpenChange: (open) => {
      menuOpen = open;
      if (open) {
        input.sampler.keyboard.reset();
        pendingCommands.push({ type: 'hint', id: 'hint.menu' });
      }
    },
  });
  const FACING = { up: 0, right: 2, down: 4, left: 6 } as const;
  const talk = new TalkSheet(root, {
    read: () => ({ state, who }),
    send: (c) => pendingCommands.push(c),
    drawIcon: (canvas, id) => blit(canvas, atlas.frame(id, 'base')),
    drawPortrait: (canvas, npcId) => {
      // The head and shoulders of the NPC's idle frame, 16 x 16 from the 24 x 32 doll frame.
      const h = atlas.animFrame(animOf(`char.${npcId}`, 'idle', 4), 0);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(atlas.image(h), atlas.srcX(h) + 4, atlas.srcY(h) + 3, 16, 16, 0, 0, 16, 16);
    },
    onOpenChange: (open) => {
      talkOpen = open;
      audio.setDucked(open);
      if (open) input.sampler.keyboard.reset();
    },
  });
  attachSwipe({
    height: () => canvas.getBoundingClientRect().height,
    bottomInset: () => readSafeInsets(probe).bottom,
    onEdgeUp: () => menu.open(),
    onDown: () => menu.close(),
    downZone: (t) => menu.isOpen && menu.isGrip(t),
  });
  const hud = new Hud();

  // Screen tap to world px, for target lock.
  const mapper = new CommandMapper((p) => {
    const r = canvas.getBoundingClientRect();
    if (r.width === 0) return null;
    const k = renderer.width / r.width;
    return { x: Math.round(p.x * k + camera.x), y: Math.round(p.y * k + camera.y) };
  });

  audio.setMuted('master', settings.get().muted);
  settings.subscribe((st) => audio.setMuted('master', st.muted));
  const feedback = new CombatFeedback({ hit: INK, crit: GOLD, hurt: HURT });
  const skillFeed = new SkillFeed();
  const centerOf = (id: number): { x: number; y: number } | null => {
    const p = state.entities.comps.pos[id];
    return p ? { x: Math.round(p.x / 256), y: Math.round(p.y / 256) - 4 } : null;
  };

  // Scripted chat, scaffolding until M5.
  const chat = new ChatTicker(root, state.tick / 30);

  // Autosave (tech/02): every 60 seconds of play, on room changes and Trials, when the page is
  // hidden or closed. One save runs at a time. `data-saved-seq` and `data-saved-hash` let tests
  // see what was written.
  const AUTOSAVE_TICKS = 60 * 30;
  let lastSaveTick = state.tick;
  let saveGlyphAt = -1e9;
  const GLYPH_MS = 1600;
  const saver = new AutoSaver(
    async () => {
      if (!saves) return;
      const h = hashState(state);
      const seq = await saves.commit({ sim: state, look: baseDoll, playSeconds: state.tick / 30 });
      canvas.dataset.savedSeq = String(seq);
      canvas.dataset.savedHash = h;
    },
    () => undefined,
    () => {
      saveGlyphAt = performance.now();
    },
  );
  const requestSave = (reason: SaveReason): void => {
    if (saves) saver.request(reason);
  };
  if (saves) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) requestSave('hidden');
    });
    window.addEventListener('pagehide', () => requestSave('pagehide'));
    if (restored) {
      canvas.dataset.loadedHash = hashState(state);
      canvas.dataset.loadedSeq = String(loaded?.plain.seq ?? 0);
      if (loaded?.report.fellBack) notices.toast(UI_STRINGS.save.fellBack);
    } else {
      // A save that could not be used: a new game starts, and the damaged one is kept aside.
      if (loadFailed || loaded) notices.toast(UI_STRINGS.save.unreadable);
      requestSave('manual');
    }
  }

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
      (dead ? 0.35 : blink ? 0.45 : 1) * (id === who ? born(now) : 1),
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
        if (rec.menu) menu.toggle();
        if (rec.bag) menu.toggle('bag');
        stepWorld(state, who, { commands: [...pendingCommands.splice(0), ...mapper.map(rec)] });
        hintLine.set(state.entities.comps.journal[who]?.hint?.id.replace('hint.', '') ?? null);
        chat.update(state.tick / 30);
        if (state.tick - lastSaveTick >= AUTOSAVE_TICKS) {
          lastSaveTick = state.tick;
          requestSave('timer');
        }
        const now = performance.now();
        feedback.onEvents(state.events.list, now, centerOf, who, settings.get().reducedMotion);
        skillFeed.ingest(state.events.list, who);
        for (const ev of state.events.list)
          if (ev.type === 'equipped' && ev.id === who)
            player.draw(
              dollWithGear(baseDoll, state.entities.comps.inventory[who]?.equipment ?? startGear),
            );
        for (const e of state.events.list) {
          if (e.type === 'roomChanged' && e.who === who) {
            const tx = Math.floor(apos.x / 256 / TILE_PX);
            const ty = Math.floor((apos.y / 256 - 1) / TILE_PX);
            enterRoom(roomAt(tx, ty) ?? OUTDOORS);
            fadeAt = performance.now();
            requestSave('transition');
          } else if (e.type === 'doorLocked') notices.toast(W_STR.locked);
          else if (e.type === 'doorOpened') notices.toast(W_STR.unlocked);
          else if (e.type === 'chestOpened') notices.toast(W_STR.chest);
          else if (e.type === 'gateOpened') notices.toast(W_STR.gate);
          else if (e.type === 'waystoneSet') notices.toast(W_STR.waystone);
          else if (e.type === 'tabletRead') {
            input.sampler.keyboard.reset();
            notices.openTablet();
          }
          talk.onEvent(e);
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
      // Rooms follow the avatar wherever it is, including a respawn at a Waystone in another room.
      if (!fly) {
        const here = roomAt(Math.floor(pxX / TILE_PX), Math.floor((pxY - 1) / TILE_PX));
        if (here && here.id !== room.id) {
          enterRoom(here);
          fadeAt = now;
        }
      }
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
      drawFixtures(now);
      // People: they stand still and turn to face you when you are close.
      for (const id of state.entities.comps.npc.keys()) {
        const n = state.entities.comps.npc[id];
        const np = state.entities.comps.pos[id];
        const def = n ? NPCS[n.id] : undefined;
        if (!n || !np || !def) continue;
        const dx = apos.x - np.x;
        const dy = apos.y - np.y;
        const near = Math.hypot(dx, dy) / 256 < 48;
        const face = near
          ? Math.abs(dx) > Math.abs(dy)
            ? dx > 0
              ? 2
              : 6
            : dy > 0
              ? 4
              : 0
          : FACING[def.facing];
        const a = animOf(`char.${n.id}`, 'idle', face);
        renderer.drawSprite(
          Layer.Objects,
          atlas.animFrame(a, now),
          Math.round(np.x / 256),
          Math.round(np.y / 256),
          atlas.animFlip(a),
        );
      }
      drawTelegraphs(renderer, state);
      drawItemsWorld();
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
      const b = born(now);
      if (b < 1) {
        // The materialize beam: wide and bright at first, narrowing to nothing as the avatar fills in.
        const k = 1 - b;
        const w = 2 + Math.round(12 * k);
        renderer.drawRect(Layer.Objects, pxX - Math.floor(w / 2), pxY - 46, w, 46, GOLD, 0.5 * k);
        renderer.drawRect(Layer.Objects, pxX - 1, pxY - 46, 2, 46, INK, 0.7 * k);
      }
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
      hud.draw({
        r: renderer,
        fonts,
        state,
        who,
        now,
        safe: v.safe,
        width: v.width,
        mmPerLogicalPx: v.mmPerLogicalPx,
        settings: settings.get(),
        icon: iconOf,
      });
      drawLockFrame(renderer, fonts.small, state, who, Math.floor(v.width / 2), v.safe.y + 15);
      skillFeed.draw(
        renderer,
        fonts.small,
        now,
        Math.floor(v.width / 2),
        v.safe.y + 40,
        v.safe.x + 3,
        v.safe.y + 3 + POOLS_HEIGHT + STATUS_HEIGHT + 4,
        settings.get().reducedMotion,
      );
      // The pinned request line, bottom left above the build label.
      const pin = pinnedRequest(state.entities.comps.journal[who] ?? newJournal());
      if (pin) {
        const text = fill(DIALOGUE_STRINGS[pin.log] ?? pin.log, {
          n: String(pin.n),
          max: String(pin.max),
        });
        fonts.small.draw(
          renderer,
          pin.ready ? `${text} Done` : text,
          v.safe.x + 3,
          v.safe.y + v.safe.h - 19,
          pin.ready ? GOLD : INK,
          { outline: DARK },
        );
      }
      // The gather timing sweep when working a node.
      const gat = state.entities.comps.gather[who];
      if (gat) {
        const g = ITEMS_BALANCE.gather;
        const w = 40;
        const gx = Math.floor(v.width / 2) - w / 2;
        const gy = v.safe.y + v.safe.h - 40;
        renderer.drawRect(Layer.Hud, gx - 1, gy - 1, w + 2, 7, DARK);
        renderer.drawRect(Layer.Hud, gx, gy, w, 5, '#3a3f46');
        const k = w / g.sweepTicks;
        renderer.drawRect(
          Layer.Hud,
          gx + Math.round(g.sweetFrom * k),
          gy,
          Math.max(1, Math.round((g.sweetTo - g.sweetFrom + 1) * k)),
          5,
          GOLD,
        );
        renderer.drawRect(Layer.Hud, gx + Math.round(gat.t * k), gy - 1, 2, 7, INK);
      }
      // Build id and time, bottom left, so a refreshed page can be told from a stale one.
      fonts.small.draw(renderer, BUILD_LABEL, v.safe.x + 3, v.safe.y + v.safe.h - 9, GREY, {
        outline: DARK,
      });
      if (!fly) {
        const k = v.dpr / v.scale;
        const css = canvas.getBoundingClientRect();
        const layout = computeLayout(css.width, css.height, settings.get().handedness === 'left', {
          scheme: settings.get().controlScheme,
          hudScale: settings.get().hudScale,
          buttonScale: settings.get().buttonScale,
          insets: readSafeInsets(probe),
        });
        const kit: ButtonKit = {
          panels,
          fonts,
          mmPerLogicalPx: v.mmPerLogicalPx,
          ink: INK,
          outline: DARK,
          opacity: settings.get().hudOpacity,
        };
        const held = new Set<string>(input.sampler.keyboard.held());
        const slotOf: Record<string, number> = { tech1: 0, tech2: 1, tech3: 2, tech4: 3 };
        const hasTarget = contextTarget(state, who) !== null;
        for (const [id, r] of Object.entries(layout.buttons)) {
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
          const iconId =
            slot !== undefined ? TECHNIQUES[afight.slots[slot] as string]?.icon : BUTTON_ICONS[id];
          const icon = iconId
            ? { handle: atlas.frame(iconId, 'base'), size: 12, alpha: cooling ? 0.45 : 1 }
            : undefined;
          drawCanvasButton(
            renderer,
            kit,
            rect,
            LABELS[id] ?? '?',
            held.has(id) || cooling,
            'small',
            icon,
          );
        }
      }
      // The save glyph: a small disk in the bottom right corner for a moment after each save.
      const gk = 1 - (now - saveGlyphAt) / GLYPH_MS;
      if (gk > 0) {
        const gx = v.safe.x + v.safe.w - 12;
        const gy = v.safe.y + v.safe.h - 12;
        renderer.drawRect(Layer.Hud, gx - 1, gy - 1, 10, 10, DARK, gk);
        renderer.drawRect(Layer.Hud, gx, gy, 8, 8, INK, gk);
        renderer.drawRect(Layer.Hud, gx + 2, gy, 4, 3, DARK, gk);
        renderer.drawRect(Layer.Hud, gx + 1, gy + 5, 6, 3, GOLD, gk);
      }
      const fade = 1 - (now - fadeAt) / FADE_MS;
      if (fade > 0) renderer.drawRect(Layer.Hud, 0, 0, v.width, v.height, '#000000', fade);
      renderer.end();
      // Input, the Menu and the first frame are all live. Tests and tools wait for this.
      if (canvas.dataset.ready !== 'true') canvas.dataset.ready = 'true';
      meter?.frameEnd(performance.now());
    },
  });
}
