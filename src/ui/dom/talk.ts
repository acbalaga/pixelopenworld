import { DIALOGUES, NPCS, SHOPS } from '../../content/dialogue';
import type { DialogueNode } from '../../content/dialogue/types';
import { ITEMS } from '../../content/items';
import { DIALOGUE_STRINGS } from '../../content/strings/dialogue';
import { ITEM_STRINGS } from '../../content/strings/items';
import { fill } from '../../content/strings/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';
import { holds, startNode } from '../../sim/journal';
import type { Command } from '../../sim/kernel/commands';
import type { SimEvent } from '../../sim/kernel/events';
import type { SimState } from '../../sim/state';
import { buyPrice, sellPrice } from '../../sim/systems/npcs';

export interface TalkDeps {
  read: () => { state: SimState; who: number };
  send: (c: Command) => void;
  /** Paints an NPC's head and shoulders (16 x 16) into a canvas. */
  drawPortrait: (canvas: HTMLCanvasElement, npcId: string) => void;
  drawIcon: (canvas: HTMLCanvasElement, iconId: string) => void;
  onOpenChange: (open: boolean) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Adds children in order. (`Element.append` is typed for the Worker's HTMLRewriter here.) */
function put<T extends HTMLElement>(parent: T, ...kids: HTMLElement[]): T {
  for (const k of kids) parent.appendChild(k);
  return parent;
}

const nameOf = (id: string): string => ITEM_STRINGS[ITEMS[id]?.nameKey ?? ''] ?? id;

/**
 * The dialogue sheet and the shop sheet (design/09): clear text in a bottom sheet with the
 * speaker's pixel portrait, tap to advance, choices as large buttons, and a scrollable log.
 * Everything the player picks goes to the sim as a command. Text uses `textContent` only.
 */
export class TalkSheet {
  private sheet: HTMLElement | null = null;
  private npc = '';
  private node: DialogueNode | null = null;
  private log: HTMLElement | null = null;
  private actions: HTMLElement | null = null;
  private shopId: string | null = null;
  private shopMsg = '';
  private shopTab: 'buy' | 'sell' = 'buy';
  private ready = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly deps: TalkDeps,
  ) {
    window.addEventListener('keydown', (e) => {
      if (this.sheet && e.code === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  get isOpen(): boolean {
    return this.sheet !== null;
  }

  close(): void {
    if (!this.sheet) return;
    this.sheet.remove();
    this.sheet = null;
    this.node = null;
    this.log = null;
    this.actions = null;
    this.shopId = null;
    this.deps.onOpenChange(false);
  }

  private mount(cls: string, label: string): HTMLElement {
    this.close();
    const s = el('section', `pow-panel pow-sheet ${cls}`);
    s.setAttribute('role', 'dialog');
    s.setAttribute('aria-label', label);
    this.root.appendChild(s);
    this.sheet = s;
    this.deps.onOpenChange(true);
    return s;
  }

  /** Starts a conversation with an NPC at the node its conditions pick. */
  openTalk(npcId: string): void {
    const d = DIALOGUES[npcId];
    const npc = NPCS[npcId];
    const { state, who } = this.deps.read();
    const first = startNode(state, who, npcId);
    if (!d || !npc || !first) return;
    const s = this.mount(`pow-talk ${d.style === 'chat' ? 'pow-chat' : ''}`, npc.name);
    this.npc = npcId;
    const head = el('header', 'pow-talk-head');
    const portrait = el('canvas', 'pow-portrait');
    portrait.width = 16;
    portrait.height = 16;
    portrait.setAttribute('aria-hidden', 'true');
    this.deps.drawPortrait(portrait, npcId);
    const name = el('h2', 'pow-talk-name', npc.name);
    const close = el('button', 'pow-button pow-close', S.talk.close);
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    put(head, portrait, name, close);
    this.log = el('div', 'pow-talk-log');
    this.log.setAttribute('role', 'log');
    this.log.setAttribute('aria-label', S.talk.log);
    this.actions = el('div', 'pow-talk-actions');
    put(s, head, this.log, this.actions);
    this.show(first);
  }

  private addLine(who: 'npc' | 'you', text: string): void {
    if (!this.log) return;
    const p = el('p', `pow-line pow-line-${who}`);
    const name = who === 'you' ? S.talk.you : (NPCS[this.npc]?.name ?? '');
    if (DIALOGUES[this.npc]?.style === 'chat' && who === 'npc') {
      p.appendChild(el('span', 'pow-line-name', name));
      p.appendChild(document.createTextNode(` ${text}`));
    } else p.textContent = text;
    this.log.appendChild(p);
    this.log.scrollTop = this.log.scrollHeight;
  }

  private show(id: string): void {
    const d = DIALOGUES[this.npc];
    const node = d?.nodes[id];
    if (!node || !this.actions) return this.close();
    this.node = node;
    this.deps.send({ type: 'talk', npc: this.npc, node: id, choice: -1 });
    this.addLine('npc', DIALOGUE_STRINGS[node.text] ?? node.text);
    this.actions.textContent = '';
    const { state, who } = this.deps.read();
    const choices = (node.choices ?? [])
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => holds(state, who, c.if));
    if (choices.length > 0) {
      for (const { c, i } of choices) {
        const b = el('button', 'pow-button pow-choice', DIALOGUE_STRINGS[c.text] ?? c.text);
        b.type = 'button';
        b.addEventListener('click', () => {
          this.addLine('you', DIALOGUE_STRINGS[c.text] ?? c.text);
          this.deps.send({ type: 'talk', npc: this.npc, node: id, choice: i });
          if (c.next) this.show(c.next);
          else this.close();
        });
        this.actions.appendChild(b);
      }
    } else {
      const next = node.next;
      const b = el('button', 'pow-button pow-choice', next ? S.talk.continue : S.talk.done);
      b.type = 'button';
      b.addEventListener('click', () => (next ? this.show(next) : this.close()));
      this.actions.appendChild(b);
    }
    this.actions.querySelector('button')?.focus();
  }

  /** Reacts to sim events: opens the shop, and reports what happened there. */
  onEvent(e: SimEvent): void {
    if (e.type === 'talkStarted') this.openTalk(e.npc);
    else if (e.type === 'shopOpened') this.openShop(e.shop);
    else if (this.shopId && e.type === 'bought') {
      this.shopMsg = fill(S.shop.bought, { item: nameOf(e.item), n: String(e.coin) });
      this.renderShop();
    } else if (this.shopId && e.type === 'sold') {
      this.shopMsg = fill(S.shop.sold, { item: nameOf(e.item), n: String(e.coin) });
      this.renderShop();
    } else if (this.shopId && e.type === 'shopDenied') {
      this.shopMsg = S.shop.denied[e.reason];
      this.renderShop();
    }
  }

  openShop(shopId: string): void {
    if (!SHOPS[shopId]) return;
    this.mount('pow-shop', S.shop.title);
    this.shopId = shopId;
    this.shopMsg = '';
    this.shopTab = 'buy';
    this.renderShop();
  }

  private renderShop(): void {
    const s = this.sheet;
    const id = this.shopId;
    const shop = id ? SHOPS[id] : undefined;
    if (!s || !shop) return;
    const { state, who } = this.deps.read();
    const coin = state.entities.comps.avatar[who]?.coin ?? 0;
    const inv = state.entities.comps.inventory[who];
    s.textContent = '';
    const head = el('header', 'pow-shop-head');
    put(
      head,
      el('h2', 'pow-talk-name', `${NPCS[shop.npc]?.name ?? ''}: ${S.shop.title}`),
      el('span', 'pow-shop-coin', fill(S.shop.coin, { n: String(coin) })),
    );
    const close = el('button', 'pow-button pow-close', S.shop.close);
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    head.appendChild(close);

    const tabs = el('div', 'pow-shop-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const t of ['buy', 'sell'] as const) {
      const b = el('button', 'pow-tab', S.shop[t]);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(this.shopTab === t));
      b.addEventListener('click', () => {
        this.shopTab = t;
        this.renderShop();
      });
      tabs.appendChild(b);
    }
    const msg = el('p', 'pow-shop-msg', this.shopMsg);
    msg.setAttribute('role', 'status');

    const list = el('ul', 'pow-shop-list');
    const row = (
      item: string,
      price: number,
      label: string,
      qtyText: string,
      run: () => void,
    ): void => {
      const li = el('li', 'pow-shop-row');
      const icon = el('canvas', 'pow-icon');
      icon.width = 12;
      icon.height = 12;
      icon.setAttribute('aria-hidden', 'true');
      this.deps.drawIcon(icon, ITEMS[item]?.icon ?? '');
      const name = el('span', 'pow-shop-name', `${nameOf(item)}${qtyText}`);
      const cost = el('span', 'pow-shop-price', fill(S.shop.price, { n: String(price) }));
      const b = el('button', 'pow-button', label);
      b.type = 'button';
      b.setAttribute(
        'aria-label',
        `${label} ${nameOf(item)}, ${fill(S.shop.price, { n: String(price) })}`,
      );
      b.addEventListener('click', run);
      put(li, icon, name, cost, b);
      list.appendChild(li);
    };
    if (this.shopTab === 'buy') {
      for (const item of shop.stock)
        row(item, buyPrice(item), S.shop.buyOne, '', () =>
          this.deps.send({ type: 'buy', shop: shop.id, item, qty: 1 }),
        );
    } else {
      let any = false;
      inv?.slots.forEach((stack, slot) => {
        if (!stack || stack.item === 'item.coin') return;
        const each = sellPrice(stack.item);
        if (each <= 0) return;
        any = true;
        row(stack.item, each, S.shop.sellOne, ` x${stack.qty}`, () =>
          this.deps.send({ type: 'sell', shop: shop.id, slot, qty: 1 }),
        );
      });
      if (!any) list.appendChild(el('li', 'pow-hint', S.shop.nothingToSell));
    }
    put(s, head, tabs, msg, list);
    (s.querySelector('.pow-shop-list button') as HTMLElement | null)?.focus();
    this.ready = true;
  }

  /** Re-draws the shop, so coin and the bag stay current. Cheap enough to call when the sheet is open. */
  refresh(): void {
    if (this.shopId && this.ready) this.renderShop();
  }
}
