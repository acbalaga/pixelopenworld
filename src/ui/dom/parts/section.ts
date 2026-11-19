import { el, nextId, put } from './dom';

/**
 * A collapsible group with a title and a count ("Gathering, 3"). `open` says how it starts and
 * `onToggle` lets the caller remember the choice per player (UI settings).
 */
export function section(
  o: {
    id: string;
    title: string;
    count?: number;
    open: boolean;
    onToggle: (open: boolean) => void;
  },
  ...children: (HTMLElement | null)[]
): HTMLElement {
  const s = el('section', 'pow-part-section');
  s.dataset.section = o.id;
  const bodyId = nextId('pow-sec');
  const h = el('h4', 'pow-part-section-h');
  const btn = el('button', 'pow-part-section-btn');
  btn.type = 'button';
  btn.dataset.key = `section-${o.id}`;
  btn.setAttribute('aria-controls', bodyId);
  put(
    btn,
    el('span', 'pow-part-section-title', o.title),
    o.count !== undefined ? el('span', 'pow-part-section-count', String(o.count)) : null,
    el('span', 'pow-part-chevron'),
  );
  btn.lastElementChild?.setAttribute('aria-hidden', 'true');
  h.appendChild(btn);
  const body = el('div', 'pow-part-section-body');
  body.id = bodyId;
  put(body, ...children);
  const sync = (open: boolean): void => {
    btn.setAttribute('aria-expanded', String(open));
    s.classList.toggle('is-closed', !open);
    body.hidden = !open;
  };
  sync(o.open);
  btn.addEventListener('click', () => {
    const next = btn.getAttribute('aria-expanded') !== 'true';
    sync(next);
    o.onToggle(next);
  });
  put(s, h, body);
  return s;
}
