import { UI_BALANCE } from '../../content/balance/ui';
import { fill } from '../../content/strings/skills';
import { UI_STRINGS as S } from '../../content/strings/ui';
import {
  HUD_OPACITY_RANGE,
  HUD_SCALE_RANGE,
  BUTTON_SCALE_RANGE,
  TEXT_SCALE_RANGE,
} from '../../platform/settings';
import type { SettingsStore } from '../../platform/settings';
import type { Command } from '../../sim/kernel/commands';
import type { SimState } from '../../sim/state';
import { bagView, characterView, itemDetail, skillsView, type ItemAction } from '../menu/model';

export const TAB_IDS = [
  'character',
  'skills',
  'bag',
  'map',
  'chronicle',
  'social',
  'routines',
  'system',
] as const;
export type TabId = (typeof TAB_IDS)[number];

/** Tabs that work in the slice. The others show disabled with their names. */
export const ENABLED_TABS: readonly TabId[] = ['character', 'skills', 'bag', 'system'];

/** What the Menu needs from the game. It never touches the sim except through `send`. */
export interface MenuDeps {
  /** The current sim state and avatar id, read when the Menu draws. */
  read: () => { state: SimState; who: number };
  send: (c: Command) => void;
  settings: SettingsStore;
  /** Paints an item or status icon (12 x 12) into a canvas. */
  drawIcon: (canvas: HTMLCanvasElement, iconId: string) => void;
  /** Paints the avatar preview into a canvas. */
  drawAvatar: (canvas: HTMLCanvasElement) => void;
  onLogOut: () => void;
  onOpenChange?: (open: boolean) => void;
}

let uid = 0;

