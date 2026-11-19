import { el, put } from './dom';

/** A tab-level action in a header. At most two (design/09). */
export type HeaderAction =
  | { kind: 'button'; label: string; key: string; onClick: () => void }
  | {
      kind: 'select';
      label: string;
      key: string;
      value: string;
      options: readonly { value: string; label: string }[];
      onChange: (value: string) => void;
    };

/** Tab title at the left, up to two actions at the right. */
export function header(title: string, actions: readonly HeaderAction[] = []): HTMLElement {
  const h = el('header', 'pow-part-header');
  put(h, el('h3', 'pow-part-title', title));
  const side = el('div', 'pow-part-actions');
  for (const a of actions.slice(0, 2)) {
    if (a.kind === 'button') {
      const b = el('button', 'pow-button pow-part-action', a.label);
      b.type = 'button';
      b.dataset.key = a.key;
      b.addEventListener('click', a.onClick);
      side.appendChild(b);
    } else {
      const wrap = el('label', 'pow-part-select');
      put(wrap, el('span', 'pow-part-select-label', a.label));
      const sel = el('select', 'pow-select');
      sel.dataset.key = a.key;
      for (const o of a.options) {
        const opt = el('option', undefined, o.label);
        opt.value = o.value;
        sel.appendChild(opt);
      }
      sel.value = a.value;
      sel.addEventListener('change', () => a.onChange(sel.value));
      wrap.appendChild(sel);
      side.appendChild(wrap);
    }
  }
  if (side.childElementCount > 0) h.appendChild(side);
  return h;
}
