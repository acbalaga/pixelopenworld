import { describe, expect, it } from 'vitest';
import { PATHS_BALANCE as B } from '../../src/content/balance/paths';
import { COMBAT as CB } from '../../src/content/balance/combat';
import { TIME } from '../../src/content/balance/time';
import { DEEDS, DEED_LIST } from '../../src/content/paths/deeds';
import { PATH_LIST, PATHS } from '../../src/content/paths';
import { PATH_STRINGS } from '../../src/content/strings/paths';
import { DIALOGUE_STRINGS } from '../../src/content/strings/dialogue';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnCreature, spawnEnemy } from '../../src/sim/combat/enemy';
import { blockCost, dealDamage } from '../../src/sim/combat/fighter';
import { fireTechnique, assign } from '../../src/sim/combat/techniques';
import { repair } from '../../src/sim/crafting';
import { addItem, eat, give, useTool } from '../../src/sim/items';
import { holds } from '../../src/sim/journal';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { activeMods, applyMods, statusMods } from '../../src/sim/mods';
import { createDemoState, type SimState } from '../../src/sim/state';
import { applyStatus } from '../../src/sim/statuses';
import { stepWorld } from '../../src/sim/step';
import {
  addressOf,
  deedsSystem,
  pathsSystem,
  deedValue,
  wearPath,
} from '../../src/sim/systems/deeds';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { payable, tradeSystem, buy } from '../../src/sim/trade';

const OPEN = { solidAt: (): number => 0 };
const DAY = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;

interface Rig {
  s: SimState;
  me: number;
  events: SimEvent[];
  tick: (...cmds: Command[]) => void;
  run: (n: number, ...cmds: Command[]) => void;
}
function rig(): Rig {
  const s = createDemoState(7, 0);
  s.world = OPEN;
  const me = createAvatar(s, feetAt(20, 20).x, feetAt(20, 20).y);
  const events: SimEvent[] = [];
  const tick = (...cmds: Command[]): void => {
    stepWorld(s, me, { commands: cmds });
    events.push(...s.events.list);
  };
  const run = (n: number, ...cmds: Command[]): void => {
    for (let i = 0; i < n; i++) tick(...(i === 0 ? cmds : []));
  };
  tick({ type: 'scheme', scheme: 'classic' });
  events.length = 0;
  return { s, me, events, tick, run };
}
const comps = (r: Rig) => ({
  paths: r.s.entities.comps.paths[r.me]!,
  deeds: r.s.entities.comps.deeds[r.me]!,
  skills: r.s.entities.comps.skills[r.me]!,
});
const ofType = <T extends SimEvent['type']>(evs: SimEvent[], t: T) =>
  evs.filter((e): e is Extract<SimEvent, { type: T }> => e.type === t);

/** An event the way a deed's matcher wants it, made by the avatar. `n` makes `distinct` values differ. */
function eventFor(r: Rig, id: string, n: number): SimEvent[] {
  const def = DEEDS[id]!;
  const ms = Array.isArray(def.on) ? def.on : [def.on];
  const m = ms[0]!;
  const base: Record<string, unknown> = { type: m.type, [m.by]: r.me, ...(m.is ?? {}) };
  if (m.type === 'statusApplied')
    Object.assign(base, { id: r.me + 1, src: r.me, refreshed: false });
  if (def.field === 'amount') base.amount = 500;
  if (def.field === 'recipe') base.recipe = `recipe.cooked_${n}`;
  if (m.type === 'killed')
    Object.assign(base, { dst: 99, kind: base.kind ?? 'creature.x', tag: base.tag ?? 'blades' });
  if (m.type === 'sold') Object.assign(base, { item: 'item.moss_tuft', qty: 1, coin: 1 });
  if (m.type === 'eaten') Object.assign(base, { item: 'item.berry_red' });
  return [base as unknown as SimEvent];
}