/** Adds children in order. (`Element.append` is typed for the Worker's HTMLRewriter here.) */
function put<T extends HTMLElement>(parent: T, ...kids: HTMLElement[]): T {
  for (const k of kids) parent.appendChild(k);
  return parent;
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

/**
 * The Menu sheet (design/09): a full-height sheet in portrait with a tab bar at the bottom, a
 * centered panel in landscape. All DOM, clear text, pixel frames. Text is set with `textContent`
 * only. The game keeps running under it.
 */
export class MenuSheet {
  readonly root: HTMLElement;
  private sheet: HTMLElement;
  private body: HTMLElement;
  private tabs = new Map<TabId, HTMLButtonElement>();
  private tab: TabId = 'character';
  private selected = -1;
  private opened = false;
  private pushed = false;
  private sig = '';
  private timer: number | null = null;
  private returnFocus: HTMLElement | null = null;
  private readonly head: HTMLElement;

  constructor(
    host: HTMLElement,
    private readonly deps: MenuDeps,
  ) {
    const id = `pow-menu-${uid++}`;
    this.root = host;
    this.sheet = el('section', 'pow-panel pow-menu');
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');
    this.sheet.setAttribute('aria-labelledby', `${id}-title`);
    this.sheet.hidden = true;

    const head = el('header', 'pow-menu-head');
    this.head = head;
    const grip = el('div', 'pow-menu-grip');
    grip.setAttribute('aria-hidden', 'true');
    const title = el('h2', 'pow-menu-title', S.menuTitle);
    title.id = `${id}-title`;
    const close = el('button', 'pow-button pow-close', S.close);
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    put(head, grip, title, close);

    this.body = el('div', 'pow-menu-body');
    this.body.id = `${id}-panel`;
    this.body.setAttribute('role', 'tabpanel');

    const bar = el('div', 'pow-tabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', S.menuTitle);
    for (const t of TAB_IDS) {
      const b = el('button', 'pow-tab', S.tabs[t]);
      b.type = 'button';
      b.id = `${id}-tab-${t}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', this.body.id);
      b.dataset.tab = t;
      if (ENABLED_TABS.includes(t)) b.addEventListener('click', () => this.show(t));
      else b.disabled = true;
      b.addEventListener('keydown', (e) => this.tabKey(e, t));
      bar.appendChild(b);
      this.tabs.set(t, b);
    }
    put(this.sheet, head, this.body, bar);
    host.appendChild(this.sheet);
    window.addEventListener('popstate', () => {
      if (this.opened) this.close(true);
    });
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** True if `target` is in the header, where a swipe down closes the sheet. */
  isGrip(target: EventTarget | null): boolean {
    return target instanceof Node && this.head.contains(target);
  }

  open(tab: TabId = this.tab): void {
    if (this.opened) {
      this.show(tab);
      return;
    }
    this.opened = true;
    this.returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.sheet.hidden = false;
    if (!this.pushed) {
      history.pushState({ powMenu: 1 }, '');
      this.pushed = true;
    }
    this.show(tab);
    this.timer = window.setInterval(() => this.refresh(), UI_BALANCE.menu.refreshMs);
    this.tabs.get(this.tab)?.focus();
    this.deps.onOpenChange?.(true);
  }

  close(fromPop = false): void {
    if (!this.opened) return;
    this.opened = false;
    this.sheet.hidden = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.pushed) {
      this.pushed = false;
      if (!fromPop) history.back();
    }
    this.returnFocus?.focus();
    this.deps.onOpenChange?.(false);
  }

  toggle(tab?: TabId): void {
    if (this.opened && (tab === undefined || tab === this.tab)) this.close();
    else this.open(tab);
  }

  /** Switches tab. */
  show(tab: TabId): void {
    if (!ENABLED_TABS.includes(tab)) return;
    this.tab = tab;
    this.selected = tab === 'bag' ? this.selected : -1;
    for (const [id, b] of this.tabs) {
      const on = id === tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) this.body.setAttribute('aria-labelledby', b.id);
    }
    this.sig = '';
    this.render(true);
  }

  private tabKey(e: KeyboardEvent, t: TabId): void {
    const live = TAB_IDS.filter((x) => ENABLED_TABS.includes(x));
    const i = live.indexOf(t);
    let next: TabId | undefined;
    if (e.key === 'ArrowRight') next = live[(i + 1) % live.length];
    else if (e.key === 'ArrowLeft') next = live[(i - 1 + live.length) % live.length];
    else if (e.key === 'Home') next = live[0];
    else if (e.key === 'End') next = live[live.length - 1];
    if (next) {
      e.preventDefault();
      this.show(next);
      this.tabs.get(next)?.focus();
    }
  }

  /** Redraws the open tab if what it shows has changed. The System tab is left alone. */
  refresh(): void {
    if (!this.opened || this.tab === 'system') return;
    this.render(false);
  }

  private signature(): string {
    const { state, who } = this.deps.read();
    switch (this.tab) {
      case 'character':
        return JSON.stringify(characterView(state, who));
      case 'skills':
        return JSON.stringify(skillsView(state, who));
      case 'bag':
        return JSON.stringify([bagView(state, who), this.selected]);
      default:
        return '';
    }
  }

  private render(force: boolean): void {
    const sig = this.signature();
    if (!force && sig === this.sig) return;
    this.sig = sig;
    const focusKey =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.key
        : undefined;
    this.body.textContent = '';
    switch (this.tab) {
      case 'character':
        this.renderCharacter();
        break;
      case 'skills':
        this.renderSkills();
        break;
      case 'bag':
        this.renderBag();
        break;
      case 'system':
        this.renderSystem();
        break;
      default:
    }
    if (focusKey && !force) {
      const again = Array.from(this.body.querySelectorAll<HTMLElement>('[data-key]')).find(
        (n) => n.dataset.key === focusKey,
      );
      again?.focus();
    }
  }

  private icon(id: string | null, cls = 'pow-icon'): HTMLElement {
    const c = el('canvas', cls);
    c.width = 12;
    c.height = 12;
    c.setAttribute('aria-hidden', 'true');
    if (id) this.deps.drawIcon(c, id);
    return c;
  }

  private heading(text: string, level: 'h3' | 'h4' = 'h3'): HTMLElement {
    return el(level, 'pow-h', text);
  }

  // ---- Character ----

  private renderCharacter(): void {
    const { state, who } = this.deps.read();
    const v = characterView(state, who);
    const top = el('div', 'pow-char-top');
    const av = el('canvas', 'pow-avatar');
    av.width = 24;
    av.height = 32;
    av.setAttribute('role', 'img');
    av.setAttribute('aria-label', S.avatarAlt);
    this.deps.drawAvatar(av);
    const pools = el('ul', 'pow-pools');
    for (const p of v.pools) {
      const li = el('li', 'pow-pool');
      put(
        li,
        el('span', 'pow-pool-name', p.label),
        el('span', 'pow-pool-val', `${p.curText} / ${p.maxText}`),
      );
      const bar = el('div', `pow-meter pow-meter-${p.key}`);
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', p.label);
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', p.maxText);
      bar.setAttribute('aria-valuenow', p.curText);
      const fillEl = el('div', 'pow-meter-fill');
      fillEl.style.setProperty('--fill', `${p.max === 0 ? 0 : Math.round((p.cur * 100) / p.max)}%`);
      bar.appendChild(fillEl);
      li.appendChild(bar);
      pools.appendChild(li);
    }
    put(top, av, pools);

    const gear = el('ul', 'pow-gear');
    gear.setAttribute('aria-label', S.gear);
    for (const g of v.gear) {
      const li = el('li', 'pow-gear-slot');
      if (g.item) {
        const b = el('button', 'pow-gear-btn');
        b.type = 'button';
        b.dataset.key = `gear-${g.slot}`;
        b.setAttribute('aria-label', `${g.label}: ${g.itemName}. ${S.unequipHint}`);
        put(
          b,
          this.icon(g.icon),
          el('span', 'pow-gear-label', g.label),
          el('span', 'pow-gear-item', g.itemName ?? ''),
        );
        b.addEventListener('click', () => this.deps.send({ type: 'unequip', slot: g.slot }));
        li.appendChild(b);
      } else {
        li.classList.add('pow-empty');
        put(li, el('span', 'pow-gear-label', g.label), el('span', 'pow-gear-item', S.slotEmpty));
      }
      gear.appendChild(li);
    }
    put(this.body, top, this.heading(S.gear), gear, el('p', 'pow-coin', `${S.coin}: ${v.coin}`));
  }

  // ---- Skills ----

  private renderSkills(): void {
    const { state, who } = this.deps.read();
    const fams = skillsView(state, who);
    if (fams.length === 0) this.body.appendChild(el('p', 'pow-hint', S.skillsEmpty));
    for (const fam of fams) {
      const sec = el('section', 'pow-skill-family');
      const h = this.heading(fam.label);
      const hid = `pow-fam-${uid++}`;
      h.id = hid;
      sec.setAttribute('aria-labelledby', hid);
      const ul = el('ul', 'pow-skills');
      for (const r of fam.rows) {
        const li = el('li', 'pow-skill');
        put(
          li,
          el('span', 'pow-skill-name', r.name),
          el('span', 'pow-skill-rank', `${r.mastery} ${r.points}`),
        );
        const bar = el('div', 'pow-meter pow-meter-skill');
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-label', `${r.name}: ${S.nextPoint}`);
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-valuenow', String(r.progressPct));
        const f = el('div', 'pow-meter-fill');
        f.style.setProperty('--fill', `${r.progressPct}%`);
        bar.appendChild(f);
        li.appendChild(bar);
        if (r.trial)
          li.appendChild(
            el('p', 'pow-hint', r.trial === 'offered' ? S.trialOffered : S.trialReady),
          );
        ul.appendChild(li);
      }
      put(sec, h, ul);
      this.body.appendChild(sec);
    }
  }

  // ---- Bag ----

  private renderBag(): void {
    const { state, who } = this.deps.read();
    const v = bagView(state, who);
    this.body.appendChild(
      el(
        'p',
        'pow-bag-count',
        `${fill(S.bagCount, { used: v.used, total: v.total })}. ${S.coin}: ${v.coin}`,
      ),
    );
    const grid = el('ul', 'pow-bag-grid');
    grid.setAttribute('aria-label', S.bagTitle);
    for (const s of v.slots) {
      const li = el('li', 'pow-bag-cell');
      if (s.item) {
        const b = el('button', 'pow-bag-slot');
        b.type = 'button';
        b.dataset.key = `slot-${s.index}`;
        b.setAttribute('aria-label', s.label);
        b.setAttribute('aria-pressed', String(this.selected === s.index));
        put(b, this.icon(s.icon, 'pow-icon pow-icon-big'));
        if (s.qty > 1) put(b, el('span', 'pow-qty', String(s.qty)));
        b.addEventListener('click', () => {
          this.selected = this.selected === s.index ? -1 : s.index;
          this.render(true);
          this.body.querySelector<HTMLElement>(`[data-key="slot-${s.index}"]`)?.focus();
        });
        li.appendChild(b);
      } else {
        li.classList.add('pow-empty');
        li.setAttribute('aria-hidden', 'true');
      }
      grid.appendChild(li);
    }
    this.body.appendChild(grid);

    const d = this.selected >= 0 ? itemDetail(state, who, this.selected) : null;
    if (this.selected >= 0 && !d) this.selected = -1;
    const detail = el('section', 'pow-detail');
    if (!d) {
      detail.appendChild(el('p', 'pow-hint', v.used === 0 ? S.bagEmpty : S.detailNone));
    } else {
      const hid = `pow-detail-${uid++}`;
      const h = this.heading(d.name);
      h.id = hid;
      detail.setAttribute('aria-labelledby', hid);
      put(
        detail,
        h,
        el('p', 'pow-detail-meta', `${d.category}. ${d.value}. ${d.qty}.`),
        el('p', 'pow-detail-desc', d.description),
      );
      const actions = el('div', 'pow-actions');
      const slot = this.selected;
      for (const a of d.actions) for (const n of this.actionNodes(a, slot)) actions.appendChild(n);
      detail.appendChild(actions);
    }
    this.body.appendChild(detail);
  }

  private actionNodes(a: ItemAction, slot: number): HTMLElement[] {
    const b = el('button', 'pow-button pow-action', S.actions[a]);
    b.type = 'button';
    b.dataset.key = `act-${a}`;
    if (a === 'use') b.addEventListener('click', () => this.deps.send({ type: 'use', slot }));
    else if (a === 'equip')
      b.addEventListener('click', () => this.deps.send({ type: 'equip', slot }));
    else {
      const hint = this.holdToConfirm(b, () => {
        this.deps.send({ type: 'drop', slot });
        this.selected = -1;
      });
      return [b, hint];
    }
    return [b];
  }

  /** Destructive actions need a held press (design/09), by touch, mouse or the keyboard. */
  private holdToConfirm(b: HTMLButtonElement, done: () => void): HTMLElement {
    // The hint describes the button. It is not part of its name.
    const hint = el('span', 'pow-sr', S.dropping);
    hint.id = `pow-hint-${uid++}`;
    b.setAttribute('aria-describedby', hint.id);
    let start = 0;
    let t: number | null = null;
    const stop = (): void => {
      if (t !== null) window.clearInterval(t);
      t = null;
      b.style.setProperty('--hold', '0%');
      b.classList.remove('holding');
    };
    const begin = (): void => {
      if (t !== null) return;
      start = performance.now();
      b.classList.add('holding');
      t = window.setInterval(() => {
        const f = (performance.now() - start) / UI_BALANCE.menu.holdConfirmMs;
        b.style.setProperty('--hold', `${Math.min(100, Math.round(f * 100))}%`);
        if (f >= 1) {
          stop();
          done();
        }
      }, 30);
    };
    b.addEventListener('pointerdown', begin);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel'] as const)
      b.addEventListener(ev, stop);
    b.addEventListener('keydown', (e) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        begin();
      }
    });
    b.addEventListener('keyup', stop);
    b.addEventListener('blur', stop);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    return hint;
  }

  // ---- System ----

  private renderSystem(): void {
    const st = this.deps.settings;
    const sys = S.system;
    this.body.appendChild(this.heading(sys.settings));

    const scheme = el('div', 'pow-seg');
    scheme.setAttribute('role', 'radiogroup');
    scheme.setAttribute('aria-label', sys.scheme);
    const mk = (id: 'flow' | 'classic', label: string): HTMLButtonElement => {
      const b = el('button', 'pow-seg-btn', label);
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.dataset.key = `scheme-${id}`;
      const sync = (): void => {
        const on = st.get().controlScheme === id;
        b.setAttribute('aria-checked', String(on));
        b.classList.toggle('on', on);
      };
      sync();
      b.addEventListener('click', () => {
        st.set({ controlScheme: id });
        for (const sib of scheme.querySelectorAll<HTMLButtonElement>('button')) {
          const on = sib.dataset.key === `scheme-${st.get().controlScheme}`;
          sib.setAttribute('aria-checked', String(on));
          sib.classList.toggle('on', on);
        }
      });
      return b;
    };
    put(scheme, mk('flow', sys.flow), mk('classic', sys.classic));
    const sRow = el('div', 'pow-setting');
    const sLabel = el('span', 'pow-setting-name', sys.scheme);
    put(sRow, sLabel, scheme);
    this.body.appendChild(sRow);

    const slider = (
      label: string,
      range: readonly [number, number],
      get: () => number,
      set: (v: number) => void,
      step: number,
    ): void => {
      const row = el('div', 'pow-setting pow-slider');
      const id = `pow-s-${uid++}`;
      const name = el('label', 'pow-setting-name', label);
      name.htmlFor = id;
      const input = el('input', 'pow-range');
      input.id = id;
      input.type = 'range';
      input.min = String(range[0]);
      input.max = String(range[1]);
      input.step = String(step);
      input.value = String(get());
      input.dataset.key = id;
      const val = el('span', 'pow-setting-val', fill(sys.percent, { n: Math.round(get() * 100) }));
      input.addEventListener('input', () => {
        set(Number(input.value));
        val.textContent = fill(sys.percent, { n: Math.round(get() * 100) });
      });
      put(row, name, val, input);
      this.body.appendChild(row);
    };
    slider(
      sys.textScale,
      TEXT_SCALE_RANGE,
      () => st.get().textScale,
      (v) => st.set({ textScale: v }),
      0.1,
    );
    slider(
      sys.hudScale,
      HUD_SCALE_RANGE,
      () => st.get().hudScale,
      (v) => st.set({ hudScale: v }),
      0.1,
    );
    slider(
      sys.buttonScale,
      BUTTON_SCALE_RANGE,
      () => st.get().buttonScale,
      (v) => st.set({ buttonScale: v }),
      0.1,
    );
    slider(
      sys.hudOpacity,
      HUD_OPACITY_RANGE,
      () => st.get().hudOpacity,
      (v) => st.set({ hudOpacity: v }),
      0.05,
    );

    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void): void => {
      const b = el('button', 'pow-toggle');
      b.type = 'button';
      b.setAttribute('role', 'switch');
      b.dataset.key = `toggle-${uid++}`;
      const name = el('span', 'pow-setting-name', label);
      const val = el('span', 'pow-setting-val');
      const sync = (): void => {
        b.setAttribute('aria-checked', String(get()));
        val.textContent = get() ? sys.on : sys.off;
      };
      sync();
      put(b, name, val);
      b.addEventListener('click', () => {
        set(!get());
        sync();
      });
      this.body.appendChild(b);
    };
    toggle(
      sys.handedness,
      () => st.get().handedness === 'left',
      (v) => st.set({ handedness: v ? 'left' : 'right' }),
    );
    toggle(
      sys.reducedMotion,
      () => st.get().reducedMotion,
      (v) => st.set({ reducedMotion: v }),
    );
    toggle(
      sys.haptics,
      () => st.get().haptics,
      (v) => st.set({ haptics: v }),
    );
    toggle(
      sys.mute,
      () => st.get().muted,
      (v) => st.set({ muted: v }),
    );

    const out = el('div', 'pow-logout');
    const btn = el('button', 'pow-button pow-danger', sys.logOut);
    btn.type = 'button';
    btn.addEventListener('click', () => this.deps.onLogOut());
    put(out, btn, el('p', 'pow-hint', sys.logOutNote));
    this.body.appendChild(out);
  }
}
