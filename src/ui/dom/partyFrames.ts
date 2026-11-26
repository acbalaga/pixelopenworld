import { ITEMS } from '../../content/items';
import { PARTY_STRINGS as P } from '../../content/strings/party';
import { ITEM_STRINGS } from '../../content/strings/items';
import type { SimEvent } from '../../sim/kernel/events';
import { frameOf, memberSlots } from '../../sim/party';
import type { SimState } from '../../sim/state';
import { identitiesOf } from '../../sim/travelers/generate';
import { el, put } from './parts';

/** How long a roll panel stays up, ms. */
const ROLL_MS = 5000;

/**
 * The party frames (POW-M5-07): small, top left under the player's bars, one row per member with
 * a clear-text name and a Health bar, marked when down or leaving. Under them, a small panel shows
 * each visible loot roll for a few seconds. Text is set with `textContent` only.
 */
export class PartyFrames {
  private readonly box: HTMLElement;
  private readonly rows: HTMLElement;
  private readonly roll: HTMLElement;
  private rollUntil = 0;
  private key = '';

  constructor(root: HTMLElement) {
    this.box = el('div', 'pow-party-frames');
    this.box.setAttribute('aria-live', 'polite');
    this.rows = el('div', 'pow-party-frame-rows');
    this.roll = el('div', 'pow-party-roll');
    this.roll.hidden = true;
    put(this.box, this.rows, this.roll);
    this.box.hidden = true;
    root.appendChild(this.box);
  }

  /** Redraws from the sim, once a frame. Cheap: rebuilds only when something shown changed. */
  update(state: SimState, now: number): void {
    const slots = memberSlots(state);
    const ids = identitiesOf(state.seed);
    const frames = slots.map((s) => ({ s, ...frameOf(state, s) }));
    const key = frames
      .map((f) => `${f.s}:${Math.round(f.hp * 20)}:${f.down ? 1 : 0}:${f.leaving ? 1 : 0}`)
      .join('|');
    if (key !== this.key) {
      this.key = key;
      this.rows.replaceChildren(
        ...frames.map((f) => {
          const row = el('div', 'pow-party-frame');
          if (f.down) row.classList.add('pow-party-frame-down');
          const name = el('span', 'pow-party-frame-name', ids[f.s]?.handle ?? '');
          const bar = el('span', 'pow-party-frame-bar');
          const fill = el('span', 'pow-party-frame-fill');
          fill.style.width = `${Math.round(f.hp * 100)}%`;
          bar.appendChild(fill);
          const tag = f.down ? P.down : f.leaving ? P.leaving : '';
          put(row, name, bar, tag ? el('span', 'pow-party-frame-tag', tag) : null);
          return row;
        }),
      );
    }
    if (this.rollUntil > 0 && now > this.rollUntil) {
      this.roll.hidden = true;
      this.rollUntil = 0;
    }
    this.box.hidden = slots.length === 0 && this.roll.hidden;
  }

  /** Shows a loot roll for a few seconds. */
  showRoll(state: SimState, e: Extract<SimEvent, { type: 'partyLootRoll' }>, now: number): void {
    const ids = identitiesOf(state.seed);
    const def = ITEMS[e.item];
    const item = (def ? ITEM_STRINGS[def.nameKey] : undefined) ?? e.item;
    const lines = e.rolls.map((r) =>
      el(
        'p',
        'pow-party-roll-line',
        `${ids[r.slot]?.handle ?? ''}: ${r.need ? P.roll.need.replace('{n}', String(r.roll)) : P.roll.pass}`,
      ),
    );
    this.roll.replaceChildren(
      el('p', 'pow-party-roll-title', P.roll.title.replace('{item}', item)),
      ...lines,
      el('p', 'pow-party-roll-won', P.roll.won.replace('{name}', ids[e.winner]?.handle ?? '')),
    );
    this.roll.hidden = false;
    this.rollUntil = now + ROLL_MS;
    this.box.hidden = false;
  }
}
