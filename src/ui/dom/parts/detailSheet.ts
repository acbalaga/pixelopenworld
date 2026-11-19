import { UI_STRINGS as S } from '../../../content/strings/ui';
import { el, nextId, put } from './dom';
import { holdToConfirm } from './hold';

/** One of the (at most three) buttons at the bottom of a sheet. The primary one is last. */
export interface SheetAction {
  label: string;
  key: string;
  primary?: boolean;
  /** A tap does this. */
  onClick?: () => void;
  /** Or a held press does this (destructive actions). */
  onHold?: () => void;
}

export interface DetailSheet {
  /** The dialog element. Put it inside the Menu's sheet. */
  el: HTMLElement;
  /** The heading, which takes focus when the sheet opens. */
  title: HTMLElement;
}

/**
 * The detail sheet: slides up over the tab at 60% height with a large icon, a name, a description
 * in clear text, numbers as a two-column list, and at most three actions at the bottom. It is a
 * labelled dialog. Closing (the button, a swipe down on the grip, Escape, or Back) is the Menu's
 * business: it calls `onClose` and returns focus to the row that opened the sheet.
 */
export function detailSheet(o: {
  title: string;
  icon?: HTMLElement | null;
  desc?: string;
  /** Each is one cell of a two-column list. */
  lines?: readonly string[];
  /** Anything else the sheet shows between the numbers and the actions. */
  extra?: readonly (HTMLElement | null)[];
  actions?: readonly SheetAction[];
  onClose: () => void;
}): DetailSheet {
  const id = nextId('pow-sheet');
  const root = el('section', 'pow-part-sheet');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', `${id}-title`);
  root.dataset.sheet = '1';

  const grip = el('div', 'pow-part-grip');
  grip.setAttribute('aria-hidden', 'true');
  const head = el('div', 'pow-part-sheet-head');
  const title = el('h3', 'pow-part-sheet-title', o.title);
  title.id = `${id}-title`;
  title.tabIndex = -1;
  const close = el('button', 'pow-button pow-part-sheet-close', 'x');
  close.type = 'button';
  close.setAttribute('aria-label', S.parts.closeSheet);
  close.addEventListener('click', o.onClose);
  put(head, o.icon ?? null, title, close);

  const body = el('div', 'pow-part-sheet-body');
  if (o.desc) put(body, el('p', 'pow-part-sheet-desc', o.desc));
  if (o.lines && o.lines.length > 0) {
    const ul = el('ul', 'pow-part-lines');
    for (const l of o.lines) put(ul, el('li', 'pow-part-line', l));
    body.appendChild(ul);
  }
  put(body, ...(o.extra ?? []));

  const bar = el('div', 'pow-part-sheet-actions');
  for (const a of (o.actions ?? []).slice(0, 3)) {
    const b = el(
      'button',
      a.primary ? 'pow-button pow-action is-primary' : 'pow-button pow-action',
    );
    b.type = 'button';
    b.textContent = a.label;
    b.dataset.key = a.key;
    if (a.onHold) bar.appendChild(holdToConfirm(b, a.onHold));
    else if (a.onClick) b.addEventListener('click', a.onClick);
    bar.appendChild(b);
  }
  put(root, grip, head, body, bar.childElementCount > 0 ? bar : null);
  return { el: root, title };
}
