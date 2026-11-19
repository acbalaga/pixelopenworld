import type { Trust } from '../../save/integrity/reasons';
import { startImport, type ImportDeps } from './backup';
import { createSeal } from './seal';
import { confirmRetire } from './retire';
import {
  applyUpdate,
  checkForUpdate,
  onUpdateChange,
  updateReady,
  updateSupported,
} from '../../platform/pwa';
import { normalizeDoll, randomDoll, type DollSpec } from '../../content/dolls/parts';
import { createLookEditor, type Facing } from './lookEditor';
import { fill } from '../../content/strings/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';
import { checkHandle, HANDLE_MAX } from '../../shared/handle';
import { BUILD_ID } from '../../shared/version';
import { PortalScene } from './portalScene';

/** What the front end needs from the game around it. */
export interface FrontEndDeps {
  root: HTMLElement;
  /** A saved character on this device, or null. */
  save: { handle: string; playSeconds: number; look: DollSpec; trust: Trust } | null;
  /** Paints the character preview (24 x 32) into a canvas. */
  drawPreview: (canvas: HTMLCanvasElement, look: DollSpec, dir?: Facing) => void;
  rand: () => number;
  /** Restoring a save file from the title. `onImported` is set here; the game applies the import. */
  importer: Omit<ImportDeps, 'onImported'>;
  /** Exports the saved character as a sealed file, for the delete confirm. */
  exportSaved: () => Promise<{ bytes: Uint8Array; fileName: string }>;
  /** Removes the saved character from this device (kept as a recovery snapshot). */
  retire: () => Promise<void>;
  /** True when this launch runs a newer build than the last one seen. Shows a small note. */
  updated?: boolean;
  /** How long the "connecting" beat lasts, ms. */
  connectMs?: number;
}

