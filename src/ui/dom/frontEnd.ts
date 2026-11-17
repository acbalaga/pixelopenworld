import {
  BODY_TYPES,
  CLOTH_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  randomDoll,
  type DollSpec,
} from '../../content/dolls/parts';
import { PALETTE } from '../../content/sprites/palette';
import { fill } from '../../content/strings/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';
import { checkHandle, HANDLE_MAX } from '../../shared/handle';
import { BUILD_ID } from '../../shared/version';

/** What the front end needs from the game around it. */
export interface FrontEndDeps {
  root: HTMLElement;
  /** A saved character on this device, or null. */
  save: { handle: string; playSeconds: number } | null;
  /** Paints the character preview (24 x 32) into a canvas. */
  drawPreview: (canvas: HTMLCanvasElement, look: DollSpec) => void;
  rand: () => number;
  /** How long the "connecting" beat lasts, ms. */
  connectMs?: number;
}

export type FrontEndResult = { mode: 'continue' } | { mode: 'new'; handle: string; look: DollSpec };

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

/** Adds children in order. (`Element.append` is typed for the Worker's HTMLRewriter here.) */
function put<T extends HTMLElement>(parent: T, ...kids: HTMLElement[]): T {
  for (const k of kids) parent.appendChild(k);
  return parent;
}

