import { ITEMS_BALANCE } from '../content/balance/items';
import { REQUEST_BALANCE } from '../content/balance/requests';
import { TIME } from '../content/balance/time';
import { REQUESTS } from '../content/requests';
import { ITEMS } from '../content/items';
import { TECHNIQUES, TECHNIQUE_LIST } from '../content/combat/techniques';
import { SKILLS } from '../content/skills';
import { RECIPES } from '../content/items/recipes';
import { createStream } from '../sim/kernel/rng';
import { intact } from './integrity/reasons';
import { newLedger } from '../sim/ledger';
import { addXpExact, xpToNext } from '../sim/skills';
import { countRevealed } from '../sim/world/fog';
import { MAP_BALANCE } from '../content/balance/map';
import { query } from '../sim/kernel/entities';
import { NO_FIGHT } from '../sim/fight';
import { dayIndex } from '../sim/time';
import { solutionMax } from '../sim/systems/requests';
import { newDeeds } from '../sim/systems/deeds';
import { newNpc } from '../sim/trade';
import { deserializeState, serializeState } from '../sim/state';
import { DEFAULT_ORIGIN } from '../content/world/origins';
import { normalizeDoll } from '../content/dolls/parts';
import { CURRENT_SCHEMA, type SavePlain } from './types';
import { deriveSummary } from '../shared/summary';
import { remapFromSlice } from './sliceRemap';

/**
 * Migrations, keyed by the schema they upgrade FROM. Each takes a save at schema N and returns
 * one at schema N + 1. They run in order until the save is current. Schema 1 is the first, so the
 * table started empty.
 *
 * To change saved state: bump CURRENT_SCHEMA, add `MIGRATIONS[oldSchema]`, commit a fixture of the
 * old schema under `tests/fixtures/saves/`, and extend `tests/unit/save.test.ts` with a case that
 * loads it. See `src/save/README.md`.
 */