/** Feeds a deed's events and runs the deed and Path systems, as the end of a tick would. */
function feed(r: Rig, id: string, times: number): void {
  for (let i = 0; i < times; i++) {
    r.s.events.list.length = 0;
    r.s.events.list.push(...eventFor(r, id, i));
    deedsSystem(r.s);
  }
  r.s.events.list.length = 0;
  pathsSystem(r.s);
  r.events.push(...r.s.events.list);
}

/** Earns a Path the way the design says: the skill points and every deed, nothing else. */
function earn(r: Rig, id: string): void {
  const p = PATHS[id]!;
  for (const [sk, n] of Object.entries(p.requires.skills ?? {})) comps(r).skills.points[sk] = n;
  r.s.worldTick = DAY * 10;
  for (const [d, n] of Object.entries(p.requires.deeds ?? {})) feed(r, d, n);
  pathsSystem(r.s);
}

describe('the 16 Paths', () => {
  it('are eight opposite pairs that point back, with titles of at most 16 characters and two hidden', () => {
    expect(PATH_LIST).toHaveLength(16);
    expect(PATH_LIST.filter((p) => p.hidden)).toHaveLength(2);
    for (const p of PATH_LIST) {
      expect(PATHS[p.opposite]?.opposite, p.id).toBe(p.id);
      expect(p.opposite).not.toBe(p.id);
      const title = PATH_STRINGS[p.titleKey]!;
      expect(title.length, p.id).toBeLessThanOrEqual(16);
      expect(title).not.toContain('—');
      for (const k of [p.nameKey, p.giftKey, p.addressKey]) expect(PATH_STRINGS[k], k).toBeTruthy();
      if (!p.hidden) expect(PATH_STRINGS[p.hintKey], p.id).toBeTruthy();
      expect(p.gift.length).toBeGreaterThan(0);
      for (const id of Object.keys(p.requires.deeds ?? {})) expect(DEEDS[id], id).toBeDefined();
    }
  });

  it.each(PATH_LIST.map((p) => p.id))('%s is earned by its requirements, and not before', (id) => {
    const r = rig();
    const p = PATHS[id]!;
    // One short of every requirement: nothing.
    for (const [sk, n] of Object.entries(p.requires.skills ?? {}))
      comps(r).skills.points[sk] = n - 1;
    r.s.worldTick = DAY * 10;
    for (const [d, n] of Object.entries(p.requires.deeds ?? {})) feed(r, d, n - 1);
    pathsSystem(r.s);
    expect(comps(r).paths.earned).not.toContain(id);
    // The whole set: earned, banner sent, worn at once, title shown.
    earn(r, id);
    expect(comps(r).paths.earned).toContain(id);
    expect(ofType(r.events, 'pathEarned').some((e) => e.path === id)).toBe(true);
    expect(comps(r).paths.worn).toContain(id);
  });

  it('Mossfriend needs three quiet days: a Mossling kill starts the count over', () => {
    const r = rig();
    r.s.worldTick = DAY * 10;
    comps(r).deeds.resetAt['deed.mossling_meets'] = r.s.worldTick - DAY * 2;
    feed(r, 'deed.mossling_meets', B.mossfriend.meets);
    expect(comps(r).paths.earned).not.toContain('path.mossfriend');
    comps(r).deeds.resetAt['deed.mossling_meets'] = r.s.worldTick - DAY * 3;
    pathsSystem(r.s);
    expect(comps(r).paths.earned).toContain('path.mossfriend');
    // A kill of a Mossling zeroes it.
    r.s.events.list.push({
      type: 'killed',
      src: r.me,
      dst: 5,
      kind: 'creature.mossling',
      tag: 'blades',
    });
    deedsSystem(r.s);
    expect(comps(r).deeds.counts['deed.mossling_meets']).toBe(0);
    expect(comps(r).deeds.resetAt['deed.mossling_meets']).toBe(r.s.worldTick);
  });

  it('only the avatar counts: an event by anyone else does nothing', () => {
    const r = rig();
    r.s.events.list.push({ type: 'parried', who: r.me + 7, src: 1 });
    deedsSystem(r.s);
    expect(deedValue(comps(r).deeds, 'deed.parries')).toBe(0);
  });
});

