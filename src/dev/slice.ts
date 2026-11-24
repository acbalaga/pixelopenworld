/**
 * Dev-only slice hooks for the Gate G1 playtest and the scripted e2e run: a control scheme toggle
 * on the HUD and a small read-only view of the run on `window.__pow`. Imported only behind
 * `import.meta.env.DEV`, so none of it reaches the production bundle (tools/check-dev-absent.ts).
 */

import './dev.css';
import type { ControlScheme, SettingsStore } from '../platform/settings';
import { spawnCreature } from '../sim/combat/enemy';
import type { Command } from '../sim/kernel/commands';
import { addItem, countItem, learnRecipe } from '../sim/items';
import { earnCoin, madeItems } from '../sim/ledger';
import { getComp, query, type EntityId } from '../sim/kernel/entities';
import { addXp, offerTrial, passTrial } from '../sim/skills';
import type { SimState } from '../sim/state';
import type { StatusId } from '../content/combat/statuses';
import { elementHitsWorld } from '../sim/elements';
import { applyStatus } from '../sim/statuses';
import { onlineCount } from '../sim/travelers/crowd';
import { travelerViews } from '../sim/travelers/entities';
import { learnTechnique } from '../sim/combat/techniques';

/** What the hooks need from the running scene. */
export interface SliceHookContext {
  state: SimState;
  who: EntityId;
  settings: SettingsStore;
  /** Queues a command for the next tick, the way the UI does. */
  command: (c: Command) => void;
  /** Posts a World chat line (dev screenshots). */
  say: (from: string, text: string) => void;
}

/** The view a test reads. Plain data, no live references. */
export interface PowSnapshot {
  scheme: ControlScheme;
  tick: number;
  requests: Record<string, { state: string; progress: number }>;
  coin: number;
  recipes: string[];
  held: Record<string, number>;
}

/** Test and playtest access. Dev builds only. */
export interface PowDevApi {
  snapshot(): PowSnapshot;
  /** Places a creature one tile from the avatar, in the direction it faces. */
  spawnFoeAhead(creatureId: string): void;
  /** Posts a line to the World chat as a named speaker, for screenshots of glyph lines. */
  say(from: string, text: string): void;
  /** The crowd (M5-04): who is online, who is an entity, and their handles. */
  crowd(): { online: number; entities: number; handles: string[] };
  /** Sends the nearest promoted Traveler to fight a creature set down beside it. Returns its handle. */
  travelerFight(creatureId: string): string | null;
  /** Puts items in the bag, as if gathered. */
  giveItem(item: string, qty: number, q?: 0 | 1 | 2 | 3, dur?: number): void;
  /** Pays XP to a skill, as if earned. For screenshots and checks of the Skills tab. */
  giveXp(skill: string, amount: number): void;
  /** Gives an item if the bag lacks it and wears it. For screenshots of weapons and shields. */
  wear(item: string): void;
  /** Makes every gathering node ready or spent, for screenshots. */
  nodes(what: 'ready' | 'spent'): void;
  /** Left or right handed layout, for screenshots of the controls. */
  leftHanded(on: boolean): void;
  /** Offers or passes a Trial, for screenshots and checks of the Trials log. */
  trial(id: string, what: 'offer' | 'pass'): void;
  /** Sets skill points and teaches taught techniques, as if earned. For screenshots of loadouts. */
  rank(skill: string, points: number): void;
  learn(technique: string): void;
  /** Teaches a recipe, as if learned. For checks of the station sheet. */
  learnRecipe(recipe: string): void;
  /** Credits a deed `n` times, as if done. For screenshots of Paths. */
  deed(id: string, n: number): void;
  /** Pays coin into the purse, as a seed (dev only). For screenshots of shops. */
  giveCoin(n: number): void;
  /** Puts statuses on the avatar, as if applied by a spell. For screenshots of the status row. */
  statuses(ids: string[]): void;
  /** An element hits the world at a tile, as a bolt would. For screenshots of the set pieces. */
  element(element: string, tx: number, ty: number): void;
  /** Sets every living creature's Health to a percent of its maximum. For screenshots of boss phases. */
  foeHp(pct: number): void;
}

const TILE = 16;
// Sim facing is N, E, S, W as 0, 2, 4, 6.
const AHEAD: Record<number, [number, number]> = { 0: [0, -1], 2: [1, 0], 4: [0, 1], 6: [-1, 0] };

