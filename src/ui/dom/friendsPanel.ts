import { FRIEND_STRINGS as F } from '../../content/strings/friends';
import type { Command } from '../../sim/kernel/commands';
import type { SimState } from '../../sim/state';
import { friendRows, requestRows } from '../menu/friendsModel';
import { el, put } from './parts';

/**
 * The friend list for the Social tab (POW-M5-06): who is online, where they are and what they are
 * doing, and the Travelers who have asked to be friends, with Accept and Decline. Built from the
 * shared parts and set with `textContent` only. Redraw on `render()`.
 */
export class FriendsPanel {
  readonly root = el('div', 'pow-friends');

  constructor(
    private readonly deps: {
      read: () => { state: SimState; who: number };
      send: (c: Command) => void;
      openCard: (slot: number) => void;
    },
  ) {}

  render(): void {
    const { state } = this.deps.read();
    const rows = friendRows(state);
    const asks = requestRows(state);
    this.root.textContent = '';
    put(this.root, el('h3', 'pow-section-title', F.title));
    if (asks.length > 0) {
      put(this.root, el('p', 'pow-part-sheet-desc', F.requests));
      const ul = el('ul', 'pow-friend-list');
      for (const a of asks) {
        const li = el('li', 'pow-friend-row');
        const accept = el('button', 'pow-button', F.accept);
        accept.type = 'button';
        accept.addEventListener('click', () =>
          this.deps.send({ type: 'friend', slot: a.slot, op: 'accept' }),
        );
        const decline = el('button', 'pow-button', F.decline);
        decline.type = 'button';
        decline.addEventListener('click', () =>
          this.deps.send({ type: 'friend', slot: a.slot, op: 'decline' }),
        );
        put(li, el('span', 'pow-friend-name', a.handle), accept, decline);
        ul.appendChild(li);
      }
      put(this.root, ul);
    }
    if (rows.length === 0) {
      put(this.root, el('p', 'pow-empty', F.none));
      return;
    }
    const ul = el('ul', 'pow-friend-list');
    for (const r of rows) {
      const li = el('li', r.online ? 'pow-friend-row pow-friend-on' : 'pow-friend-row');
      const open = el('button', 'pow-button', F.open);
      open.type = 'button';
      open.setAttribute('aria-label', `${F.open}: ${r.handle}`);
      open.addEventListener('click', () => this.deps.openCard(r.slot));
      const where = [r.online ? F.online : F.offline, r.doing, r.place]
        .filter((x) => x !== '')
        .join(', ');
      put(
        li,
        el('span', 'pow-friend-name', r.handle),
        el('span', 'pow-friend-where', `${r.tier}. ${where}`),
        open,
      );
      ul.appendChild(li);
    }
    put(this.root, ul);
  }
}