describe('deeds come from what the avatar really does', () => {
  it('a kill with a sword counts as a one-handed kill and a Mossling kill, and sums, distinct and counts work', () => {
    const r = rig();
    const p = r.s.entities.comps.pos[r.me]!;
    const foe = spawnEnemy(
      r.s,
      'creature.mossling',
      Math.round(p.x / 256) + 14,
      Math.round(p.y / 256),
    );
    r.s.entities.comps.pools[foe]!.hp = 1;
    r.run(2, { type: 'move', dir: 2 });
    r.run(3, { type: 'move', dir: null });
    r.run(30, { type: 'attack' });
    expect(ofType(r.events, 'killed')).toHaveLength(1);
    expect(comps(r).deeds.counts['deed.kills_onehand']).toBe(1);
    expect(comps(r).deeds.counts['deed.mossling_kills']).toBe(1);
    expect(DEED_LIST.map((d) => d.kind).sort()).toContain('distinct');
  });

  it('a Mossling that comes within 3 tiles is met once per approach', () => {
    const r = rig();
    const p = r.s.entities.comps.pos[r.me]!;
    const foe = spawnCreature(
      r.s,
      'creature.mossling',
      Math.round(p.x / 256) + 200,
      Math.round(p.y / 256),
    );
    r.run(3);
    expect(comps(r).deeds.counts['deed.mossling_meets'] ?? 0).toBe(0);
    r.s.entities.comps.pos[foe]!.x = p.x + 30 * 256;
    r.s.entities.comps.ai[foe]!.state = 'idle';
    r.run(2);
    r.run(20);
    expect(comps(r).deeds.counts['deed.mossling_meets']).toBe(1);
    // Moving it away and back is a second meeting.
    r.s.entities.comps.pos[foe]!.x = p.x + 400 * 256;
    r.run(3);
    r.s.entities.comps.pos[foe]!.x = p.x + 30 * 256;
    r.run(3);
    expect(comps(r).deeds.counts['deed.mossling_meets']).toBe(2);
  });

  it('a fight won without being hurt is an untouched fight, and a fight in which you were hit is not', () => {
    const r = rig();
    const sk = comps(r).skills;
    // A won fight with a kill, nothing taken: ends after the quiet spell.
    sk.fight = { id: 1, last: r.s.tick };
    r.s.entities.comps.pools[r.me]!.lastCombat = r.s.tick;
    r.run(2);
    comps(r).deeds.fight.kills = 1;
    r.run(CB.pools.hpRegenDelay + 5);
    expect(comps(r).deeds.counts['deed.untouched_fights']).toBe(1);
    // The same, but a hit landed on the avatar during it.
    sk.fight = { id: 2, last: r.s.tick };
    r.run(2);
    comps(r).deeds.fight.kills = 1;
    comps(r).deeds.fight.hurt = true;
    r.run(CB.pools.hpRegenDelay + 5);
    expect(comps(r).deeds.counts['deed.untouched_fights']).toBe(1);
  });

  it('the deed counts that mirror the ledger ride along with it in a real session', () => {
    const r = rig();
    r.s.events.list.push({
      type: 'crafted',
      id: r.me,
      tag: 'cooking',
      recipe: 'recipe.herb_tea',
      tier: 1,
      item: 'item.herb_tea',
      qty: 1,
      quality: 0,
      source: 'manual',
    });
    r.s.events.list.push({
      type: 'crafted',
      id: r.me,
      tag: 'cooking',
      recipe: 'recipe.herb_tea',
      tier: 1,
      item: 'item.herb_tea',
      qty: 1,
      quality: 0,
      source: 'manual',
    });
    deedsSystem(r.s);
    expect(comps(r).deeds.counts['deed.dishes']).toBe(2);
    expect(deedValue(comps(r).deeds, 'deed.dish_recipes')).toBe(1);
  });
});