export const MIGRATIONS: Record<number, (old: SavePlain) => SavePlain> = {
  /**
   * 1 to 2 (M1-10): the avatar gains a `handle`, and the journal gains `hints` and `hint`. An old
   * save keeps playing under the name "Traveler" with no hint ever shown, since it is not new.
   */
  1: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { avatar: unknown[]; journal: unknown[] } };
    };
    const patch = (list: unknown[], add: Record<string, unknown>): void => {
      list.forEach((c) => {
        if (c && typeof c === 'object') Object.assign(c, add);
      });
    };
    patch(raw.entities.comps.avatar, { handle: 'Traveler' });
    patch(raw.entities.comps.journal, { hints: HINT_IDS_V1, hint: null });
    return { ...old, schema: 2, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 2 to 3 (M2-01): the sim gains a `ledger` of lifetime totals, and the save carries a copy. A
   * save made before the ledger has no history, so the ledger starts from what the avatar holds
   * under the source `seed`: coin as earned, items as made, and the XP that its skill points and
   * banked XP add up to. That reconciles by construction, so honest saves are not flagged.
   */
  2: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: Record<string, unknown[]> };
    };
    const comps = raw.entities.comps;
    const who = (comps.avatar ?? []).findIndex((a) => a);
    const ledger = newLedger();
    if (who >= 0) {
      const avatar = comps.avatar?.[who] as { coin: number };
      if (avatar.coin > 0) ledger.coinEarned.seed = avatar.coin;
      const inv = comps.inventory?.[who] as
        | {
            slots: ({ item: string; qty: number } | null)[];
            equipment: Record<string, string | null>;
          }
        | undefined;
      const seeded: Record<string, number> = {};
      for (const st of inv?.slots ?? []) if (st) seeded[st.item] = (seeded[st.item] ?? 0) + st.qty;
      for (const item of Object.values(inv?.equipment ?? {}))
        if (item) seeded[item] = (seeded[item] ?? 0) + 1;
      if (Object.keys(seeded).length > 0) ledger.itemsMade.seed = seeded;
      const sk = comps.skills?.[who] as
        { points: Record<string, number>; xp: Record<string, number> } | undefined;
      for (const id of new Set([...Object.keys(sk?.points ?? {}), ...Object.keys(sk?.xp ?? {})])) {
        let total = sk?.xp[id] ?? 0;
        for (let i = 0; i < (sk?.points[id] ?? 0); i++) total += xpToNext(i);
        if (total > 0) ledger.xpEarned[id] = total;
      }
    }
    const state = deserializeState(JSON.stringify({ ...raw, ledger }));
    return { ...old, schema: 3, sim: serializeState(state), ledger };
  },
  /**
   * 3 to 4 (M2-02): the save records when it was first written and whether it is Intact or
   * Flagged. A save from before has no record of its start, so it is taken to have started
   * `playSeconds` before it was last written, which is the earliest an honest save could have.
   * Every save starts Intact here; the validator runs on load and flags it if it is not.
   */
  3: (old) => ({
    ...old,
    schema: 4,
    startedAt: old.createdAt - old.playSeconds * 1000,
    trust: intact(),
  }),
  /**
   * 4 to 5 (M2-04): the save carries a trusted-time record. The world clock counts from an epoch,
   * and an old save's epoch is picked so the time of day at its last write is what it was under
   * the tick clock, then runs in real time from there. Its trusted time starts at its last write,
   * with no offset and no offline accrual used.
   */
  4: (old) => {
    const tickMs = Math.floor(
      ((JSON.parse(old.sim) as { tick: number }).tick * 60_000) / TIME.ticksPerMinute,
    );
    return {
      ...old,
      schema: 5,
      time: {
        epoch: old.createdAt - tickMs,
        lastTrustedNow: old.createdAt,
        offset: 0,
        accrualUsedMs: 0,
      },
    };
  },
  /**
   * 5 to 6 (M3-02): Cooking pays on the `craft` event instead of `cook`, so its first-time keys
   * `<skill>:cook:<recipe>` become `<skill>:craft:<recipe>` and no bonus is paid twice. Skills
   * gain a `nightAcc` counter (Survival), which starts at 0.
   */
  5: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { skills: ({ seen: string[]; nightAcc?: number } | null)[] } };
    };
    for (const sk of raw.entities.comps.skills) {
      if (!sk) continue;
      sk.seen = sk.seen.map((k) => k.replace(/^([^:]+):cook:/, '$1:craft:'));
      sk.nightAcc = 0;
    }
    return { ...old, schema: 6, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 6 to 7 (M3-05): items become instances. Every worn item (a string until now) becomes a stack
   * with durability at its maximum, gear and tools in the bag gain full durability, the avatar
   * gets wear counters and an empty storage chest, and the ledger gains `masterworks` and
   * `marked`. Nothing is lost: the same items are held, in the same places.
   */
  6: (old) => {
    type Stack = { item: string; qty: number; dur?: number };
    const raw = JSON.parse(old.sim) as {
      entities: {
        capacity: number;
        comps: {
          inventory: ({
            slots: (Stack | null)[];
            equipment: Record<string, string | Stack | null>;
            wear?: unknown;
          } | null)[];
          storage?: ({ slots: null[] } | null)[];
        };
      };
      ledger?: Record<string, unknown>;
    };
    const full = (item: string): number | undefined => ITEMS[item]?.durability;
    const comps = raw.entities.comps;
    const storage: ({ slots: null[] } | null)[] = comps.inventory.map(() => null);
    comps.inventory.forEach((inv, i) => {
      if (!inv) return;
      for (const [slot, item] of Object.entries(inv.equipment)) {
        if (typeof item !== 'string') continue;
        const dur = full(item);
        inv.equipment[slot] = dur === undefined ? { item, qty: 1 } : { item, qty: 1, dur };
      }
      for (const s of inv.slots) {
        const dur = s ? full(s.item) : undefined;
        if (s && dur !== undefined && s.dur === undefined) s.dur = dur;
      }
      inv.wear = { hits: 0, taken: 0, uses: 0 };
      storage[i] = { slots: Array.from({ length: ITEMS_BALANCE.storage.slots }, () => null) };
    });
    comps.storage = storage;
    if (raw.ledger) Object.assign(raw.ledger, { masterworks: {}, marked: {} });
    return {
      ...old,
      schema: 7,
      sim: serializeState(deserializeState(JSON.stringify(raw))),
      ledger: { ...old.ledger, masterworks: {}, marked: {} },
    };
  },
  /**
   * 7 to 8 (M3-03): skills gain Trial progress and the fight record. A Trial that was already
   * offered (the Foraging Trial of M1) starts with no progress.
   */
  7: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: {
        comps: {
          skills: ({
            offered: string[];
            trial?: Record<string, unknown>;
            fight?: unknown;
          } | null)[];
        };
      };
    };
    for (const sk of raw.entities.comps.skills) {
      if (!sk) continue;
      sk.trial = Object.fromEntries(sk.offered.map((id) => [id, { n: 0, t0: 0 }]));
      sk.fight = { id: 0, last: NO_FIGHT };
    }
    return { ...old, schema: 8, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 8 to 9 (M3-04): every fighter gains a guard (down, no ticks) and a stood-still counter.
   */
  8: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: {
        comps: {
          fighter: ({ guard?: boolean; guardT?: number; still?: number } | null)[];
        };
      };
    };
    for (const f of raw.entities.comps.fighter) {
      if (!f) continue;
      f.guard = false;
      f.guardT = 0;
      f.still = 0;
    }
    return { ...old, schema: 9, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 9 to 10 (M3-06): a node's `readyAt` is now in world ticks, so every node starts ready (one
   * free respawn on upgrade is harmless). A gather in progress gains its sweep count, hits, the
   * tool slot (none) and the fishing wait (none).
   */
  9: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: {
        comps: {
          node: ({ readyAt: number } | null)[];
          gather: ({ swing?: number; hits?: number; tool?: number; wait?: number } | null)[];
        };
      };
    };
    for (const n of raw.entities.comps.node) if (n) n.readyAt = 0;
    for (const g of raw.entities.comps.gather) {
      if (!g) continue;
      g.swing = 0;
      g.hits = 0;
      g.tool = -1;
      g.wait = 0;
    }
    return { ...old, schema: 10, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 10 to 11 (M3-07): crafting gets its own RNG stream, seeded from the save's seed the way
   * `createStreams` does, and a `craft` component (no craft under way). A new avatar knows the
   * start recipes of every craft. An old avatar keeps what it knew and gains them too.
   */
  10: (old) => {
    const raw = JSON.parse(old.sim) as {
      seed: number;
      rng: Record<string, unknown>;
      entities: {
        comps: {
          pos: unknown[];
          craft?: unknown[];
          inventory: ({ recipes: string[] } | null)[];
        };
      };
    };
    raw.rng.craft = createStream(raw.seed, 'craft');
    raw.entities.comps.craft = raw.entities.comps.pos.map(() => null);
    const start = Object.values(RECIPES)
      .filter((r) => r.learn === 'start')
      .map((r) => r.id);
    for (const inv of raw.entities.comps.inventory)
      if (inv) for (const id of start) if (!inv.recipes.includes(id)) inv.recipes.push(id);
    return { ...old, schema: 11, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 11 to 12 (M3-09): statuses become a component on every unit. A live `fed` component turns
   * into a `fed` status with the same `until` and meal; the pool bonuses now come from the meal's
   * mods. A meal the build no longer knows is dropped. The steam `cloud` component starts empty.
   */
  11: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: {
        comps: {
          pos: unknown[];
          fed?: ({ item: string; until: number } | null)[];
          statuses?: unknown[];
          cloud?: unknown[];
        };
      };
    };
    const comps = raw.entities.comps;
    const fed = comps.fed ?? [];
    comps.statuses = comps.pos.map((_, i) => {
      const f = fed[i];
      return f && ITEMS[f.item]?.food?.fed
        ? [{ id: 'fed', until: f.until, src: -1, item: f.item }]
        : null;
    });
    comps.cloud = comps.pos.map(() => null);
    delete comps.fed;
    return { ...old, schema: 12, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 12 to 13 (M3-10): trade. A `trade` RNG stream seeded the way `createStreams` does, a
   * `haggle` component (none open), the ledger's `itemsSold` tally, and shop state on every
   * shopkeeper: a full shelf, no lost haggles, an empty buyback, and the save's own day as the
   * restock day (a shop restocks at the first dawn after it, from the world clock).
   */
  12: (old) => {
    const raw = JSON.parse(old.sim) as {
      seed: number;
      tick: number;
      rng: Record<string, unknown>;
      ledger?: Record<string, unknown>;
      entities: {
        comps: { pos: unknown[]; haggle?: unknown[]; npc: ({ id: string } | null)[] };
      };
    };
    raw.rng.trade = createStream(raw.seed, 'trade');
    raw.entities.comps.haggle = raw.entities.comps.pos.map(() => null);
    raw.entities.comps.npc = raw.entities.comps.npc.map((n) =>
      n ? { ...n, ...newNpc(n.id, dayIndex(raw.tick)), purse: (n as { purse?: number }).purse } : n,
    );
    if (raw.ledger) raw.ledger.itemsSold = {};
    return {
      ...old,
      schema: 13,
      sim: serializeState(deserializeState(JSON.stringify(raw))),
      ledger: { ...old.ledger, itemsSold: {} },
    };
  },
  /**
   * 13 to 14 (M3-13): loadouts and channels. Every avatar's current technique slots become
   * loadout 0, loadout 1 starts empty, no channel is running. A technique that was already in a
   * slot and needs teaching (Ember Bolt) is marked as learned, so it stays known.
   */
  13: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: {
        comps: {
          pos: unknown[];
          fighter: ({ slots: (string | null)[] } | null)[];
          avatar: unknown[];
          journal: ({ flags: string[] } | null)[];
          loadouts?: unknown[];
          channel?: unknown[];
        };
      };
    };
    const c = raw.entities.comps;
    c.channel = c.pos.map(() => null);
    c.loadouts = c.pos.map((_, i) => {
      const f = c.fighter[i];
      if (!f || !c.avatar[i]) return null;
      for (const id of f.slots) {
        const t = id ? TECHNIQUES[id] : undefined;
        const j = c.journal[i];
        if (t?.source === 'taught' && j && !j.flags.includes(`learned.${t.id}`))
          j.flags.push(`learned.${t.id}`);
      }
      return {
        active: 0,
        sets: [
          { main: null, off: null, slots: [...f.slots] },
          { main: null, off: null, slots: [null, null, null, null] },
        ],
      };
    });
    const sim = serializeState(deserializeState(JSON.stringify(raw)));
    // The learned flags count in the summary's flag total, so it is kept in step.
    const me = c.avatar.findIndex((a) => a);
    const flags = me >= 0 ? (c.journal[me]?.flags.length ?? 0) : 0;
    return {
      ...old,
      schema: 14,
      sim,
      ...(old.summary ? { summary: { ...old.summary, flags } } : {}),
    };
  },
  /**
   * 14 to 15 (M3-14): Crafting II adds start recipes (the first of Tailoring, Alchemy, Enchanting
   * and Tinkering). An avatar keeps every recipe it knew and gains them too.
   */
  14: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { inventory: ({ recipes: string[] } | null)[] } };
    };
    const start = Object.values(RECIPES)
      .filter((r) => r.learn === 'start')
      .map((r) => r.id);
    for (const inv of raw.entities.comps.inventory)
      if (inv) for (const id of start) if (!inv.recipes.includes(id)) inv.recipes.push(id);
    return { ...old, schema: 15, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 15 to 16 (M3-08): deeds and paths. Every avatar gets an empty record of deeds and no Paths,
   * as if it had just begun: nothing already done is counted, since nothing was recorded.
   */
  15: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: {
        comps: { pos: unknown[]; avatar: unknown[]; deeds?: unknown[]; paths?: unknown[] };
      };
    };
    const c = raw.entities.comps;
    c.deeds = c.pos.map((_, i) => (c.avatar[i] ? newDeeds() : null));
    c.paths = c.pos.map((_, i) => (c.avatar[i] ? { earned: [], worn: [], shown: null } : null));
    return { ...old, schema: 16, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 16 to 17 (M3-11): requests v2. Each request the avatar holds gets solutions and step
   * progress: an active one keeps its count in the step it was on, a ready or finished one has
   * every step done under its first solution. The journal gains Renown (what finished requests
   * and passed Trials were worth, as if it had been counted all along), no trade net, and no pin.
   * A `requests` RNG stream, a `board` component (none placed: the map adds the board), and the
   * ledger's `requestRewards` tally.
   */
  16: (old) => {
    type OldRec = { state: 'active' | 'ready' | 'done'; progress: number };
    const raw = JSON.parse(old.sim) as {
      seed: number;
      rng: Record<string, unknown>;
      ledger?: Record<string, unknown>;
      entities: {
        comps: {
          pos: unknown[];
          board?: unknown[];
          skills: ({ passed: string[] } | null)[];
          journal: ({ requests: Record<string, unknown>; [k: string]: unknown } | null)[];
        };
      };
    };
    raw.rng.requests = createStream(raw.seed, 'requests');
    const c = raw.entities.comps;
    c.board = c.pos.map(() => null);
    c.journal = c.journal.map((j, i) => {
      if (!j) return j;
      let renown = 0;
      const requests: Record<string, unknown> = {};
      for (const [id, r] of Object.entries(j.requests as Record<string, OldRec>)) {
        const def = REQUESTS[id];
        const sol = def?.solutions[0];
        if (!def || !sol) {
          requests[id] = { state: r.state, solution: null, prog: {}, progress: r.progress };
          continue;
        }
        const finished = r.state !== 'active';
        const prog: Record<string, unknown> = {};
        for (const s of def.solutions)
          prog[s.id] = {
            step: finished && s.id === sol.id ? s.steps.length : 0,
            p: { n: !finished && s.id === sol.id ? r.progress : 0, t0: 0 },
          };
        requests[id] = {
          state: r.state,
          solution: finished ? sol.id : null,
          prog,
          progress: finished ? solutionMax(def, sol.id) : r.progress,
        };
        if (r.state === 'done') renown += def.reward.renown;
      }
      renown += (c.skills[i]?.passed.length ?? 0) * REQUEST_BALANCE.renown.perTrial;
      return {
        ...j,
        requests,
        renown: renown > 0 ? { [REQUEST_BALANCE.homeRegion]: renown } : {},
        tradeCoin: {},
        pinned: null,
      };
    });
    if (raw.ledger) raw.ledger.requestRewards = {};
    return {
      ...old,
      schema: 17,
      sim: serializeState(deserializeState(JSON.stringify(raw))),
      ledger: { ...old.ledger, requestRewards: {} },
    };
  },
  /**
   * 17 to 18 (M4-14): the ledger records which starter kit the character began with. Every save
   * before this began with kit 1 (a rusty sword and two bread), so that is what it gets. The one
   * exception is a save whose `start` ledger already holds a kit 2 item (test states built from
   * current code; no real save can), which is kit 2. Claiming kit 2 gains nothing: kit 2 is the
   * smaller kit, and the check still rejects a rusty sword from `start`. The new `start` rng
   * stream joins, seeded as it would have been for a new character.
   */
  17: (old) => {
    const raw = JSON.parse(old.sim) as {
      seed: number;
      rng: Record<string, unknown>;
      ledger?: Record<string, unknown>;
    };
    const kit2 = Object.keys(old.ledger?.itemsMade?.start ?? {}).some(
      (i) => i === 'item.dagger_wood' || i === 'item.outfit_ragged',
    );
    const startKit = kit2 ? 2 : 1;
    if (raw.ledger) raw.ledger.startKit = startKit;
    raw.rng.start ??= createStream(raw.seed, 'start');
    return {
      ...old,
      schema: 18,
      sim: serializeState(deserializeState(JSON.stringify(raw))),
      ledger: { ...old.ledger, startKit },
    };
  },
  /**
   * 18 to 19 (M4-15): skills awaken and every technique has a source. `awake` is every skill with
   * points or XP. Every technique the old rule called known (its band reached, and taught if it
   * needed that) gets its `learned.<id>` flag so nothing is lost, and its skill awakens with it,
   * so a slotted technique stays valid. Insight starts empty. Nothing came from a manual.
   */
  18: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: {
        comps: {
          avatar: unknown[];
          skills: ({
            points: Record<string, number>;
            xp: Record<string, number>;
            awake?: string[];
            insight?: Record<string, number>;
          } | null)[];
          journal: ({ flags: string[]; learnedVia?: Record<string, string> } | null)[];
        };
      };
    };
    const c = raw.entities.comps;
    c.skills.forEach((sk, i) => {
      const j = c.journal[i];
      if (!sk || !j || !c.avatar[i]) return;
      const awake = new Set<string>();
      for (const id of Object.keys(SKILLS))
        if ((sk.points[id] ?? 0) > 0 || (sk.xp[id] ?? 0) > 0) awake.add(id);
      for (const t of TECHNIQUE_LIST) {
        const known =
          (sk.points[t.skill] ?? 0) >= t.band &&
          (t.source !== 'taught' || j.flags.includes(`learned.${t.id}`));
        if (!known) continue;
        awake.add(t.skill);
        if (t.band === 0 && !j.flags.includes(`learned.${t.id}`)) j.flags.push(`learned.${t.id}`);
      }
      sk.awake = [...awake].sort();
      sk.insight = {};
      j.learnedVia = {};
    });
    // The learned flags count in the summary's flag total, so it is kept in step.
    const me = c.avatar.findIndex((a) => a);
    const flags = c.journal[me]?.flags.length ?? 0;
    return {
      ...old,
      schema: 19,
      sim: serializeState(deserializeState(JSON.stringify(raw))),
      ...(old.summary ? { summary: { ...old.summary, flags } } : {}),
    };
  },
  /**
   * 19 to 20 (M4-19): the look gains height, eyes, brows, mouth, mark, facial hair, accessory and
   * the two own colors, each at its neutral entry so the character looks exactly as before. The
   * avatar gains an origin, `origin.unremembered`: it only ever narrowed where a new character
   * woke, and no old character chose one.
   */
  19: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { avatar: ({ origin?: string } | null)[] } };
    };
    for (const a of raw.entities.comps.avatar) if (a) a.origin = DEFAULT_ORIGIN;
    return {
      ...old,
      schema: 20,
      look: normalizeDoll(old.look),
      sim: serializeState(deserializeState(JSON.stringify(raw))),
    };
  },
  /**
   * 20 to 21 (M4-03): the sim gains `deltas`, what the player changed in each chunk. It starts
   * empty. Fixtures and nodes the old save holds stay as entities. The first streaming step adopts
   * them into the chunks they stand in, and folds them into deltas as those chunks leave the
   * window, so what the player did to the world (a chest opened, a tree felled, a block pushed)
   * is kept.
   */
  20: (old) => ({
    ...old,
    schema: 21,
    sim: serializeState(deserializeState(old.sim)),
  }),
  /**
   * 21 to 22 (M4-08): the entity store gains a `boss` component (none placed: bosses are spawned
   * with their dungeon). Fixtures gain an optional arena record and spawners an optional
   * `clearedDay`, both absent until used, so nothing else changes.
   */
  21: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { pos: unknown[]; boss?: unknown[] } };
    };
    const c = raw.entities.comps;
    c.boss = c.pos.map(() => null);
    return { ...old, schema: 22, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 22 to 23 (M4-04): the game boots into Dawnmeadow, so a save made on the slice map moves to the
   * equivalent place. See `sliceRemap.ts` for the rules. Map objects of the slice are removed (the
   * region places its own and streaming adds them), and the chunk deltas that described them go.
   */
  22: (old) => {
    const s = deserializeState(old.sim);
    remapFromSlice(s);
    return { ...old, schema: 23, sim: serializeState(s) };
  },
  /**
   * 23 to 24 (M4-06): the sim gains `map`, the fog, notes and rumors. A character begins with
   * nothing uncovered. The first steps in the world uncover the ground around the avatar, so the
   * map is never empty for long and nothing is invented for places the player has been.
   */
  23: (old) => ({
    ...old,
    schema: 24,
    sim: serializeState(deserializeState(old.sim)),
  }),
  /**
   * 24 to 25 (M4-07): the map state gains `waystones`, the stones the avatar has attuned. It
   * starts empty. A stone touched before this is attuned again by touching it (which is free), and
   * the respawn point the avatar already has is kept.
   */
  24: (old) => {
    const raw = JSON.parse(old.sim) as { map?: { waystones?: string[] } };
    if (raw.map) raw.map.waystones = [];
    return { ...old, schema: 25, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 25 to 26 (M4-20): the journal gains `singulars`, progress in the hidden questlines. It starts
   * empty: a character has touched none.
   */
  25: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { journal: ({ singulars?: unknown } | null)[] } };
    };
    for (const j of raw.entities.comps.journal) if (j) j.singulars = {};
    return { ...old, schema: 26, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 26 to 27 (M4-05): the journal gains `bestiary`, what the avatar has learned of each creature.
   * It starts empty. Kills are read from the ledger, so a character who has already killed things
   * finds those entries open.
   */
  26: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { journal: ({ bestiary?: unknown } | null)[] } };
    };
    for (const j of raw.entities.comps.journal) if (j) j.bestiary = {};
    return { ...old, schema: 27, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 27 to 28 (M4-23 part A): walking never paid Cartography, because the map ran after the skills
   * system and its `revealed` event was cleared unread. Pay what the fog already shows: every
   * revealed block at `xpPerBlock`, less any Cartography XP the ledger records, never below 0.
   * The grant goes through the sim's XP path (the skill awakens, XP banks at a pending Trial,
   * the ledger records it) without the Rested bonus, so it is exact.
   */
  27: (old) => {
    const s = deserializeState(old.sim);
    let blocks = 0;
    for (const fog of Object.values(s.map.fog)) blocks += countRevealed(fog);
    const owed = blocks * MAP_BALANCE.xpPerBlock - (s.ledger.xpEarned['skill.cartography'] ?? 0);
    if (owed > 0)
      for (const who of query(s.entities, 'avatar', 'skills'))
        addXpExact(s, who, 'skill.cartography', owed);
    const sim = serializeState(s);
    return {
      ...old,
      schema: 28,
      sim,
      summary: deriveSummary(s, old.playSeconds),
      ledger: structuredClone(s.ledger),
    };
  },
  /**
   * 28 to 29 (M4-23 part C): Skills gain `camp`, the camping accumulator, the minutes each camp
   * has paid today and the last sleep that paid (Survival). It starts empty: nothing is owed and
   * nothing has been paid.
   */
  28: (old) => {
    const raw = JSON.parse(old.sim) as {
      entities: { comps: { skills: ({ camp?: unknown } | null)[] } };
    };
    for (const sk of raw.entities.comps.skills)
      if (sk) sk.camp = { at: null, acc: 0, used: {}, sleepHour: -1 };
    return { ...old, schema: 29, sim: serializeState(deserializeState(JSON.stringify(raw))) };
  },
  /**
   * 29 to 30 (M5-02): the sim gains `travelers`, the lives of the 240 Travelers. A save made
   * before has none, so each starts as a fresh generation from the save's world seed (the
   * identities are derived from the same seed and are never saved). The summary gains the Traveler
   * totals, so it is recomputed.
   */
  29: (old) => {
    const s = deserializeState(old.sim);
    return {
      ...old,
      schema: 30,
      sim: serializeState(s),
      summary: deriveSummary(s, old.playSeconds),
    };
  },
};

/** Every hint that existed in schema 2, marked as seen for a save made before hints existed. */
const HINT_IDS_V1: string[] = [
  'hint.move',
  'hint.lock',
  'hint.dodge',
  'hint.technique',
  'hint.gather',
  'hint.cook',
  'hint.menu',
];

/** Brings a save up to the current schema. Throws for a save from the future or a missing step. */
export function migrate(
  plain: SavePlain,
  table: Record<number, (old: SavePlain) => SavePlain> = MIGRATIONS,
  target: number = CURRENT_SCHEMA,
): SavePlain {
  if (plain.schema > target) throw new Error(`save schema ${plain.schema} is newer than ${target}`);
  let cur = plain;
  while (cur.schema < target) {
    const step = table[cur.schema];
    if (!step) throw new Error(`no migration from schema ${cur.schema}`);
    const next = step(cur);
    if (next.schema !== cur.schema + 1)
      throw new Error(`migration from ${cur.schema} produced schema ${next.schema}`);
    cur = next;
  }
  return cur;
}
