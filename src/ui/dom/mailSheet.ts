import { MAIL_STRINGS as M } from '../../content/strings/mail';
import { ITEMS } from '../../content/items';
import { ITEM_STRINGS } from '../../content/strings/items';
import { letterText } from '../../sim/chat/letters';
import type { Command } from '../../sim/kernel/commands';
import { hasAttachment, type Letter } from '../../sim/mail';
import type { SimState } from '../../sim/state';
import { identitiesOf } from '../../sim/travelers/generate';
import { detailSheet, el, put } from './parts';

/**
 * The mailbox sheet (POW-M5-12): the letters, newest first, in the sender's voice, with a button
 * to take what a letter carries. Opening it marks the letters read. Text is set with
 * `textContent` only. Built on the shared Menu parts.
 */
export class MailSheet {
  private wrap: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: {
      read: () => { state: SimState; who: number };
      send: (c: Command) => void;
      onOpenChange: (open: boolean) => void;
    },
  ) {}

  get isOpen(): boolean {
    return this.wrap !== null;
  }

  open(): void {
    this.close();
    const { state } = this.opts.read();
    for (const l of state.mail.letters)
      if (!l.read) this.opts.send({ type: 'mail', op: 'read', id: l.id });
    this.build();
    this.opts.onOpenChange(true);
  }

  /** Redraws the open sheet, after a claim. */
  refresh(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.build();
  }

  private attached(l: Letter): string {
    const parts: string[] = [];
    if (l.item !== '' && l.qty > 0) {
      const def = ITEMS[l.item];
      const name = (def ? ITEM_STRINGS[def.nameKey] : undefined) ?? l.item;
      parts.push(l.qty > 1 ? `${l.qty} ${name}` : name);
    }
    if (l.coin > 0) parts.push(M.coin.replace('{n}', String(l.coin)));
    return parts.join(', ');
  }

  private build(): void {
    const { state } = this.opts.read();
    const ids = identitiesOf(state.seed);
    const letters = [...state.mail.letters].reverse();
    const list = el('ul', 'pow-mail-list');
    for (const l of letters) {
      const li = el('li', 'pow-mail-letter');
      put(
        li,
        el('p', 'pow-mail-from', M.from.replace('{name}', ids[l.slot]?.handle ?? '')),
        el('p', 'pow-mail-text', letterText(state, l)),
      );
      if (hasAttachment(l)) {
        put(li, el('p', 'pow-mail-attached', M.attached.replace('{what}', this.attached(l))));
        if (l.claimed) put(li, el('p', 'pow-part-sheet-desc', M.claimed));
        else {
          const b = el('button', 'pow-button pow-mail-claim', M.claim);
          b.type = 'button';
          b.addEventListener('click', () => {
            this.opts.send({ type: 'mail', op: 'claim', id: l.id });
            // The sim handles the command on the next tick: redraw shortly after.
            window.setTimeout(() => this.refresh(), 150);
          });
          put(li, b);
        }
      }
      list.appendChild(li);
    }
    const sheet = detailSheet({
      title: M.title,
      extra: [letters.length === 0 ? el('p', 'pow-empty', M.empty) : list],
      onClose: () => this.close(),
    });
    const wrap = el('div', 'pow-mail');
    put(wrap, sheet.el);
    this.root.appendChild(wrap);
    this.wrap = wrap;
    sheet.title.focus();
  }

  close(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.opts.onOpenChange(false);
  }
}