describe('gifts apply only while the Path is worn', () => {
  /** Earns `id`, then runs `probe` while worn, while earned but taken off, and before it was earned. */
  function threeStates(
    id: string,
    probe: (r: Rig) => number,
  ): { worn: number; off: number; none: number } {
    const none = probe(rig());
    const r = rig();
    earn(r, id);
    expect(comps(r).paths.worn).toContain(id);
    const worn = probe(r);
    // Earned but taken off, on a fresh avatar so nothing from the first probe is left over.
    const q = rig();
    earn(q, id);
    comps(q).paths.worn = [];
    comps(q).paths.shown = null;
    const off = probe(q);
    return { worn, off, none };
  }

  it('critPct: Duelist adds 5 points', () => {
    const t = threeStates('path.duelist', (r) =>
      activeMods(r.s, r.me)
        .filter((m) => m.stat === 'critPct')
        .reduce((n, m) => n + (m.add ?? 0), 0),
    );
    expect(t).toEqual({ worn: 5, off: 0, none: 0 });
  });
  it('blockStaPct: Bulwark makes a block cost 30 percent less', () => {
    const t = threeStates('path.bulwark', (r) => blockCost(r.s, r.me));
    expect(t.worn).toBe(Math.floor(CB.guard.cost * 0.7));
    expect(t.off).toBe(CB.guard.cost);
    expect(t.none).toBe(CB.guard.cost);
  });
  it('emberFocPct: Emberhand makes Ember techniques cost less Focus', () => {
    const cost = (r: Rig): number => {
      comps(r).skills.points['skill.ember'] = Math.max(
        comps(r).skills.points['skill.ember'] ?? 0,
        0,
      );
      r.s.entities.comps.journal[r.me]!.flags.push('learned.technique.ember_bolt');
      assign(r.s, r.me, 1, 'technique.ember_bolt');
      const p = r.s.entities.comps.pools[r.me]!;
      p.foc = p.focMax;
      fireTechnique(r.s, r.me, 1, null);
      return p.focMax - p.foc;
    };
    const t = threeStates('path.emberhand', cost);
    expect(t.none).toBe(300);
    expect(t.worn).toBe(Math.floor(300 * 0.85));
    expect(t.off).toBe(300);
  });
  it('wetTicksPct: Tidecaller makes Wet last longer on others, not on yourself', () => {
    const wet = (r: Rig): number => {
      const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
      applyStatus(r.s, foe, 'wet', r.me);
      return r.s.entities.comps.statuses[foe]!.find((s) => s.id === 'wet')!.until - r.s.tick;
    };
    const t = threeStates('path.tidecaller', wet);
    expect(t.worn).toBe(Math.floor(t.none * 1.5));
    expect(t.off).toBe(t.none);
  });
  it('gatherYield: Forager adds one on a sweet hit at foraging nodes only', () => {
    const t = threeStates('path.forager', (r) => {
      const mods = activeMods(r.s, r.me);
      return (
        applyMods(0, 'gatherYield', mods, 'foraging') * 10 +
        applyMods(0, 'gatherYield', mods, 'mining')
      );
    });
    expect(t).toEqual({ worn: 10, off: 0, none: 0 });
  });
  it('durabilityLossPct: Prospector halves tool wear on veins only', () => {
    const wear =
      (tag: string) =>
      (r: Rig): number => {
        const inv = r.s.entities.comps.inventory[r.me]!;
        give(r.s, r.me, 'item.pick_copper', 1, 'seed');
        const slot = inv.slots.findIndex((x) => x?.item === 'item.pick_copper');
        let used = 0;
        while (!useTool(r.s, r.me, slot, tag) && used < 100) used++;
        return used + 1;
      };
    const t = threeStates('path.prospector', wear('mining'));
    expect(t.worn).toBe(t.none * 2);
    expect(t.off).toBe(t.none);
    const other = threeStates('path.prospector', wear('logging'));
    expect(other.worn).toBe(other.none);
  });
  it('repairMaterialFree: Anvil Hand repairs with no material', () => {
    // The rusty sword is worn, so put one in the bag to mend.
    const t = threeStates('path.anvil_hand', (r) => {
      give(r.s, r.me, 'item.sword_bronze', 1, 'seed');
      const inv = r.s.entities.comps.inventory[r.me]!;
      const i = inv.slots.findIndex((x) => x?.item === 'item.sword_bronze');
      inv.slots[i]!.dur = 1;
      spawnFixture(r.s, 'fixture.anvil', 20, 21);
      r.run(1, { type: 'move', dir: 4 });
      r.run(3, { type: 'move', dir: null });
      give(r.s, r.me, 'item.copper_ingot', 1, 'seed');
      const before = inv.slots.reduce(
        (n, x) => n + (x?.item === 'item.copper_ingot' ? x.qty : 0),
        0,
      );
      repair(r.s, r.me, i);
      const after = inv.slots.reduce(
        (n, x) => n + (x?.item === 'item.copper_ingot' ? x.qty : 0),
        0,
      );
      return before - after;
    });
    expect(t).toEqual({ worn: 0, off: 1, none: 1 });
  });
  it('dodgeRecoverTicks: Quick Needle ends a dodge 2 ticks sooner only in armor you made', () => {
    const t = threeStates('path.quick_needle', (r) => {
      const inv = r.s.entities.comps.inventory[r.me]!;
      give(r.s, r.me, 'item.cap_wool', 1, 'craft', { mark: 1 });
      const i = inv.slots.findIndex((x) => x?.item === 'item.cap_wool');
      inv.equipment.head = { ...inv.slots[i]!, qty: 1 };
      r.run(1, { type: 'dodge', dir: 2 });
      let n = 0;
      while (r.s.entities.comps.fighter[r.me]!.state === 'dodge' && n < 40) {
        r.run(1);
        n++;
      }
      return n;
    });
    expect(t.worn).toBe(t.none - 2);
    expect(t.off).toBe(t.none);
    // Armor bought rather than made does not help.
    const r = rig();
    earn(r, 'path.quick_needle');
    r.s.entities.comps.inventory[r.me]!.equipment.head = { item: 'item.cap_wool', qty: 1, dur: 40 };
    r.run(1, { type: 'dodge', dir: 2 });
    let n = 0;
    while (r.s.entities.comps.fighter[r.me]!.state === 'dodge' && n < 40) {
      r.run(1);
      n++;
    }
    expect(n).toBe(t.none);
  });
  it('fedTicksPct and rawFoodPct: Hearth Cook lengthens Fed, Wild Eater doubles raw forage', () => {
    const fed = (r: Rig): number => {
      addItem(r.s.entities.comps.inventory[r.me]!, 'item.hearty_stew', 1);
      const slot = r.s.entities.comps.inventory[r.me]!.slots.findIndex(
        (x) => x?.item === 'item.hearty_stew',
      );
      eat(r.s, r.me, slot);
      return r.s.entities.comps.statuses[r.me]!.find((s) => s.id === 'fed')!.until - r.s.tick;
    };
    const t = threeStates('path.hearth_cook', fed);
    expect(t.worn).toBe(Math.floor(t.none * 1.25));
    expect(t.off).toBe(t.none);
    const raw = (r: Rig): number => {
      addItem(r.s.entities.comps.inventory[r.me]!, 'item.berry_red', 1);
      r.s.entities.comps.pools[r.me]!.hp = 1;
      const slot = r.s.entities.comps.inventory[r.me]!.slots.findIndex(
        (x) => x?.item === 'item.berry_red',
      );
      eat(r.s, r.me, slot);
      return r.s.entities.comps.pools[r.me]!.hp - 1;
    };
    const w = threeStates('path.wild_eater', raw);
    expect(w.worn).toBe(w.none * 2);
    expect(w.off).toBe(w.none);
  });
  it('buyPct and purseRegenPct: Haggler lowers buy prices, Fair Dealer refills purses faster', () => {
    const price = (r: Rig): number => payable(r.s, r.me, 40);
    const t = threeStates('path.haggler', price);
    expect(t).toEqual({ worn: 38, off: 40, none: 40 });
    // The real purchase pays the lower price.
    const r = rig();
    earn(r, 'path.haggler');
    r.s.entities.comps.avatar[r.me]!.coin = 100;
    spawnNpc(r.s, 'npc.shopkeeper', 20, 19);
    r.run(1, { type: 'buy', shop: 'shop.brin', item: 'item.cap_wool', qty: 1 });
    expect(r.s.entities.comps.avatar[r.me]!.coin).toBe(100 - Math.ceil(18 * 0.95));
    void buy;
    const regen = (q: Rig): number => {
      const k = spawnNpc(q.s, 'npc.shopkeeper', 20, 19);
      q.s.entities.comps.npc[k]!.purse = 10;
      q.s.tick = 30 * 120;
      tradeSystem(q.s);
      return q.s.entities.comps.npc[k]!.purse - 10;
    };
    const f = threeStates('path.fair_dealer', regen);
    expect(f.worn).toBe(f.none * 2);
    expect(f.off).toBe(f.none);
  });
  it('songTicksPct: Busker makes a song last 50 percent longer', () => {
    const song = (r: Rig): number => {
      comps(r).skills.points['skill.performance'] = 0;
      assign(r.s, r.me, 1, 'technique.performance_hum');
      const p = r.s.entities.comps.pools[r.me]!;
      p.foc = p.focMax;
      fireTechnique(r.s, r.me, 1, null);
      const c = r.s.entities.comps.channel[r.me]!;
      return c.until - r.s.tick;
    };
    const t = threeStates('path.busker', song);
    expect(t.worn).toBe(Math.floor(t.none * 1.5));
    expect(t.off).toBe(t.none);
  });
  it('hideSpeedPct: Shadow lets you move at 80 percent while hidden instead of 60', () => {
    const speed = (r: Rig): number => {
      applyStatus(r.s, r.me, 'hidden');
      return (
        100 +
        statusMods(r.s, r.me)
          .filter((m) => m.stat === 'moveSpeed')
          .reduce((n, m) => n + (m.pct ?? 0), 0)
      );
    };
    const t = threeStates('path.shadow', speed);
    expect(t).toEqual({ worn: 80, off: 60, none: 60 });
  });
  it('noAggroCreature: Mossfriend means Mosslings never notice you, and others still do', () => {
    const noticed =
      (kind: string) =>
      (r: Rig): number => {
        const p = r.s.entities.comps.pos[r.me]!;
        const foe = spawnCreature(r.s, kind, Math.round(p.x / 256) + 40, Math.round(p.y / 256));
        r.run(20);
        return r.s.entities.comps.ai[foe]!.target === null ? 0 : 1;
      };
    const t = threeStates('path.mossfriend', noticed('creature.mossling'));
    expect(t).toEqual({ worn: 0, off: 1, none: 1 });
    const boar = threeStates('path.mossfriend', noticed('creature.bramble_boar'));
    expect(boar.worn).toBe(boar.none);
  });
  it('tierDamagePct: Pestward adds 20 percent to tier 1 creatures only', () => {
    const hit =
      (tier: number) =>
      (r: Rig): number => {
        const foe = spawnEnemy(r.s, 'creature.mossling', 400, 300);
        r.s.entities.comps.combatant[foe]!.tier = tier;
        r.s.events.list.length = 0;
        dealDamage(r.s, foe, {
          src: r.me,
          from: { x: 0, y: 0 },
          power: 200,
          rank: 0,
          mult: 100,
          stagger: 0,
          knock: 0,
          element: 100,
          heavy: false,
          tag: 'blades',
        });
        return (r.s.events.list.find((e) => e.type === 'damageDealt') as { amount: number }).amount;
      };
    const t = threeStates('path.pestward', hit(1));
    expect(t.worn).toBeGreaterThan(t.none);
    expect(t.off).toBe(t.none);
    const high = threeStates('path.pestward', hit(2));
    expect(high.worn).toBe(high.none);
  });
});