export type FrontEndResult =
  | { mode: 'continue' }
  | { mode: 'new'; handle: string; look: DollSpec; seed: number; origin: string };

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

    // The saved character shown on the title. Deleting it turns the title into a new-character one.
    let save = deps.save;
    let offUpdate: (() => void) | null = null;
    let scene: PortalScene | null = null;
    const finish = (r: FrontEndResult): void => {
      offUpdate?.();
      scene?.destroy();
      done(r);
    };

    /**
     * The title: a portal into the game's world, with the game's name on a small signpost beside
     * it. Whoever is signed in on this device stands in front of the gate. Tap them to step
     * through. With nobody yet, a silhouette stands there for a new character.
     */
    const title = (): void => {
      screen.textContent = '';
      offUpdate?.();
      scene?.destroy();
      scene = new PortalScene();
      const stage = el('div', 'pow-portal-stage');
      stage.appendChild(scene.canvas);

      const sign = el('div', 'pow-sign');
      const board = el('div', 'pow-sign-board');
      put(
        board,
        el('h1', 'pow-sign-title', 'Pixel Open World'),
        el('span', 'pow-sign-arrow', '\u2192'),
      );
      put(sign, board, el('div', 'pow-sign-post'));
      sign.querySelector('.pow-sign-arrow')?.setAttribute('aria-hidden', 'true');

      const chars = el('div', 'pow-portal-chars');
      const go = el('button', 'pow-portal-char');
      go.type = 'button';
      const portrait = el('canvas', 'pow-portal-doll');
      portrait.width = 24;
      portrait.height = 32;
      portrait.setAttribute('aria-hidden', 'true');
      const label = el('span', 'pow-portal-name');
      if (save) {
        deps.drawPreview(portrait, save.look);
        label.textContent = save.handle;
        go.setAttribute('aria-label', fill(S.title.logInAs, { name: save.handle }));
      } else {
        deps.drawPreview(portrait, { ...randomDoll(deps.rand), mainHand: 'none', offHand: 'none' });
        portrait.classList.add('pow-silhouette');
        label.textContent = S.title.newCharacter;
        go.setAttribute('aria-label', S.title.logIn);
      }
      put(go, portrait, label);
      go.addEventListener('click', () => (save ? stepThrough(go) : setup()));
      chars.appendChild(go);
      put(stage, sign, chars);

      const status = el(
        'p',
        'pow-front-status',
        save
          ? fill(S.title.saveFound, {
              name: save.handle,
              time: minutes(save.playSeconds),
            })
          : S.title.noSave,
      );
      status.setAttribute('role', 'status');
      const ver = el('p', 'pow-front-version', fill(S.title.version, { id: BUILD_ID }));
      put(screen, stage, status);
      if (save) put(screen, createSeal(save.trust));
      const imp = el('button', 'pow-button pow-front-import', S.backup.import);
      imp.type = 'button';
      imp.addEventListener('click', () =>
        startImport(
          deps.root,
          { ...deps.importer, onImported: () => finish({ mode: 'continue' }) },
          (text) => {
            if (text) status.textContent = text;
          },
        ),
      );
      put(screen, imp);
      if (save) {
        const del = el('button', 'pow-button pow-front-delete', S.title.deleteCharacter);
        del.type = 'button';
        del.addEventListener('click', () => {
          const who = save;
          if (!who) return;
          void confirmRetire(deps.root, {
            handle: who.handle,
            playSeconds: who.playSeconds,
            exportCurrent: deps.exportSaved,
          }).then(async (yes) => {
            if (!yes) return;
            try {
              await deps.retire();
              save = null;
              title();
            } catch {
              status.textContent = S.retire.failed;
            }
          });
        });
        put(screen, del);
      }
      put(screen, updateBlock(), ver);
      if (deps.updated) {
        const note = el('p', 'pow-front-version', fill(S.title.updated, { id: BUILD_ID }));
        note.setAttribute('role', 'status');
        put(screen, note);
      }
      go.focus();
    };

    /**
     * Whether a newer build is waiting, and the way to take it before logging in. A save loads into
     * whatever build is running, so updating here is what makes new content show up for it. Nothing
     * is running at the title, so there is nothing to save first.
     */
    const updateBlock = (): HTMLElement => {
      const box = el('div', 'pow-front-update');
      const msg = el('p', 'pow-front-version');
      msg.setAttribute('role', 'status');
      const check = el('button', 'pow-button', S.title.updateCheck);
      check.type = 'button';
      const apply = el('button', 'pow-button', S.title.updateNow);
      apply.type = 'button';
      let asked = false;
      const show = (): void => {
        const ready = updateReady();
        apply.hidden = !ready;
        check.hidden = ready || !updateSupported();
        if (ready) msg.textContent = S.title.updateReady;
        else if (!msg.dataset.busy) msg.textContent = updateSupported() ? S.title.updateNone : '';
        // The first time the worker is known, look for a newer build without being asked.
        if (updateSupported() && !asked) {
          asked = true;
          msg.dataset.busy = '1';
          msg.textContent = S.title.updateChecking;
          void checkForUpdate().then(() => {
            delete msg.dataset.busy;
            show();
          });
        }
      };
      check.addEventListener('click', () => {
        msg.dataset.busy = '1';
        msg.textContent = S.title.updateChecking;
        check.disabled = true;
        void checkForUpdate().then(() => {
          delete msg.dataset.busy;
          check.disabled = false;
          show();
        });
      });
      apply.addEventListener('click', () => {
        apply.disabled = true;
        msg.textContent = S.title.updateRestarting;
        applyUpdate();
      });
      show();
      offUpdate = onUpdateChange(show);
      put(box, msg, check, apply);
      return box;
    };

    /**
     * The character walks into the gate. It is the "connecting" beat, about 0.9 seconds, and any
     * tap or key skips it.
     */
    const stepThrough = (go: HTMLButtonElement): void => {
      go.disabled = true;
      go.classList.add('pow-walking');
      scene?.enter();
      const status = screen.querySelector('.pow-front-status');
      if (status) status.textContent = S.title.connecting;
      let finished = false;
      const end = (): void => {
        if (finished) return;
        finished = true;
        window.removeEventListener('keydown', end);
        screen.removeEventListener('click', end);
        finish({ mode: 'continue' });
      };
      // Registered after this click has finished bubbling, so it does not skip itself.
      window.setTimeout(() => {
        if (finished) return;
        window.addEventListener('keydown', end);
        screen.addEventListener('click', end);
      }, 0);
      window.setTimeout(end, deps.connectMs ?? 900);
    };

    const setup = (): void => {
      screen.textContent = '';
      const look: DollSpec = {
        ...randomDoll(deps.rand),
        mainHand: 'sword',
        offHand: 'none',
      };
      look.bottomColor = look.topColor;
      const form = el('form', 'pow-setup');
      form.noValidate = true;
      form.setAttribute('aria-labelledby', 'pow-setup-h');
      const h = el('h2', undefined, S.setup.heading);
      h.id = 'pow-setup-h';

      // The look editor owns the preview, the groups of choices, the dice and the origin.
      const editor = createLookEditor(look, deps, { origin: true });

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

      const random = el('button', 'pow-button', S.setup.randomize);
      random.type = 'button';
      random.addEventListener('click', () => {
        Object.assign(look, randomDoll(deps.rand), { mainHand: 'sword', offHand: 'none' });
        editor.randomize();
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!validate(true)) {
          input.focus();
          return;
        }
        // The creation seed is drawn here, in the platform layer, never in the sim.
        const seed = crypto.getRandomValues(new Uint32Array(1))[0] as number;
        // The two clothing colors chosen here are the character's own colors (M4-19).
        const final: DollSpec = { ...look, ownColors: [look.topColor, look.bottomColor] };
        finish({
          mode: 'new',
          handle: input.value.trim(),
          look: normalizeDoll(final),
          seed,
          origin: editor.origin(),
        });
      });

      put(
        form,
        h,
        put(el('div', 'pow-setup-name'), hl, input, hint, err),
        editor.el,
        put(el('div', 'pow-setup-actions'), random, enter),
      );
      screen.appendChild(form);
      input.focus();
    };

    title();
  });
}
