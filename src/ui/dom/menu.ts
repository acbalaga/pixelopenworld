import type { Trust } from '../../save/integrity/reasons';
import { togglePin } from '../hud/quickSlot';
import { createBackupSection, type BackupDeps } from './backup';
import { createDeviceSection } from './device';
import { createSeal } from './seal';
import { detailSheet, emptyState, gridCell, header, row, section, type SheetAction } from './parts';
import { TAB_ICONS } from '../../content/ui/tabIcons';
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
import { ITEMS } from '../../content/items';
import type { RequestView } from '../../sim/requestLog';
import type { SimState } from '../../sim/state';
import { REQUEST_STRINGS as RS } from '../../content/strings/requests';
import {
  bagView,
  calendarView,
  canRestOutdoors,
  characterView,
  itemDetail,
  skillsView,
  techniquesView,
  type PathRowView,
  type TrialLogRow,
  type SkillRowView,
  type BagFilterId,
  type BagSortId,
} from '../menu/model';
import { MAP_STRINGS } from '../../content/strings/map';
import { MapPane, type MapPaneDeps } from './mapPane';
import { bestiaryView } from '../menu/bestiaryModel';
import { chronicleLines } from '../menu/singularModel';
import { finished, knownRecipes, underWay } from '../menu/journalModel';

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

/** Tabs that work. The others are hidden until their systems exist (design/09). */
export const ENABLED_TABS: readonly TabId[] = [
  'character',
  'skills',
  'bag',
  'map',
  'chronicle',
  'system',
];

/** What the Menu needs from the game. It never touches the sim except through `send`. */
export interface MenuDeps {
  /** The current sim state and avatar id, read when the Menu draws. */
  read: () => { state: SimState; who: number };
  send: (c: Command) => void;
  settings: SettingsStore;
  /** Paints an item or status icon (12 x 12) into a canvas. */
  drawIcon: (canvas: HTMLCanvasElement, iconId: string) => void;
  /** Paints a creature's picture (its idle frame, facing the viewer) into a canvas, sizing it to the frame. Optional. */
  drawCreature?: (canvas: HTMLCanvasElement, spriteId: string) => void;
  /** Paints the avatar preview into a canvas. */
  drawAvatar: (canvas: HTMLCanvasElement) => void;
  onLogOut: () => void;
  /** Asks to delete the character and start a new one. The game confirms and does it. */
  onDeleteCharacter: () => void;
  /** The save's trust state, read when System draws. */
  trust: () => Trust;
  /** Export and import, shown under Backup in System. */
  backup: BackupDeps;
  /** Writes the game before an update restarts it. */
  beforeUpdate?: () => Promise<void>;
  onOpenChange?: (open: boolean) => void;
  /** The region being played, so System can offer to keep it for offline play. */
  region?: string;
  /** What the Map tab draws from (M4-06). Without it the tab says there is no map. */
  map?: Pick<MapPaneDeps, 'ctx' | 'image' | 'fill' | 'travel'>;
}

let uid = 0;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The 16 x 16 tab icon, drawn from `TAB_ICONS` in the text color. Decorative. */
function tabIcon(tab: string): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'pow-tab-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('shape-rendering', 'crispEdges');
  (TAB_ICONS[tab] ?? []).forEach((rowStr, y) => {
    for (let x = 0; x < rowStr.length; x++) {
      if (rowStr[x] !== '#') continue;
      const r = document.createElementNS(SVG_NS, 'rect');
      r.setAttribute('x', String(x));
      r.setAttribute('y', String(y));
      r.setAttribute('width', '1');
      r.setAttribute('height', '1');
      svg.appendChild(r);
    }
  });
  return svg;
}