const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function minutes(sec: number): string {
  const m = Math.max(1, Math.round(sec / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/**
 * The title screen, then either the connecting beat (a saved character) or the character setup
 * (a new one). Resolves when the player is ready to enter the world. All DOM, clear text, built
 * with `textContent` only. The first tap here is also the gesture that unlocks audio.
 */
export function runFrontEnd(deps: FrontEndDeps): Promise<FrontEndResult> {
  return new Promise((resolve) => {
    const screen = el('main', 'pow-front');
    deps.root.appendChild(screen);
    const done = (r: FrontEndResult): void => {
      screen.remove();
      resolve(r);
    };

    const title = (): void => {
      screen.textContent = '';
      const logo = el('h1', 'pow-logo');
      put(logo, el('span', 'pow-logo-a', 'Pixel'), el('span', 'pow-logo-b', 'Open World'));
      const status = el(
        'p',
        'pow-front-status',
        deps.save
          ? fill(S.title.saveFound, {
              name: deps.save.handle,
              time: minutes(deps.save.playSeconds),
            })
          : S.title.noSave,
      );
      status.setAttribute('role', 'status');
      const go = el('button', 'pow-button pow-big', S.title.logIn);
      go.type = 'button';
      go.addEventListener('click', () => (deps.save ? connect() : setup()));
      const ver = el('p', 'pow-front-version', fill(S.title.version, { id: BUILD_ID }));
      put(screen, logo, status, go, ver);
      go.focus();
    };

    /** A short "connecting" beat for a saved character. Any tap or key skips it. */
    const connect = (): void => {
      screen.textContent = '';
      const line = el('p', 'pow-connect', S.title.connecting);
      line.setAttribute('role', 'status');
      const dots = el('span', 'pow-dots', '...');
      line.appendChild(dots);
      const skip = el('button', 'pow-button', S.title.skipHint);
      skip.type = 'button';
      put(screen, line, skip);
      skip.focus();
      let finished = false;
      const finish = (): void => {
        if (finished) return;
        finished = true;
        window.removeEventListener('keydown', finish);
        done({ mode: 'continue' });
      };
      skip.addEventListener('click', finish);
      window.addEventListener('keydown', finish);
      window.setTimeout(finish, deps.connectMs ?? 700);
    };

    const setup = (): void => {
      screen.textContent = '';
      const look: DollSpec = { ...randomDoll(deps.rand), mainHand: 'sword', offHand: 'none' };
      const form = el('form', 'pow-setup');
      form.noValidate = true;
      form.setAttribute('aria-labelledby', 'pow-setup-h');
      const h = el('h2', undefined, S.setup.heading);
      h.id = 'pow-setup-h';

      const preview = el('canvas', 'pow-preview');
      preview.width = 24;
      preview.height = 32;
      preview.setAttribute('role', 'img');
      preview.setAttribute('aria-label', S.setup.preview);
      const redraw = (): void => deps.drawPreview(preview, look);

      // Handle.
      const hl = el('label', 'pow-field-label', S.setup.handle);
      const input = el('input', 'pow-input');
      input.type = 'text';
      input.maxLength = HANDLE_MAX + 4;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.id = 'pow-handle';
      input.setAttribute('autocapitalize', 'off');
      hl.htmlFor = input.id;
      const hint = el('p', 'pow-hint', S.setup.handleHint);
      hint.id = 'pow-handle-hint';
      const err = el('p', 'pow-error');
      err.id = 'pow-handle-err';
      err.setAttribute('role', 'alert');
      input.setAttribute('aria-describedby', 'pow-handle-hint pow-handle-err');

      const enter = el('button', 'pow-button pow-big', S.setup.enter);
      enter.type = 'submit';
      const validate = (show: boolean): boolean => {
        const p = checkHandle(input.value);
        err.textContent = show && p !== 'ok' ? S.setup.handleErrors[p] : '';
        input.setAttribute('aria-invalid', String(show && p !== 'ok'));
        return p === 'ok';
      };
      input.addEventListener('input', () => validate(input.value.length > 0));

      // Choices: one group of buttons per field.
      const groups: (() => void)[] = [];
      const group = <K extends keyof DollSpec>(
        label: string,
        key: K,
        values: readonly DollSpec[K][],
        text: (v: DollSpec[K]) => string,
        swatch?: (v: DollSpec[K]) => string,
      ): HTMLElement => {
        const box = el('fieldset', 'pow-choices');
        const legend = el('legend', 'pow-field-label', label);
        box.appendChild(legend);
        const row = el('div', 'pow-choice-row');
        const buttons = values.map((v) => {
          const b = el('button', swatch ? 'pow-swatch' : 'pow-pill');
          b.type = 'button';
          b.setAttribute('aria-label', text(v));
          b.title = text(v);
          if (swatch) b.style.setProperty('--sw', swatch(v));
          else b.textContent = text(v);
          b.addEventListener('click', () => {
            look[key] = v;
            sync();
            redraw();
          });
          row.appendChild(b);
          return { b, v };
        });
        const sync = (): void => {
          for (const { b, v } of buttons) b.setAttribute('aria-pressed', String(look[key] === v));
        };
        groups.push(sync);
        sync();
        box.appendChild(row);
        return box;
      };
      const rampColor = (r: readonly number[]): string => PALETTE[r[2] as number] as string;
      const body = group(S.setup.body, 'body', BODY_TYPES, (v) => (v === 'a' ? 'Broad' : 'Slim'));
      const skin = group(
        S.setup.skin,
        'skin',
        Object.keys(SKIN_TONES) as (keyof typeof SKIN_TONES)[],
        titleCase,
        (v) => rampColor(SKIN_TONES[v]),
      );
      const hair = group(S.setup.hair, 'hair', HAIR_STYLES, titleCase);
      const hairColor = group(
        S.setup.hairColor,
        'hairColor',
        Object.keys(HAIR_COLORS) as (keyof typeof HAIR_COLORS)[],
        titleCase,
        (v) => rampColor(HAIR_COLORS[v]),
      );
      const outfit = group(
        S.setup.outfit,
        'topColor',
        Object.keys(CLOTH_COLORS) as (keyof typeof CLOTH_COLORS)[],
        titleCase,
        (v) => rampColor(CLOTH_COLORS[v]),
      );

      const random = el('button', 'pow-button', S.setup.randomize);
      random.type = 'button';
      random.addEventListener('click', () => {
        Object.assign(look, randomDoll(deps.rand), { mainHand: 'sword', offHand: 'none' });
        // The outfit color drives the trousers too, so the outfit reads as one.
        look.bottomColor = look.topColor;
        for (const g of groups) g();
        redraw();
      });
      // Choosing an outfit color dresses the whole outfit in it.
      outfit.addEventListener('click', () => {
        look.bottomColor = look.topColor;
        redraw();
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validate(true)) {
          input.focus();
          return;
        }
        done({ mode: 'new', handle: input.value.trim(), look: { ...look } });
      });

      put(
        form,
        h,
        put(
          el('div', 'pow-setup-top'),
          preview,
          put(el('div', 'pow-setup-name'), hl, input, hint, err),
        ),
        body,
        skin,
        hair,
        hairColor,
        outfit,
        put(el('div', 'pow-setup-actions'), random, enter),
      );
      screen.appendChild(form);
      redraw();
      input.focus();
    };

    title();
  });
}
