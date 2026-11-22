import { DIALOGUES, NPCS, SHOPS } from '../../content/dialogue';
import type { DialogueNode } from '../../content/dialogue/types';
import { CRAFTING } from '../../content/balance/crafting';
import { ITEMS } from '../../content/items';
import { PATHS } from '../../content/paths';
import { PATHS_BALANCE } from '../../content/balance/paths';
import { PATH_STRINGS } from '../../content/strings/paths';
import { RECIPES, expand } from '../../content/items/recipes';
import { STATIONS } from '../../content/items/stations';
import { DIALOGUE_STRINGS } from '../../content/strings/dialogue';
import { emptyState, gridCell } from './parts';
import { canBeIngredient, itemName, recipeName } from '../menu/recipeModel';
import { fill } from '../../content/strings/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';
import { holds, startNode } from '../../sim/journal';
import { addressOf } from '../../sim/systems/deeds';
import type { Command } from '../../sim/kernel/commands';
import type { SimEvent } from '../../sim/kernel/events';
import type { Haggle, SimState } from '../../sim/state';
import { acceptChance } from '../../sim/economy';
import { countItem } from '../../sim/items';
import { EQUIP_SLOTS } from '../../content/items/types';
import {
  haggleOf,
  mendCost,
  openBuy,
  openSell,
  payable,
  shopPurse,
  shopTakes,
} from '../../sim/trade';

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

const nameOf = itemName;

