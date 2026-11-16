import manifestJson from '../../baked/manifest.json';
import coreUrl from '../../baked/atlas-core.png?url';
import uiUrl from '../../baked/atlas-ui.png?url';
import { randomDoll } from '../content/dolls/parts';
import { loadAtlas, type Atlas, type Manifest } from '../render/atlas';
import { DollFactory } from '../render/dollSprite';
import { el, mountDevPage } from './page';

const manifest = manifestJson as unknown as Manifest;
const SCALES = [1, 2, 4] as const;
const BACKGROUNDS = ['light', 'dark', 'terrain'] as const;
type Background = (typeof BACKGROUNDS)[number];
const CHAR_ANIMS = (['idle', 'walk', 'attack', 'hurt', 'dodge'] as const).flatMap((a) =>
  (['down', 'up', 'left', 'right'] as const).map((d) => `${a}_${d}`),
);
const CHAR_COUNT = 6;

interface Card {
  id: string;
  frames: string[];
  anims: string[];
}

/** Draws one frame handle at an integer scale, centered in the canvas. */
function blit(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  handle: number,
  flip: boolean,
  scale: number,
): void {
  const w = atlas.width(handle);
  const h = atlas.height(handle);
  const { canvas } = ctx;
  const x = Math.floor((canvas.width - w * scale) / 2);
  const y = Math.floor((canvas.height - h * scale) / 2);
  ctx.save();
  if (flip) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    atlas.image(handle),
    atlas.srcX(handle),
    atlas.srcY(handle),
    w,
    h,
    flip ? Math.floor((canvas.width - w * scale) / 2) : x,
    y,
    w * scale,
    h * scale,
  );
  ctx.restore();
}

/** `/dev/sprites`: every sprite and animation at 1x, 2x, 4x on light, dark and terrain. */
export async function startSpritesPage(): Promise<void> {
  const main = mountDevPage('Sprites');
  main.id = 'pow-dev-sprites';
  const atlas = await loadAtlas(manifest, { core: coreUrl, ui: uiUrl });

  // Composed characters (the doll kit) are runtime sprites, so they are not in the manifest.
  const dolls = new DollFactory(atlas, manifest);
  let seed = 7;
  const rand = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cards: Card[] = Object.keys(manifest.sprites)
    .sort()
    .map((id) => {
      const s = manifest.sprites[id] as Manifest['sprites'][string];
      return { id, frames: Object.keys(s.frames).sort(), anims: Object.keys(s.anims).sort() };
    });
  for (let i = 0; i < CHAR_COUNT; i++) {
    const id = `char.dev_${i}`;
    dolls.create(id, randomDoll(rand));
    cards.unshift({ id, frames: [], anims: CHAR_ANIMS });
  }

  const grassFrame = atlas.frame('tile.grass_0', 'base');
  const bar = el('div', 'dev-bar');
  const filter = el('input');
  filter.type = 'search';
  filter.placeholder = 'Filter by id';
  filter.setAttribute('aria-label', 'Filter sprites by id');
  const count = el('span');
  bar.appendChild(filter);
  bar.appendChild(count);
  main.appendChild(bar);
  const grid = el('div', 'dev-grid');
  main.appendChild(grid);

  const painters = new Map<HTMLElement, (now: number) => void>();
  const visible = new Set<HTMLElement>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) visible.add(e.target as HTMLElement);
      else visible.delete(e.target as HTMLElement);
    }
  });

  const paintBackground = (ctx: CanvasRenderingContext2D, bg: Background): void => {
    const { canvas } = ctx;
    if (bg === 'light') {
      ctx.fillStyle = '#e8e4d8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (bg === 'dark') {
      ctx.fillStyle = '#14121f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      const tw = atlas.width(grassFrame);
      for (let y = 0; y < canvas.height; y += tw * 2) {
        for (let x = 0; x < canvas.width; x += tw * 2) {
          ctx.drawImage(
            atlas.image(grassFrame),
            atlas.srcX(grassFrame),
            atlas.srcY(grassFrame),
            tw,
            tw,
            x,
            y,
            tw * 2,
            tw * 2,
          );
        }
      }
    }
  };

  const build = (c: Card): HTMLElement => {
    const card = el('div', 'dev-card');
    card.dataset.id = c.id;
    card.appendChild(el('h3', undefined, c.id));
    const cells = el('div', 'dev-cells');
    let anim = c.anims[0] ?? '';
    let frame = c.frames[0] ?? '';
    if (c.anims.length + c.frames.length > 1) {
      const pick = el('select');
      pick.setAttribute('aria-label', `Frame or animation for ${c.id}`);
      for (const a of c.anims) pick.appendChild(new Option(`anim ${a}`, `a:${a}`));
      for (const f of c.frames) pick.appendChild(new Option(`frame ${f}`, `f:${f}`));
      pick.addEventListener('change', () => {
        const [kind, name] = [pick.value[0], pick.value.slice(2)];
        anim = kind === 'a' ? name : '';
        frame = kind === 'f' ? name : '';
      });
      card.appendChild(pick);
    }
    const dims = (): [number, number] => {
      const h = anim ? atlas.animFrame(atlas.anim(c.id, anim), 0) : atlas.frame(c.id, frame);
      return [atlas.width(h), atlas.height(h)];
    };
    const [fw, fh] = dims();
    const ctxs: [CanvasRenderingContext2D, number, Background][] = [];
    for (const scale of SCALES) {
      for (const bg of BACKGROUNDS) {
        const canvas = el('canvas');
        canvas.width = Math.max(fw, 16) * scale + 4;
        canvas.height = Math.max(fh, 16) * scale + 4;
        canvas.title = `${scale}x on ${bg}`;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        ctx.imageSmoothingEnabled = false;
        ctxs.push([ctx, scale, bg]);
        cells.appendChild(canvas);
      }
    }
    painters.set(card, (now) => {
      const handle = anim ? atlas.animFrame(atlas.anim(c.id, anim), now) : atlas.frame(c.id, frame);
      const flip = anim ? atlas.animFlip(atlas.anim(c.id, anim)) : false;
      for (const [ctx, scale, bg] of ctxs) {
        paintBackground(ctx, bg);
        blit(ctx, atlas, handle, flip, scale);
      }
    });
    card.appendChild(cells);
    io.observe(card);
    return card;
  };

  const nodes = cards.map(build);
  for (const n of nodes) grid.appendChild(n);
  const applyFilter = (): void => {
    const q = filter.value.trim().toLowerCase();
    let shown = 0;
    for (const n of nodes) {
      const match = q === '' || (n.dataset.id ?? '').toLowerCase().includes(q);
      n.hidden = !match;
      if (match) shown++;
    }
    count.textContent = `${shown} of ${nodes.length} sprites`;
  };
  filter.addEventListener('input', applyFilter);
  applyFilter();

  const frame = (now: number): void => {
    for (const n of visible) if (!n.hidden) painters.get(n)?.(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