/** Adds the scheme toggle button and `window.__pow`. */
export function installSliceHooks(ctx: SliceHookContext): void {
  const { state, who, settings, command } = ctx;

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'pow-dev-scheme';
  const label = (): void => {
    button.textContent = `Scheme: ${settings.get().controlScheme}`;
  };
  label();
  button.addEventListener('click', () => {
    settings.set({ controlScheme: settings.get().controlScheme === 'flow' ? 'classic' : 'flow' });
  });
  settings.subscribe(label);
  document.body.appendChild(button);

  const api: PowDevApi = {
    snapshot() {
      const inv = getComp(state.entities, who, 'inventory');
      const j = getComp(state.entities, who, 'journal');
      const held: Record<string, number> = {};
      if (inv) for (const s of inv.slots) if (s) held[s.item] = countItem(inv, s.item);
      return {
        scheme: settings.get().controlScheme,
        tick: state.tick,
        requests: { ...(j?.requests ?? {}) },
        coin: getComp(state.entities, who, 'avatar')?.coin ?? 0,
        recipes: [...(inv?.recipes ?? [])],
        held,
      };
    },
    giveItem(item, qty, q = 0, dur) {
      const inv = getComp(state.entities, who, 'inventory');
      if (!inv) return;
      addItem(inv, item, qty, q ? { q } : {});
      if (dur !== undefined)
        for (const s of inv.slots) if (s?.item === item && s.q === (q || undefined)) s.dur = dur;
      madeItems(state, 'seed', item, qty);
    },
    wear(item) {
      const inv = getComp(state.entities, who, 'inventory');
      if (!inv) return;
      if (!inv.slots.some((s) => s?.item === item)) addItem(inv, item, 1);
      command({ type: 'equip', slot: inv.slots.findIndex((s) => s?.item === item) });
    },
    nodes(what) {
      for (const n of state.entities.comps.node)
        if (n) n.readyAt = what === 'ready' ? 0 : state.worldTick + 1_000_000;
    },
    leftHanded(on) {
      settings.set({ handedness: on ? 'left' : 'right' });
    },
    trial(id, what) {
      if (what === 'offer') offerTrial(state, who, id);
      else {
        offerTrial(state, who, id);
        passTrial(state, who, id);
      }
    },
    rank(skill, points) {
      const s = getComp(state.entities, who, 'skills');
      if (s) s.points[skill] = points;
    },
    learnRecipe(recipe) {
      learnRecipe(state, who, recipe);
    },
    learn(technique) {
      learnTechnique(state, who, technique);
    },
    foeHp(pct) {
      for (const id of query(state.entities, 'fighter', 'pools')) {
        const f = getComp(state.entities, id, 'fighter');
        const p = getComp(state.entities, id, 'pools');
        if (f?.team === 1 && p) p.hp = Math.max(1, Math.round((p.hpMax * pct) / 100));
      }
    },
    deed(id, n) {
      const d = getComp(state.entities, who, 'deeds');
      if (d) d.counts[id] = (d.counts[id] ?? 0) + n;
    },
    giveCoin(n) {
      earnCoin(state, who, n, 'seed');
    },
    statuses(ids) {
      for (const id of ids) applyStatus(state, who, id as StatusId);
    },
    element(element, tx, ty) {
      elementHitsWorld(state, element, { x: tx * TILE + 8, y: ty * TILE + 8 });
    },
    giveXp(skill, amount) {
      addXp(state, who, skill, amount);
    },
    say(from, text) {
      ctx.say(from, text);
    },
    crowd() {
      const c = state.crowd;
      return {
        online: c ? onlineCount(c) : 0,
        entities: c ? c.ents.size : 0,
        handles: c ? travelerViews(state).map((v) => v.handle) : [],
      };
    },
    travelerFight(creatureId) {
      const c = state.crowd;
      const me = getComp(state.entities, who, 'pos');
      const view = c
        ? travelerViews(state).sort(
            (a, b) =>
              Math.hypot(a.x - (me?.x ?? 0) / 256, a.y - (me?.y ?? 0) / 256) -
              Math.hypot(b.x - (me?.x ?? 0) / 256, b.y - (me?.y ?? 0) / 256),
          )[0]
        : undefined;
      if (!c || !view) return null;
      const slot = view.slot;
      c.doing[slot] = {
        kind: 'fight',
        place: state.travelers[slot]!.place,
        left: 600,
        eta: 0,
        from: 0,
        total: 0,
        skill: -1,
        thing: creatureId,
      };
      spawnCreature(state, creatureId, Math.round(view.x) + 28, Math.round(view.y));
      return view.handle;
    },
    spawnFoeAhead(creatureId) {
      const pos = getComp(state.entities, who, 'pos');
      const facing = getComp(state.entities, who, 'avatar')?.facing ?? 4;
      if (!pos) return;
      const [dx, dy] = AHEAD[facing] ?? [0, 1];
      spawnCreature(
        state,
        creatureId,
        Math.round(pos.x / 256) + dx * TILE,
        Math.round(pos.y / 256) + dy * TILE,
      );
    },
  };
  (window as unknown as { __pow: PowDevApi }).__pow = api;
}
