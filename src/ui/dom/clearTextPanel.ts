/** Options for a clear text panel. */
export interface ClearTextPanelOptions {
  title?: string;
  /** One entry per paragraph. */
  paragraphs: readonly string[];
  /** Extra class, for example for placement. */
  className?: string;
}

let nextId = 1;

/**
 * A panel of clear text (sentences, dialogue, descriptions) framed in pixel art. Text is set with
 * `textContent` only, so nothing in a string can become markup. Sizing is in `rem` times the
 * player's text scale, so it follows both the OS font size and the in-game setting, and the
 * content wraps and scrolls instead of truncating.
 */
export class ClearTextPanel {
  readonly el: HTMLElement;
  private heading: HTMLElement | null = null;
  private body: HTMLElement;

  constructor(root: HTMLElement, opts: ClearTextPanelOptions) {
    const id = `pow-panel-${nextId++}`;
    this.el = document.createElement('section');
    this.el.className = `pow-panel pow-clear ${opts.className ?? ''}`.trim();
    this.el.setAttribute('role', 'dialog');
    if (opts.title) {
      this.heading = document.createElement('h2');
      this.heading.id = `${id}-title`;
      this.heading.textContent = opts.title;
      this.el.setAttribute('aria-labelledby', this.heading.id);
      this.el.appendChild(this.heading);
    }
    this.body = document.createElement('div');
    this.body.className = 'pow-clear-body';
    this.el.appendChild(this.body);
    this.setParagraphs(opts.paragraphs);
    root.appendChild(this.el);
  }

  /** Replaces the text. */
  setParagraphs(paragraphs: readonly string[]): void {
    this.body.textContent = '';
    for (const text of paragraphs) {
      const p = document.createElement('p');
      p.textContent = text;
      this.body.appendChild(p);
    }
  }

  destroy(): void {
    this.el.remove();
  }
}

/** A DOM button in the same visual language as the canvas button. */
export function createDomButton(
  root: HTMLElement,
  label: string,
  onPress: () => void,
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pow-button';
  b.textContent = label;
  b.addEventListener('click', onPress);
  root.appendChild(b);
  return b;
}