/** Adds children in order. (`Element.append` is typed for the Worker's HTMLRewriter here.) */
function put<T extends HTMLElement>(parent: T, ...kids: (HTMLElement | null)[]): T {
  for (const k of kids) if (k) parent.appendChild(k);
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
  private opened = false;
  private sig = '';
  private timer: number | null = null;
  private returnFocus: HTMLElement | null = null;
  private readonly head: HTMLElement;
  private bar!: HTMLElement;
  /** The one detail sheet that may be open (never a sheet over a sheet), and what opened it. */
  private detail: {
    kind: 'skill' | 'item' | 'request' | 'trial';
    id: string;
    opener: string;
  } | null = null;
  private detailEl: HTMLElement | null = null;
  private detailSig = '';
  /** History entries this Menu has pushed (the Menu, then a sheet), so Back unwinds them in order. */
  private pushDepth = 0;
  private ignorePops = 0;
  /** What each tab showed when it was last looked at, for the badge dot. */
  private seen = new Map<TabId, string>();
  private baselined = false;
  /** The Map tab's pane. It outlives the tab's redraws so pan and zoom are kept. */
  private mapPane: MapPane | null = null;

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
    // Tabs for systems that are not built yet are not drawn at all.
    for (const t of TAB_IDS.filter((x) => ENABLED_TABS.includes(x))) {
      const b = el('button', 'pow-tab');
      b.type = 'button';
      b.id = `${id}-tab-${t}`;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', this.body.id);
      b.dataset.tab = t;
      put(b, tabIcon(t) as unknown as HTMLElement, el('span', 'pow-tab-label', S.tabs[t]));
      const dot = el('span', 'pow-part-dot pow-tab-dot');
      dot.hidden = true;
      dot.setAttribute('aria-hidden', 'true');
      b.appendChild(dot);
      b.addEventListener('click', () => this.show(t));
      b.addEventListener('keydown', (e) => this.tabKey(e, t));
      bar.appendChild(b);
      this.tabs.set(t, b);
    }
    this.bar = bar;
    put(this.sheet, head, this.body, bar);
    host.appendChild(this.sheet);
    window.addEventListener('popstate', () => {
      if (this.ignorePops > 0) {
        this.ignorePops--;
        return;
      }
      if (!this.opened) {
        this.pushDepth = 0;
        return;
      }
      this.pushDepth = Math.max(0, this.pushDepth - 1);
      // Back closes the sheet first, then the Menu.
      if (this.detail) this.closeSheet(true);
      else this.close(true);
    });
    // Escape closes an open sheet before it can close the Menu.
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.opened && this.detail && e.code === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.closeSheet();
        }
      },
      true,
    );
  }

  get isOpen(): boolean {
    return this.opened;
  }

  /** True if `target` is in the header, where a swipe down closes the sheet. */
  isGrip(target: EventTarget | null): boolean {
    return target instanceof Node && this.head.contains(target);
  }

  open(tab?: TabId): void {
    if (this.opened) {
      if (tab) this.show(tab);
      return;
    }
    const last = this.deps.settings.get().menuTab as TabId;
    const want = tab ?? (ENABLED_TABS.includes(last) ? last : this.tab);
    this.opened = true;
    this.returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.sheet.hidden = false;
    this.pushHistory();
    if (!this.baselined) {
      this.baselined = true;
      for (const t of ENABLED_TABS) this.seen.set(t, this.tabSig(t));
    }
    // Reopens where it was left, unless a button asked for a tab.
    const restore = tab === undefined || tab === last ? this.deps.settings.get().menuScroll : 0;
    this.show(want, restore);
    this.timer = window.setInterval(() => this.refresh(), UI_BALANCE.menu.refreshMs);
    this.tabs.get(this.tab)?.focus();
    this.deps.onOpenChange?.(true);
  }

  close(fromPop = false): void {
    if (!this.opened) return;
    this.deps.settings.set({ menuTab: this.tab, menuScroll: Math.round(this.body.scrollTop) });
    this.removeSheet();
    this.detail = null;
    this.opened = false;
    this.sheet.hidden = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (!fromPop && this.pushDepth > 0) {
      this.ignorePops++;
      history.go(-this.pushDepth);
    }
    this.pushDepth = 0;
    this.returnFocus?.focus();
    this.deps.onOpenChange?.(false);
  }

  toggle(tab?: TabId): void {
    if (this.opened && (tab === undefined || tab === this.tab)) this.close();
    else this.open(tab);
  }

  /** Switches tab. `scroll` is where to leave the body. */
  show(tab: TabId, scroll = 0): void {
    if (!ENABLED_TABS.includes(tab)) return;
    if (tab !== this.tab) this.closeSheet(false, false);
    this.tab = tab;
    for (const [id, b] of this.tabs) {
      const on = id === tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) this.body.setAttribute('aria-labelledby', b.id);
    }
    this.sig = '';
    this.render(true);
    this.body.scrollTop = scroll;
    this.seen.set(tab, this.tabSig(tab));
    this.paintBadges();
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

  private pushHistory(): void {
    history.pushState({ powMenu: this.pushDepth + 1 }, '');
    this.pushDepth++;
  }

  /** What a tab shows that counts as news: a new point or Trial, or a new kind of item. */
  private tabSig(tab: TabId): string {
    const { state, who } = this.deps.read();
    if (tab === 'skills')
      return JSON.stringify(
        skillsView(state, who).map((f) => f.rows.map((r) => [r.id, r.points, r.trial])),
      );
    if (tab === 'bag')
      return JSON.stringify(
        bagView(state, who)
          .slots.filter((s) => s.item)
          .map((s) => s.item)
          .sort(),
      );
    return '';
  }

  private paintBadges(): void {
    for (const [t, b] of this.tabs) {
      const dot = b.querySelector<HTMLElement>('.pow-tab-dot');
      if (dot) dot.hidden = t === this.tab || this.tabSig(t) === (this.seen.get(t) ?? '');
    }
  }

  /** Redraws the open tab if what it shows has changed. The System tab is left alone. */
  refresh(): void {
    if (!this.opened) return;
    this.paintBadges();
    if (this.tab === 'system') return;
    if (this.tab === 'map') {
      this.mapPane?.update();
      return;
    }
    this.render(false);
    if (this.detail) this.mountSheet(false);
  }

  private signature(): string {
    const { state, who } = this.deps.read();
    const closed = this.deps.settings.get().closedSections.join(',');
    switch (this.tab) {
      case 'character':
        return JSON.stringify([characterView(state, who), closed, canRestOutdoors(state, who)]);
      case 'skills':
        return JSON.stringify([skillsView(state, who), closed]);
      case 'chronicle':
        return JSON.stringify([
          underWay(state, who),
          finished(state, who),
          knownRecipes(state, who),
          chronicleLines(state, who),
          bestiaryView(state, who),
          closed,
          this.detail?.kind === 'request' || this.detail?.kind === 'trial' ? this.detail.id : '',
        ]);
      case 'bag':
        return JSON.stringify([
          bagView(state, who, { filter: this.bagFilter, sort: this.bagSort }),
          this.detail?.kind === 'item' ? this.detail.id : '',
        ]);
      default:
        return '';
    }
  }

  private render(force: boolean): void {
    const sig = this.signature();
    if (!force && sig === this.sig) return;
    this.sig = sig;
    const active = document.activeElement;
    const focusKey =
      active instanceof HTMLElement && this.body.contains(active) ? active.dataset.key : undefined;
    const scroll = this.body.scrollTop;
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
      case 'map':
        this.renderMap();
        break;
      case 'chronicle':
        this.renderChronicle();
        break;
      case 'system':
        this.renderSystem();
        break;
      default:
    }
    if (!force) this.body.scrollTop = scroll;
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

  /** A collapsible section whose open state is remembered per player (UI settings). */
  private sec(
    id: string,
    title: string,
    count: number | undefined,
    ...kids: (HTMLElement | null)[]
  ): HTMLElement {
    return this.secWith(id, title, count, true, ...kids);
  }

  /**
   * Like `sec`, with the starting state. A section that starts closed is remembered as
   * `open:<id>` in the same list, so the setting needs no new field.
   */
  private secWith(
    id: string,
    title: string,
    count: number | undefined,
    openByDefault: boolean,
    ...kids: (HTMLElement | null)[]
  ): HTMLElement {
    const st = this.deps.settings;
    const mark = openByDefault ? id : `open:${id}`;
    return section(
      {
        id,
        title,
        ...(count !== undefined ? { count } : {}),
        open: openByDefault
          ? !st.get().closedSections.includes(id)
          : st.get().closedSections.includes(mark),
        onToggle: (open) => {
          const rest = st.get().closedSections.filter((x) => x !== mark);
          const keep = openByDefault ? !open : open;
          st.set({ closedSections: keep ? [...rest, mark] : rest });
        },
      },
      ...kids,
    );
  }

  // ---- Chronicle ----

  /**
   * The journal (POW-M4-22B): what is under way, what is finished, the recipes known, the
   * Bestiary, and the Singular lines. Nothing here names a place.
   */
  private renderChronicle(): void {
    const { state, who } = this.deps.read();
    const now = underWay(state, who);
    const done = finished(state, who);
    const recipes = knownRecipes(state, who);
    const lines = chronicleLines(state, who);
    const bestiary = bestiaryView(state, who);
    put(this.body, header(S.tabs.chronicle));
    const nUnder = now.requests.length + now.trials.length;
    const nDone = done.requests.length + done.trials.length;
    if (nUnder + nDone + recipes.length + lines.length + bestiary.rows.length === 0) {
      put(this.body, emptyState(S.chronicleEmpty));
      return;
    }
    if (nUnder > 0) {
      const ul = el('ul', 'pow-skills');
      for (const r of now.requests) ul.appendChild(this.requestRow(r));
      for (const t of now.trials) ul.appendChild(this.trialRow(t));
      const sec = this.sec('journal-under', S.journal.underWay, nUnder, ul);
      sec.dataset.key = 'requests';
      sec.classList.add('pow-requests');
      this.body.appendChild(sec);
    }
    if (nDone > 0) {
      const rows = [...done.requests, ...done.trials].map((f) =>
        row({
          key: `done-${f.kind}-${f.key}`,
          name: f.title,
          state: f.state,
          onOpen: () => this.openSheet(f.kind, f.key, `done-${f.kind}-${f.key}`),
        }),
      );
      const sec = this.secWith('journal-done', S.journal.finished, nDone, false, ...rows);
      sec.classList.add('pow-finished');
      this.body.appendChild(sec);
    }
    if (recipes.length > 0) {
      const n = recipes.reduce((a, g) => a + g.rows.length, 0);
      const kids: HTMLElement[] = [];
      for (const g of recipes) {
        kids.push(el('h5', 'pow-recipe-craft', g.label));
        for (const r of g.rows)
          kids.push(
            row({
              key: `recipe-${r.id}`,
              name: r.name,
              state: r.ingredients,
              icon: r.icon ? this.icon(r.icon) : null,
              onOpen: () => undefined,
            }),
          );
      }
      this.body.appendChild(this.secWith('journal-recipes', S.journal.recipes, n, false, ...kids));
    }
    if (bestiary.rows.length > 0) {
      put(this.body, header(S.bestiary.title), el('p', 'pow-bestiary-count', bestiary.count));
      const ul = el('ul', 'pow-bestiary');
      for (const r of bestiary.rows) {
        const li = el('li', 'pow-bestiary-row');
        const pic = el('canvas', 'pow-bestiary-pic');
        pic.setAttribute('aria-hidden', 'true');
        this.deps.drawCreature?.(pic, r.sprite);
        // Whole-pixel scale, like every other sprite in the Menu.
        pic.style.width = `calc(var(--px) * ${pic.width})`;
        pic.style.height = `calc(var(--px) * ${pic.height})`;
        const text = el('div', 'pow-bestiary-text');
        put(
          text,
          el('span', 'pow-bestiary-name', r.name),
          el('span', 'pow-bestiary-line', r.kills),
          ...(r.befriended ? [el('span', 'pow-bestiary-line', S.bestiary.befriended)] : []),
          el('span', 'pow-bestiary-line', r.temperament),
        );
        put(li, this.deps.drawCreature ? pic : null, text);
        put(ul, li);
      }
      put(this.body, ul);
    }
    if (lines.length > 0) {
      const ul = el('ul', 'pow-chronicle');
      for (const t of lines) put(ul, el('li', 'pow-chronicle-line', t));
      put(this.body, header(S.journal.story), ul);
    }
  }

  // ---- Map ----

  private renderMap(): void {
    const m = this.deps.map;
    if (!m) {
      put(this.body, header(S.tabs.map), emptyState(MAP_STRINGS.placesNone));
      return;
    }
    this.mapPane ??= new MapPane({
      ...m,
      read: this.deps.read,
      send: this.deps.send,
    });
    this.body.appendChild(this.mapPane.root);
    this.mapPane.update();
  }

  // ---- Character ----

  private renderCharacter(): void {
    const { state, who } = this.deps.read();
    const v = characterView(state, who);
    const rest = canRestOutdoors(state, who);
    put(
      this.body,
      header(
        S.tabs.character,
        rest
          ? [
              {
                kind: 'button',
                label: S.sleepHere,
                key: 'sleep-here',
                onClick: () => this.deps.send({ type: 'sleep' }),
              },
            ]
          : [],
      ),
    );

    // The doll at 2x in the center with its gear slots around it: armor to the left, hands and
    // accessory to the right. Tapping a worn piece takes it off, and the doll changes at once.
    const doll = el('div', 'pow-doll');
    const av = el('canvas', 'pow-avatar');
    av.width = 24;
    av.height = 32;
    av.setAttribute('role', 'img');
    av.setAttribute('aria-label', S.avatarAlt);
    this.deps.drawAvatar(av);
    const left = el('ul', 'pow-doll-col');
    left.setAttribute('aria-label', S.gear);
    const right = el('ul', 'pow-doll-col');
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
      (['head', 'body', 'legs'].includes(g.slot) ? left : right).appendChild(li);
    }
    put(doll, left, av, right);
    this.body.appendChild(doll);

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
    put(this.body, pools, el('p', 'pow-coin', `${S.coin}: ${v.coin}`));

    // Worn Paths as chips, then the two loadouts side by side.
    const worn = v.paths.filter((p) => p.worn);
    if (worn.length > 0) {
      const chips = el('ul', 'pow-chips');
      chips.setAttribute('aria-label', S.pathsTitle);
      for (const p of worn) put(chips, el('li', 'pow-chip', p.name));
      this.body.appendChild(chips);
    }
    if (v.loadouts.length > 0) {
      const wrap = el('div', 'pow-loadouts');
      for (const l of v.loadouts) {
        const card = el('section', l.active ? 'pow-loadout is-active' : 'pow-loadout');
        card.setAttribute('aria-label', fill(S.parts.loadout, { n: l.n }));
        put(
          card,
          el('h4', 'pow-part-section-title', fill(S.parts.loadout, { n: l.n })),
          l.active ? el('span', 'pow-part-tag', S.parts.loadoutActive) : null,
        );
        const ul = el('ul', 'pow-loadout-slots');
        l.slots.forEach((name, i) =>
          put(ul, el('li', undefined, `${i + 2}: ${name ?? S.parts.loadoutEmpty}`)),
        );
        card.appendChild(ul);
        wrap.appendChild(card);
      }
      this.body.appendChild(wrap);
    }
    this.body.appendChild(
      this.sec(
        'paths',
        S.pathsTitle,
        v.paths.length,
        v.paths.length === 0 ? emptyState(S.parts.pathsEmpty) : this.pathsList(v.paths),
      ),
    );
  }

  /**
   * One request under way, in the asker's words, with per way which steps are done. It never
   * shows a place. A request with one way of one step that only repeats its title draws no step
   * line: its count sits at the right of the title (POW-M4-22B, G10).
   */
  private requestRow(r: RequestView): HTMLElement {
    const li = el('li', `pow-journal-row pow-request pow-request-${r.state}`);
    li.dataset.request = r.id;
    const only = r.ways.length === 1 && r.ways[0]?.steps.length === 1 ? r.ways[0].steps[0] : null;
    const merged = only !== null && only !== undefined && only.text === r.title;
    const head = el('div', 'pow-tech-head');
    put(head, el('span', 'pow-skill-name', r.title));
    const tag =
      r.state === 'ready' ? (RS['request.log.ready'] as string) : merged ? only.status : '';
    if (tag) head.appendChild(el('span', 'pow-skill-rank', tag));
    const pin = el(
      'button',
      'pow-button pow-pin-small',
      r.pinned ? (RS['request.log.unpin'] as string) : (RS['request.log.pin'] as string),
    );
    pin.type = 'button';
    pin.dataset.key = `pin-${r.id}`;
    pin.setAttribute('aria-pressed', String(r.pinned));
    pin.addEventListener('click', () =>
      this.deps.send({ type: 'pinRequest', id: r.pinned ? null : r.id }),
    );
    head.appendChild(pin);
    li.appendChild(head);
    li.appendChild(el('p', 'pow-request-ask', r.ask));
    if (r.ways.length > 1) li.appendChild(el('p', 'pow-hint', RS['request.log.any'] as string));
    if (!merged)
      for (const w of r.ways) {
        const way = el('ul', 'pow-request-way');
        way.setAttribute('aria-label', w.label);
        for (const st of w.steps) {
          const stepRow = el(
            'li',
            st.status === RS['request.step.done'] ? 'pow-step pow-step-done' : 'pow-step',
          );
          stepRow.textContent = st.status ? `${st.text} (${st.status})` : st.text;
          way.appendChild(stepRow);
        }
        li.appendChild(way);
      }
    li.appendChild(el('p', 'pow-hint', r.reward));
    return li;
  }

  /** The Trial under way, as a journal row. */
  private trialRow(r: TrialLogRow): HTMLElement {
    const li = el('li', 'pow-journal-row pow-skill');
    li.setAttribute('aria-label', r.label);
    put(
      li,
      el('span', 'pow-skill-name', `${r.skill}, ${r.giver}`),
      el('span', 'pow-skill-rank', fill(S.trialProgress, { n: r.n, count: r.count })),
      el('p', 'pow-hint', r.intro),
    );
    return li;
  }

  /** The Paths list. Hidden Paths are not in the model until earned. */
  private pathsList(paths: readonly PathRowView[]): HTMLElement {
    const ul = el('ul', 'pow-skills');
    for (const r of paths) {
      const li = el('li', 'pow-path');
      const head = el('div', 'pow-tech-head');
      put(head, el('span', 'pow-skill-name', r.name));
      if (r.worn)
        head.appendChild(
          el('span', 'pow-skill-rank', r.shown ? `${S.pathsWorn}, ${S.pathsShown}` : S.pathsWorn),
        );
      li.appendChild(head);
      li.appendChild(el('p', 'pow-hint', r.earned ? r.gift : `${S.pathsHintLabel} ${r.hint}`));
      ul.appendChild(li);
    }
    return ul;
  }

  // ---- Skills ----

  private renderSkills(): void {
    const { state, who } = this.deps.read();
    const fams = skillsView(state, who);
    put(this.body, header(S.tabs.skills));
    if (fams.length === 0) {
      this.body.appendChild(emptyState(S.skillsEmpty));
      return;
    }
    for (const fam of fams) {
      const rows = fam.rows.map((r) =>
        row({
          key: `skill-${r.id}`,
          name: r.name,
          state: `${r.mastery} ${r.points}`,
          label: r.label,
          progress: r.progressPct,
          badge: r.trial !== null,
          onOpen: () => this.openSheet('skill', r.id, `skill-${r.id}`),
        }),
      );
      this.body.appendChild(this.sec(`family-${fam.family}`, fam.label, rows.length, ...rows));
    }
  }

  // ---- The detail sheet: one level below a tab, never a sheet over a sheet ----

  private openSheet(
    kind: 'skill' | 'item' | 'request' | 'trial',
    id: string,
    opener: string,
  ): void {
    if (this.detail) return;
    this.detail = { kind, id, opener };
    this.pushHistory();
    this.mountSheet(true);
    // The item grid marks the open cell.
    if (kind === 'item') this.render(true);
  }

  /** Closes the sheet and puts focus back on the row that opened it. */
  closeSheet(fromPop = false, refocus = true): void {
    if (!this.detail) return;
    const { opener, kind } = this.detail;
    this.removeSheet();
    this.detail = null;
    if (!fromPop && this.pushDepth > 1) {
      this.ignorePops++;
      this.pushDepth--;
      history.back();
    }
    if (kind === 'item' && refocus) this.render(true);
    if (refocus) this.body.querySelector<HTMLElement>(`[data-key="${opener}"]`)?.focus();
  }

  private removeSheet(): void {
    this.detailEl?.remove();
    this.detailEl = null;
    this.detailSig = '';
  }

  /** Builds the sheet from the view models. Rebuilds only when what it shows has changed. */
  private mountSheet(first: boolean): void {
    if (!this.detail) return;
    const { state, who } = this.deps.read();
    const { kind, id } = this.detail;
    const spec =
      kind === 'skill'
        ? this.skillSheet(state, who, id)
        : kind === 'item'
          ? this.itemSheet(state, who, Number(id))
          : this.journalSheet(state, who, kind, id);
    if (!spec) {
      this.closeSheet();
      return;
    }
    if (!first && spec.sig === this.detailSig) return;
    const active = document.activeElement;
    const focusKey =
      active instanceof HTMLElement && this.detailEl?.contains(active)
        ? active.dataset.key
        : undefined;
    this.removeSheet();
    this.detailSig = spec.sig;
    const ds = detailSheet({ ...spec.parts, onClose: () => this.closeSheet() });
    this.detailEl = ds.el;
    // Over the tab, above the tab bar, so the other tabs stay one tap away.
    ds.el.style.bottom = `${Math.max(0, Math.round(this.sheet.getBoundingClientRect().bottom - this.bar.getBoundingClientRect().top))}px`;
    this.sheet.appendChild(ds.el);
    this.swipeToClose(ds.el);
    const again = focusKey
      ? Array.from(ds.el.querySelectorAll<HTMLElement>('[data-key]')).find(
          (n) => n.dataset.key === focusKey,
        )
      : undefined;
    (again ?? ds.title).focus();
  }

  /** A swipe down on the sheet's grip or header closes it (Back and Escape do too). */
  private swipeToClose(sheet: HTMLElement): void {
    const handle = sheet.querySelector<HTMLElement>('.pow-part-grip');
    const head = sheet.querySelector<HTMLElement>('.pow-part-sheet-head');
    let y0: number | null = null;
    const down = (e: PointerEvent): void => {
      if ((e.target as HTMLElement).closest('button')) return;
      y0 = e.clientY;
    };
    const move = (e: PointerEvent): void => {
      if (y0 !== null && e.clientY - y0 > UI_BALANCE.menu.swipeMinPx * 0.75) {
        y0 = null;
        this.closeSheet();
      }
    };
    const up = (): void => {
      y0 = null;
    };
    for (const t of [handle, head]) {
      if (!t) continue;
      t.addEventListener('pointerdown', down);
      t.addEventListener('pointermove', move);
      t.addEventListener('pointerup', up);
      t.addEventListener('pointercancel', up);
    }
  }

  private skillSheet(
    state: SimState,
    who: number,
    id: string,
  ): { sig: string; parts: Omit<Parameters<typeof detailSheet>[0], 'onClose'> } | null {
    const r: SkillRowView | undefined = skillsView(state, who)
      .flatMap((f) => f.rows)
      .find((x) => x.id === id);
    if (!r) return null;
    const techs = techniquesView(state, who).groups.find((g) => g.skill === id);
    const extra: (HTMLElement | null)[] = [];
    const bar = el('div', 'pow-meter pow-meter-skill');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', `${r.name}: ${S.nextPoint}`);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    bar.setAttribute('aria-valuenow', String(r.progressPct));
    const f = el('div', 'pow-meter-fill');
    f.style.setProperty('--fill', `${r.progressPct}%`);
    bar.appendChild(f);
    extra.push(bar);
    extra.push(
      el(
        'p',
        'pow-part-sheet-desc',
        r.xp ? fill(S.parts.xpToNext, { have: r.xp.have, cost: r.xp.cost }) : S.parts.topRank,
      ),
    );
    if (r.trial)
      extra.push(el('p', 'pow-hint', r.trial === 'offered' ? S.trialOffered : S.trialReady));
    if (r.trialHint) extra.push(el('p', 'pow-hint', r.trialHint));
    if (r.sealed.length > 0) {
      const seals = el('p', 'pow-seals');
      for (const th of r.sealed) {
        const s = el('span', 'pow-seal', S.trialSeal);
        s.title = `${S.trialPassed}: ${th}`;
        s.setAttribute('role', 'img');
        s.setAttribute('aria-label', `${S.trialPassed}: ${th}`);
        seals.appendChild(s);
      }
      extra.push(seals);
    }
    if (techs) {
      const ul = el('ul', 'pow-skills');
      for (const t of techs.rows) {
        const li = el('li', 'pow-tech');
        const head = el('div', 'pow-tech-head');
        put(head, this.icon(t.icon), el('span', 'pow-skill-name', t.name));
        li.appendChild(head);
        // Where it comes from: "Known", "Insight 18 of 30", "Someone in Hearthford teaches this".
        li.appendChild(el('p', 'pow-hint', t.known ? t.desc : (t.need ?? '')));
        if (t.known && t.kind === 'passive') li.appendChild(el('p', 'pow-hint', S.techPassive));
        if (t.known && t.kind === 'active') {
          const slots = el('div', 'pow-tech-slots');
          for (const n of [2, 3, 4]) {
            const here = t.slot === n - 1;
            const b = el(
              'button',
              here ? 'pow-button pow-tech-slot is-on' : 'pow-button pow-tech-slot',
              String(n),
            );
            b.type = 'button';
            b.dataset.key = `tech-${t.id}-${n}`;
            b.setAttribute('aria-pressed', String(here));
            b.setAttribute(
              'aria-label',
              here ? fill(S.techClear, { name: t.name, n }) : fill(S.techPut, { name: t.name, n }),
            );
            b.addEventListener('click', () =>
              this.deps.send({ type: 'assign', slot: n - 1, technique: here ? null : t.id }),
            );
            slots.appendChild(b);
          }
          li.appendChild(slots);
        }
        ul.appendChild(li);
      }
      extra.push(
        el(
          'h4',
          'pow-h',
          `${S.parts.techniques}: ${fill(S.techniquesLoadout, { n: techs ? techniquesView(state, who).active : 1 })}`,
        ),
      );
      extra.push(el('p', 'pow-hint', S.techniquesHint));
      extra.push(ul);
    }
    return {
      sig: JSON.stringify([r, techs]),
      parts: { title: r.name, lines: [`${r.mastery} ${r.points}`], extra },
    };
  }

  /** The sheet for a finished request or a passed Trial: the asker's words, and the reward. */
  private journalSheet(
    state: SimState,
    who: number,
    kind: 'request' | 'trial',
    id: string,
  ): { sig: string; parts: Omit<Parameters<typeof detailSheet>[0], 'onClose'> } | null {
    const v = finished(state, who);
    const f = (kind === 'request' ? v.requests : v.trials).find((x) => x.key === id);
    if (!f) return null;
    return {
      sig: JSON.stringify(f),
      parts: {
        title: f.title,
        desc: f.desc,
        lines: f.state ? [f.state] : [],
        extra: f.reward ? [el('p', 'pow-hint', f.reward)] : [],
      },
    };
  }

  private itemSheet(
    state: SimState,
    who: number,
    slot: number,
  ): { sig: string; parts: Omit<Parameters<typeof detailSheet>[0], 'onClose'> } | null {
    const d = itemDetail(state, who, slot);
    if (!d) return null;
    const inv = state.entities.comps.inventory[who]?.slots[slot];
    const icon = inv ? this.icon(ITEMS[inv.item]?.icon ?? null, 'pow-icon pow-icon-big') : null;
    const pinned = !!inv && this.deps.settings.get().quickItems.includes(inv.item);
    const actions: SheetAction[] = d.actions.map((a) =>
      a === 'quick'
        ? {
            label: pinned ? S.quickUnpin : S.actions.quick,
            key: `act-${a}`,
            onClick: () => {
              if (!inv) return;
              const st = this.deps.settings.get();
              this.deps.settings.set(togglePin(st, inv.item));
              this.closeSheet();
            },
          }
        : a === 'drop' || a === 'trash'
          ? {
              label: S.actions[a],
              key: `act-${a}`,
              onHold: () => {
                this.deps.send({ type: a, slot });
                this.closeSheet();
              },
            }
          : {
              label: a === 'use' ? d.useLabel : S.actions[a],
              key: `act-${a}`,
              primary: true,
              onClick: () => this.deps.send({ type: a, slot }),
            },
    );
    // The primary action sits last, on the thumb side.
    actions.sort((x, y) => Number(x.primary === true) - Number(y.primary === true));
    return {
      sig: JSON.stringify([d, pinned]),
      parts: {
        title: d.name,
        icon,
        desc: d.description,
        lines: [d.category, d.value, d.qty, ...d.lines],
        actions,
      },
    };
  }

  // ---- Bag ----

  private renderBag(): void {
    const { state, who } = this.deps.read();
    const v = bagView(state, who, { filter: this.bagFilter, sort: this.bagSort });
    put(
      this.body,
      header(S.tabs.bag, [
        {
          kind: 'select',
          label: S.bagFiltersLabel,
          key: 'bag-filter',
          value: this.bagFilter,
          options: (Object.keys(S.bagFilters) as BagFilterId[]).map((id) => ({
            value: id,
            label: S.bagFilters[id],
          })),
          onChange: (value) => {
            this.bagFilter = value as BagFilterId;
            this.render(true);
            this.body.querySelector<HTMLElement>('[data-key="bag-filter"]')?.focus();
          },
        },
        {
          kind: 'select',
          label: S.bagSortLabel,
          key: 'bag-sort',
          value: this.bagSort ?? '',
          options: [
            { value: '', label: S.bagSlotOrder },
            ...(Object.keys(S.bagSorts) as BagSortId[]).map((id) => ({
              value: id,
              label: S.bagSorts[id],
            })),
          ],
          onChange: (value) => {
            this.bagSort = (value || null) as BagSortId | null;
            this.render(true);
            this.body.querySelector<HTMLElement>('[data-key="bag-sort"]')?.focus();
          },
        },
      ]),
    );
    this.body.appendChild(
      el(
        'p',
        'pow-bag-count',
        `${fill(S.bagCount, { used: v.used, total: v.total })}. ${S.coin}: ${v.coin}`,
      ),
    );
    if (v.used === 0) {
      this.body.appendChild(emptyState(S.bagEmpty));
      return;
    }
    const grid = el('ul', 'pow-bag-grid');
    grid.setAttribute('aria-label', S.bagTitle);
    for (const s of v.slots) {
      const li = el('li', 'pow-bag-cell');
      if (s.item) {
        const open = this.detail?.kind === 'item' && this.detail.id === String(s.index);
        li.appendChild(
          gridCell({
            key: `slot-${s.index}`,
            label: s.label,
            icon: this.icon(s.icon, 'pow-icon pow-icon-big'),
            qty: s.qty,
            glyph: s.glyph,
            broken: s.broken,
            pressed: open,
            onOpen: () => this.openSheet('item', String(s.index), `slot-${s.index}`),
          }),
        );
      } else {
        li.classList.add('pow-empty');
        li.setAttribute('aria-hidden', 'true');
      }
      grid.appendChild(li);
    }
    this.body.appendChild(grid);
    if (v.slots.every((s) => !s.item)) this.body.appendChild(emptyState(S.bagNothingHere));
  }

  private bagFilter: BagFilterId = 'all';
  private bagSort: BagSortId | null = null;

  // ---- System ----

  private renderSystem(): void {
    const st = this.deps.settings;
    const sys = S.system;
    put(this.body, header(S.tabs.system));
    const box = el('div', 'pow-settings');

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
    box.appendChild(sRow);

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
      box.appendChild(row);
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
      box.appendChild(b);
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
      sys.minimap,
      () => st.get().minimap,
      (v) => st.set({ minimap: v }),
    );
    toggle(
      sys.haptics,
      () => st.get().haptics,
      (v) => st.set({ haptics: v }),
    );
    toggle(
      sys.guardToggle,
      () => st.get().guardToggle,
      (v) => st.set({ guardToggle: v }),
    );
    toggle(
      sys.mute,
      () => st.get().muted,
      (v) => st.set({ muted: v }),
    );
    toggle(
      sys.prefetchRegions,
      () => st.get().prefetchRegions,
      (v) => st.set({ prefetchRegions: v }),
    );
    const region = this.deps.region;
    if (region)
      toggle(
        sys.pinRegion,
        () => st.get().pinnedRegions.includes(region),
        (v) =>
          st.set({
            pinnedRegions: v
              ? [...st.get().pinnedRegions, region]
              : st.get().pinnedRegions.filter((r) => r !== region),
          }),
      );

    const privacy = el('div', 'pow-help');
    privacy.dataset.key = 'privacy-note';
    put(privacy, el('h4', 'pow-h', S.help.privacyHeading));
    for (const line of S.help.privacy) put(privacy, el('p', 'pow-hint', line));
    // The calendar (M4-09): the date, the hour, today's weather and the days ahead.
    const cal = calendarView(this.deps.read().state);
    const calBox = el('div', 'pow-calendar');
    calBox.dataset.key = 'calendar';
    put(
      calBox,
      el('p', 'pow-cal-date', cal.date),
      el('p', 'pow-cal-time', cal.time),
      el('p', 'pow-cal-today', cal.today),
      el('h4', 'pow-h', S.calendar.ahead),
      ...cal.ahead.map((l) => el('p', 'pow-hint pow-cal-ahead', l)),
    );
    this.body.appendChild(this.sec('sys-calendar', S.calendar.heading, undefined, calBox));
    // Each group folds, and the fold is remembered.
    this.body.appendChild(this.sec('sys-settings', sys.settings, undefined, box));
    this.body.appendChild(
      this.sec('sys-save', S.title.sealLabel, undefined, createSeal(this.deps.trust())),
    );
    this.body.appendChild(
      this.sec(
        'sys-device',
        S.device.heading,
        undefined,
        createDeviceSection({ beforeUpdate: this.deps.beforeUpdate }),
      ),
    );
    this.body.appendChild(
      this.sec(
        'sys-backup',
        S.backup.heading,
        undefined,
        createBackupSection(this.root, this.deps.backup),
      ),
    );
    this.body.appendChild(this.sec('sys-help', S.help.heading, undefined, privacy));

    const out = el('div', 'pow-logout');
    const btn = el('button', 'pow-button pow-danger', sys.logOut);
    btn.type = 'button';
    btn.addEventListener('click', () => this.deps.onLogOut());
    put(out, btn, el('p', 'pow-hint', sys.logOutNote));
    const del = el('button', 'pow-button pow-danger', S.retire.button);
    del.type = 'button';
    del.dataset.key = 'delete-character';
    del.addEventListener('click', () => this.deps.onDeleteCharacter());
    put(out, del, el('p', 'pow-hint', S.retire.note));
    this.body.appendChild(this.sec('sys-account', sys.account, undefined, out));
  }
}
