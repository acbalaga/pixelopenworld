import { el, put } from './dom';

/**
 * A list row: icon, name, one line of state at the right. The whole row is the touch target, at
 * least 48 px tall, and tapping it opens the detail sheet. The same text is the tooltip a long
 * press shows. Text wraps, so nothing is cut off at a large text scale.
 */
export function row(o: {
  key: string;
  name: string;
  state?: string;
  sub?: string;
  icon?: HTMLElement | null;
  /** 0 to 100: a thin progress bar under the text. Described in `label`, hidden from readers. */
  progress?: number;
  /** What a screen reader says for the row. Defaults to the name and state. */
  label?: string;
  badge?: boolean;
  onOpen: () => void;
}): HTMLButtonElement {
  const b = el('button', 'pow-part-row');
  b.type = 'button';
  b.dataset.key = o.key;
  const text = o.state ? `${o.name}, ${o.state}` : o.name;
  b.setAttribute('aria-label', o.label ?? text);
  b.title = o.label ?? text;
  const main = el('span', 'pow-part-row-main');
  put(main, el('span', 'pow-part-row-name', o.name));
  if (o.sub) put(main, el('span', 'pow-part-row-sub', o.sub));
  put(b, o.icon ?? null, main, o.state ? el('span', 'pow-part-row-state', o.state) : null);
  if (o.badge) {
    const dot = el('span', 'pow-part-dot');
    dot.setAttribute('aria-hidden', 'true');
    b.appendChild(dot);
  }
  if (o.progress !== undefined) {
    const bar = el('span', 'pow-part-row-bar');
    bar.setAttribute('aria-hidden', 'true');
    const f = el('span', 'pow-part-row-fill');
    f.style.setProperty('--fill', `${Math.max(0, Math.min(100, o.progress))}%`);
    bar.appendChild(f);
    b.appendChild(bar);
  }
  b.addEventListener('click', o.onOpen);
  return b;
}
