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
import { PLACE_SPOTS } from '../content/people/placeSpots';
import { CREATURES } from '../content/creatures';
import { onlineCount, routeMinutes } from '../sim/travelers/crowd';
import { dayIndexOf, localMinute } from '../sim/travelers/schedule';
import { deliver } from '../sim/mail';
import { makeFriends, remember } from '../sim/travelers/social';
import { travelerViews } from '../sim/travelers/entities';
import { learnTechnique } from '../sim/combat/techniques';
import { identitiesOf } from '../sim/travelers/generate';
import { travelerListings } from '../sim/party';
import { startBout } from '../sim/pitBouts';
import { addFlag } from '../sim/travelers/pit';
import { PIT } from '../content/balance/travelers';
import { PLACE_LIST, placeIdx } from '../sim/travelers/lists';

/** What the hooks need from the running scene. */
const CAMP_FIRE = PLACE_SPOTS['wayside.river_camp']!.focus!;

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
  /** Dev only: opens the Pit, sends ten online Travelers there, and starts a bout once two are near (M5-30). */
  stagePit(): number;
  /** Dev only: puts the player in a guild, as if they had joined (M5-08). */
  joinGuild(id: number): void;
  /** The party (M5-07): member handles, and the listings on the finder. */
  party(): { members: string[]; listings: number };
  /** Places a creature one tile from the avatar, in the direction it faces. */
  spawnFoeAhead(creatureId: string): void;
  /** Posts a line to the World chat as a named speaker, for screenshots of glyph lines. */
  say(from: string, text: string): void;
  /** The crowd (M5-04): who is online, who is an entity, and their handles. */
  crowd(): {
    online: number;
    entities: number;
    handles: string[];
    atCamp: number;
    scenes: string[];
    asleep: number;
  };
  /** Makes the nearest promoted Traveler a friend, with a memory of a fight, for screenshots (M5-06). Returns the handle. */
  befriend(): string | null;
  /** Puts two letters in the mailbox, a note and a gift, from the nearest promoted Traveler, for screenshots (M5-12). */
  deliverLetters(): string | null;
  /** Gives the nearest promoted Traveler a memory of the player and enough regard to ask to be friends. Returns the handle (M5-06). */
  primeRequest(): string | null;
  /**
   * Sends up to `n` online Travelers, the closest by route first, to spend a social stretch at a
   * place (a camp, the inn, the guard yard). They walk there and the sim takes it from there: the
   * camp, scene planner and dice are untouched. `maxRank` keeps only Travelers whose top skill is
   * under that rank. For e2e specs that need people somewhere, not luck. Returns their handles.
   */
  sendTo(place: string, n: number, maxRank?: number): string[];
  /** Puts the nearest promoted Traveler to sleep, AFK past the threshold, and makes them a friend so the card is reachable. Returns the handle (M5-31). */
  putToSleep(): string | null;
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
        // Scenes in progress (M5-27): wish, dance, dummy.
        asleep: c ? travelerViews(state).filter((v) => v.asleep).length : 0,
        scenes: c ? [...c.ents.values()].flatMap((e) => (e.scene ? [e.scene.kind] : [])) : [],
        // Travelers seated or asleep within 3 tiles of the river camp's bedroll (POW-M5-26).
        atCamp: c
          ? travelerViews(state).filter(
              (v) =>
                (v.mode === 'sit' || v.mode === 'afk') &&
                Math.hypot(v.x - (CAMP_FIRE[0] * 16 + 8), v.y - (CAMP_FIRE[1] * 16 + 8)) < 48,
            ).length
          : 0,
      };
    },
    deliverLetters() {
      const c = state.crowd;
      const me = getComp(state.entities, who, 'pos');
      const view = c
        ? travelerViews(state).sort(
            (a, b) =>
              Math.hypot(a.x - (me?.x ?? 0) / 256, a.y - (me?.y ?? 0) / 256) -
              Math.hypot(b.x - (me?.x ?? 0) / 256, b.y - (me?.y ?? 0) / 256),
          )[0]
        : undefined;
      if (!c || !view || !state.clock) return null;
      const day = dayIndexOf(localMinute(state.clock.nowMs, state.clock.tzOffsetMin));
      const base = { slot: view.slot, day, subject: 0, item: '', qty: 0, coin: 0 };
      deliver(state, { ...base, tpl: 'letter.news.n01' });
      deliver(state, { ...base, tpl: 'letter.gift.coin.n01', coin: 25 });
      return view.handle;
    },
    sendTo(place, n, maxRank) {
      const c = state.crowd;
      const to = placeIdx(place);
      if (!c || to < 0) return [];
      const ids = identitiesOf(state.seed);
      const top = (slot: number): number => {
        let t = 0;
        for (const [, p] of state.travelers[slot]!.build) t = Math.max(t, p);
        return t;
      };
      const picks = ids
        .filter((t) => c.online[t.slot] === 1)
        .filter((t) => maxRank === undefined || top(t.slot) < maxRank)
        .map((t) => ({ t, eta: routeMinutes(state.travelers[t.slot]!.place, to) }))
        .sort((a, b) => a.eta - b.eta)
        .slice(0, n);
      for (const { t, eta } of picks) {
        const from = state.travelers[t.slot]!.place;
        c.doing[t.slot] = {
          kind: 'social',
          place: to,
          left: 240,
          eta,
          from,
          total: eta,
          skill: -1,
          thing: '',
        };
      }
      return picks.map((p) => p.t.handle);
    },
    primeRequest() {
      const c = state.crowd;
      const me = getComp(state.entities, who, 'pos');
      const view = c
        ? travelerViews(state).sort(
            (a, b) =>
              Math.hypot(a.x - (me?.x ?? 0) / 256, a.y - (me?.y ?? 0) / 256) -
              Math.hypot(b.x - (me?.x ?? 0) / 256, b.y - (me?.y ?? 0) / 256),
          )[0]
        : undefined;
      if (!c || !view || !state.clock) return null;
      const life = state.travelers[view.slot]!;
      const now = localMinute(state.clock.nowMs, state.clock.tzOffsetMin);
      remember(
        life,
        'foughtNear',
        Object.keys(CREATURES).indexOf('creature.mossling'),
        dayIndexOf(now),
        now,
      );
      life.regardPts = 40;
      life.regardTier = 2;
      life.lastSeen = now;
      return view.handle;
    },
    putToSleep() {
      const c = state.crowd;
      const me = getComp(state.entities, who, 'pos');
      const view = c
        ? travelerViews(state).sort(
            (a, b) =>
              Math.hypot(a.x - (me?.x ?? 0) / 256, a.y - (me?.y ?? 0) / 256) -
              Math.hypot(b.x - (me?.x ?? 0) / 256, b.y - (me?.y ?? 0) / 256),
          )[0]
        : undefined;
      if (!c || !view || !state.clock) return null;
      const ent = c.ents.get(c.entOf[view.slot] ?? -1);
      if (!ent) return null;
      c.doing[view.slot] = {
        kind: 'afk',
        place: state.travelers[view.slot]!.place,
        left: 900,
        eta: 0,
        from: 0,
        total: 0,
        skill: -1,
        thing: '',
      };
      ent.lastDoing = c.doing[view.slot]!;
      ent.still = 9999;
      ent.afkFor = 9999;
      ent.woke = false;
      makeFriends(
        state.travelers[view.slot]!,
        localMinute(state.clock.nowMs, state.clock.tzOffsetMin),
      );
      return view.handle;
    },
    befriend() {
      const c = state.crowd;
      const me = getComp(state.entities, who, 'pos');
      const view = c
        ? travelerViews(state).sort(
            (a, b) =>
              Math.hypot(a.x - (me?.x ?? 0) / 256, a.y - (me?.y ?? 0) / 256) -
              Math.hypot(b.x - (me?.x ?? 0) / 256, b.y - (me?.y ?? 0) / 256),
          )[0]
        : undefined;
      if (!c || !view || !state.clock) return null;
      const life = state.travelers[view.slot]!;
      const now = localMinute(state.clock.nowMs, state.clock.tzOffsetMin);
      remember(
        life,
        'foughtNear',
        Object.keys(CREATURES).indexOf('creature.mossling'),
        dayIndexOf(now),
        now,
      );
      makeFriends(life, now);
      return view.handle;
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
    stagePit() {
      const c = state.crowd;
      if (!c) return 0;
      addFlag(state, PIT.flags.open);
      const idx = PLACE_LIST.indexOf(PIT.place);
      const ten: number[] = [];
      for (let slot = 0; slot < 240 && ten.length < 10; slot++) if (c.online[slot]) ten.push(slot);
      for (const slot of ten) {
        c.doing[slot] = {
          kind: 'social',
          place: idx,
          left: 1e6,
          eta: 0,
          from: idx,
          total: 0,
          skill: -1,
          thing: '',
        };
        state.travelers[slot]!.place = idx;
        state.travelers[slot]!.guild = PIT.guilds[0]!;
      }
      const near = ten.filter((slot) => (c.entOf[slot] ?? -1) >= 0);
      if (near.length >= 2 && !state.pitBouts?.bout) startBout(state, near[0]!, near[1]!);
      return near.length;
    },
    joinGuild(id) {
      state.guild = { id, stashes: state.guild.stashes, week: -1, progress: [], paid: [] };
    },
    party() {
      const ids = identitiesOf(state.seed);
      return {
        members: (state.party?.members ?? []).map((m) => ids[m.slot]?.handle ?? ''),
        listings: travelerListings(state).length,
      };
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
