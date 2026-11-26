import { MARKET } from '../../content/balance/market';
import { ITEMS } from '../../content/items';
import { ITEM_STRINGS } from '../../content/strings/items';
import { MARKET_STRINGS as M } from '../../content/strings/market';
import type { Command } from '../../sim/kernel/commands';
import { cutFor, feeFor, netFor, priceOf, TRADEABLE, travelerOffers } from '../../sim/market';
import type { SimState } from '../../sim/state';
import { identitiesOf } from '../../sim/travelers/generate';
import { detailSheet, el, put } from './parts';

const nameOf = (id: string): string => {
  const def = ITEMS[id];
  return (def ? ITEM_STRINGS[def.nameKey] : undefined) ?? id;
};
const fill = (t: string, v: Record<string, string | number>): string =>
  t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));

type Tab = 'browse' | 'sell' | 'mine';

/**
 * The market terminal sheet (POW-M5-10): browse items with their price now, a 14 day sparkline and
 * Traveler listings by handle to buy from; sell from the bag with a price inside the bounds, the fee
 * and the cut shown before listing; and the player's own listings to take down. Text is set with
 * `textContent`. The sparkline is drawn on a small canvas.
 */
export class MarketSheet {
  private wrap: HTMLElement | null = null;
  private tab: Tab = 'browse';
  private item: string | null = null;
  private sellSlot = -1;
  private sellPrice = 0;

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
    this.tab = 'browse';
    this.item = null;
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
    window.setTimeout(() => this.refresh(), 150);
  }

  private button(label: string, on: () => void, cls = 'pow-market-btn'): HTMLButtonElement {
    const b = el('button', `pow-button ${cls}`, label);
    b.type = 'button';
    b.addEventListener('click', on);
    return b;
  }

  private spark(values: readonly number[], floor: number, ceil: number): HTMLElement {
    const c = el('canvas', 'pow-market-spark');
    c.width = 168;
    c.height = 36;
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', fill(M.history, { n: values.length }));
    const ctx = c.getContext('2d');
    if (ctx && values.length > 0) {
      const span = Math.max(1, ceil - floor);
      const x = (i: number): number =>
        values.length === 1 ? 84 : 4 + (i * 160) / (values.length - 1);
      const y = (v: number): number => 32 - ((v - floor) / span) * 28;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(4, 32);
      ctx.lineTo(164, 32);
      ctx.stroke();
      ctx.strokeStyle = '#e9c46a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      values.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
      ctx.stroke();
      ctx.fillStyle = '#e9c46a';
      ctx.fillRect(x(values.length - 1) - 2, y(values[values.length - 1]!) - 2, 4, 4);
    }
    return c;
  }

  private tabs(): HTMLElement {
    const row = el('div', 'pow-market-tabs');
    for (const t of ['browse', 'sell', 'mine'] as const) {
      const b = this.button(
        M.tabs[t],
        () => {
          this.tab = t;
          this.item = null;
          this.sellSlot = -1;
          this.refresh();
        },
        'pow-market-tab',
      );
      b.setAttribute('aria-pressed', String(this.tab === t));
      row.appendChild(b);
    }
    return row;
  }

  private browse(state: SimState): HTMLElement[] {
    const out: HTMLElement[] = [];
    if (this.item) {
      const item = this.item;
      const b = TRADEABLE.get(item)!;
      const ids = identitiesOf(state.seed);
      out.push(this.button(M.back, () => ((this.item = null), this.refresh())));
      out.push(el('h4', 'pow-market-head', nameOf(item)));
      out.push(el('p', 'pow-part-sheet-desc', fill(M.now, { price: priceOf(state, item) })));
      out.push(this.spark(state.market.history[item] ?? [], b.floor, b.ceil));
      out.push(
        el(
          'p',
          'pow-market-meta',
          `${fill(M.history, { n: (state.market.history[item] ?? []).length })}. ${fill(M.range, { floor: b.floor, ceil: b.ceil })}`,
        ),
      );
      out.push(el('h4', 'pow-market-head', M.sellers));
      const offers = travelerOffers(state, item);
      if (offers.length === 0) out.push(el('p', 'pow-empty', M.noSellers));
      const ul = el('ul', 'pow-market-list');
      for (const o of offers) {
        const li = el('li', 'pow-market-row');
        const text = el('div', 'pow-market-text');
        put(
          text,
          el('span', 'pow-market-name', ids[o.slot]?.handle ?? ''),
          el('span', 'pow-market-meta', fill(M.each, { qty: o.qty, price: o.price })),
        );
        put(
          li,
          text,
          this.button(M.buy, () =>
            this.act({ type: 'market', op: 'buy', item, seller: o.slot, qty: 1 }),
          ),
        );
        ul.appendChild(li);
      }
      out.push(ul);
      return out;
    }
    const ul = el('ul', 'pow-market-list');
    for (const item of TRADEABLE.keys()) {
      const li = el('li', 'pow-market-row');
      const b = el('button', 'pow-market-pick');
      b.type = 'button';
      put(
        b,
        el('span', 'pow-market-name', nameOf(item)),
        el('span', 'pow-market-meta', fill(M.now, { price: priceOf(state, item) })),
      );
      b.addEventListener('click', () => {
        this.item = item;
        this.refresh();
      });
      li.appendChild(b);
      ul.appendChild(li);
    }
    out.push(ul);
    return out;
  }

  private sell(state: SimState, who: number): HTMLElement[] {
    const inv = state.entities.comps.inventory[who];
    const out: HTMLElement[] = [];
    if (!inv) return out;
    const st = this.sellSlot >= 0 ? inv.slots[this.sellSlot] : null;
    if (st && TRADEABLE.has(st.item)) {
      const b = TRADEABLE.get(st.item)!;
      if (this.sellPrice < b.floor || this.sellPrice > b.ceil)
        this.sellPrice = priceOf(state, st.item);
      const p = this.sellPrice;
      out.push(this.button(M.back, () => ((this.sellSlot = -1), this.refresh())));
      out.push(el('h4', 'pow-market-head', `${nameOf(st.item)} x${st.qty}`));
      out.push(el('p', 'pow-part-sheet-desc', fill(M.now, { price: priceOf(state, st.item) })));
      out.push(this.spark(state.market.history[st.item] ?? [], b.floor, b.ceil));
      const row = el('div', 'pow-market-price');
      put(
        row,
        this.button(M.lower, () => ((this.sellPrice = Math.max(b.floor, p - 1)), this.refresh())),
        el('span', 'pow-market-name', fill(M.price, { price: p })),
        this.button(M.higher, () => ((this.sellPrice = Math.min(b.ceil, p + 1)), this.refresh())),
      );
      out.push(row);
      out.push(
        el('p', 'pow-market-meta', fill(M.fee, { fee: feeFor(p, st.qty), cut: cutFor(p, st.qty) })),
      );
      out.push(
        el('p', 'pow-market-meta', fill(M.net, { net: netFor(p, st.qty) + feeFor(p, st.qty) })),
      );
      out.push(
        this.button(fill(M.list, { qty: st.qty, price: p }), () => {
          this.act({ type: 'market', op: 'list', slot: this.sellSlot, qty: st.qty, price: p });
          this.sellSlot = -1;
        }),
      );
      return out;
    }
    const ul = el('ul', 'pow-market-list');
    inv.slots.forEach((x, i) => {
      if (!x || !TRADEABLE.has(x.item) || x.q || x.mark || x.affixes?.length) return;
      const li = el('li', 'pow-market-row');
      const b = el('button', 'pow-market-pick');
      b.type = 'button';
      put(
        b,
        el('span', 'pow-market-name', `${nameOf(x.item)} x${x.qty}`),
        el('span', 'pow-market-meta', fill(M.now, { price: priceOf(state, x.item) })),
      );
      b.addEventListener('click', () => {
        this.sellSlot = i;
        this.sellPrice = priceOf(state, x.item);
        this.refresh();
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
    out.push(ul.childElementCount > 0 ? ul : el('p', 'pow-empty', M.sellNone));
    return out;
  }

  private mine(state: SimState): HTMLElement[] {
    const ls = state.market.listings;
    if (ls.length === 0) return [el('p', 'pow-empty', M.noListings)];
    const ul = el('ul', 'pow-market-list');
    for (const l of ls) {
      const li = el('li', 'pow-market-row');
      put(
        li,
        el(
          'span',
          'pow-market-text',
          fill(M.listing, { qty: l.qty, item: nameOf(l.item), price: l.price }),
        ),
        this.button(M.cancel, () => this.act({ type: 'market', op: 'cancel', id: l.id })),
      );
      ul.appendChild(li);
    }
    return [ul, el('p', 'pow-market-meta', `${ls.length} / ${MARKET.maxListings}`)];
  }

  private build(): void {
    const { state, who } = this.opts.read();
    const body =
      this.tab === 'browse'
        ? this.browse(state)
        : this.tab === 'sell'
          ? this.sell(state, who)
          : this.mine(state);
    const sheet = detailSheet({
      title: M.title,
      extra: [this.tabs(), ...body],
      onClose: () => this.close(),
    });
    const wrap = el('div', 'pow-market');
    put(wrap, sheet.el);
    this.root.appendChild(wrap);
    this.wrap = wrap;
  }

  close(): void {
    if (!this.wrap) return;
    this.wrap.remove();
    this.wrap = null;
    this.opts.onOpenChange(false);
  }
}
