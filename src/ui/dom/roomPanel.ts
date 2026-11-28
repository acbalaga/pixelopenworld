import { FURNITURE_STRINGS as S } from '../../content/strings/furniture';
import { PIECE_BY_ID } from '../../content/furniture/pieces';
import type { Command } from '../../sim/kernel/commands';
import { placedIn, INTERIOR_BY_ID } from '../../sim/home';
import type { SimState } from '../../sim/state';
import { homeView } from '../menu/homeModel';
import { el, put } from './parts';

/**
 * The room panel at the top of the Bag tab while the avatar is inside one of their rooms
 * (POW-M6-07): the pieces standing there, each with Turn, Store and four arrows to move it, and the
 * furniture in the bag, each with Place. Placing puts a piece on the first free spot and the arrows
 * walk it from there, so nothing needs a precise tap. Set with `textContent` only.
 */
export class RoomPanel {
  readonly root = el('div', 'pow-room');

  constructor(
    private readonly deps: {
      read: () => { state: SimState; who: number };
      send: (c: Command) => void;
      drawIcon: (c: HTMLCanvasElement, id: string) => void;
    },
  ) {}

  /** Redraws. Returns false (and leaves the panel empty) when the avatar is not in a room. */
  render(): boolean {
    const { state, who } = this.deps.read();
    const v = homeView(state, who);
    this.root.textContent = '';
    if (!v) return false;
    const room = INTERIOR_BY_ID[v.room];
    const list = placedIn(state, v.room);
    const icon = (id: string): HTMLElement => {
      const c = el('canvas', 'pow-icon');
      c.width = 12;
      c.height = 12;
      c.setAttribute('aria-hidden', 'true');
      if (id) this.deps.drawIcon(c, id);
      return c;
    };
    const button = (label: string, aria: string, on: () => void): HTMLElement => {
      const b = el('button', 'pow-button', label);
      b.type = 'button';
      b.setAttribute('aria-label', aria);
      b.addEventListener('click', on);
      return b;
    };
    put(this.root, el('h3', 'pow-section-title', v.title));
    put(this.root, el('h4', 'pow-room-sub', S.placed));
    if (v.placed.length === 0) put(this.root, el('p', 'pow-empty', S.nothingPlaced));
    const ul = el('ul', 'pow-room-list');
    for (const r of v.placed) {
      const o = list[r.i];
      const p = o ? PIECE_BY_ID[o.piece] : undefined;
      if (!o || !p) continue;
      const send = (c: Partial<Extract<Command, { type: 'home' }>>): void =>
        this.deps.send({ type: 'home', room: v.room, i: r.i, op: 'move', ...c });
      const mv = (dx: number, dy: number, label: string): HTMLElement =>
        button(label.slice(0, 1), `${label}: ${r.name}`, () =>
          send({ op: 'move', x: o.x + dx, y: o.y + dy, rot: o.rot }),
        );
      const li = el('li', 'pow-room-row');
      put(
        li,
        icon(r.icon),
        el('span', 'pow-room-name', r.name),
        el('span', 'pow-room-where', r.where),
        mv(-1, 0, S.left),
        // A wall piece slides along the wall only.
        ...(r.wall ? [] : [mv(0, -1, S.up), mv(0, 1, S.down)]),
        mv(1, 0, S.right),
        ...(r.wall ? [] : [button(S.turn, `${S.turn}: ${r.name}`, () => send({ op: 'rotate' }))]),
        button(S.store, `${S.store}: ${r.name}`, () => send({ op: 'store' })),
      );
      ul.appendChild(li);
    }
    put(this.root, ul);
    put(this.root, el('h4', 'pow-room-sub', S.inBag));
    if (v.bag.length === 0) put(this.root, el('p', 'pow-empty', S.nothingInBag));
    const bag = el('ul', 'pow-room-list');
    for (const b of v.bag) {
      const li = el('li', 'pow-room-row');
      const place = button(S.place, `${S.place}: ${b.name}`, () => {
        if (b.spot)
          this.deps.send({
            type: 'home',
            op: 'place',
            room: v.room,
            slot: b.slot,
            x: b.spot.x,
            y: b.spot.y,
            rot: 0,
          });
      });
      if (!b.spot) {
        place.setAttribute('disabled', '');
        place.title = S.noSpace;
      }
      put(
        li,
        icon(b.icon),
        el('span', 'pow-room-name', b.name),
        el('span', 'pow-room-where', `x${b.qty}`),
        place,
      );
      bag.appendChild(li);
    }
    put(this.root, bag);
    void room;
    return true;
  }
}
