import {
  ACCESSORY_IDS,
  BODY_TYPES,
  BROW_COUNT,
  CLOTH_COLORS,
  EYE_COUNT,
  FACIALS,
  HAIR_COLORS,
  HAIR_STYLES,
  HEIGHTS,
  MARK_COUNT,
  MOUTH_COUNT,
  SKIN_TONES,
  randomFace,
  type DollSpec,
} from '../../content/dolls/parts';
import { DEFAULT_ORIGIN, ORIGINS, ORIGIN_IDS } from '../../content/world/origins';
import { ORIGIN_STRINGS } from '../../content/strings/origins';
import { PALETTE } from '../../content/sprites/palette';
import { fill } from '../../content/strings/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';
import { section } from './parts';

/** The four ways the preview faces, in the order a drag or the buttons turn it. */
export const FACINGS = ['down', 'right', 'up', 'left'] as const;
export type Facing = (typeof FACINGS)[number];

export interface LookEditorDeps {
  /** Paints the preview into a 24 x 32 canvas, facing `dir`. */
  drawPreview: (canvas: HTMLCanvasElement, look: DollSpec, dir: Facing) => void;
  rand: () => number;
}

const SVG = 'http://www.w3.org/2000/svg';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function put<T extends HTMLElement>(parent: T, ...kids: (HTMLElement | null)[]): T {
  for (const k of kids) if (k) parent.appendChild(k);
  return parent;
}
const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const rampColor = (r: readonly number[]): string => PALETTE[r[2] as number] as string;

/** A small die: five pips in a square. Decorative. */
function dice(): SVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('class', 'pow-dice');
  svg.setAttribute('aria-hidden', 'true');
  const frame = document.createElementNS(SVG, 'rect');
  for (const [k, v] of Object.entries({
    x: '1',
    y: '1',
    width: '10',
    height: '10',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1',
  }))
    frame.setAttribute(k, v);
  svg.appendChild(frame);
  for (const [x, y] of [
    [3, 3],
    [8, 3],
    [5.5, 5.5],
    [3, 8],
    [8, 8],
  ] as const) {
    const p = document.createElementNS(SVG, 'rect');
    for (const [k, v] of Object.entries({
      x: String(x),
      y: String(y),
      width: '1',
      height: '1',
      fill: 'currentColor',
    }))
      p.setAttribute(k, v);
    svg.appendChild(p);
  }
  return svg as unknown as SVGElement;
}

export interface LookEditor {
  el: HTMLElement;
  /** The look being edited. Mutated in place. */
  look: DollSpec;
  /** The origin chosen, when the editor offers one. */
  origin: () => string;
  /** Redraws the preview and the pressed states from `look`. */
  sync: () => void;
  /** Re-rolls every look option, and the origin is left alone. */
  randomize: () => void;
}

/**
 * The look editor (M4-19, design/09 "Avatar setup"): groups of choices with a small die each, a
 * Randomize for all of them, a preview that turns with a drag, and optionally the origin. The
 * setup screen and the inn mirror both use it. Everything is cosmetic.
 */
