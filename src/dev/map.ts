import manifestJson from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import uiUrl from '../../baked/atlas-ui.png?url';
import { CREATURES } from '../content/creatures';
import type { Temperament } from '../content/creatures/types';
import { ROSTERS } from '../content/world/rosters';
import { STAMPS } from '../content/world/stamps';
import { ChunkRenderer, TILE_PX } from '../render/chunks';
import { loadAtlas, type Atlas, type Manifest } from '../render/atlas';
import { decodeChunk, Solid, tileIndex, CHUNK_TILES, type Chunk } from '../sim/world/chunk';
import { TileWorld } from '../sim/world/world';
import { collisionOfCell } from '../../tools/bake-assets/world';
import { DevRenderer } from './devRenderer';
import { el, mountDevPage } from './page';
import {
  LAYER_NAMES,
  paintCell,
  paintChars,
  resolveForEditor,
  stampSize,
  stampToChunks,
  exportLayers,
  type LayerName,
} from './stampEdit';
import type { StampV2 } from '../sim/world/stamp';

/** Appends children in order. */
function add(parent: HTMLElement, ...kids: Node[]): void {
  for (const k of kids) parent.appendChild(k);
}

const manifest = manifestJson as unknown as Manifest & {
  tiles: Record<string, { sprite: string; frame: string; animated?: boolean; offset?: number[] }>;
};

/** What the viewer reads of a region manifest (written by tools/bake-world). */
interface RegionManifest {
  region: string;
  chunks: { w: number; h: number };
  files: { file: string; cx: number; cy: number }[];
  interiors?: { id: string; dir: string; chunks: { file: string; cx: number; cy: number }[] }[];
  landmarks?: { id: string; x: number; y: number }[];
  wakePoints?: { id: string; x: number; y: number }[];
  waystones?: { id: string; x: number; y: number }[];
  zones?: { id: string; roster: string; polygon: { x: number; y: number }[] }[];
}

const TILES = manifest.tiles as unknown as ConstructorParameters<typeof ChunkRenderer>[2];

const REGIONS = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../baked/world/*/manifest.json', {
      eager: true,
      import: 'default',
    }) as Record<string, RegionManifest>,
  ).map(([path, m]) => [path.split('/').slice(-2)[0] as string, m]),
);

/** A colour and a one letter glyph for each temperament, so a zone reads at a glance. */
export const TEMPERAMENT_MARK: Readonly<Record<Temperament, { color: string; glyph: string }>> = {
  hostile: { color: '#e05a4a', glyph: 'H' },
  territorial: { color: '#e0a040', glyph: 'T' },
  defensive: { color: '#4a90e0', glyph: 'D' },
  skittish: { color: '#b070e0', glyph: 'S' },
  passive: { color: '#60c070', glyph: 'P' },
  curious: { color: '#40c8c8', glyph: 'C' },
};
const SEVERITY: Temperament[] = [
  'hostile',
  'territorial',
  'defensive',
  'curious',
  'skittish',
  'passive',
];

/** The temperaments in a roster, most dangerous first, or none if the roster is unknown. */
export function rosterTemperaments(roster: string): Temperament[] {
  const out = new Set<Temperament>();
  for (const c of ROSTERS[roster]?.creatures ?? []) {
    const t = CREATURES[c]?.temperament;
    if (t) out.add(t);
  }
  return SEVERITY.filter((t) => out.has(t));
}

async function fetchChunks(region: string, files: { file: string }[], dir = ''): Promise<Chunk[]> {
  return Promise.all(
    files.map(async (f) => {
      const res = await fetch(`/world/${region}/${dir}${f.file}`);
      return decodeChunk(new Uint8Array(await res.arrayBuffer()));
    }),
  );
}