/** The list each station kind last showed, for the session. UI state, not saved. */
const STATION_VIEW = new Map<string, 'recipes' | 'bag' | 'repair'>();

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
  private shopTab: 'buy' | 'sell' | 'buyback' | 'repair' = 'buy';
  private haggleNote = '';
  private ready = false;
  private storageOpen = false;
  private restOpen = false;
  private restMsg = '';
  private stationKind: string | null = null;
  private lastStation: string | null = null;
  private stationMsg = '';
  /** What the last craft made, shown as a card until the player starts another pick. */
  private craftResult: { item: string; qty: number; quality: number } | null = null;
  private picked: string[] = [];

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

  /** The person being talked to, or empty when no talk is open. */
  get speaker(): string {
    return this.sheet ? this.npc : '';
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
    this.storageOpen = false;
    this.restOpen = false;
    this.stationKind = null;
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
    const { state, who } = this.deps.read();
    // `{address}` is how the shown Path (or else the handle) is said.
    this.addLine(
      'npc',
      (DIALOGUE_STRINGS[node.text] ?? node.text).split('{address}').join(addressOf(state, who)),
    );
    this.actions.textContent = '';
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
    else if (e.type === 'storageOpened') this.openStorage();
    else if (e.type === 'stationOpened') this.openStation(e.station);
    else if (e.type === 'bedOpened') this.openRest();
    else if (this.restOpen && e.type === 'slept') {
      this.restMsg = S.rest.slept;
      this.renderRest();
    } else if (this.restOpen && e.type === 'pathWorn') this.renderRest();
    else if (e.type === 'craftStarted') this.close();
    else if (e.type === 'crafted' || e.type === 'craftFailed') this.afterCraft(e);
    else if (e.type === 'repaired' && this.stationKind) {
      this.stationMsg = fill(S.craft.mended, { item: nameOf(e.item) });
      this.renderStation();
    } else if (this.storageOpen && e.type === 'storageMoved') this.renderStorage();
    else if (this.shopId && e.type === 'bought') {
      this.shopMsg = fill(S.shop.bought, { item: nameOf(e.item), n: String(e.coin) });
      this.renderShop();
    } else if (this.shopId && e.type === 'sold') {
      this.shopMsg = fill(S.shop.sold, { item: nameOf(e.item), n: String(e.coin) });
      this.renderShop();
    } else if (this.shopId && e.type === 'boughtBack') {
      this.shopMsg = fill(S.shop.boughtBack, { item: nameOf(e.item), n: String(e.coin) });
      this.renderShop();
    } else if (this.shopId && e.type === 'mended') {
      this.shopMsg = fill(S.shop.mended, { item: nameOf(e.item), n: String(e.coin) });
      this.renderShop();
    } else if (this.shopId && e.type === 'haggleStep') {
      if (e.result === 'open') this.shopMsg = '';
      this.haggleNote = fill(S.shop.haggle.says[e.result], { n: String(e.price) });
      this.renderShop();
    } else if (this.shopId && e.type === 'haggleEnded') {
      this.haggleNote = '';
      // A walk away or a purchase that failed has its own message, or none.
      if (e.won)
        this.shopMsg = fill(S.shop.haggle.won, { item: nameOf(e.item), n: String(e.price) });
      else if (e.refused) this.shopMsg = S.shop.haggle.lost;
      this.renderShop();
    } else if (this.shopId && e.type === 'shopDenied') {
      this.shopMsg = fill(S.shop.denied[e.reason], {
        name: NPCS[SHOPS[this.shopId]?.npc ?? '']?.name ?? '',
      });
      this.renderShop();
    }
  }

  openShop(shopId: string): void {
    if (!SHOPS[shopId]) return;
    this.mount('pow-shop', S.shop.title);
    this.shopId = shopId;
    this.shopMsg = '';
    this.haggleNote = '';
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
    const tabNames = shop.repairs
      ? (['buy', 'sell', 'buyback', 'repair'] as const)
      : (['buy', 'sell', 'buyback'] as const);
    for (const t of tabNames) {
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
    const purse = el(
      'p',
      'pow-hint',
      fill(S.shop.purse, {
        name: NPCS[shop.npc]?.name ?? '',
        n: String(shopPurse(state, shop.id)),
      }),
    );
    const msg = el('p', 'pow-shop-msg', this.shopMsg);
    msg.setAttribute('role', 'status');

    const list = el('ul', 'pow-shop-list');
    const row = (
      item: string,
      price: number,
      label: string,
      qtyText: string,
      run: (() => void) | null,
      extra: HTMLElement | null = null,
      glyph: string | null = null,
    ): void => {
      const li = el('li', 'pow-shop-row pow-part-listrow');
      const icon = el('canvas', 'pow-icon');
      icon.width = 12;
      icon.height = 12;
      icon.setAttribute('aria-hidden', 'true');
      this.deps.drawIcon(icon, ITEMS[item]?.icon ?? '');
      const name = el('span', 'pow-shop-name', `${nameOf(item)}${qtyText}`);
      const cost = el('span', 'pow-shop-price', fill(S.shop.price, { n: String(price) }));
      const b = el('button', glyph ? 'pow-button pow-icon-button' : 'pow-button');
      b.type = 'button';
      if (glyph) b.appendChild(this.glyph(glyph));
      else b.textContent = label;
      b.title = label;
      b.setAttribute(
        'aria-label',
        `${label} ${nameOf(item)}, ${fill(S.shop.price, { n: String(price) })}`,
      );
      if (run) b.addEventListener('click', run);
      else b.disabled = true;
      const actions = el('span', 'pow-shop-actions');
      put(actions, b);
      if (extra) actions.appendChild(extra);
      put(li, icon, name, cost, actions);
      list.appendChild(li);
    };
    const haggleButton = (
      start: Extract<Command, { type: 'haggle' }>,
      item: string,
    ): HTMLElement => {
      const b = el('button', 'pow-button pow-icon-button');
      b.type = 'button';
      b.appendChild(this.glyph('ui.icon_haggle'));
      b.title = S.shop.haggle.button;
      b.setAttribute('aria-label', `${S.shop.haggle.button} ${nameOf(item)}`);
      b.addEventListener('click', () => this.deps.send(start));
      return b;
    };
    const k = state.entities.comps.npc.find((n) => n?.id === shop.npc) ?? null;
    const open = haggleOf(state, who);
    if (open && open.shop === shop.id) {
      put(s, head, msg, this.renderHaggle(open, shop.firmness));
      this.ready = true;
      return;
    }
    if (this.shopTab === 'buy') {
      for (const { item } of shop.stock) {
        const left = k?.stock[item] ?? 0;
        const locked = k?.locked.includes(item) ?? false;
        row(
          item,
          payable(state, who, openBuy(shop.id, item)),
          left > 0 ? S.shop.buyOne : S.shop.soldOut,
          ` ${fill(S.shop.left, { n: String(left) })}`,
          left > 0 ? () => this.deps.send({ type: 'buy', shop: shop.id, item, qty: 1 }) : null,
          left > 0 && !locked
            ? haggleButton({ type: 'haggle', shop: shop.id, step: 'start', item, dir: 'buy' }, item)
            : null,
          left > 0 ? 'ui.icon_buy' : null,
        );
      }
    } else if (this.shopTab === 'sell') {
      let any = false;
      inv?.slots.forEach((stack, slot) => {
        if (!stack || !shopTakes(shop.id, stack.item)) return;
        const each = openSell(shop.id, stack.item, stack.q ?? 0);
        if (each <= 0) return;
        any = true;
        const locked = k?.locked.includes(stack.item) ?? false;
        row(
          stack.item,
          each,
          S.shop.sellOne,
          ` x${stack.qty}`,
          () => this.deps.send({ type: 'sell', shop: shop.id, slot, qty: 1 }),
          locked
            ? null
            : haggleButton(
                { type: 'haggle', shop: shop.id, step: 'start', dir: 'sell', slot },
                stack.item,
              ),
        );
      });
      if (!any) list.appendChild(el('li', 'pow-hint', S.shop.nothingToSell));
    } else if (this.shopTab === 'buyback') {
      (k?.buyback ?? []).forEach((b, index) =>
        row(
          b.stack.item,
          b.price * b.stack.qty,
          S.shop.buyBackOne,
          b.stack.qty > 1 ? ` x${b.stack.qty}` : '',
          () => this.deps.send({ type: 'buyback', shop: shop.id, index }),
        ),
      );
      if (!k || k.buyback.length === 0) list.appendChild(el('li', 'pow-hint', S.shop.nothingBack));
    } else {
      let any = false;
      const add = (from: 'bag' | 'worn', slot: number, item: string): void => {
        const cost = mendCost(state, who, from, slot);
        if (cost <= 0) return;
        any = true;
        const tag = from === 'worn' ? ` (${S.shop.worn})` : '';
        row(item, cost, S.shop.mendOne, tag, () =>
          this.deps.send({ type: 'mend', shop: shop.id, from, slot }),
        );
      };
      EQUIP_SLOTS.forEach((slot, i) => {
        const w = inv?.equipment[slot];
        if (w) add('worn', i, w.item);
      });
      inv?.slots.forEach((stack, slot) => {
        if (stack) add('bag', slot, stack.item);
      });
      if (!any) list.appendChild(el('li', 'pow-hint', S.shop.nothingWorn));
    }
    put(s, head, tabs, purse, msg, list);
    (s.querySelector('.pow-shop-list button') as HTMLElement | null)?.focus();
    this.ready = true;
  }

  /** A 12 x 12 icon canvas for a button. The button's label and aria-label carry the words. */
  private glyph(iconId: string): HTMLCanvasElement {
    const c = el('canvas', 'pow-icon');
    c.width = 12;
    c.height = 12;
    c.setAttribute('aria-hidden', 'true');
    this.deps.drawIcon(c, iconId);
    return c;
  }

  /** The Rest panel on a bedroll: sleep, wear and take off Paths, choose the title shown. */
  openRest(): void {
    this.mount('pow-shop pow-rest', S.rest.title);
    this.restOpen = true;
    this.restMsg = '';
    this.renderRest();
  }

  private renderRest(): void {
    const s = this.sheet;
    if (!s || !this.restOpen) return;
    const { state, who } = this.deps.read();
    const paths = state.entities.comps.paths[who];
    s.textContent = '';
    const head = el('header', 'pow-shop-head');
    put(head, el('h2', 'pow-talk-name', S.rest.title));
    const close = el('button', 'pow-button pow-close', S.rest.close);
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    head.appendChild(close);
    const msg = el('p', 'pow-shop-msg', this.restMsg);
    msg.setAttribute('role', 'status');
    const sleep = el('button', 'pow-button pow-choice', S.rest.sleep);
    sleep.type = 'button';
    sleep.addEventListener('click', () => this.deps.send({ type: 'sleep' }));
    put(
      s,
      head,
      msg,
      sleep,
      el('h3', 'pow-heading', fill(S.rest.paths, { max: String(PATHS_BALANCE.maxWorn) })),
    );
    const list = el('ul', 'pow-shop-list');
    for (const id of paths?.earned ?? []) {
      const def = PATHS[id];
      if (!def) continue;
      const worn = paths?.worn.includes(id) === true;
      const li = el('li', 'pow-shop-row pow-part-listrow');
      const name = PATH_STRINGS[def.nameKey] ?? id;
      const mark = paths?.shown === id ? ` (${S.pathsShown})` : worn ? ` (${S.pathsWorn})` : '';
      const b = el('button', 'pow-button', worn ? S.rest.takeOff : S.rest.wear);
      b.type = 'button';
      b.setAttribute('aria-label', `${worn ? S.rest.takeOff : S.rest.wear} ${name}`);
      b.addEventListener('click', () => this.deps.send({ type: 'wearPath', path: id, on: !worn }));
      put(li, el('span', 'pow-shop-name', `${name}${mark}`), b);
      if (worn && paths?.shown !== id) {
        const sb = el('button', 'pow-button', S.rest.show);
        sb.type = 'button';
        sb.setAttribute('aria-label', `${S.rest.show}: ${name}`);
        sb.addEventListener('click', () => this.deps.send({ type: 'showPath', path: id }));
        li.appendChild(sb);
      }
      list.appendChild(li);
      list.appendChild(el('li', 'pow-hint', PATH_STRINGS[def.giftKey] ?? ''));
    }
    if ((paths?.earned.length ?? 0) === 0) list.appendChild(el('li', 'pow-hint', S.rest.noPaths));
    s.appendChild(list);
    this.ready = true;
  }

  /** What the price standing comes to for the avatar: the Haggler Path takes its share off a buy. */
  private pay(h: Haggle): number {
    const { state, who } = this.deps.read();
    return h.dir === 'buy' ? payable(state, who, h.cur) : h.cur;
  }

  /** The haggle panel: the price standing, the exchanges left, and the four choices. */
  private renderHaggle(h: Haggle, firmness: number): HTMLElement {
    const box = el('section', 'pow-haggle');
    const name = SHOPS[h.shop] ? (NPCS[SHOPS[h.shop]?.npc ?? '']?.name ?? '') : '';
    put(
      box,
      el(
        'h3',
        'pow-haggle-title',
        fill(h.dir === 'buy' ? S.shop.haggle.titleBuy : S.shop.haggle.titleSell, {
          item: nameOf(h.item),
        }),
      ),
      el('p', 'pow-haggle-price', fill(S.shop.haggle.standing, { n: String(this.pay(h)) })),
      el(
        'p',
        'pow-hint',
        fill(S.shop.haggle.rounds, { n: String(h.rounds - h.round), max: String(h.rounds) }),
      ),
      el('p', 'pow-haggle-says', this.haggleNote ? `${name}: ${this.haggleNote}` : ''),
    );
    const { state, who } = this.deps.read();
    const pts = state.entities.comps.skills[who]?.points['skill.bartering'] ?? 0;
    const btn = (label: string, step: 'low' | 'fair' | 'accept' | 'cancel', hint = ''): void => {
      const b = el('button', 'pow-button pow-choice', hint ? `${label} (${hint})` : label);
      b.type = 'button';
      b.addEventListener('click', () => this.deps.send({ type: 'haggle', shop: h.shop, step }));
      box.appendChild(b);
    };
    if (h.round < h.rounds) {
      btn(
        S.shop.haggle.low,
        'low',
        fill(S.shop.haggle.chance, { n: String(acceptChance('low', pts, firmness)) }),
      );
      btn(
        S.shop.haggle.fair,
        'fair',
        fill(S.shop.haggle.chance, { n: String(acceptChance('fair', pts, firmness)) }),
      );
    }
    btn(fill(S.shop.haggle.accept, { n: String(this.pay(h)) }), 'accept');
    btn(S.shop.haggle.walk, 'cancel');
    return box;
  }

  /** The result of a craft: the panel comes back with what was made. */
  private afterCraft(e: Extract<SimEvent, { type: 'crafted' | 'craftFailed' }>): void {
    if (!this.lastStation) return;
    const { state, who } = this.deps.read();
    if (e.id !== who) return;
    const msg =
      e.type === 'crafted'
        ? fill(S.craft.made, {
            n: String(e.qty),
            item: nameOf(e.item),
            quality: S.craft.qualities[e.quality] ?? '',
          })
        : fill(S.craft.failed, {
            item: nameOf(
              CRAFTING.failItem[STATIONS[this.lastStation]?.craft ?? ''] ?? 'item.burnt_mess',
            ),
          });
    void state;
    this.craftResult =
      e.type === 'crafted' ? { item: e.item, qty: e.qty, quality: e.quality } : null;
    this.openStation(this.lastStation, msg);
  }

  /** The card for what was just made: its icon, name, and quality in words and glyph, never color alone. */
  private resultCard(r: { item: string; qty: number; quality: number }): HTMLElement {
    const q = Math.max(0, Math.min(3, r.quality));
    const card = el('div', `pow-craft-result pow-craft-q${q}`);
    card.setAttribute('role', 'status');
    const icon = el('canvas', 'pow-icon pow-icon-big');
    icon.width = 12;
    icon.height = 12;
    icon.setAttribute('aria-hidden', 'true');
    this.deps.drawIcon(icon, ITEMS[r.item]?.icon ?? '');
    const name = r.qty > 1 ? `${nameOf(r.item)} x${r.qty}` : nameOf(r.item);
    const glyph = S.qualityGlyph[q] ?? '';
    const grade = el(
      'span',
      'pow-craft-grade',
      glyph ? `${S.quality[q]} ${glyph}` : (S.quality[q] ?? ''),
    );
    put(
      card,
      icon,
      put(el('div', 'pow-craft-text'), el('strong', 'pow-craft-name', name), grade),
      el('p', 'pow-hint', S.craft.resultLine[q] ?? ''),
    );
    return card;
  }

  /** A crafting station: pick up to four ingredients or a known recipe, craft, and repair at the anvil. */
  openStation(kind: string, msg = ''): void {
    const def = STATIONS[kind];
    if (!def) return;
    this.mount('pow-shop pow-station', S.craft.title[kind] ?? kind);
    this.stationKind = kind;
    this.lastStation = kind;
    this.stationMsg = msg;
    if (!msg) {
      this.picked = [];
      this.craftResult = null;
    }
    this.renderStation();
  }

  /**
   * The station sheet (POW-M4-22C): a fixed tray on top, one switchable list below it. The Craft
   * button never scrolls away, and only the list scrolls.
   */
  private renderStation(): void {
    const s = this.sheet;
    const kind = this.stationKind;
    const def = kind ? STATIONS[kind] : undefined;
    if (!s || !kind || !def) return;
    const { state, who } = this.deps.read();
    const inv = state.entities.comps.inventory[who];
    s.textContent = '';
    const head = el('header', 'pow-shop-head');
    put(head, el('h2', 'pow-talk-name', S.craft.title[kind] ?? kind));
    const close = el('button', 'pow-button pow-close', S.craft.close);
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    head.appendChild(close);

    const held = (item: string): number => (inv ? countItem(inv, item) : 0);
    const pickedOf = (item: string): number => this.picked.filter((p) => p === item).length;
    const full = this.picked.length >= CRAFTING.maxIngredients;
    const icon = (id: string | undefined): HTMLElement => {
      const c = el('canvas', 'pow-icon');
      c.width = 12;
      c.height = 12;
      c.setAttribute('aria-hidden', 'true');
      this.deps.drawIcon(c, ITEMS[id ?? '']?.icon ?? '');
      return c;
    };

    // The tray: one cell per ingredient slot. Tap a filled one to take it out.
    const tray = el('div', 'pow-station-tray');
    const cells = el('div', 'pow-station-cells');
    cells.setAttribute('role', 'group');
    cells.setAttribute('aria-label', S.craft.tray);
    for (let i = 0; i < CRAFTING.maxIngredients; i++) {
      const item = this.picked[i];
      if (item === undefined) {
        const empty = el('div', 'pow-part-cell pow-tray-empty');
        empty.setAttribute('aria-hidden', 'true');
        cells.appendChild(empty);
        continue;
      }
      cells.appendChild(
        gridCell({
          key: `picked-${i}`,
          label: nameOf(item),
          icon: icon(item),
          onOpen: () => {
            this.picked.splice(i, 1);
            this.renderStation();
          },
        }),
      );
    }
    const acts = el('div', 'pow-station-acts');
    const go = el('button', 'pow-button pow-choice', S.craft.craft);
    go.type = 'button';
    go.dataset.key = 'craft-go';
    go.disabled = this.picked.length === 0;
    go.addEventListener('click', () => {
      this.deps.send({ type: 'craft', items: [...this.picked] });
      this.stationMsg = '';
    });
    const clear = el('button', 'pow-button', S.craft.clear);
    clear.type = 'button';
    clear.dataset.key = 'craft-clear';
    clear.addEventListener('click', () => {
      this.picked = [];
      this.renderStation();
    });
    put(acts, go, clear);
    put(tray, cells, acts);

    // One line: the result card after a craft, else the message, else how the step plays.
    const line = el('div', 'pow-station-line');
    if (this.stationMsg && this.craftResult) line.appendChild(this.resultCard(this.craftResult));
    else {
      const msg = el('p', 'pow-shop-msg', this.stationMsg || (S.craft.steps[def.step] ?? ''));
      msg.setAttribute('role', 'status');
      line.appendChild(msg);
    }

    // The known recipes of this station, makeable ones first.
    const recipes = Object.values(RECIPES)
      .filter((r) => r.station === kind && inv?.recipes.includes(r.id))
      .map((r) => {
        const units = expand(r.ingredients);
        const short = r.ingredients
          .map((i) => ({ ...i, lack: Math.max(0, i.qty - held(i.item)) }))
          .filter((i) => i.lack > 0);
        return { r, units, short, name: recipeName(r) };
      })
      .sort(
        (a, b) =>
          Number(a.short.length > 0) - Number(b.short.length > 0) || a.name.localeCompare(b.name),
      );

    const mode = this.viewFor(kind, recipes.length > 0);
    const lists = el('div', 'pow-station-list');
    if (mode === 'recipes') {
      const ul = el('ul', 'pow-station-recipes');
      for (const { r, units, short, name } of recipes) {
        const b = el('button', 'pow-station-recipe');
        b.type = 'button';
        b.dataset.key = `recipe-${r.id}`;
        b.classList.toggle('is-short', short.length > 0);
        b.setAttribute(
          'aria-label',
          `${name}: ${r.ingredients.map((i) => `${held(i.item)} of ${i.qty} ${nameOf(i.item)}`).join(', ')}`,
        );
        const need = el('span', 'pow-station-need');
        for (const i of r.ingredients) {
          const chip = el('span', 'pow-station-chip');
          chip.title = nameOf(i.item);
          put(
            chip,
            icon(i.item),
            el(
              'span',
              held(i.item) >= i.qty ? undefined : 'pow-station-lack',
              `${Math.min(held(i.item), i.qty)}/${i.qty}`,
            ),
          );
          need.appendChild(chip);
        }
        put(
          b,
          r.result ? icon(r.result) : el('span', 'pow-icon'),
          el('span', 'pow-station-rname', name),
          need,
        );
        b.addEventListener('click', () => {
          if (short.length > 0) {
            this.stationMsg = fill(S.craft.missing, {
              list: short.map((i) => `${i.lack} ${nameOf(i.item)}`).join(', '),
            });
            this.craftResult = null;
          } else {
            this.picked = units;
            this.stationMsg = '';
          }
          this.renderStation();
        });
        ul.appendChild(el('li')).appendChild(b);
      }
      if (recipes.length === 0) ul.appendChild(el('li', 'pow-hint', S.craft.noRecipes));
      lists.appendChild(ul);
    } else if (mode === 'bag') {
      const grid = el('div', 'pow-station-bag');
      const seen = new Set<string>();
      inv?.slots.forEach((st) => {
        if (!st || seen.has(st.item)) return;
        const gear =
          def.craft === 'enchanting' &&
          (ITEMS[st.item]?.category === 'weapon' || ITEMS[st.item]?.category === 'armor');
        if (!canBeIngredient(st.item) && !gear) return;
        seen.add(st.item);
        const left = held(st.item) - pickedOf(st.item);
        const cell = gridCell({
          key: `add-${st.item}`,
          label: `${nameOf(st.item)} x${left}`,
          icon: icon(st.item),
          qty: left,
          onOpen: () => {
            this.picked.push(st.item);
            this.stationMsg = '';
            this.renderStation();
          },
        });
        cell.removeAttribute('aria-haspopup');
        cell.disabled = left <= 0 || full;
        grid.appendChild(cell);
      });
      if (!grid.hasChildNodes()) grid.appendChild(el('p', 'pow-hint', S.craft.none));
      lists.appendChild(grid);
    } else {
      const rl = el('ul', 'pow-station-recipes');
      let any = false;
      inv?.slots.forEach((st, slot) => {
        const d = st ? ITEMS[st.item] : undefined;
        if (!st || !d?.durability || (st.dur ?? d.durability) >= d.durability) return;
        any = true;
        const b = el('button', 'pow-station-recipe');
        b.type = 'button';
        b.dataset.key = `repair-${slot}`;
        b.setAttribute('aria-label', `${S.craft.repair}: ${nameOf(st.item)}`);
        put(
          b,
          icon(st.item),
          el('span', 'pow-station-rname', `${S.craft.repair}: ${nameOf(st.item)}`),
          el(
            'span',
            'pow-hint',
            fill(S.craft.repairCost, { item: nameOf(CRAFTING.repairMaterial[d.tier] ?? '') }),
          ),
        );
        b.addEventListener('click', () => this.deps.send({ type: 'repair', slot }));
        rl.appendChild(el('li')).appendChild(b);
      });
      if (!any) rl.appendChild(el('li', 'pow-hint', S.craft.repairNone));
      lists.appendChild(rl);
    }

    // The switch: one list at a time. It remembers its choice per station kind.
    const modes: ('recipes' | 'bag' | 'repair')[] =
      def.craft === 'smithing' ? ['recipes', 'bag', 'repair'] : ['recipes', 'bag'];
    const sw = el('div', 'pow-station-switch');
    sw.setAttribute('role', 'group');
    for (const m of modes) {
      const label =
        m === 'recipes' ? S.craft.viewRecipes : m === 'bag' ? S.craft.viewBag : S.craft.viewRepair;
      const b = el('button', 'pow-button', label);
      b.type = 'button';
      b.dataset.key = `view-${m}`;
      b.setAttribute('aria-pressed', String(m === mode));
      b.addEventListener('click', () => {
        STATION_VIEW.set(kind, m);
        this.renderStation();
      });
      sw.appendChild(b);
    }
    put(s, head, tray, line, sw, lists);
    (s.querySelector('button.pow-choice') as HTMLElement | null)?.focus();
  }

  /** The list the switch shows: the remembered one, else Recipes when any is known, else Bag. */
  private viewFor(kind: string, anyKnown: boolean): 'recipes' | 'bag' | 'repair' {
    return STATION_VIEW.get(kind) ?? (anyKnown ? 'recipes' : 'bag');
  }

  /** The storage chest: two lists, tap a stack to move it across. */
  openStorage(): void {
    this.mount('pow-shop pow-storage', S.storage.title);
    this.storageOpen = true;
    this.renderStorage();
  }

  private renderStorage(): void {
    const s = this.sheet;
    if (!s || !this.storageOpen) return;
    const { state, who } = this.deps.read();
    const inv = state.entities.comps.inventory[who];
    const store = state.entities.comps.storage[who];
    s.textContent = '';
    const head = el('header', 'pow-shop-head');
    put(head, el('h2', 'pow-talk-name', S.storage.title));
    const close = el('button', 'pow-button pow-close', S.storage.close);
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    head.appendChild(close);
    const column = (
      title: string,
      slots: readonly ({ item: string; qty: number; q?: number } | null)[],
      dir: 'in' | 'out',
    ): HTMLElement => {
      const col = el('section', 'pow-storage-col');
      const used = slots.filter((x) => x).length;
      put(
        col,
        el('h3', 'pow-h', title),
        el('p', 'pow-hint', fill(S.storage.count, { used, total: slots.length })),
      );
      const list = el('ul', 'pow-shop-list');
      slots.forEach((stack, slot) => {
        if (!stack) return;
        const li = el('li', 'pow-shop-row pow-part-listrow');
        const icon = el('canvas', 'pow-icon');
        icon.width = 12;
        icon.height = 12;
        icon.setAttribute('aria-hidden', 'true');
        this.deps.drawIcon(icon, ITEMS[stack.item]?.icon ?? '');
        const q = stack.q ? ` ${S.qualityGlyph[stack.q] ?? ''}` : '';
        const name = el('span', 'pow-shop-name', `${nameOf(stack.item)}${q} x${stack.qty}`);
        const label = dir === 'in' ? S.storage.toChest : S.storage.toBag;
        const b = el('button', 'pow-button', label);
        b.type = 'button';
        b.setAttribute('aria-label', `${label} ${nameOf(stack.item)}`);
        b.addEventListener('click', () => this.deps.send({ type: 'store', dir, slot }));
        put(li, icon, name, b);
        list.appendChild(li);
      });
      if (used === 0) list.appendChild(emptyState(S.storage.empty));
      col.appendChild(list);
      return col;
    };
    const cols = el('div', 'pow-storage-cols');
    put(
      cols,
      column(S.storage.bag, inv?.slots ?? [], 'in'),
      column(S.storage.chest, store?.slots ?? [], 'out'),
    );
    put(s, head, cols);
    (s.querySelector('.pow-shop-list button') as HTMLElement | null)?.focus();
  }

  /** Re-draws the shop, so coin and the bag stay current. Cheap enough to call when the sheet is open. */
  refresh(): void {
    if (this.storageOpen) this.renderStorage();
    if (this.shopId && this.ready) this.renderShop();
  }
}