export function createLookEditor(
  look: DollSpec,
  deps: LookEditorDeps,
  opts: { origin?: boolean; initialOrigin?: string } = {},
): LookEditor {
  let dir: Facing = 'down';
  let originId = opts.initialOrigin ?? DEFAULT_ORIGIN;
  const root = el('div', 'pow-look-editor');

  // The preview stands on a patch of the origin's ground, and turns when it is dragged.
  const stage = el('div', 'pow-preview-stage');
  const preview = el('canvas', 'pow-preview');
  preview.width = 24;
  preview.height = 32;
  preview.setAttribute('role', 'img');
  preview.setAttribute('aria-label', S.setup.preview);
  const turn = (by: number): void => {
    dir = FACINGS[(FACINGS.indexOf(dir) + by + FACINGS.length) % FACINGS.length] as Facing;
    redraw();
  };
  const left = el('button', 'pow-button pow-turn', '◀');
  left.type = 'button';
  left.setAttribute('aria-label', S.setup.turnLeft);
  left.addEventListener('click', () => turn(-1));
  const right = el('button', 'pow-button pow-turn', '▶');
  right.type = 'button';
  right.setAttribute('aria-label', S.setup.turnRight);
  right.addEventListener('click', () => turn(1));
  let x0: number | null = null;
  preview.addEventListener('pointerdown', (e) => {
    x0 = e.clientX;
  });
  preview.addEventListener('pointermove', (e) => {
    if (x0 === null) return;
    const d = e.clientX - x0;
    if (Math.abs(d) >= 24) {
      turn(d > 0 ? 1 : -1);
      x0 = e.clientX;
    }
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const)
    preview.addEventListener(ev, () => {
      x0 = null;
    });
  put(stage, left, preview, right);
  const paintGround = (): void => {
    const o = ORIGINS[originId] ?? ORIGINS[DEFAULT_ORIGIN];
    stage.style.setProperty('--ground', PALETTE[o?.ground ?? 10] as string);
  };
  const redraw = (): void => deps.drawPreview(preview, look, dir);

  // Groups of choices.
  const syncs: (() => void)[] = [];
  const rerolls: (() => void)[] = [];
  const group = <T extends string | number>(
    label: string,
    values: readonly T[],
    get: () => T | undefined,
    set: (v: T) => void,
    text: (v: T) => string,
    reroll: () => void,
    swatch?: (v: T) => string,
  ): HTMLElement => {
    const box = el('fieldset', 'pow-choices');
    const head = el('div', 'pow-choice-head');
    put(head, el('legend', 'pow-field-label', label));
    const die = el('button', 'pow-button pow-die');
    die.type = 'button';
    die.setAttribute('aria-label', fill(S.setup.dice, { group: label }));
    die.title = fill(S.setup.dice, { group: label });
    die.appendChild(dice() as unknown as HTMLElement);
    die.addEventListener('click', () => {
      reroll();
      sync();
    });
    head.appendChild(die);
    box.appendChild(head);
    const row = el('div', 'pow-choice-row');
    const buttons = values.map((v) => {
      const b = el('button', swatch ? 'pow-swatch' : 'pow-pill');
      b.type = 'button';
      b.setAttribute('aria-label', text(v));
      b.title = text(v);
      if (swatch) b.style.setProperty('--sw', swatch(v));
      else b.textContent = text(v);
      b.addEventListener('click', () => {
        set(v);
        sync();
      });
      row.appendChild(b);
      return { b, v };
    });
    syncs.push(() => {
      for (const { b, v } of buttons) b.setAttribute('aria-pressed', String(get() === v));
    });
    rerolls.push(reroll);
    box.appendChild(row);
    return box;
  };
  const pickOne = <T>(xs: readonly T[]): T =>
    xs[Math.min(xs.length - 1, Math.floor(deps.rand() * xs.length))] as T;
  const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
  const skins = Object.keys(SKIN_TONES) as (keyof typeof SKIN_TONES)[];
  const hairColors = Object.keys(HAIR_COLORS) as (keyof typeof HAIR_COLORS)[];
  const cloth = Object.keys(CLOTH_COLORS) as (keyof typeof CLOTH_COLORS)[];
  const num = (n: number): string => String(n + 1);

  const gBody = group(
    S.setup.body,
    BODY_TYPES,
    () => look.body,
    (v) => (look.body = v),
    (v) => (v === 'a' ? 'Broad' : 'Slim'),
    () => (look.body = pickOne(BODY_TYPES)),
  );
  const gHeight = group(
    S.setup.height,
    HEIGHTS,
    () => look.height ?? 'mid',
    (v) => (look.height = v),
    (v) => S.setup.heights[v],
    () => (look.height = pickOne(HEIGHTS)),
  );
  const gSkin = group(
    S.setup.skin,
    skins,
    () => look.skin,
    (v) => (look.skin = v),
    titleCase,
    () => (look.skin = pickOne(skins)),
    (v) => rampColor(SKIN_TONES[v]),
  );
  const gEyes = group(
    S.setup.eyes,
    range(EYE_COUNT),
    () => look.eyes ?? 0,
    (v) => (look.eyes = v),
    num,
    () => (look.eyes = pickOne(range(EYE_COUNT))),
  );
  const gBrows = group(
    S.setup.brows,
    range(BROW_COUNT),
    () => look.brows ?? 0,
    (v) => (look.brows = v),
    num,
    () => (look.brows = pickOne(range(BROW_COUNT))),
  );
  const gMouth = group(
    S.setup.mouth,
    range(MOUTH_COUNT),
    () => look.mouth ?? 0,
    (v) => (look.mouth = v),
    num,
    () => (look.mouth = pickOne(range(MOUTH_COUNT))),
  );
  const gMark = group(
    S.setup.mark,
    range(MARK_COUNT),
    () => look.mark ?? 0,
    (v) => (look.mark = v),
    (v) => S.setup.markNames[v] ?? num(v),
    () => (look.mark = pickOne(range(MARK_COUNT))),
  );
  const gMarkColor = group(
    S.setup.markColor,
    cloth,
    () => look.markColor ?? 'brown',
    (v) => (look.markColor = v),
    titleCase,
    () => (look.markColor = pickOne(cloth)),
    (v) => rampColor(CLOTH_COLORS[v]),
  );
  const gHair = group(
    S.setup.hair,
    HAIR_STYLES,
    () => look.hair,
    (v) => (look.hair = v),
    titleCase,
    () => (look.hair = pickOne(HAIR_STYLES)),
  );
  const gHairColor = group(
    S.setup.hairColor,
    hairColors,
    () => look.hairColor,
    (v) => (look.hairColor = v),
    titleCase,
    () => (look.hairColor = pickOne(hairColors)),
    (v) => rampColor(HAIR_COLORS[v]),
  );
  const tipValues = ['none', ...hairColors] as const;
  const gTips = group(
    S.setup.hairTips,
    tipValues,
    () => look.hairStyle2Color ?? 'none',
    (v) => {
      if (v === 'none') delete look.hairStyle2Color;
      else look.hairStyle2Color = v;
    },
    (v) => (v === 'none' ? S.setup.none : titleCase(v)),
    () => {
      const v = pickOne(tipValues);
      if (v === 'none') delete look.hairStyle2Color;
      else look.hairStyle2Color = v;
    },
    (v) => (v === 'none' ? 'transparent' : rampColor(HAIR_COLORS[v])),
  );
  const gFacial = group(
    S.setup.facial,
    FACIALS,
    () => look.facial ?? 'none',
    (v) => (look.facial = v),
    (v) => S.setup.facials[v],
    () => (look.facial = pickOne(FACIALS)),
  );
  const gTop = group(
    S.setup.top,
    cloth,
    () => look.topColor,
    (v) => {
      look.topColor = v;
      look.ownColors = [v, look.bottomColor];
    },
    titleCase,
    () => {
      look.topColor = pickOne(cloth);
      look.ownColors = [look.topColor, look.bottomColor];
    },
    (v) => rampColor(CLOTH_COLORS[v]),
  );
  const gTrousers = group(
    S.setup.trousers,
    cloth,
    () => look.bottomColor,
    (v) => {
      look.bottomColor = v;
      look.ownColors = [look.topColor, v];
    },
    titleCase,
    () => {
      look.bottomColor = pickOne(cloth);
      look.ownColors = [look.topColor, look.bottomColor];
    },
    (v) => rampColor(CLOTH_COLORS[v]),
  );
  const gAccessory = group(
    S.setup.accessory,
    ACCESSORY_IDS,
    () => look.accessory ?? 'none',
    (v) => (look.accessory = v),
    (v) => S.setup.accessories[v],
    () => (look.accessory = pickOne(ACCESSORY_IDS)),
  );

  const open = (): boolean => true;
  const sec = (id: string, title: string, ...kids: HTMLElement[]): HTMLElement =>
    section({ id, title, open: open(), onToggle: () => undefined }, ...kids);
  put(
    root,
    stage,
    sec('body', S.setup.groupBody, gBody, gHeight, gSkin),
    sec('face', S.setup.face, gEyes, gBrows, gMouth, gMark, gMarkColor),
    sec('hair', S.setup.groupHair, gHair, gHairColor, gTips, gFacial),
    sec('clothes', S.setup.clothes, gTop, gTrousers, gAccessory),
  );

  // The origin: flavor only, and not offered at the mirror.
  const blurb = el('p', 'pow-hint pow-origin-blurb');
  if (opts.origin) {
    const box = el('fieldset', 'pow-choices');
    put(box, el('legend', 'pow-field-label', S.setup.origin));
    const row = el('div', 'pow-choice-row');
    row.setAttribute('role', 'radiogroup');
    row.setAttribute('aria-label', S.setup.origin);
    const buttons = ORIGIN_IDS.map((id) => {
      const o = ORIGINS[id];
      const b = el('button', 'pow-pill', ORIGIN_STRINGS[o?.nameKey ?? ''] ?? id);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.addEventListener('click', () => {
        originId = id;
        sync();
      });
      row.appendChild(b);
      return { b, id };
    });
    syncs.push(() => {
      for (const { b, id } of buttons) b.setAttribute('aria-checked', String(originId === id));
      const o = ORIGINS[originId];
      blurb.textContent = ORIGIN_STRINGS[o?.blurbKey ?? ''] ?? '';
    });
    put(box, row, blurb, el('p', 'pow-hint', S.setup.originNote));
    root.appendChild(sec('origin', S.setup.origin, box));
  }

  const sync = (): void => {
    for (const s of syncs) s();
    paintGround();
    redraw();
  };
  const randomize = (): void => {
    // Every option at once. The face parts are drawn after the rest, as `randomDoll` does.
    Object.assign(look, randomFace(deps.rand));
    for (const r of rerolls) r();
    sync();
  };
  sync();
  return { el: root, look, origin: () => originId, sync, randomize };
}
