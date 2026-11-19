import { normalizeDoll, type DollSpec } from '../../content/dolls/parts';
import { UI_STRINGS as S } from '../../content/strings/ui';
import { createLookEditor, type Facing } from './lookEditor';

export interface MirrorDeps {
  /** The look now. */
  current: () => DollSpec;
  /** Paints the preview, dressed in what the avatar wears. */
  drawPreview: (canvas: HTMLCanvasElement, look: DollSpec, dir: Facing) => void;
  rand: () => number;
  /** The look is chosen: the game redresses the avatar and saves it. */
  apply: (look: DollSpec) => void;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The inn mirror (M4-19): the setup editor again, minus the origin. Changing the look is free in
 * M4 (a barber and a tailor charge for it from M6). Cancel keeps what you had.
 */
export class MirrorPanel {
  private panel: HTMLElement | null = null;
  private returnFocus: HTMLElement | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly deps: MirrorDeps,
  ) {}

  get isOpen(): boolean {
    return this.panel !== null;
  }

  open(): void {
    if (this.panel) return;
    this.returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const look: DollSpec = { ...this.deps.current() };
    const panel = document.createElement('section');
    panel.className = 'pow-panel pow-mirror';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'pow-mirror-h');
    const h = document.createElement('h2');
    h.id = 'pow-mirror-h';
    h.textContent = S.mirror.title;
    const note = document.createElement('p');
    note.className = 'pow-hint';
    note.textContent = S.mirror.free;
    const editor = createLookEditor(look, this.deps);
    const random = document.createElement('button');
    random.type = 'button';
    random.className = 'pow-button';
    random.textContent = S.setup.randomize;
    random.addEventListener('click', () => editor.randomize());
    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'pow-button pow-big';
    done.textContent = S.mirror.done;
    done.dataset.key = 'mirror-done';
    done.addEventListener('click', () => {
      this.deps.apply(normalizeDoll({ ...look, ownColors: [look.topColor, look.bottomColor] }));
      this.close();
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'pow-button';
    cancel.textContent = S.mirror.cancel;
    cancel.addEventListener('click', () => this.close());
    const actions = document.createElement('div');
    actions.className = 'pow-setup-actions';
    for (const b of [random, cancel, done]) actions.appendChild(b);
    for (const k of [h, note, editor.el, actions]) panel.appendChild(k);
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    });
    this.host.appendChild(panel);
    this.panel = panel;
    done.focus();
    this.deps.onOpenChange?.(true);
  }

  close(): void {
    if (!this.panel) return;
    this.panel.remove();
    this.panel = null;
    this.returnFocus?.focus();
    this.deps.onOpenChange?.(false);
  }
}