/** `/dev/map`: pan and zoom the baked world, toggle layers and overlays, edit stamps. */
export async function startMapPage(): Promise<void> {
  const main = mountDevPage('World map');
  main.id = 'pow-dev-map';
  const atlas: Atlas = await loadAtlas(manifest, { core: coreUrl, ui: uiUrl });

  // ---- Toolbar -------------------------------------------------------------------------------
  const bar = el('div', 'dev-bar');
  const regionSel = el('select');
  regionSel.dataset.key = 'region';
  for (const id of Object.keys(REGIONS).sort()) regionSel.appendChild(new Option(id, id));
  const spaceSel = el('select');
  spaceSel.dataset.key = 'space';
  add(bar, regionSel, spaceSel);
  const toggles: Record<string, HTMLInputElement> = {};
  const toggle = (id: string, label: string, on: boolean): void => {
    const l = el('label', 'dev-check');
    const i = el('input');
    i.type = 'checkbox';
    i.checked = on;
    i.dataset.key = `show-${id}`;
    toggles[id] = i;
    add(l, i, document.createTextNode(label));
    bar.appendChild(l);
  };
  toggle('ground', 'Ground', true);
  toggle('objects', 'Objects', true);
  toggle('overhead', 'Overhead', true);
  toggle('collision', 'Collision', false);
  toggle('zones', 'Zones', true);
  toggle('pois', 'Landmarks', true);
  toggle('wake', 'Wake points', true);
  toggle('waystones', 'Waystones', true);
  main.appendChild(bar);

  const canvas = el('canvas', 'dev-map-canvas');
  canvas.id = 'pow-dev-map-canvas';
  canvas.width = 900;
  canvas.height = 600;
  main.appendChild(canvas);
  const info = el('p', 'dev-info', 'Click a tile.');
  info.dataset.key = 'info';
  const tele = el('a', 'dev-link', 'Teleport the player here');
  tele.dataset.key = 'teleport';
  tele.hidden = true;
  add(main, info, tele);
  const legend = el('p', 'dev-info');
  legend.textContent = `Zones show their roster's temperaments: ${SEVERITY.map((t) => `${TEMPERAMENT_MARK[t].glyph} ${t}`).join(', ')}.`;
  main.appendChild(legend);

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const dr = new DevRenderer(ctx, atlas);
  let world = new TileWorld();
  let chunkRenderer = new ChunkRenderer(atlas, world, TILES);
  let region = Object.keys(REGIONS).sort()[0] as string;
  let space = '';
  let view = { x: 0, y: 0, zoom: 1 };
  let dirty = true;
  let selected: { tx: number; ty: number } | null = null;

  async function load(): Promise<void> {
    const m = REGIONS[region] as RegionManifest;
    const inter = space ? m.interiors?.find((i) => i.id === space) : undefined;
    const chunks = inter
      ? await fetchChunks(region, inter.chunks, `${inter.dir}/`)
      : await fetchChunks(region, m.files);
    world = new TileWorld(chunks);
    chunkRenderer = new ChunkRenderer(atlas, world, TILES);
    const b = world.bounds();
    if (b) {
      const wpx = (b.x1 - b.x0) * TILE_PX;
      const hpx = (b.y1 - b.y0) * TILE_PX;
      const zoom = Math.max(0.125, Math.min(4, Math.min(canvas.width / wpx, canvas.height / hpx)));
      view = { x: b.x0 * TILE_PX + wpx / 2, y: b.y0 * TILE_PX + hpx / 2, zoom };
    }
    selected = null;
    tele.hidden = true;
    dirty = true;
  }

  function fillSpaces(): void {
    const m = REGIONS[region] as RegionManifest;
    spaceSel.replaceChildren(new Option('World', ''));
    for (const i of m.interiors ?? []) spaceSel.appendChild(new Option(i.id, i.id));
    space = '';
  }
  regionSel.addEventListener('change', () => {
    region = regionSel.value;
    fillSpaces();
    void load();
  });
  spaceSel.addEventListener('change', () => {
    space = spaceSel.value;
    void load();
  });
  for (const i of Object.values(toggles)) i.addEventListener('change', () => (dirty = true));

  // ---- Drawing -------------------------------------------------------------------------------
  const tileToScreen = (tx: number, ty: number): [number, number] => [
    (tx * TILE_PX - (view.x - canvas.width / view.zoom / 2)) * view.zoom,
    (ty * TILE_PX - (view.y - canvas.height / view.zoom / 2)) * view.zoom,
  ];

  function overlays(): void {
    const m = REGIONS[region] as RegionManifest;
    const z = view.zoom;
    const t = TILE_PX * z;
    const camX = view.x - canvas.width / z / 2;
    const camY = view.y - canvas.height / z / 2;
    if (toggles.collision?.checked) {
      const tx0 = Math.max(0, Math.floor(camX / TILE_PX));
      const ty0 = Math.max(0, Math.floor(camY / TILE_PX));
      const tx1 = Math.ceil((camX + canvas.width / z) / TILE_PX);
      const ty1 = Math.ceil((camY + canvas.height / z) / TILE_PX);
      for (let ty = ty0; ty < ty1; ty++)
        for (let tx = tx0; tx < tx1; tx++) {
          const s = world.solidAt(tx, ty);
          if (s === Solid.None) continue;
          ctx.fillStyle = s === Solid.Water ? 'rgba(60,120,255,0.4)' : 'rgba(255,60,60,0.4)';
          const [sx, sy] = tileToScreen(tx, ty);
          ctx.fillRect(sx, sy, t, t);
        }
    }
    if (!space && toggles.zones?.checked) {
      for (const zone of m.zones ?? []) {
        const temps = rosterTemperaments(zone.roster);
        const color = temps[0] ? TEMPERAMENT_MARK[temps[0]].color : '#cccccc';
        ctx.beginPath();
        zone.polygon.forEach((p, i) => {
          const [sx, sy] = tileToScreen(p.x, p.y);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
        const cx = zone.polygon.reduce((n, p) => n + p.x, 0) / zone.polygon.length;
        const cy = zone.polygon.reduce((n, p) => n + p.y, 0) / zone.polygon.length;
        const [sx, sy] = tileToScreen(cx, cy);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px system-ui';
        ctx.fillText(
          `${zone.id} ${temps.map((x) => TEMPERAMENT_MARK[x].glyph).join('')}`,
          sx - 20,
          sy,
        );
      }
    }
    const marks: [
      string,
      boolean | undefined,
      { id: string; x: number; y: number }[],
      string,
      string,
    ][] = [
      ['pois', toggles.pois?.checked, m.landmarks ?? [], '#ffd96a', '◆'],
      ['wake', toggles.wake?.checked, m.wakePoints ?? [], '#7be08a', '●'],
      ['waystones', toggles.waystones?.checked, m.waystones ?? [], '#c79bff', '▲'],
    ];
    if (!space)
      for (const [, on, list, color, glyph] of marks) {
        if (!on) continue;
        for (const p of list) {
          const [sx, sy] = tileToScreen(p.x + 0.5, p.y + 0.5);
          ctx.fillStyle = color;
          ctx.font = '18px system-ui';
          ctx.fillText(glyph, sx - 7, sy + 6);
          ctx.font = '11px system-ui';
          ctx.fillText(p.id, sx + 8, sy + 4);
        }
      }
    if (selected) {
      const [sx, sy] = tileToScreen(selected.tx, selected.ty);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, t, t);
    }
  }

  function frame(): void {
    if (dirty) {
      dirty = false;
      chunkRenderer.show = {
        ground: toggles.ground?.checked ?? true,
        objects: toggles.objects?.checked ?? true,
        overhead: toggles.overhead?.checked ?? true,
      };
      const camX = view.x - canvas.width / view.zoom / 2;
      const camY = view.y - canvas.height / view.zoom / 2;
      dr.begin(camX, camY, view.zoom);
      chunkRenderer.drawVisible(
        dr.asRenderer(),
        camX,
        camY,
        canvas.width / view.zoom,
        canvas.height / view.zoom,
        0,
        null,
        16,
      );
      overlays();
    }
    requestAnimationFrame(frame);
  }

  // ---- Pan, zoom, pick -----------------------------------------------------------------------
  const pointers = new Map<number, { x: number; y: number }>();
  let moved = 0;
  let pinch = 0;
  const local = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    moved = 0;
    pinch = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = local(e);
    pointers.set(e.pointerId, cur);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch > 0) view.zoom = Math.max(0.0625, Math.min(16, (view.zoom * d) / pinch));
      pinch = d;
      moved += 10;
    } else {
      view.x -= (cur.x - prev.x) / view.zoom;
      view.y -= (cur.y - prev.y) / view.zoom;
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
    }
    dirty = true;
  });
  canvas.addEventListener('pointerup', (e) => {
    const p = local(e);
    pointers.delete(e.pointerId);
    if (moved < 4 && pointers.size === 0) pick(p.x, p.y);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      view.zoom = Math.max(0.0625, Math.min(16, view.zoom * (e.deltaY < 0 ? 1.25 : 0.8)));
      dirty = true;
    },
    { passive: false },
  );

  function pick(sx: number, sy: number): void {
    const wx = view.x - canvas.width / view.zoom / 2 + sx / view.zoom;
    const wy = view.y - canvas.height / view.zoom / 2 + sy / view.zoom;
    const tx = Math.floor(wx / TILE_PX);
    const ty = Math.floor(wy / TILE_PX);
    const c = world.chunk(Math.floor(tx / CHUNK_TILES), Math.floor(ty / CHUNK_TILES));
    selected = { tx, ty };
    dirty = true;
    if (!c) {
      info.textContent = `Tile ${tx}, ${ty}: outside the loaded world.`;
      tele.hidden = true;
      return;
    }
    const i = tileIndex(tx - c.cx * CHUNK_TILES, ty - c.cy * CHUNK_TILES);
    const objs = c.objects
      .filter((o) => c.cx * CHUNK_TILES + o.x === tx && c.cy * CHUNK_TILES + o.y === ty)
      .map((o) => o.kind);
    info.textContent = `Tile ${tx}, ${ty}: ground ${c.ground[i]}, detail ${c.detail[i]}, object ${c.object[i]}, overhead ${c.overhead[i]}, collision ${c.collision[i]}, elevation ${c.elevation[i]}${objs.length ? `, placed: ${objs.join(', ')}` : ''}`;
    // The game takes `?at=` and `?region=` in dev builds: it starts the avatar on that tile.
    tele.hidden = !!space;
    tele.href = `/?region=${region}&at=${tx},${ty}&nosave=1&foes=0`;
  }

  fillSpaces();
  regionSel.value = region;
  await load();
  requestAnimationFrame(frame);

  // ---- Stamp editor --------------------------------------------------------------------------
  main.appendChild(el('h2', undefined, 'Stamp editor'));
  const sbar = el('div', 'dev-bar');
  const stampSel = el('select');
  stampSel.dataset.key = 'stamp';
  for (const id of Object.keys(STAMPS).sort()) stampSel.appendChild(new Option(id, id));
  const layerSel = el('select');
  layerSel.dataset.key = 'stamp-layer';
  for (const l of LAYER_NAMES) layerSel.appendChild(new Option(l, l));
  const undoBtn = el('button', undefined, 'Undo');
  undoBtn.dataset.key = 'undo';
  const resetBtn = el('button', undefined, 'Reset');
  resetBtn.dataset.key = 'reset';
  const exportBtn = el('button', undefined, 'Export layers');
  exportBtn.dataset.key = 'export';
  add(sbar, stampSel, layerSel, undoBtn, resetBtn, exportBtn);
  main.appendChild(sbar);
  const palette = el('div', 'dev-bar');
  palette.dataset.key = 'palette';
  main.appendChild(palette);
  const scanvas = el('canvas', 'dev-map-canvas');
  scanvas.id = 'pow-dev-stamp-canvas';
  main.appendChild(scanvas);
  const exported = el('textarea');
  exported.dataset.key = 'export-text';
  exported.rows = 14;
  exported.readOnly = true;
  exported.placeholder = 'Export puts the layers block here, to paste into the stamp file in a PR.';
  main.appendChild(exported);

  const sctx = scanvas.getContext('2d') as CanvasRenderingContext2D;
  const sdr = new DevRenderer(sctx, atlas);
  let original = STAMPS[stampSel.value] as StampV2;
  let current = original;
  let undo: StampV2[] = [];
  let brush = ' ';
  const SZ = 4;

  function redraw(): void {
    const { w, h } = stampSize(current);
    scanvas.width = Math.max(1, w) * TILE_PX * SZ;
    scanvas.height = Math.max(1, h) * TILE_PX * SZ;
    const sw = new TileWorld(stampToChunks(resolveForEditor(current), collisionOfCell));
    const cr = new ChunkRenderer(atlas, sw, TILES);
    sdr.begin(0, 0, SZ);
    cr.drawVisible(sdr.asRenderer(), 0, 0, w * TILE_PX, h * TILE_PX, 0, null, 16);
    sctx.strokeStyle = 'rgba(255,255,255,0.18)';
    for (let x = 0; x <= w; x++) {
      sctx.beginPath();
      sctx.moveTo(x * TILE_PX * SZ, 0);
      sctx.lineTo(x * TILE_PX * SZ, h * TILE_PX * SZ);
      sctx.stroke();
    }
    for (let y = 0; y <= h; y++) {
      sctx.beginPath();
      sctx.moveTo(0, y * TILE_PX * SZ);
      sctx.lineTo(w * TILE_PX * SZ, y * TILE_PX * SZ);
      sctx.stroke();
    }
    for (const o of current.objects ?? []) {
      sctx.fillStyle = '#ffd96a';
      sctx.font = '11px system-ui';
      sctx.fillText(o.kind, o.x * TILE_PX * SZ + 2, (o.y + 1) * TILE_PX * SZ - 4);
    }
  }
  function fillPalette(): void {
    const layer = layerSel.value as LayerName;
    palette.replaceChildren();
    for (const ch of [' ', ...paintChars(current, layer)]) {
      const b = el('button', 'stamp-char', ch === ' ' ? 'clear' : ch);
      b.dataset.char = ch;
      b.addEventListener('click', () => {
        brush = ch;
        for (const x of palette.children) x.classList.toggle('on', x === b);
      });
      palette.appendChild(b);
    }
    brush = ' ';
    palette.children[0]?.classList.add('on');
  }
  stampSel.addEventListener('change', () => {
    original = STAMPS[stampSel.value] as StampV2;
    current = original;
    undo = [];
    fillPalette();
    redraw();
  });
  layerSel.addEventListener('change', fillPalette);
  undoBtn.addEventListener('click', () => {
    const prev = undo.pop();
    if (prev) {
      current = prev;
      redraw();
    }
  });
  resetBtn.addEventListener('click', () => {
    current = original;
    undo = [];
    redraw();
  });
  exportBtn.addEventListener('click', () => {
    exported.value = exportLayers(current);
  });
  scanvas.addEventListener('pointerdown', (e) => {
    const r = scanvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) * scanvas.width) / r.width / (TILE_PX * SZ));
    const y = Math.floor(((e.clientY - r.top) * scanvas.height) / r.height / (TILE_PX * SZ));
    try {
      const next = paintCell(current, layerSel.value as LayerName, x, y, brush);
      undo.push(current);
      current = next;
      redraw();
    } catch {
      // Outside the stamp, or a character the layer cannot take: nothing to paint.
    }
  });
  fillPalette();
  redraw();
}