describe('wearing, the Rest panel and the title', () => {
  it('only at a bed, at most three worn, earned ones only, and the shown title is a worn one', () => {
    const r = rig();
    for (const id of ['path.duelist', 'path.bulwark', 'path.emberhand', 'path.tidecaller'])
      earn(r, id);
    expect(comps(r).paths.earned).toHaveLength(4);
    // Auto-worn up to three.
    expect(comps(r).paths.worn).toHaveLength(3);
    expect(comps(r).paths.shown).toBe('path.duelist');
    // No bed near: the commands do nothing.
    r.run(1, { type: 'wearPath', path: 'path.duelist', on: false });
    expect(comps(r).paths.worn).toContain('path.duelist');
    spawnFixture(r.s, 'fixture.bed', 20, 21);
    r.run(1, { type: 'wearPath', path: 'path.duelist', on: false });
    expect(comps(r).paths.worn).not.toContain('path.duelist');
    expect(comps(r).paths.shown).toBe('path.bulwark');
    // A fourth cannot go on while three are worn; an unearned one never can.
    r.run(1, { type: 'wearPath', path: 'path.duelist', on: true });
    expect(comps(r).paths.worn).toHaveLength(3);
    expect(wearPath(r.s, r.me, 'path.tidecaller', true)).toBe(false);
    expect(wearPath(r.s, r.me, 'path.forager', true)).toBe(false);
    r.run(1, { type: 'showPath', path: 'path.emberhand' });
    expect(comps(r).paths.shown).toBe('path.emberhand');
    r.run(1, { type: 'showPath', path: 'path.forager' });
    expect(comps(r).paths.shown).toBe('path.emberhand');
  });

  it('the bed opens the Rest panel, and sleeping is its own command', () => {
    const r = rig();
    spawnFixture(r.s, 'fixture.bed', 20, 21);
    r.run(2, { type: 'move', dir: 4 });
    r.run(3, { type: 'move', dir: null });
    r.run(1, { type: 'interact' });
    expect(ofType(r.events, 'bedOpened')).toHaveLength(1);
    r.run(1, { type: 'sleep' });
    expect(ofType(r.events, 'slept')).toHaveLength(1);
  });

  it('a dialogue line with {address} says the shown title, else the handle, and conditions read Paths', () => {
    const r = rig();
    expect(DIALOGUE_STRINGS['dlg.brin.again']).toContain('{address}');
    expect(addressOf(r.s, r.me)).toBe('Traveler');
    earn(r, 'path.hearth_cook');
    expect(addressOf(r.s, r.me)).toBe('our cook');
    comps(r).paths.shown = null;
    expect(addressOf(r.s, r.me)).toBe('Traveler');
    comps(r).paths.shown = 'path.hearth_cook';
    expect(holds(r.s, r.me, [{ pathEarned: 'path.hearth_cook' }])).toBe(true);
    expect(holds(r.s, r.me, [{ pathWorn: 'path.hearth_cook' }])).toBe(true);
    expect(holds(r.s, r.me, [{ pathWorn: 'path.duelist' }])).toBe(false);
    expect(holds(r.s, r.me, [{ pathWorn: 'path.duelist', not: true }])).toBe(true);
    comps(r).paths.worn = [];
    expect(holds(r.s, r.me, [{ pathWorn: 'path.hearth_cook' }])).toBe(false);
  });
});
