import { PIT_STRINGS as P, PIT_HONOR_NAMES } from '../../content/strings/pit';
import type { Command } from '../../sim/kernel/commands';
import { waitingAtPit } from '../../sim/pitBouts';
import type { SimState } from '../../sim/state';
import { identitiesOf } from '../../sim/travelers/generate';
import { detailSheet, el, put } from './parts';

/**
 * The Pit's "Next" board (POW-M5-30): who is waiting for a duel, with a Challenge button each, the
 * bout in the ring if one is on, and the player's Pit wins and honor. A challenge is M5-12's: the
 * Traveler takes it by temper and regard. Text is set with `textContent` only.
 */
export class PitSheet {
  private wrap: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: {
      read: () => { state: SimState };
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
    const ids = identitiesOf(state.seed);
    const extra: HTMLElement[] = [];
    const bout = state.pitBouts?.bout;
    if (bout)
      extra.push(
        el(
          'p',
          'pow-part-sheet-desc',
          P.bout
            .replace('{a}', ids[bout.a]?.handle ?? '')
            .replace('{b}', ids[bout.b]?.handle ?? ''),
        ),
      );
    extra.push(el('h4', 'pow-party-head', P.waiting));
    const waiting = waitingAtPit(state);
    if (waiting.length === 0) extra.push(el('p', 'pow-empty', P.none));
    else {
      const ul = el('ul', 'pow-party-list');
      for (const slot of waiting) {
        const li = el('li', 'pow-party-row');
        const b = el('button', 'pow-button pow-party-btn', P.challenge);
        b.type = 'button';
        b.addEventListener('click', () => {
          this.opts.send({ type: 'duel', slot });
          this.close();
        });
        put(li, el('span', 'pow-party-name', ids[slot]?.handle ?? ''), b);
        ul.appendChild(li);
      }
      extra.push(ul, el('p', 'pow-part-sheet-desc', P.note));
    }
    const d = state.mail.duels;
    extra.push(el('p', 'pow-part-sheet-desc', P.wins.replace('{n}', String(d.pit))));
    if (d.honor > 0)
      extra.push(
        el('p', 'pow-part-sheet-desc', P.honor.replace('{honor}', PIT_HONOR_NAMES[d.honor] ?? '')),
      );
    const sheet = detailSheet({ title: P.title, extra, onClose: () => this.close() });
    const wrap = el('div', 'pow-pit');
    put(wrap, sheet.el);
    this.root.appendChild(wrap);
    this.wrap = wrap;
    sheet.title.focus();
    this.opts.onOpenChange(true);
  }

  close(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.opts.onOpenChange(false);
  }
}
