import { el, put } from './dom';

/** A cell for the bag and storage: icon, quantity corner, quality pip, broken mark. 48 px minimum. */
export function gridCell(o: {
  key: string;
  label: string;
  icon: HTMLElement;
  qty?: number;
  glyph?: string;
  broken?: boolean;
  pressed?: boolean;
  onOpen: () => void;
}): HTMLButtonElement {
  const b = el('button', 'pow-part-cell');
  b.type = 'button';
  b.dataset.key = o.key;
  b.setAttribute('aria-label', o.label);
  b.title = o.label;
  b.setAttribute('aria-haspopup', 'dialog');
  if (o.pressed !== undefined) b.setAttribute('aria-pressed', String(o.pressed));
  put(
    b,
    o.icon,
    o.qty !== undefined && o.qty > 1 ? el('span', 'pow-qty', String(o.qty)) : null,
    o.glyph ? el('span', 'pow-qual', o.glyph) : null,
  );
  if (o.broken) b.classList.add('pow-broken');
  b.addEventListener('click', o.onOpen);
  return b;
}
