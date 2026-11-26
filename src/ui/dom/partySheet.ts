import { DUNGEON_NAMES } from '../../content/chat/names';
import { CREATURES } from '../../content/creatures';
import { SKILLS, TRIALS } from '../../content/skills';
import { PARTY_STRINGS as P } from '../../content/strings/party';
import { PARTY } from '../../content/balance/party';
import type { Command } from '../../sim/kernel/commands';
import { PARTY_ACTIVITIES, travelerListings, type PartyActivity } from '../../sim/party';
import type { SimState } from '../../sim/state';
import { identitiesOf } from '../../sim/travelers/generate';
import { detailSheet, el, put } from './parts';

/** The name of a party activity on the board and in the frames. */
export function activityName(id: string): string {
  const d = DUNGEON_NAMES[id];
  if (d) return d.replace(/^the /, 'The ');
  const c = CREATURES[id];
  if (c) return P.hunt.replace('{creature}', c.name);
  const t = TRIALS[id];
  if (t) return P.trial.replace('{skill}', SKILLS[t.skill]?.name ?? '');
  return id;
}

/**
 * The party finder sheet (POW-M5-07): open groups from Travelers who want one, with a Join button,
 * and the player's own listing by activity. Text is set with `textContent` only. Built on the
 * shared Menu parts, like the mailbox.
 */
export class PartySheet {
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
    this.build();
    this.opts.onOpenChange(true);
  }

  refresh(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.build();
  }

  private act(c: Command): void {
    this.opts.send(c);
    // The sim takes the command on the next tick: redraw shortly after.
    window.setTimeout(() => this.refresh(), 150);
  }

  private build(): void {
    const { state } = this.opts.read();
    const ids = identitiesOf(state.seed);
    const party = state.party;
    const room = PARTY.max - (party?.members.length ?? 0);
    const extra: HTMLElement[] = [];

    // The player's party, if any.
    if (party && party.members.length > 0) {
      extra.push(el('h4', 'pow-party-head', P.yours));
      const ul = el('ul', 'pow-party-list');
      for (const m of party.members) {
        const li = el('li', 'pow-party-row');
        put(
          li,
          el('span', 'pow-party-name', ids[m.slot]?.handle ?? ''),
          el('span', 'pow-party-meta', P.roles[m.role]),
        );
        ul.appendChild(li);
      }
      const leave = el('button', 'pow-button pow-party-btn', P.leave);
      leave.type = 'button';
      leave.addEventListener('click', () => this.act({ type: 'party', op: 'leave' }));
      extra.push(ul, leave);
    }

    // Groups looking.
    extra.push(el('h4', 'pow-party-head', P.groups));
    const listings = travelerListings(state);
    if (listings.length === 0) extra.push(el('p', 'pow-empty', P.none));
    else {
      const ul = el('ul', 'pow-party-list');
      for (const l of listings) {
        const li = el('li', 'pow-party-row');
        const who = l.slots.map((s) => ids[s]?.handle ?? '').join(', ');
        const text = el('div', 'pow-party-text');
        put(
          text,
          el('span', 'pow-party-name', who),
          el('span', 'pow-party-meta', activityName(l.activity)),
        );
        const b = el(
          'button',
          'pow-button pow-party-btn',
          room >= l.slots.length ? P.join : P.full,
        );
        b.type = 'button';
        b.disabled = room < l.slots.length;
        b.addEventListener('click', () => this.act({ type: 'party', op: 'join', slot: l.leader }));
        put(li, text, b);
        ul.appendChild(li);
      }
      extra.push(ul);
    }

    // The player's own listing.
    extra.push(el('h4', 'pow-party-head', P.post));
    if (party?.listing) {
      extra.push(
        el(
          'p',
          'pow-party-posting',
          P.posting.replace('{activity}', activityName(party.listing.activity)),
        ),
      );
      const c = el('button', 'pow-button pow-party-btn', P.cancel);
      c.type = 'button';
      c.addEventListener('click', () => this.act({ type: 'party', op: 'cancel' }));
      extra.push(c);
    } else if (room > 0) {
      const kinds: PartyActivity['kind'][] = ['dungeon', 'area', 'trial'];
      for (const k of kinds) {
        const list = PARTY_ACTIVITIES.filter((a) => a.kind === k);
        if (list.length === 0) continue;
        extra.push(el('p', 'pow-party-kind', P.kinds[k]));
        const row = el('div', 'pow-party-acts');
        for (const a of list) {
          const b = el('button', 'pow-button pow-party-act', activityName(a.id));
          b.type = 'button';
          b.addEventListener('click', () =>
            this.act({ type: 'party', op: 'post', activity: a.id }),
          );
          row.appendChild(b);
        }
        extra.push(row);
      }
    }

    const sheet = detailSheet({ title: P.title, extra, onClose: () => this.close() });
    const wrap = el('div', 'pow-party');
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
