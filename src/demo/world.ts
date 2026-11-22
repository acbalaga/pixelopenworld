// Temporary demo: the 3 x 3 chunk test map with the sim avatar and three practice creatures.
// Walk, fight (Flow or Classic, button top right), dodge with the button or Space, lock by tapping.
// Keys: WASD move, J attack (Classic), Space dodge, 1 and 2 techniques (hold to aim), T scheme.
//   ?fly=1   no collision, fast, no creatures (for crossing all nine chunks)
//   ?auto=1  fly a fixed loop through all nine chunks without input (for the frame-rate check)
//   ?region= stream another baked region (default dawnmeadow; `slice` is the M1 map, for tests).
//            Dev regions start with `dev_`.
//   ?foes=N  number of practice creatures (default 3)
//   ?at=x,y  start at a world tile (for screenshots)
import { fixtureFrame } from '../render/fixtureFrame';
import manifest from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import uiUrl from '../../baked/atlas-ui.png?url';
import panelBase from '../../baked/ui-panel-base.png?url';
import panelPressed from '../../baked/ui-panel-pressed.png?url';
import { randomDoll } from '../content/dolls/parts';
import { FONTS } from '../content/fonts';
import { PALETTE } from '../content/sprites/palette';
import { BUTTON_ICONS } from '../content/sprites/ui/icons';
import { SIGN_STRINGS } from '../content/strings/signs';
import { BELL_ORDER } from '../content/world/dungeons/west';
import { TECHNIQUES } from '../content/combat/techniques';
import { BUILD_LABEL } from '../shared/version';
import { attachInput } from '../platform/input/dom';
import { sfxFor, hapticFor, vibrate } from '../platform/combatFx';
import { CommandMapper } from '../platform/input/sampler';
import { computeLayout } from '../platform/input/layout';
import { startBrowserLoop } from '../platform/loop';
import {
  PERSIST_AFTER_SECONDS,
  captureInstallPrompt,
  persistenceAsked,
  registerServiceWorker,
  requestPersistence,
  takeUpdateNote,
} from '../platform/pwa';
import { BUILD_ID } from '../shared/version';
import { itemName } from '../ui/menu/model';
import {
  TrustedClock,
  browserClockEnv,
  dateAt,
  mergeClockMemory,
  readDeviceClock,
  writeDeviceClock,
} from '../platform/clock';
import { worldTickAt } from '../sim/time';
import { gatherSweep } from '../sim/gathering';
import { drawCraftStep } from '../render/craftStep';
import {
  drawGatherMeter,
  faded,
  meterRect,
  stepPoint,
  type Draws,
  type MeterRect,
} from '../render/actionMeter';
import { UI_BALANCE } from '../content/balance/ui';
import { STATIONS } from '../content/items/stations';
import type { SaveTime } from '../save/types';
import { attachAudioLifecycle, createGameAudio } from '../platform/audio';
import { browserSettingsEnv, SettingsStore } from '../platform/settings';
import {
  createSettingsBackend,
  persistSettings,
  restoreSettings,
} from '../platform/settingsStorage';
import { loadAtlas, type Manifest } from '../render/atlas';
import { Camera } from '../render/camera';
import { Notices } from '../ui/dom/notices';
import { FIXTURES } from '../content/world/fixtures';
import { litFor } from '../sim/systems/dungeon';
import { roomAt as regionRoomAt, OUTDOORS } from '../content/world/rooms';
import { UI_STRINGS } from '../content/strings/ui';
import { PATHS } from '../content/paths';
import { PATH_STRINGS } from '../content/strings/paths';
import { chooseTextRenderer } from '../ui/text/rule';
import { fill } from '../content/strings/skills';
import { NPCS } from '../content/dialogue';
import { pinnedLine } from '../sim/requestLog';
import { TalkSheet } from '../ui/dom/talk';
import { ChatTicker, PinnedLine } from '../ui/dom/ambient';
import { drawFloaters } from '../ui/messages/floaters';
import { quickCount, quickItem, quickNext, quickSlotOf } from '../ui/hud/quickSlot';
import { calloutFor } from '../ui/combat/callout';
import { lanesFor } from '../ui/messages/layout';
import { MessageRouter } from '../ui/messages/router';
import { MessageView } from '../ui/messages/view';
import { confirmRetire } from '../ui/dom/retire';
import { BoardSheet } from '../ui/dom/board';
import { runFrontEnd, type FrontEndResult } from '../ui/dom/frontEnd';
import {
  AutoSaver,
  checkSaveSupport,
  createStorage,
  IdbKeyStore,
  loadDeviceKey,
  newSaveId,
  SaveManager,
  SecureCodec,
  type SaveReason,
} from '../save';
import { showRecover, showUnsupported } from '../ui/dom/saveNotices';
import { validateSave, intact } from '../save/integrity';
import { exportBytes, exportFileName, planImport } from '../save/exportImport';
import { warmSealMaterial } from '../save/seal/source';
import {
  browserReminderStore,
  loadReminder,
  reminderDue,
  saveReminder,
} from '../platform/exportReminder';
import { download, showReminder } from '../ui/dom/backup';
import type { SavePlain } from '../save';
import { findAvatar } from '../shared/summary';
import { CombatFeedback } from '../render/feedback';
import { PanelCache } from '../ui/panel';
import { drawCanvasButton, type ButtonKit } from '../ui/hud/canvasButton';
import { drawLockFrame } from '../ui/hud/combatHud';
import { Hud, POOLS_HEIGHT, STATUS_HEIGHT } from '../ui/hud/hud';
import { MenuSheet } from '../ui/dom/menu';
import { Minimap } from '../ui/dom/minimap';
import { singularBanner } from '../ui/menu/singularModel';
import { MAP_STRINGS } from '../content/strings/map';
import { travelBlock } from '../sim/systems/waystones';
import { MapImage } from '../render/mapImage';
import { REGIONS } from '../content/world/regions';
import { countRevealed } from '../sim/world/fog';
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
import { CREATURES } from '../content/creatures';
import { drawTelegraphs, telegraphOf } from '../render/telegraph';
import { drawCommitMarks, drawWarnings } from '../render/warning';
import { ChunkRenderer, TILE_PX } from '../render/chunks';
import { lightLevel, skyOverlays } from '../render/grade';
import { LightIndex } from '../render/lights';
import { WeatherFx } from '../render/weatherFx';
import { LIGHTS } from '../content/world/atmosphere';
import { TIME } from '../content/balance/time';
import type { Weather } from '../content/balance/time';
import { WEATHER } from '../content/balance/time';
import { currentWeather } from '../sim/time';
import { DollFactory } from '../render/dollSprite';
import type { DevOverlay } from '../dev/overlay';
import { Canvas2DRenderer, Layer } from '../render/renderer';
import { readSafeInsets, watchViewport } from '../render/viewport';
import { createAvatar } from '../sim/avatar';
import { SKILLS } from '../content/skills';
import { TECHNIQUE_STRINGS } from '../content/strings/techniques';
import { chooseWake } from '../sim/world/wake';
import { ORIGINS, wakesFor } from '../content/world/origins';
import { WAKE_TABLES } from '../content/world/wake';
import { ORIGIN_STRINGS } from '../content/strings/origins';
import { MirrorPanel } from '../ui/dom/mirror';
import { ITEMS_BALANCE } from '../content/balance/items';
import { ITEMS } from '../content/items';
import { ITEM_STRINGS } from '../content/strings/items';
import { NODES } from '../content/items/recipes';
import { dollWithGear } from '../render/gearDoll';
import { madeItems } from '../sim/ledger';
import { addItem, newInventory } from '../sim/items';
import type { Command } from '../sim/kernel/commands';
import { cardinalOf } from '../sim/combat/fighter';
import { hasShield } from '../sim/combat/guard';
import { px } from '../sim/kernel/fixed';
import { createDemoState, deserializeState, hashState, type SimState } from '../sim/state';
import { stepWorld } from '../sim/step';
import { contextTarget } from '../sim/systems/interact';
import { TileWorld } from '../sim/world/world';
import { browserLoader, type ChunkLoader } from '../platform/world/loader';
import { ChunkStreamer } from '../platform/world/streamer';
import { newStream } from '../sim/world/stream';
import { chunkOfPx } from '../sim/world/window';
import { CHUNK_TILES } from '../sim/world/chunk';

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
  guard: 'G',
  context: 'E',
  menu: 'M',
  bag: 'B',
  swap: 'S',
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
  // Installable and offline (M2-05). The note says a new build took over since the last launch.
  registerServiceWorker();
  captureInstallPrompt();
  const updated = takeUpdateNote(BUILD_ID);
  const auto = params.get('auto') === '1';
  const fly = auto || params.get('fly') === '1';
  // Saves: `?nosave=1` turns loading and saving off (for screenshots and tools). Free flight never saves.
  const savesWanted = !(fly || params.get('nosave') === '1');
  if (savesWanted) {
    // A browser that cannot keep a safe save says so. It never stores one in the clear.
    const support = await checkSaveSupport();
    if (!support.ok) {
      applyPaletteVars(document.documentElement);
      showUnsupported(support.missing);
      return;
    }
  }
  // Trusted time (tech/02): the boot sync starts now and settles before the world starts, so the
  // game never waits on the network for more than its timeout and plays fine with none.
  const clock = new TrustedClock(browserClockEnv());
  const bootSync = clock.sync();
  const deviceKey = savesWanted ? loadDeviceKey(new IdbKeyStore()) : null;
  const saves = savesWanted
    ? new SaveManager({
        codec: new SecureCodec(() => deviceKey as Promise<CryptoKey>, true),
        storage: createStorage(),
        now: () => clock.trustedNow(),
        newId: newSaveId,
        // Dev builds check every save as it is written and warn, so a legitimate change that
        // would trip a rule is found by the developer, not by a player.
        ...(import.meta.env.DEV
          ? {
              audit: (plain: SavePlain): void => {
                const found = validateSave(plain);
                if (!found.ok)
                  console.warn(
                    `[integrity] this save would be flagged: ${found.reasons.map((r) => `${r.code} (${r.detail})`).join('; ')}`,
                  );
              },
            }
          : {}),
      })
    : null;
  // Fetch the seal material now, while online, so an import at the title works with no network.
  if (savesWanted) void warmSealMaterial();
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
  // The world streams in around the avatar (M4-03). `?region=` picks another baked region, for
  // tools and tests (dev regions are served by the dev server and the preview only).
  const regionId = /^[a-z][a-z0-9_]*$/.test(params.get('region') ?? '')
    ? (params.get('region') as string)
    : 'dawnmeadow';
  const loader: ChunkLoader = await browserLoader();
  const regionManifest = await loader.manifest(regionId);
  // The world loads after the title, so a first launch starts the region download now, while the
  // player is at the title screen. Without it a first start that goes offline before login has no
  // chunks. Later launches find the region cached and this returns at once.
  void loader.status(regionManifest).then((st) => {
    if (!st.complete) void loader.prefetch(regionManifest).catch(() => {});
  });
  const world = new TileWorld();
  const streamer = new ChunkStreamer(loader, regionManifest, world);
  const worldW = regionManifest.chunks.w * CHUNK_TILES * TILE_PX;
  const worldH = regionManifest.chunks.h * CHUNK_TILES * TILE_PX;

  const renderer = new Canvas2DRenderer(canvas);
  renderer.setAtlas(atlas);
  const camera = new Camera(worldW, worldH);
  const chunkRenderer = new ChunkRenderer(atlas, world, m.tiles);
  chunkRenderer.beyondEdge = streamer.beyondEdge;
  // Lights that map tiles make (torches, lit windows) are indexed as chunks arrive (M4-09).
  const lightIndex = new LightIndex();
  // The map picture reads each chunk as it arrives. Ground uncovered in an earlier session is read
  // from the chunk cache when the Map opens (M4-06).
  const mapImage = new MapImage(regionManifest.chunks.w, regionManifest.chunks.h);
  streamer.onChunk = (c) => {
    lightIndex.add(c);
    mapImage.setChunk(c);
  };
  streamer.onDrop = (cx, cy) => {
    chunkRenderer.drop(cx, cy);
    lightIndex.remove(cx, cy);
  };
  const weatherFx = new WeatherFx(() => Math.random());

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

  /** Paints the setup preview (24 x 32) facing `dir` from the preview doll's idle frame. */
  const paintPreview = (canvas: HTMLCanvasElement, dir: 'down' | 'right' | 'up' | 'left'): void => {
    const a = atlas.anim('char.setup', `idle_${dir}`);
    const h = atlas.animFrame(a, 0);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    // The left view is the right one mirrored.
    if (atlas.animFlip(a)) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
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
    ctx.restore();
  };

  // The front end: title, then setup for a new character or a short connecting beat for a saved
  // one. Developer parameters (`?at=`, `?foes=`, `?nosave=`, `?fly=`, `?skip=1`) go straight in.
  const direct = fly || ['at', 'foes', 'nosave', 'skip'].some((k) => params.has(k));
  let entry: Extract<FrontEndResult, { mode: 'new' }> | null = null;
  let previewDolls: ReturnType<typeof dolls.create> | null = null;
  /** The preview doll, made on first use (setup makes it; a loaded game makes it for the mirror). */
  const previewDolls0 = (): NonNullable<typeof previewDolls> =>
    (previewDolls ??= dolls.create('char.setup', randomDoll(rand)));
  if (!direct) {
    const savedAvatar = restored ? state0Avatar(restored) : null;
    previewDolls = dolls.create('char.setup', randomDoll(rand));
    const result = await runFrontEnd({
      root,
      updated,
      importer: {
        planImport: (bytes) => planImport(bytes, undefined, () => clock.trustedNow()),
        hasSave: () => loaded !== null,
        // At the title the import becomes the save to continue from, with no reload: the loaded
        // save and state are replaced here, and the title then steps into the world.
        applyImport: async (plan) => {
          if (!saves) throw new Error('saving is off');
          await saves.importSave(plan.plain);
          loaded = await saves.load();
          restored = loaded ? deserializeState(loaded.plain.sim) : null;
          if (restored && findAvatar(restored) === null) restored = null;
        },
      },
      exportSaved: async () => {
        if (!loaded) throw new Error('nothing to export');
        return {
          bytes: await exportBytes(loaded.plain),
          fileName: exportFileName(savedAvatar?.handle ?? 'save', dateAt(clock.trustedNow())),
        };
      },
      retire: async () => {
        if (!saves) throw new Error('saving is off');
        await saves.retire();
        loaded = null;
        restored = null;
      },
      save:
        restored && savedAvatar && loaded
          ? {
              handle: savedAvatar.handle,
              playSeconds: loaded.plain.playSeconds,
              look: loaded.plain.look,
              trust: loaded.plain.trust,
            }
          : null,
      drawPreview: (canvas, look, dir = 'down') => {
        previewDolls0().draw(dollWithGear(look, startGear0));
        paintPreview(canvas, dir);
      },
      rand,
    });
    if (result.mode === 'new') {
      entry = result;
      // A new character starts a new game, even if an unreadable save was lying around.
      restored = null;
      saves?.startFresh();
    }
  }
  // The newest save could not be used: say which one was loaded and why.
  if (!entry && restored && loaded?.report.fellBack) {
    await showRecover(root, loaded.report, loaded.plain.createdAt);
  }
  // The boot sync has had the whole title screen to finish. Offline or blocked, it just says no.
  await bootSync;
  const timeMemory = restored && loaded ? loaded.plain.time : null;
  clock.load(mergeClockMemory(timeMemory, readDeviceClock()));
  // The world clock counts from the save's epoch; a new character starts it now.
  const worldEpoch = timeMemory?.epoch ?? clock.trustedNow();
  canvas.dataset.timeSynced = String(clock.isSynced());
  canvas.dataset.closedMs = String(Math.round(clock.elapsedSinceLastSession()));
  /** The trusted-time record every save carries. */
  function saveTime(): SaveTime {
    const memory = clock.snapshot();
    writeDeviceClock(memory);
    return { epoch: worldEpoch, ...memory };
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
  // Settings outlive a session and a Log Out. Not part of the save (tech/01).
  if (!fly && params.get('nosave') !== '1') {
    const backend = createSettingsBackend();
    if (backend) {
      await restoreSettings(settings, backend);
      persistSettings(settings, backend);
    }
  }
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
  const router = new MessageRouter();
  const notices = new Notices(root, router);
  const messageView = new MessageView(root, router, settings);
  // The first line on waking is the origin's, in the notice lane (M4-19). It describes the moment.
  if (entry) {
    const first = ORIGIN_STRINGS[ORIGINS[entry.origin]?.firstLineKey ?? ''];
    if (first) router.post({ lane: 'notice', text: first, key: 'origin.first' });
  }
  // The hint on show, so it is posted once and retracted when the sim drops it.
  let shownHint: string | null = null;
  const fit = (v: Parameters<Canvas2DRenderer['resize']>[0]): void => {
    renderer.resize(v);
    applyPixelScale(root, v.scale / v.dpr);
    camera.setView(v.width, v.height, v.portrait);
  };
  // Region download (M4-03): after the start window is in, fetch the rest of the region in the
  // background so it plays with no network. A pinned region is also marked, and kept.
  let cacheMode = '';
  const syncRegionCache = (): void => {
    const st = settings.get();
    const pinned = st.pinnedRegions.includes(regionId);
    const mode = `${st.prefetchRegions}|${pinned}`;
    if (mode === cacheMode) return;
    cacheMode = mode;
    void loader.pin(regionId, pinned).catch(() => {});
    if (st.prefetchRegions || pinned) void loader.prefetch(regionManifest).catch(() => {});
  };
  settings.subscribe(syncRegionCache);
  setTimeout(syncRegionCache, 1500);
  const vp = watchViewport(probe, fit);
  fit(vp.current);
  // Whether a shield is worn, so the Guard button exists. Kept current by the tick.
  let shieldWorn = false;
  const input = attachInput(canvas, {
    leftHanded: () => settings.get().handedness === 'left',
    scheme: () => settings.get().controlScheme,
    guard: () => shieldWorn,
    hudScale: () => settings.get().hudScale,
    buttonScale: () => settings.get().buttonScale,
    keysEnabled: () => !menuOpen && !notices.tabletOpen && !talkOpen && !mirrorOpen,
    insets: () => readSafeInsets(probe),
  });
  let menuOpen = false;
  let mirrorOpen = false;
  let talkOpen = false;

  // The avatar lives in the sim. Feet position is the bottom center of its 10 x 8 box.
  const at = params.get('at')?.split(',').map(Number);
  const hasAt = !!at && at.length === 2 && at.every(Number.isFinite);
  // A new character has its own creation seed. Developer paths without one keep seed 1.
  const state = restored ?? createDemoState(entry?.seed ?? 1, 0);
  // Dev builds can freeze the time of day (`?time=dawn|day|dusk|night`) and force the weather
  // (`?weather=rain`), for screenshots and the frame-rate checks.
  const wantTime = import.meta.env.DEV ? params.get('time') : null;
  const frozenTick = ((): number | null => {
    if (!wantTime) return null;
    let at = 0;
    for (const p of TIME.phases) {
      if (p.phase === wantTime)
        return Math.round((at + p.minutes / 2 - TIME.startMinute) * TIME.ticksPerMinute);
      at += p.minutes;
    }
    return null;
  })();
  const wantWeather = import.meta.env.DEV ? params.get('weather') : null;
  state.region = regionId;
  if (wantWeather && (WEATHER as readonly string[]).includes(wantWeather))
    state.weatherOverride = wantWeather as Weather;
  const worldNow = (): number => frozenTick ?? worldTickAt(clock.trustedNow(), worldEpoch);
  state.worldTick = worldNow();
  // A new character wakes at one of the wake points, outside town and facing it (M4-14). A
  // developer `?at=` overrides that. A region with no wake table (dev regions) starts at its
  // first wake point.
  const wake =
    !restored && entry && !hasAt && WAKE_TABLES[regionId]
      ? chooseWake(state, wakesFor(entry.origin), regionId)
      : null;
  const savedPos = restored ? restored.entities.comps.pos[findAvatar(restored) as number] : null;
  // A start with no choice behind it (`?skip=1`, a dev path) stands by the region's Hearthford
  // Waystone when it has one, else at its first wake point.
  const hub = regionManifest.waystones?.find((w) => w.id === 'hearthford');
  const regionWake = hub ? { x: hub.x, y: hub.y + 2 } : regionManifest.wakePoints?.[0];
  const spawnTile = hasAt
    ? { x: (at as number[])[0] as number, y: (at as number[])[1] as number }
    : wake
      ? { x: wake.x, y: wake.y }
      : savedPos
        ? {
            x: Math.floor(savedPos.x / 256 / TILE_PX),
            y: Math.floor((savedPos.y / 256 - 1) / TILE_PX),
          }
        : regionWake
          ? { x: regionWake.x, y: regionWake.y }
          : { x: 48, y: 48 };
  // Stream in the window around the start before the first frame, so there is never a loading
  // screen after this point. The slice's default start is an object in the map, found once its
  // chunks are in.
  const settleAt = async (tx: number, ty: number): Promise<void> => {
    streamer.update(Math.floor(tx / CHUNK_TILES), Math.floor(ty / CHUNK_TILES));
    await streamer.whenReady();
  };
  await settleAt(spawnTile.x, spawnTile.y);
  if (!restored && !hasAt && !wake && !regionWake) {
    for (const k of [...Array(regionManifest.chunks.w * regionManifest.chunks.h).keys()]) {
      const c = world.chunk(k % regionManifest.chunks.w, Math.floor(k / regionManifest.chunks.w));
      const o = c?.objects.find((ob) => ob.kind === 'spawn.player');
      if (c && o) {
        spawnTile.x = c.cx * CHUNK_TILES + o.x;
        spawnTile.y = c.cy * CHUNK_TILES + o.y;
        await settleAt(spawnTile.x, spawnTile.y);
        break;
      }
    }
  }
  state.world = world;
  // Map objects become entities as their chunks enter the window, and fold into the save's chunk
  // deltas as they leave it. `?foes=0` turns spawners off.
  state.stream = newStream(world, !fly && params.get('foes') !== '0');
  const feet = { x: spawnTile.x * TILE_PX + 8, y: spawnTile.y * TILE_PX + 14 };
  const who = restored
    ? (findAvatar(restored) as number)
    : createAvatar(state, px(feet.x), px(feet.y), entry?.handle, entry?.origin);
  if (wake) {
    const a = state.entities.comps.avatar[who];
    if (a) a.facing = wake.facing as typeof a.facing;
  }
  // `?at=` also moves a loaded avatar, for screenshots and tests.
  if (restored && hasAt) {
    const p = state.entities.comps.pos[who];
    if (p) {
      p.x = px(feet.x);
      p.y = px(feet.y);
    }
  }
  // `?kit=dev` (dev builds only) adds a quick kit for screenshots and tests, recorded as seeded.
  const bag =
    restored || !import.meta.env.DEV || params.get('kit') !== 'dev'
      ? null
      : state.entities.comps.inventory[who];
  if (bag) {
    for (const [item, qty] of [
      ['item.sword_iron', 1],
      ['item.outfit_leather', 1],
      ['item.shield_wood', 1],
      ['item.raw_meat', 2],
    ] as const) {
      addItem(bag, item, qty);
      madeItems(state, 'seed', item, qty);
    }
  }
  // Demo keys until the Menu exists (M1-06): G wear the next piece of gear. F is the quick slot now.
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
    }
  });

  const lastDrawn = new Map<number, { x: number; y: number }>();

  // The inn mirror (M4-19): the setup editor again, minus the origin. Free.
  const mirror = new MirrorPanel(root, {
    current: () => baseDoll,
    drawPreview: (canvas, look, dir) => {
      const inv = state.entities.comps.inventory[who];
      previewDolls0().draw(dollWithGear(look, inv ? inv.equipment : startGear));
      paintPreview(canvas, dir);
    },
    rand,
    apply: (look) => {
      baseDoll = look;
      const inv = state.entities.comps.inventory[who];
      player.draw(dollWithGear(baseDoll, inv ? inv.equipment : startGear));
      requestSave('manual');
    },
    onOpenChange: (open) => {
      mirrorOpen = open;
      if (open) input.sampler.keyboard.reset();
    },
  });
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
      const sprite = state.worldTick >= n.readyAt ? def.sprite.ready : def.sprite.spent;
      // Feet at the node: centered across, with two px under the sprite's bottom edge (a 12 px icon
      // lands where it always did; a tall tree stands on its own trunk).
      const h = iconOf(sprite);
      renderer.drawSprite(
        Layer.Objects,
        h,
        Math.round(p.x / 256) - Math.floor(atlas.width(h) / 2),
        Math.round(p.y / 256) - (atlas.height(h) - 2),
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
  /** When each door, gate or chest opened this session, for its opening frames. */
  // The trace and hold steps read the pointer directly: where it is, in the step's 1000 by 1000 space.
  const stepPtr = { down: false, x: 0, y: 0 };
  let stepGeom: { x: number; y: number; w: number; h: number; k: number } | null = null;
  let holdSent = false;
  let lastMeter: { draw: (r: Draws) => void; until: number } | null = null;
  let kbCursor = { x: 500, y: 500 };
  const setPtr = (e: PointerEvent, down: boolean): void => {
    const css = canvas.getBoundingClientRect();
    stepPtr.down = down;
    stepPtr.x = e.clientX - css.left;
    stepPtr.y = e.clientY - css.top;
  };
  canvas.addEventListener('pointerdown', (e) => setPtr(e, true));
  canvas.addEventListener('pointermove', (e) => {
    if (stepPtr.down) setPtr(e, true);
  });
  canvas.addEventListener('pointerup', (e) => setPtr(e, false));
  canvas.addEventListener('pointercancel', (e) => setPtr(e, false));
  const openedAt = new Map<number, number>();
  const OPENING_STEP_MS = 90;
  const OPENING_FRAMES = { door: 4, gate: 3, chest: 1 } as const;
  const drawFixtures = (now: number): void => {
    const e = state.entities;
    for (const id of e.comps.fixture.keys()) {
      const f = e.comps.fixture[id];
      const p = e.comps.pos[id];
      const def = f ? FIXTURES[f.kind] : undefined;
      if (!f || !p || !def?.sprite) continue;
      // The slab over a hidden way is drawn only while the way is shut.
      if (def.unlockedBy && f.open) continue;
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
      // A hidden niche is drawn only once Hexing has revealed it.
      if (def.hidden && !f.revealed) continue;
      let frame = fixtureFrame(def.type, f.open);
      if (def.type === 'door' || def.type === 'gate' || def.type === 'chest') {
        // A fixture opened this session plays its opening frames first. One loaded already open
        // just shows open.
        const since = f.open ? openedAt.get(id) : undefined;
        if (since !== undefined) {
          const steps = OPENING_FRAMES[def.type];
          const k = Math.floor((now - since) / OPENING_STEP_MS);
          if (k < steps) frame = `opening_${k}`;
          else openedAt.delete(id);
        }
      }
      const layer =
        def.type === 'plate' ||
        def.type === 'vent' ||
        (def.type === 'door' && frame === 'open') ||
        (def.type === 'element' && f.open && !def.hidden)
          ? Layer.Detail
          : Layer.Objects;
      renderer.drawSprite(layer, spriteFrame(def.sprite, frame), x, y);
    }
  };

  // Steam clouds: a few pale puffs that drift with the clock, fading out as the cloud ends.
  const drawClouds = (now: number): void => {
    const e = state.entities;
    for (const id of e.comps.cloud.keys()) {
      const c = e.comps.cloud[id];
      const p = e.comps.pos[id];
      if (!c || !p) continue;
      const x = Math.round(p.x / 256);
      const y = Math.round(p.y / 256);
      const left = Math.max(0, c.until - state.tick);
      const k = Math.min(1, left / 20);
      for (let i = 0; i < 5; i++) {
        const a = (now / 600 + i * 1.3) % (Math.PI * 2);
        const rx = Math.round(Math.cos(a) * c.radius * 0.5);
        const ry = Math.round(Math.sin(a) * c.radius * 0.35);
        renderer.drawRect(Layer.Objects, x + rx - 7, y + ry - 12, 14, 9, '#e8eef2', 0.55 * k);
      }
    }
  };

  // Rooms: the camera is held to the room the avatar is in and snaps when it changes.
  const ROOM_PX = TILE_PX;
  // The slice's rooms (the square and the cave) exist only on the slice. Any other region is one
  // open room as big as the region, until its own interiors and dungeons register (M4-11).
  let nextPortalScan = 0;
  const regionRoom: typeof OUTDOORS = {
    id: 'room.region',
    x0: 0,
    y0: 0,
    x1: regionManifest.chunks.w * CHUNK_TILES,
    y1: regionManifest.chunks.h * CHUNK_TILES,
    outdoors: true,
  };
  const roomAt = (tx: number, ty: number): typeof OUTDOORS | null =>
    regionRoomAt(tx, ty, regionId) ?? (regionId === 'slice' ? null : regionRoom);
  const startPos = state.entities.comps.pos[who];
  let room =
    (restored && startPos
      ? roomAt(Math.floor(startPos.x / 256 / TILE_PX), Math.floor((startPos.y / 256 - 1) / TILE_PX))
      : roomAt(spawnTile.x, spawnTile.y)) ?? regionRoom;
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
  let lastGatherQty = 1;

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
    region: regionId,
    map: {
      ctx: {
        region: regionId,
        regionName: REGIONS.find((r) => r.id === regionId)?.name ?? regionId,
        chunks: regionManifest.chunks,
        landmarks: regionManifest.landmarks ?? [],
        waystones: regionManifest.waystones ?? [],
      },
      image: mapImage,
      travel: (stone) => {
        const def = regionManifest.waystones?.find((w) => w.id === stone);
        const block = travelBlock(state, who, stone);
        if (!def || (block !== null && block !== 'loading')) return;
        menu.close();
        // Load the ground around the stone first, so the avatar lands on it and nothing hitches.
        fadeAt = performance.now();
        void streamer
          .preload(Math.floor(def.x / CHUNK_TILES), Math.floor(def.y / CHUNK_TILES))
          .then(() => pendingCommands.push({ type: 'travel', stone }))
          .catch(() => notices.toast(MAP_STRINGS.blocked.loading));
      },
      fill: async (chunks) => {
        for (const c of chunks) {
          const f = regionManifest.files.find((x) => x.cx === c.cx && x.cy === c.cy);
          if (f) mapImage.setChunk(await loader.load(regionId, f));
        }
      },
    },
    read: () => ({ state, who }),
    send: (c) => pendingCommands.push(c),
    settings,
    drawIcon: (canvas, id) => blit(canvas, atlas.frame(id, 'base')),
    drawCreature: (canvas, spriteId) => {
      try {
        const h = atlas.animFrame(animOf(spriteId, 'idle', 4), 0);
        canvas.width = atlas.width(h);
        canvas.height = atlas.height(h);
        blit(canvas, h);
      } catch {
        canvas.width = 1;
        canvas.height = 1;
      }
    },
    drawAvatar: (canvas) => blit(canvas, atlas.animFrame(animOf('char.player', 'idle', 4), 0)),
    // Log Out saves, then returns to the title screen (a fresh page start shows it).
    trust: () => saves?.currentTrust() ?? intact(),
    beforeUpdate: async () => {
      if (!saves) return;
      saver.request('manual');
      await saver.idle();
    },
    backup: {
      exportCurrent: () => exportFile(),
      planImport: (bytes) => planImport(bytes, undefined, () => clock.trustedNow()),
      hasSave: () => saves !== null,
      applyImport: async (plan) => {
        if (!saves) throw new Error('saving is off');
        await saves.importSave(plan.plain);
      },
      // The game in memory is the old one. Reloading starts from the imported save.
      onImported: () => location.reload(),
      onExported: () => markExported(),
    },
    onDeleteCharacter: () => {
      if (!saves) return;
      void confirmRetire(root, {
        handle: state0Avatar(state)?.handle ?? 'save',
        playSeconds: state.tick / 30,
        exportCurrent: () => exportFile(),
        onExported: () => markExported(),
      }).then(async (yes) => {
        if (!yes) return;
        try {
          // Let a save in flight finish, then stop all saving so the old game is not written back.
          await saver.idle();
          retired = true;
          await saves.retire();
          location.reload();
        } catch {
          retired = false;
          notices.toast(UI_STRINGS.retire.failed);
        }
      });
    },
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
        // One sheet at a time (G4 playtest): the Menu sits over a station, shop or board panel
        // that is still open, so the Menu would seem not to open. The panel closes instead.
        if (talk.isOpen) talk.close();
        if (board.isOpen) board.close();
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
      if (open && menu.isOpen) menu.close();
      if (open) input.sampler.keyboard.reset();
    },
  });
  const board = new BoardSheet(root, {
    read: () => ({ state, who }),
    send: (c) => pendingCommands.push(c),
    onOpenChange: (open) => {
      talkOpen = open;
      if (open && menu.isOpen) menu.close();
      if (open) input.sampler.keyboard.reset();
    },
  });
  const pinned = new PinnedLine(root);
  // The minimap (M4-06): a tap opens the Map tab. It sits beside the loadout swap button.
  const minimap = new Minimap(root, mapImage, () => menu.open('map'));
  let mmRevealedAt = 0;
  let mmRevealed = 0;
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
  const skillFeed = new SkillFeed(router);
  const centerOf = (id: number): { x: number; y: number } | null => {
    const p = state.entities.comps.pos[id];
    return p ? { x: Math.round(p.x / 256), y: Math.round(p.y / 256) - 4 } : null;
  };

  // Scripted chat, scaffolding until M5.
  const chat = new ChatTicker(router, state.tick / 30);

  // Autosave (tech/02): every 60 seconds of play, on room changes and Trials, when the page is
  // hidden or closed. One save runs at a time. `data-saved-seq` and `data-saved-hash` let tests
  // see what was written.
  const AUTOSAVE_TICKS = 60 * 30;
  let lastSaveTick = state.tick;
  let saveGlyphAt = -1e9;
  const GLYPH_MS = 1600;
  // Set while a deleted character is being removed: nothing may write the old game back.
  let retired = false;
  const saver = new AutoSaver(
    async () => {
      if (!saves || retired) return;
      const h = hashState(state);
      const seq = await saves.commit({
        sim: state,
        look: baseDoll,
        playSeconds: state.tick / 30,
        time: saveTime(),
      });
      canvas.dataset.savedSeq = String(seq);
      canvas.dataset.savedHash = h;
    },
    () => undefined,
    () => {
      saveGlyphAt = performance.now();
    },
  );
  /** Writes the game as it is now, then seals exactly what was written. */
  async function exportFile(): Promise<{ bytes: Uint8Array; fileName: string }> {
    if (!saves) throw new Error('saving is off');
    saver.request('manual');
    await saver.idle();
    const plain = await saves.latestPlain();
    if (!plain) throw new Error('nothing to export');
    const handle = state0Avatar(state)?.handle ?? 'save';
    return {
      bytes: await exportBytes(plain),
      fileName: exportFileName(handle, dateAt(clock.trustedNow())),
    };
  }
  // The backup reminder: after 5 hours of play since the last export, ask once, dismissible.
  // Declared before the Menu uses `markExported`, so it is a function declaration.
  const reminderStore = browserReminderStore();
  let reminderShown = false;
  function playSeconds(): number {
    return state.tick / 30;
  }
  function markExported(): void {
    const id = saves?.currentSaveId();
    if (id)
      saveReminder(reminderStore, id, { exportedAt: playSeconds(), dismissedAt: playSeconds() });
    reminderShown = false;
  }
  const checkReminder = (): void => {
    const id = saves?.currentSaveId();
    if (!saves || !id || reminderShown) return;
    const st = loadReminder(reminderStore, id, playSeconds());
    if (!reminderDue(playSeconds(), st)) return;
    reminderShown = true;
    showReminder(
      root,
      async () => {
        try {
          const file = await exportFile();
          download(file.bytes, file.fileName);
          markExported();
        } catch {
          // The reminder comes back at the next check.
          reminderShown = false;
        }
      },
      () => saveReminder(reminderStore, id, { ...st, dismissedAt: playSeconds() }),
    );
  };
  // Keep the clock honest while playing: ask the server again every few minutes and whenever the
  // network comes back. A failure changes nothing.
  window.setInterval(() => void clock.sync(), 5 * 60_000);
  window.addEventListener('online', () => void clock.sync());
  // Ask the browser to keep the save from being cleared, once, after the first Trial or 15
  // minutes of play, with the reason on screen. The answer is shown in System.
  let persistDone = !saves || persistenceAsked();
  const askPersistence = (): void => {
    if (persistDone) return;
    persistDone = true;
    notices.toast(UI_STRINGS.device.asking);
    void requestPersistence();
  };
  const requestSave = (reason: SaveReason): void => {
    if (saves) saver.request(reason);
  };
  if (saves) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) requestSave('hidden');
    });
    window.addEventListener('pagehide', () => requestSave('pagehide'));
    window.setInterval(checkReminder, 60_000);
    window.setTimeout(checkReminder, 3000);
    // The crash handler writes the emergency slot, once, and touches nothing else.
    let crashed = false;
    const onCrash = (): void => {
      if (crashed || retired) return;
      crashed = true;
      void saves
        .commitEmergency({
          sim: state,
          look: baseDoll,
          playSeconds: state.tick / 30,
          time: saveTime(),
        })
        .catch(() => undefined);
    };
    window.addEventListener('error', onCrash);
    window.addEventListener('unhandledrejection', onCrash);
    if (restored) {
      canvas.dataset.loadedHash = hashState(state);
      canvas.dataset.loadedSeq = String(loaded?.plain.seq ?? 0);
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
  if (import.meta.env.DEV && !fly) {
    void import('../dev/slice').then((mod) =>
      mod.installSliceHooks({ state, who, settings, command: (c) => pendingCommands.push(c) }),
    );
  }
  if (import.meta.env.DEV) {
    void import('../dev/overlay').then((mod) => {
      meter = new mod.DevOverlay(() => ({
        entities: state.entities.capacity - state.entities.free.length,
        drawCalls: renderer.drawCalls,
        logicalWidth: renderer.width,
        logicalHeight: renderer.height,
        scale: vp.current.scale,
        extra: `chunks ${world.size} built ${chunkRenderer.chunksBuilt} stalls ${chunkRenderer.stalls} | terrain blits ${renderer.terrainBlits}`,
      }));
    });
  }

  /** What the avatar is working on, if anything: the animation, the thing's position and its box. */
  const workOf = (): { anim: string; x: number; y: number; box: number[] } | null => {
    const e = state.entities;
    const g = e.comps.gather[who];
    if (g) {
      const n = e.comps.node[g.node];
      const p = e.comps.pos[g.node];
      const def = n ? NODES[n.kind] : undefined;
      if (def && p) {
        const x = Math.round(p.x / 256);
        const y = Math.round(p.y / 256);
        return { anim: def.workAnim, x, y, box: [x - 7, y - 11, 14, 14] };
      }
    }
    const c = e.comps.craft[who];
    const st = c ? STATIONS[c.station] : undefined;
    const ap = e.comps.pos[who];
    if (c && st && ap) {
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const id of e.comps.interactable.keys()) {
        const it = e.comps.interactable[id];
        const p = e.comps.pos[id];
        if (it?.kind !== c.station || !p) continue;
        const d = Math.hypot(p.x - ap.x, p.y - ap.y);
        if (d < bestD) {
          bestD = d;
          best = { x: Math.round(p.x / 256), y: Math.round(p.y / 256) };
        }
      }
      if (best) return { anim: st.workAnim, ...best, box: [best.x - 8, best.y - 12, 16, 14] };
    }
    return null;
  };
  /** Hit sparks at the thing being worked: render only, off under reduced motion. */
  const sparks: { x: number; y: number; born: number }[] = [];

  const drawActor = (spriteId: string, id: number, now: number, x: number, y: number): void => {
    const f = state.entities.comps.fighter[id];
    const v = state.entities.comps.vel[id];
    let facing = state.entities.comps.avatar[id]?.facing ?? (f ? cardinalOf(f.aim) : 4);
    const working = id === who ? workOf() : null;
    let name = 'idle';
    let t = now;
    const last = lastDrawn.get(id);
    lastDrawn.set(id, { x, y });
    const walking = last !== undefined && (last.x !== x || last.y !== y);
    if (state.entities.comps.ai[id]?.state === 'warn' && f?.state === 'idle') {
      // The warning pose: the wind-up frame, held. A creature that rears is telling you to back off.
      name = 'attack';
      t = 0;
    } else if (f?.state === 'attack') {
      name = 'attack';
      t = Math.min(Math.max(0, f.t) * (1000 / 30), 249);
    } else if (f?.state === 'dodge') {
      name = 'dodge';
      t = Math.min(Math.max(0, f.t) * (1000 / 30), 249);
    } else if (f?.state === 'hurt' || f?.state === 'stagger' || f?.state === 'dead') name = 'hurt';
    else if (id === who && working) {
      name = working.anim;
      // Face the thing being worked.
      const wx = working.x - x;
      const wy = working.y - y;
      facing = Math.abs(wx) > Math.abs(wy) ? (wx > 0 ? 2 : 6) : wy > 0 ? 4 : 0;
    } else if ((v && (v.x !== 0 || v.y !== 0)) || (!state.entities.comps.avatar[id] && walking))
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

  // Auto flight: the slice's fixed loop, or a back and forth sweep across any other region.
  const loopPath: readonly [number, number][] =
    regionId === 'slice'
      ? LOOP
      : [
          [200, worldH / 2],
          [worldW - 200, worldH / 2],
          [worldW - 200, worldH / 3],
          [200, worldH / 3],
        ];
  let lastFrame = performance.now();
  let lastWorked = 0;
  startBrowserLoop({
    tick: () => {
      meter?.tickBegin(performance.now());
      prev = { x: apos.x, y: apos.y };
      if (fly) {
        // Free flight for the frame-rate check and for crossing the map: no collision, no sim step.
        let mx = 0;
        let my = 0;
        if (auto) {
          const target = loopPath[waypoint] as readonly [number, number];
          const dx = target[0] - apos.x / 256;
          const dy = target[1] - (apos.y / 256 - 14);
          const d = Math.hypot(dx, dy);
          if (d < 12) waypoint = (waypoint + 1) % loopPath.length;
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
        shieldWorn = hasShield(state, who);
        mapper.guardToggle = settings.get().guardToggle;
        // During a craft's step one tap anywhere in the lower zone is a hit (the context key
        // and button are too, in the sim).
        if (state.entities.comps.craft[who] && rec.targetTap) {
          const h = canvas.getBoundingClientRect().height;
          if (rec.targetTap.y > h * 0.5) pendingCommands.push({ type: 'craftStep' });
          rec.targetTap = null;
        }
        // The trace and hold steps own the pointer: no walking, no dodge flick, and the sim is
        // told where the pointer is, or whether it is down.
        const cs0 = state.entities.comps.craft[who];
        const st0 = cs0 ? STATIONS[cs0.station] : undefined;
        if (cs0 && st0 && (st0.step === 'trace' || st0.step === 'hold')) {
          const kb = input.sampler.keyboard.move();
          rec.move = { x: 0, y: 0 };
          rec.moveDir = null;
          rec.full = false;
          rec.dodge = null;
          rec.targetTap = null;
          if (st0.step === 'trace' && stepGeom) {
            kbCursor = {
              x: Math.min(1000, Math.max(0, kbCursor.x + kb.x * 18)),
              y: Math.min(1000, Math.max(0, kbCursor.y + kb.y * 18)),
            };
            const g = stepGeom;
            if (stepPtr.down)
              pendingCommands.push({ type: 'craftPoint', ...stepPoint(stepPtr, g, g.k) });
            else if (kb.x !== 0 || kb.y !== 0)
              pendingCommands.push({ type: 'craftPoint', x: kbCursor.x, y: kbCursor.y });
          } else if (st0.step === 'hold') {
            const want = stepPtr.down || input.sampler.keyboard.held().includes('context');
            if (want !== holdSent) {
              holdSent = want;
              pendingCommands.push({ type: 'craftHold', on: want });
            }
          }
        } else {
          holdSent = false;
          kbCursor = { x: 500, y: 500 };
        }
        mapper.syncGuard(state.entities.comps.fighter[who]?.guard === true);
        if (rec.menu) menu.toggle();
        if (rec.bag) menu.toggle('bag');
        // The quick slot (G4 playtest): a tap uses its item, a long press steps it on.
        if (rec.quickNext) {
          const inv = state.entities.comps.inventory[who];
          const next = quickNext(inv, settings.get());
          if (next && next !== quickItem(inv, settings.get())) {
            settings.set({ quickPick: next });
            router.post({
              lane: 'floater',
              text: ITEM_STRINGS[ITEMS[next]?.nameKey ?? ''] ?? next,
              key: 'quick',
            });
          }
        }
        if (rec.quick) {
          const inv = state.entities.comps.inventory[who];
          const item = quickItem(inv, settings.get());
          const slot = item ? quickSlotOf(inv, item) : -1;
          if (slot >= 0) pendingCommands.push({ type: 'use', slot });
        }
        stepWorld(state, who, {
          commands: [...pendingCommands.splice(0), ...mapper.map(rec)],
          worldTick: worldNow(),
        });
        {
          // Hints are notices with a glyph (design/09): posted once, retracted when acted on.
          const hint = state.entities.comps.journal[who]?.hint?.id.replace('hint.', '') ?? null;
          if (hint !== shownHint) {
            if (shownHint) router.retract(`hint.${shownHint}`);
            const text = hint ? (UI_STRINGS.hints as Record<string, string>)[hint] : undefined;
            if (hint && text) router.post({ lane: 'hint', text, key: `hint.${hint}` });
            shownHint = hint;
          }
        }
        chat.update(state.tick / 30);
        if (state.tick - lastSaveTick >= AUTOSAVE_TICKS) {
          lastSaveTick = state.tick;
          requestSave('timer');
          if (state.tick / 30 >= PERSIST_AFTER_SECONDS) askPersistence();
        }
        const now = performance.now();
        feedback.onEvents(state.events.list, now, centerOf, who, settings.get().reducedMotion);
        for (const e of state.events.list) {
          const c = calloutFor(state, who, e);
          if (c) feedback.callout(c.id, c.text, c.boss ? HURT : GOLD, now);
        }
        if (!settings.get().reducedMotion) {
          const w = workOf();
          if (w)
            for (const e of state.events.list)
              if (
                (e.type === 'craftTap' && e.id === who) ||
                ((e.type === 'gatherSwing' || e.type === 'gatherResolved') &&
                  e.id === who &&
                  e.sweet)
              )
                sparks.push({ x: w.x, y: w.y, born: now });
        }
        skillFeed.ingest(state.events.list, who);
        // Redress on any change of gear, taking an item off included, so an unarmed avatar holds nothing.
        if (
          state.events.list.some(
            (ev) => (ev.type === 'equipped' || ev.type === 'unequipped') && ev.id === who,
          )
        )
          player.draw(
            dollWithGear(baseDoll, state.entities.comps.inventory[who]?.equipment ?? startGear),
          );
        for (const e of state.events.list) {
          if (e.type === 'roomChanged' && e.who === who) {
            const tx = Math.floor(apos.x / 256 / TILE_PX);
            const ty = Math.floor((apos.y / 256 - 1) / TILE_PX);
            enterRoom(roomAt(tx, ty) ?? regionRoom);
            fadeAt = performance.now();
            requestSave('transition');
          } else if (e.type === 'trialPassed' && e.id === who) askPersistence();
          else if (e.type === 'itemPickedUp' && e.id === who)
            router.post({
              lane: 'floater',
              text: ITEM_STRINGS[ITEMS[e.item]?.nameKey ?? ''] ?? e.item,
              key: e.item,
              amount: e.qty,
            });
          else if (e.type === 'gatherResolved' && e.id === who) lastGatherQty = e.qty;
          else if (e.type === 'gathered' && e.id === who)
            notices.toast(
              (e.tag === 'fishing' ? W_STR.caught : W_STR.gathered)
                .replace('{n}', String(lastGatherQty))
                .replace('{item}', itemName(e.item)),
              `gather.${e.item}`,
            );
          else if (e.type === 'denied' && e.id === who)
            notices.toast(
              {
                cooldown: W_STR.deniedCooldown,
                stamina: W_STR.deniedStamina,
                focus: W_STR.deniedFocus,
                requires: W_STR.deniedRequires,
                skill: W_STR.deniedSkill,
                locked: W_STR.deniedLocked,
              }[e.reason],
              `denied.${e.reason}`,
            );
          else if (e.type === 'signRead' && e.who === who)
            notices.toast(SIGN_STRINGS[e.kind.replace('fixture.sign_', 'sign.')] ?? '', e.kind);
          else if (e.type === 'roomReset' && e.who === who)
            notices.toast(e.count > 0 ? W_STR.roomReset : W_STR.roomResetNone);
          else if (e.type === 'doorLocked') notices.toast(W_STR.locked);
          else if (e.type === 'doorOpened') {
            openedAt.set(e.id, performance.now());
            notices.toast(W_STR.unlocked);
          } else if (e.type === 'chestOpened') {
            openedAt.set(e.id, performance.now());
            const def = FIXTURES[state.entities.comps.fixture[e.id]?.kind ?? ''];
            const parts = (def?.loot?.items ?? []).map((l) =>
              l.qty > 1 ? `${l.qty} ${itemName(l.item)}` : itemName(l.item),
            );
            if (def?.loot?.coin) parts.push(W_STR.coin.replace('{n}', String(def.loot.coin)));
            notices.toast(
              parts.length
                ? W_STR.chestFound.replace('{items}', parts.join(', '))
                : W_STR.chestEmpty,
            );
          } else if (e.type === 'shortcutOpened') notices.toast(W_STR.shortcut);
          else if (e.type === 'pathEarned' && e.who === who) {
            const def = PATHS[e.path];
            notices.toast(
              `${fill(UI_STRINGS.rest.banner, { name: PATH_STRINGS[def?.nameKey ?? ''] ?? e.path })}. ${PATH_STRINGS[def?.giftKey ?? ''] ?? ''}`,
            );
          } else if (e.type === 'techniqueLearned' && e.who === who)
            notices.toast(
              W_STR.learned.replace(
                '{name}',
                TECHNIQUE_STRINGS[`${e.technique}.name`] ?? e.technique,
              ),
            );
          else if (e.type === 'skillAwakened' && e.id === who)
            notices.toast(W_STR.awakens.replace('{skill}', SKILLS[e.skill]?.name ?? e.skill));
          else if (e.type === 'itemStolen' && e.who === who)
            notices.toast(W_STR.stolen.replace('{item}', itemName(e.item)), 'stolen');
          else if (e.type === 'itemReturned' && e.who === who)
            notices.toast(W_STR.returned.replace('{item}', itemName(e.item)), 'returned');
          else if (e.type === 'bagGrew' && e.who === who)
            notices.toast(W_STR.bagGrew.replace('{n}', String(e.slots)));
          else if (e.type === 'bagBigEnough' && e.who === who) notices.toast(W_STR.bagBigEnough);
          else if (e.type === 'manualKnown' && e.who === who)
            notices.toast(
              W_STR.manualKnown.replace(
                '{name}',
                TECHNIQUE_STRINGS[`${e.technique}.name`] ?? e.technique,
              ),
            );
          else if (e.type === 'gateOpened') {
            openedAt.set(e.id, performance.now());
            notices.toast(W_STR.gate);
          } else if (e.type === 'waystoneSet') {
            notices.toast(W_STR.waystone);
            // A second stone makes travel possible, so the Map opens on it (M4-07).
            if ((state.map.waystones.filter((k) => k.startsWith(`${regionId}:`)).length ?? 0) > 1)
              menu.open('map');
          } else if (
            (e.type === 'singularStep' || e.type === 'worldFirst') &&
            singularBanner(state, who, e)
          ) {
            notices.toast(singularBanner(state, who, e) as string);
          } else if (e.type === 'waystoneAttuned' && e.who === who) {
            const n = MAP_STRINGS.waystones[e.stone as keyof typeof MAP_STRINGS.waystones];
            if (n) notices.toast(fill(MAP_STRINGS.attunedToast, { name: n }));
          } else if (e.type === 'traveled' && e.who === who) {
            fadeAt = performance.now();
            const n = MAP_STRINGS.waystones[e.to as keyof typeof MAP_STRINGS.waystones];
            if (n) notices.toast(fill(MAP_STRINGS.arrived, { name: n }));
            requestSave('transition');
          } else if (e.type === 'mirrorOpened') mirror.open();
          else if (e.type === 'tabletRead') {
            input.sampler.keyboard.reset();
            notices.openTablet(
              state.entities.comps.fixture[e.id]?.kind === 'fixture.tw_order'
                ? BELL_ORDER
                : undefined,
            );
          }
          talk.onEvent(e);
          board.onEvent(e);
          const sfx = sfxFor(e, who, (id) => {
            const c = state.entities.comps.ai[id]?.creature;
            return c ? CREATURES[c]?.sounds : undefined;
          });
          if (sfx) audio.playSfx(sfx);
          const h = hapticFor(e, who);
          if (h !== null) vibrate(h, settings.get().haptics);
        }
      }
      // The board redraws when what it shows changes, such as the bag (POW-M4-22A).
      board.update();
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
      streamer.update(chunkOfPx(pxX), chunkOfPx(pxY));
      // A portal whose far side is in a chunk that is not loaded (the Rootway, under the region)
      // gets that ground loaded while the avatar is still near it, so the step through is instant.
      if (now > nextPortalScan) {
        nextPortalScan = now + 250;
        for (const id of state.entities.comps.fixture.keys()) {
          const f = state.entities.comps.fixture[id];
          const p = state.entities.comps.pos[id];
          const def = f ? FIXTURES[f.kind] : undefined;
          const to = def?.type === 'portal' && def.to ? FIXTURES[def.to]?.at : undefined;
          if (!to || !p || Math.hypot(p.x / 256 - pxX, p.y / 256 - pxY) > 160) continue;
          void streamer
            .preload(Math.floor(to.x / CHUNK_TILES), Math.floor(to.y / CHUNK_TILES))
            .catch(() => {});
        }
      }
      camera.follow(pxX, pxY - 14, dt);
      const shake = feedback.shake(now);
      renderer.begin(camera.x + shake.x, camera.y + shake.y);
      // A dark room shows nothing but telegraphs, and the avatar, until a torch is lit or a
      // lantern is held (M4-08). The world is not drawn at all, so nothing leaks through.
      const dark = !fly && !litFor(state, who);
      if (dark) {
        renderer.drawRect(Layer.Ground, camera.x, camera.y, renderer.width, renderer.height, DARK);
      } else {
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
        drawClouds(now);
        // In a closed room, whatever lies past its walls (the sea over the Rootway, rock) is not
        // drawn: four bands of black cover the rest of the view.
        if (!room.outdoors) {
          const x0 = room.x0 * ROOM_PX;
          const y0 = room.y0 * ROOM_PX;
          const x1 = room.x1 * ROOM_PX;
          const y1 = room.y1 * ROOM_PX;
          const vx1 = camera.x + renderer.width;
          const vy1 = camera.y + renderer.height;
          const band = (x: number, y: number, w: number, h: number): void => {
            if (w > 0 && h > 0) renderer.drawRect(Layer.Overhead, x, y, w, h, DARK);
          };
          band(camera.x, camera.y, renderer.width, y0 - camera.y);
          band(camera.x, y1, renderer.width, vy1 - y1);
          band(
            camera.x,
            Math.max(y0, camera.y),
            x0 - camera.x,
            Math.min(y1, vy1) - Math.max(y0, camera.y),
          );
          band(x1, Math.max(y0, camera.y), vx1 - x1, Math.min(y1, vy1) - Math.max(y0, camera.y));
        }
      }
      // People: they stand still and turn to face you when you are close.
      for (const id of dark ? [] : state.entities.comps.npc.keys()) {
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
      // The sky: weather particles, the tint of the hour and the weather, and the lights of the
      // night. Under open sky only: caves, dungeons and houses keep their own light (M4-09).
      const outdoors =
        fly ||
        room.outdoors === true ||
        roomAt(Math.floor(pxX / TILE_PX), Math.floor((pxY - 1) / TILE_PX)) === null;
      const sky: Weather = outdoors ? currentWeather(state) : 'clear';
      weatherFx.update(dt, sky, renderer.width, renderer.height, now);
      if (outdoors) {
        const gx = camera.x + shake.x;
        const gy = camera.y + shake.y;
        weatherFx.draw(renderer, gx, gy, sky, now);
        const sky2 = skyOverlays(state.worldTick, sky);
        if (sky2.multiply)
          renderer.drawRect(
            Layer.Grade,
            gx,
            gy,
            renderer.width,
            renderer.height,
            sky2.multiply,
            1,
            'multiply',
          );
        if (sky2.haze)
          renderer.drawRect(
            Layer.Grade,
            gx,
            gy,
            renderer.width,
            renderer.height,
            sky2.haze.color,
            sky2.haze.alpha,
          );
        const level = lightLevel(state.worldTick);
        if (level > 0) {
          const glow = (
            x: number,
            y: number,
            def: { radius: number; color: number; alpha: number },
          ): void => {
            const flicker = 1 + 0.05 * Math.sin(now / 140 + x * 0.7);
            renderer.drawLight(
              Layer.Grade,
              x,
              y,
              def.radius * flicker,
              PALETTE[def.color] as string,
              def.alpha * level,
            );
          };
          lightIndex.forVisible(gx, gy, renderer.width, renderer.height, 64, (l) =>
            glow(l.x, l.y, l.def),
          );
          for (const id of state.entities.comps.fixture.keys()) {
            const f = state.entities.comps.fixture[id];
            const fp = state.entities.comps.pos[id];
            const t = f ? FIXTURES[f.kind]?.type : undefined;
            if (!f || !fp || (t !== 'waystone' && !(t === 'torch' && f.open))) continue;
            glow(
              Math.round(fp.x / 256),
              Math.round(fp.y / 256) - 8,
              LIGHTS.fixtures[t as string] as never,
            );
          }
          if (state.entities.comps.inventory[who]?.equipment.off?.item === 'item.lantern')
            glow(pxX, pxY - 8, LIGHTS.lantern);
        }
      }
      drawTelegraphs(renderer, state);
      drawWarnings(renderer, state);
      drawCommitMarks(renderer, state);
      if (!dark) drawItemsWorld();
      const worked = workOf();
      if (worked) {
        const [bx, by, bw, bh] = worked.box as [number, number, number, number];
        renderer.drawRect(Layer.Overhead, bx, by, bw, 1, GOLD);
        renderer.drawRect(Layer.Overhead, bx, by + bh - 1, bw, 1, GOLD);
        renderer.drawRect(Layer.Overhead, bx, by + 1, 1, bh - 2, GOLD);
        renderer.drawRect(Layer.Overhead, bx + bw - 1, by + 1, 1, bh - 2, GOLD);
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const sp = sparks[i] as (typeof sparks)[number];
        const age = (now - sp.born) / UI_BALANCE.meter.sparkMs;
        if (age >= 1) {
          sparks.splice(i, 1);
          continue;
        }
        const d = 2 + Math.round(5 * age);
        for (const [sx, sy] of [
          [-d, -d],
          [d, -d],
          [-d, d],
          [d, d],
        ] as const)
          renderer.drawRect(Layer.Overhead, sp.x + sx - 1, sp.y - 6 + sy, 2, 2, GOLD, 1 - age);
      }
      for (const id of dark ? [] : state.entities.comps.ai.keys()) {
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
      feedback.drawCallouts(
        renderer,
        fonts.large,
        camera.x + shake.x,
        camera.y + shake.y,
        now,
        DARK,
        centerOf,
        settings.get().reducedMotion,
      );

      // Screen space: bars, lock frame, controls.
      const v = vp.current;
      // The shown Path's title, above the avatar's head. Pixel text only where the text rule allows it.
      const shownPath = state.entities.comps.paths[who]?.shown;
      const titleKey = shownPath ? PATHS[shownPath]?.titleKey : undefined;
      const title = titleKey ? PATH_STRINGS[titleKey] : undefined;
      if (
        title &&
        chooseTextRenderer({ text: title, lines: 1, physicalMmPerLogicalPx: v.mmPerLogicalPx })
          .renderer === 'pixel'
      )
        fonts.small.draw(
          renderer,
          title,
          Math.round(pxX - camera.x - shake.x),
          Math.round(pxY - camera.y - shake.y) - 40,
          GOLD,
          { align: 'center', outline: DARK },
        );
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
      // The message lanes (design/09): placed from the same control layout the HUD uses, so the
      // lanes, the action meter and the thumb zone never overlap.
      const cssBox = canvas.getBoundingClientRect();
      const lay = computeLayout(cssBox.width, cssBox.height, settings.get().handedness === 'left', {
        scheme: settings.get().controlScheme,
        guard: shieldWorn,
        hudScale: settings.get().hudScale,
        buttonScale: settings.get().buttonScale,
        insets: readSafeInsets(probe),
      });
      const lanes = lanesFor(v, lay, readSafeInsets(probe));
      const kCss = v.cssWidth / v.width;
      const craftNow = state.entities.comps.craft[who];
      const stepNow = craftNow ? STATIONS[craftNow.station] : undefined;
      // A trace or hold step is a panel over the avatar: lanes wait behind it like any panel.
      const panelStep = !!stepNow && (stepNow.step === 'trace' || stepNow.step === 'hold');
      router.update(
        now,
        menuOpen || talkOpen || mirrorOpen || notices.tabletOpen || messageView.open || panelStep,
      );
      messageView.setBusy(panelStep);
      messageView.layout(lanes, cssBox.height * (1 - UI_BALANCE.messages.sheetFraction));
      messageView.render();
      drawFloaters(renderer, fonts.small, router, {
        x: lanes.floaters.x / kCss,
        y: lanes.floaters.y / kCss,
        h: lanes.floaters.h / kCss,
      });
      skillFeed.draw(
        renderer,
        fonts.small,
        now,
        v.safe.x + 3,
        v.safe.y + 3 + POOLS_HEIGHT + STATUS_HEIGHT + 4,
        settings.get().reducedMotion,
      );
      // The pinned request is clear text in the DOM (design/09), drawn below the HUD.
      pinned.set(menuOpen || talkOpen ? null : pinnedLine(state, who));
      // The action meter (design/09): over the avatar while it works, faded out over fadeMs after.
      {
        const feetY = Math.round(pxY - camera.y - shake.y);
        const anchor = {
          x: Math.round(pxX - camera.x - shake.x),
          headY: feetY - UI_BALANCE.meter.headDy,
          feetY,
        };
        const mvp = {
          safe: v.safe,
          // Under the status row and under the message lanes, so the meter never rises into them.
          topLimit: Math.max(
            v.safe.y + 3 + POOLS_HEIGHT + STATUS_HEIGHT + 4,
            Math.ceil(lanes.meterTop / kCss),
          ),
          zoneTop: Math.round(lay.stickZone.y * (v.dpr / v.scale)),
        };
        let draw: ((r: Draws) => void) | null = null;
        const gat = state.entities.comps.gather[who];
        const gs = gat ? gatherSweep(state, who) : null;
        if (gat && gs) {
          const bal = ITEMS_BALANCE.gather;
          // A sweep shows its sweet window. Fishing fills while it waits, then the bite window is gold.
          const total = gs.def.fishing ? gat.wait + bal.fishBiteTicks : gs.sweep.ticks;
          const r = meterRect(anchor, mvp, 'track');
          const view = {
            total,
            from: gs.def.fishing ? gat.wait : gs.sweep.sweetFrom,
            to: gs.def.fishing ? total - 1 : gs.sweep.sweetTo,
            t: gat.t,
            swing: gat.swing,
            swings: gs.sweep.swings,
          };
          draw = (rr) =>
            drawGatherMeter(rr, r, view, { ink: INK, dark: DARK, gold: GOLD, track: '#3a3f46' });
        }
        const cs = state.entities.comps.craft[who];
        const st = cs ? STATIONS[cs.station] : undefined;
        if (cs && st) {
          const r: MeterRect = meterRect(
            anchor,
            mvp,
            st.step === 'trace' || st.step === 'hold' ? 'panel' : 'track',
          );
          stepGeom = { ...r, h: r.w, k: v.dpr / v.scale };
          const view = {
            step: st.step,
            t: state.tick - cs.start,
            taps: cs.taps,
            craft: st.craft,
            samples: cs.samples ?? [],
            held:
              cs.holdFrom === undefined ? null : (cs.holdTo ?? state.tick - cs.start) - cs.holdFrom,
          };
          draw = (rr) =>
            drawCraftStep(rr, r, view, {
              ink: INK,
              dark: DARK,
              gold: GOLD,
              track: '#3a3f46',
              good: '#8a7a3a',
            });
        } else stepGeom = null;
        if (draw) {
          draw(renderer);
          lastMeter = { draw, until: now + UI_BALANCE.meter.fadeMs };
        } else if (lastMeter && now < lastMeter.until) {
          const fade = Math.max(0, (lastMeter.until - now) / UI_BALANCE.meter.fadeMs);
          lastMeter.draw(faded(renderer, fade));
        } else lastMeter = null;
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
          guard: shieldWorn,
          hudScale: settings.get().hudScale,
          buttonScale: settings.get().buttonScale,
          insets: readSafeInsets(probe),
        });
        {
          // Under the top row, beside the loadout swap button (away from the screen edge), so it
          // never covers the clock. Only when it is wanted.
          const bag = layout.buttons.swap;
          const size = 56 * settings.get().hudScale;
          const left = settings.get().handedness === 'left';
          minimap.hidden = !settings.get().minimap || menuOpen || talkOpen || mirrorOpen;
          if (!minimap.button.hidden && bag) {
            minimap.place(
              css.left + (left ? bag.x + bag.w + 8 : bag.x - 8 - size),
              css.top + bag.y,
            );
            const me = state.entities.comps.pos[who];
            if (me) {
              // Counting the fog is a few hundred reads, so it runs about four times a second.
              if (now - mmRevealedAt > 250) {
                mmRevealedAt = now;
                mmRevealed = countRevealed(state.map.fog[regionId] ?? {});
              }
              minimap.update(
                state.map.fog[regionId] ?? {},
                Math.floor(me.x / 256 / 16),
                Math.floor((me.y / 256 - 1) / 16),
                mmRevealed,
              );
            }
          }
        }
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
        const guardUp = state.entities.comps.fighter[who]?.guard === true;
        const quickInv = state.entities.comps.inventory[who];
        const quickNow = quickItem(quickInv, settings.get());
        for (const [id, r] of Object.entries(layout.buttons)) {
          // Slots with no technique and a context button with nothing to use are not shown.
          const slot = slotOf[id];
          if (slot !== undefined && !afight.slots[slot]) continue;
          if (id === 'context' && !hasTarget) continue;
          // The quick slot shows while the Bag holds something it can use.
          if (id === 'quick' && !quickNow) continue;
          const rect = {
            x: Math.round(r.x * k),
            y: Math.round(r.y * k),
            w: Math.round(r.w * k),
            h: Math.round(r.h * k),
          };
          const cooling = slot !== undefined && (afight.cooldowns[slot] ?? 0) > 0;
          const iconId =
            slot !== undefined
              ? TECHNIQUES[afight.slots[slot] as string]?.icon
              : id === 'quick'
                ? ITEMS[quickNow as string]?.icon
                : BUTTON_ICONS[id];
          const icon = iconId
            ? { handle: atlas.frame(iconId, 'base'), size: 12, alpha: cooling ? 0.45 : 1 }
            : undefined;
          drawCanvasButton(
            renderer,
            kit,
            rect,
            // The swap button shows which loadout is in use.
            id === 'swap'
              ? String((state.entities.comps.loadouts[who]?.active ?? 0) + 1)
              : id === 'quick'
                ? String(Math.min(99, quickCount(quickInv, quickNow as string)))
                : (LABELS[id] ?? '?'),
            held.has(id) || cooling || (id === 'guard' && guardUp),
            'small',
            icon,
          );
          if (id === 'quick' && quickNow) {
            // How many are left, in the corner, since the icon takes the label's place.
            const n = String(Math.min(99, quickCount(quickInv, quickNow)));
            fonts.small.draw(renderer, n, rect.x + rect.w - 2, rect.y + rect.h - 8, INK, {
              align: 'right',
              outline: DARK,
            });
          }
          if (cooling && slot !== undefined) {
            // The cooldown drains down the button: dark over what is still cooling.
            const total = TECHNIQUES[afight.slots[slot] as string]?.cooldown ?? 0;
            const left = afight.cooldowns[slot] ?? 0;
            const frac = total > 0 ? Math.min(1, left / total) : 1;
            const hh = Math.round(rect.h * frac);
            renderer.drawRect(Layer.Hud, rect.x, rect.y + rect.h - hh, rect.w, hh, DARK, 0.55);
          }
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
      // The larger of this and the last frame's work, so one heavy frame holds painting back for two.
      const frameWork = performance.now() - now;
      chunkRenderer.lastFrameMs = Math.max(frameWork, lastWorked);
      lastWorked = frameWork;
      meter?.frameEnd(performance.now());
    },
  });
}
