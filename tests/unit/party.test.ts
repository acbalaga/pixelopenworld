import { describe, expect, it } from 'vitest';
import { PARTY } from '../../src/content/balance/party';
import { validateShippedChat } from '../../src/content/chat/validate';
import { ABSTRACT_TICKS } from '../../src/content/balance/travelers';
import { CREATURES } from '../../src/content/creatures';
import { createAvatar } from '../../src/sim/avatar';
import { spawnCreature } from '../../src/sim/combat/enemy';
import { query } from '../../src/sim/kernel/entities';
import type { Command } from '../../src/sim/kernel/commands';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import {
  addMember,
  competence,
  lfgOf,
  memberOf,
  partySystem,
  rankOf,
  roleOf,
  travelerListings,
} from '../../src/sim/party';
import { spawnBoss } from '../../src/sim/systems/boss';
import { equip, give } from '../../src/sim/items';
import { recomputePools } from '../../src/sim/skills';
import {
  createDemoState,
  deserializeState,
  serializeState,
  type SimState,
} from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { standPx } from '../../src/sim/travelers/entities';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { PLACE_LIST, SKILL_LIST } from '../../src/sim/travelers/lists';
import { findAvatar } from '../../src/shared/summary';

/**
 * Parties (POW-M5-07): the finder, answers, role AI and competence, downs, loot and departures.
 * Every fight here runs on the real sim (`stepWorld`), the clock following at 30 ticks a second.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 20 * 3_600_000;
const AWAY = { x: 20_000, y: 20_000 };
const OPEN = { solidAt: (): number => 0 };
const FOOD = 'item.dish_bread';
const SQUARE = standPx(0, PLACE_LIST.indexOf('hearthford.square'))!;

function world(seed: number, at = SQUARE): SimState {
  const s = createDemoState(seed, 0);
  s.world = OPEN;
  s.weatherOverride = 'clear';
  createAvatar(s, px(at.x), px(at.y));
  s.worldTick = 9000;
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return s;
}

/** Runs ticks on the real sim. `policy` gives the avatar's commands each tick. */
function run(
  s: SimState,
  ticks: number,
  policy?: (s: SimState) => Command[],
  seen?: (e: SimEvent) => void,
): void {
  const me = findAvatar(s)!;
  for (let i = 0; i < ticks; i++) {
    const clock = { ...s.clock!, nowMs: s.clock!.nowMs + 33 };
    stepWorld(s, me, { commands: policy ? policy(s) : [], worldTick: s.worldTick + 1, clock });
    if (seen) for (const e of s.events.list) seen(e);
  }
}

/** Online, free Travelers, for a party made by hand. */
function freeSlots(s: SimState, n: number, want?: (slot: number) => boolean): number[] {
  const c = crowdOf(s);
  const out: number[] = [];
  for (let i = 0; i < 240 && out.length < n; i++)
    if (c.online[i] && !memberOf(s, i) && (!want || want(i))) out.push(i);
  return out;
}

function setRank(s: SimState, slot: number, skill: string, points: number): void {
  const idx = SKILL_LIST.indexOf(skill);
  const life = s.travelers[slot]!;
  life.build = life.build.filter(([k]) => k !== idx && k !== SKILL_LIST.indexOf('skill.mending'));
  life.build = life.build.map(([k, p]) => [k, Math.min(p, points)] as [number, number]);
  life.build.push([idx, points]);
  life.build.sort((a, b) => a[0] - b[0]);
}

const dist = (s: SimState, a: number, b: number): number => {
  const p = s.entities.comps.pos[a]!;
  const q = s.entities.comps.pos[b]!;
  return Math.hypot((p.x - q.x) / 256, (p.y - q.y) / 256);
};

describe('the party finder', () => {
  it('lists real groups from Travelers who want one this hour, and they are free', () => {
    const s = world(5);
    run(s, 120);
    const list = travelerListings(s);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(PARTY.boardMax);
    for (const l of list) {
      expect(crowdOf(s).online[l.leader]).toBe(1);
      expect(lfgOf(s, l.leader)).toBe(l.activity);
      expect(l.slots.length).toBeLessThanOrEqual(PARTY.max);
    }
  });

  it('a posted listing is answered over a few in-game minutes by suited Travelers', () => {
    const s = world(7);
    run(s, 60);
    const answered: number[] = [];
    run(s, 1, () => [{ type: 'party', op: 'post', activity: 'dungeon.rootway' }]);
    run(s, ABSTRACT_TICKS * PARTY.listingMinutes, undefined, (e) => {
      if (e.type === 'partyAnswered') answered.push(e.slot);
    });
    expect(answered.length).toBeGreaterThan(0);
    expect(s.party!.members.length).toBeLessThanOrEqual(PARTY.max);
    // They come to the player.
    run(s, 90);
    const me = findAvatar(s)!;
    for (const m of s.party!.members) {
      const id = crowdOf(s).entOf[m.slot]!;
      expect(id).toBeGreaterThanOrEqual(0);
      expect(dist(s, id, me)).toBeLessThan(PARTY.catchUpPx);
    }
  });

  it('joining a group from the board brings its members in', () => {
    const s = world(11);
    run(s, 60);
    const l = travelerListings(s)[0]!;
    run(s, 1, () => [{ type: 'party', op: 'join', slot: l.leader }]);
    expect(s.party!.members.map((m) => m.slot)).toEqual(l.slots);
    run(s, 1, () => [{ type: 'party', op: 'leave' }]);
    expect(s.party!.members.length).toBe(0);
  });

  it('a party is session only: it is not saved, and a load has none', () => {
    const s = world(13);
    run(s, 60);
    for (const slot of freeSlots(s, 3)) addMember(s, slot, 'dungeon.rootway');
    run(s, 30);
    expect(s.party!.members.length).toBe(3);
    const text = serializeState(s);
    expect(text).not.toContain('"party"');
    const back = deserializeState(text, OPEN);
    expect(back.party).toBeUndefined();
  });
});

/** The fights of the Rootway's Root Hall route, room by room, then Old Bramblehide (tools/fight-sim). */
const ROOTWAY_FIGHTS: { creature: string; count: number; boss?: string }[] = [
  { creature: 'creature.mossling', count: 3 },
  { creature: 'creature.mossling', count: 3 },
  { creature: 'creature.spitbloom', count: 1 },
  { creature: 'creature.glowcap', count: 3 },
  { creature: 'creature.root_grub', count: 3 },
  { creature: 'creature.bramble_boar', count: 1 },
  { creature: 'creature.old_bramblehide', count: 1, boss: 'boss.old_bramblehide' },
];

/** The plain player policy: lock the nearest, close in, swing, eat when hurt. */
function playerPolicy(s: SimState): Command[] {
  const me = findAvatar(s)!;
  const mp = s.entities.comps.pos[me]!;
  let best = -1;
  let bestD = 400;
  for (const id of query(s.entities, 'ai', 'fighter', 'pos')) {
    const f = s.entities.comps.fighter[id]!;
    if (f.team !== 1 || f.state === 'dead' || !s.entities.alive[id]) continue;
    const d = dist(s, id, me);
    if (d < bestD) {
      best = id;
      bestD = d;
    }
  }
  if (best < 0) return [{ type: 'move', dir: null }];
  const fp = s.entities.comps.pos[best]!;
  const dx = (fp.x - mp.x) / 256;
  const dy = (fp.y - mp.y) / 256;
  const cmds: Command[] = [];
  if (s.entities.comps.fighter[me]!.lock !== best)
    cmds.push({ type: 'lock', x: Math.round(fp.x / 256), y: Math.round(fp.y / 256 - 6) });
  const pools = s.entities.comps.pools[me]!;
  if (pools.hp < pools.hpMax * 0.4 && s.tick % 30 === 0) {
    const slot = s.entities.comps.inventory[me]!.slots.findIndex((x) => x?.item === FOOD);
    if (slot >= 0) cmds.push({ type: 'use', slot });
  }
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 6) : dy > 0 ? 4 : 0;
  if (bestD > 16) cmds.push({ type: 'move', dir: dir as 0 | 2 | 4 | 6 });
  else {
    cmds.push({ type: 'move', dir: null });
    cmds.push({ type: 'attack' });
  }
  return cmds;
}

function spawnFight(s: SimState, f: (typeof ROOTWAY_FIGHTS)[number]): number[] {
  const me = findAvatar(s)!;
  const mp = s.entities.comps.pos[me]!;
  const ids: number[] = [];
  for (let k = 0; k < f.count; k++) {
    const x = Math.round(mp.x / 256) + 40 + (k % 2) * 10;
    const y = Math.round(mp.y / 256) + (k - (f.count - 1) / 2) * 20;
    const id = f.boss ? spawnBoss(s, f.boss, x, y) : spawnCreature(s, f.creature, x, y, -1);
    const ai = s.entities.comps.ai[id];
    if (ai) {
      ai.provoked = true;
      ai.target = me;
    }
    ids.push(id);
  }
  return ids;
}

/** Down, or gone: an id can be taken by something new once a creature is gone, so the kind must match. */
const down = (s: SimState, id: number, kind: string): boolean =>
  !s.entities.alive[id] ||
  s.entities.comps.combatant[id]?.kind !== kind ||
  s.entities.comps.fighter[id]?.state === 'dead';

describe('a party in a fight', () => {
  it('scenario: the player and three Travelers clear the Rootway', () => {
    const s = world(21);
    run(s, 60);
    const me = findAvatar(s)!;
    // The target loadout of the Rootway scenarios (M4-21): a sword at rank 8, leather, dishes.
    s.entities.comps.skills[me]!.points['skill.blades'] = 8;
    for (const item of [
      'item.sword_rusty',
      'item.cap_leather',
      'item.jerkin_leather',
      'item.chaps_leather',
    ]) {
      give(s, me, item, 1, 'start');
      const inv = s.entities.comps.inventory[me]!;
      equip(
        s,
        me,
        inv.slots.findIndex((x) => x?.item === item),
      );
    }
    give(s, me, FOOD, 3, 'start');
    recomputePools(s, me);
    s.entities.comps.pools[me]!.hp = s.entities.comps.pools[me]!.hpMax;
    const slots = freeSlots(s, 3);
    const skills = ['skill.shieldcraft', 'skill.blades', 'skill.mending'];
    slots.forEach((slot, i) => setRank(s, slot, skills[i]!, 24));
    for (const slot of slots) addMember(s, slot, 'dungeon.rootway');
    run(s, 60);
    expect(s.party!.members.map((m) => m.role).sort()).toEqual(['striker', 'support', 'vanguard']);
    const report: string[] = [];
    let cleared = 0;
    for (const f of ROOTWAY_FIGHTS) {
      const foes = spawnFight(s, f);
      let t = 0;
      while (t < 30 * 240 && !foes.every((id) => down(s, id, f.creature))) {
        run(s, 30, playerPolicy);
        t += 30;
        if (s.entities.comps.fighter[me]!.state === 'dead') break;
      }
      const won = foes.every((id) => down(s, id, f.creature));
      report.push(
        `${f.creature} x${f.count}: ${won ? 'down' : 'NOT down'} in ${(t / 30).toFixed(0)} s`,
      );
      if (!won) break;
      cleared++;
      // A breather between rooms: the downed get up.
      run(s, PARTY.reviveTicks + 30);
    }
    const dealt = s.party!.members.map(
      (m) =>
        `${identitiesOf(s.seed)[m.slot]!.handle} (${m.role}) dealt ${m.dealt}, took ${m.taken}`,
    );
    console.log(['Rootway with a party of four:', ...report, ...dealt].join('\n  '));
    expect(cleared).toBe(ROOTWAY_FIGHTS.length);
    expect(s.party!.members.length).toBe(3);
  });

  it('a rank 5 Striker deals less per minute and takes more avoidable hits than a rank 40 one', () => {
    const measure = (rank: number): { dpm: number; hits: number } => {
      const s = world(31);
      run(s, 60);
      const slot = freeSlots(s, 1, (i) => roleOf(s, i) === 'striker')[0]!;
      setRank(s, slot, 'skill.blades', rank);
      addMember(s, slot, 'creature.bramble_boar');
      run(s, 30);
      const ent = crowdOf(s).entOf[slot]!;
      // The skill on the entity follows the life it was built from.
      s.entities.comps.combatant[ent]!.skillRank = rank;
      expect(rankOf(s, slot)).toBe(rank);
      const me = findAvatar(s)!;
      const mp = s.entities.comps.pos[me]!;
      const boar = spawnCreature(s, 'creature.bramble_boar', mp.x / 256 + 40, mp.y / 256, -1);
      const ai = s.entities.comps.ai[boar]!;
      ai.provoked = true;
      ai.target = ent;
      const minutes = 2;
      const m = memberOf(s, slot)!;
      for (let i = 0; i < 30 * 60 * minutes; i++) {
        // The boar never falls and never turns from the Striker; the Striker never goes down.
        const bp = s.entities.comps.pools[boar]!;
        bp.hp = bp.hpMax;
        ai.target = ent;
        const mpools = s.entities.comps.pools[ent]!;
        mpools.hp = mpools.hpMax;
        run(s, 1, () => [
          {
            type: 'lock',
            x: Math.round(s.entities.comps.pos[boar]!.x / 256),
            y: Math.round(s.entities.comps.pos[boar]!.y / 256 - 6),
          },
        ]);
      }
      return { dpm: m.dealt / minutes, hits: m.hitsTaken };
    };
    const low = measure(5);
    const high = measure(40);
    console.log(
      `Striker vs Bramble Boar, 2 minutes: rank 5 deals ${low.dpm.toFixed(0)} a minute and takes ${low.hits} avoidable hits; rank 40 deals ${high.dpm.toFixed(0)} a minute and takes ${high.hits}.`,
    );
    expect(low.dpm).toBeLessThan(high.dpm);
    expect(low.hits).toBeGreaterThan(high.hits);
  });

  it('competence is a straight line in rank, and full at the cap', () => {
    const a = competence(0);
    const b = competence(PARTY.rankFull);
    expect(a.reactionTicks).toBe(PARTY.competence.reactionTicks.low);
    expect(b.reactionTicks).toBe(PARTY.competence.reactionTicks.high);
    expect(competence(200)).toEqual(b);
    expect(competence(5).dodge).toBeLessThan(competence(40).dodge);
  });
});

describe('departures', () => {
  it('a departure warning always precedes a member logging out, over a simulated week of parties', () => {
    // The crowd and the party at one in-game minute a step, a real minute passing each step.
    const s = world(41, AWAY);
    const warned = new Set<number>();
    const inParty = new Set<number>();
    let logouts = 0;
    let warnings = 0;
    let bad = 0;
    let departures = 0;
    const steps = 7 * 24 * 60;
    for (let i = 0; i < steps; i++) {
      s.tick += ABSTRACT_TICKS;
      s.worldTick += ABSTRACT_TICKS;
      s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + 60_000 };
      s.events.list.length = 0;
      travelersSystem(s);
      partySystem(s);
      // Keep a party going: whoever is free fills it up.
      if ((s.party?.members.length ?? 0) < PARTY.max)
        for (const slot of freeSlots(s, PARTY.max - (s.party?.members.length ?? 0)))
          addMember(s, slot, 'dungeon.rootway');
      for (const e of s.events.list) {
        if (e.type === 'partyJoined') inParty.add(e.slot);
        else if (e.type === 'partyWarned') {
          warned.add(e.slot);
          warnings++;
        } else if (e.type === 'partyLeft') {
          if (e.why === 'session') departures++;
          if (e.why === 'session' && !warned.has(e.slot)) bad++;
          inParty.delete(e.slot);
          warned.delete(e.slot);
        } else if (e.type === 'travelerLoggedOut') {
          if (inParty.has(e.slot)) bad++;
          logouts++;
        }
      }
    }
    console.log(
      `A week of parties: ${departures} members left at the end of their session, ${warnings} notices, ${logouts} logouts in all.`,
    );
    expect(departures).toBeGreaterThan(10);
    expect(warnings).toBeGreaterThanOrEqual(departures);
    expect(logouts).toBeGreaterThan(departures);
    expect(bad).toBe(0);
  });
});

describe('loot', () => {
  /** The mean of a creature's drop table per kill, items only. */
  const expected = (kind: string): number =>
    CREATURES[kind]!.drops.filter((d) => d.item !== 'item.coin').reduce(
      (a, d) => a + (d.chance / 100) * ((d.min + d.max) / 2),
      0,
    );
  const most = (kind: string): number =>
    CREATURES[kind]!.drops.filter((d) => d.item !== 'item.coin').reduce((a, d) => a + d.max, 0);
  const lootMade = (s: SimState): number =>
    Object.values(s.ledger.itemsMade.loot ?? {}).reduce((a, b) => a + b, 0);

  /** Kills `n` of a creature by the party's hands, or the player's alone, and reads the loot. */
  function hunt(
    withParty: boolean,
    n: number,
    seed = withParty ? 51 : 52,
  ): { kills: number; loot: number; held: number } {
    const kind = 'creature.mossling';
    // Away from the square, so no passer-by takes a kill (theirs drop nothing for the player).
    const s = world(seed, AWAY);
    run(s, 60);
    const me = findAvatar(s)!;
    s.entities.comps.skills[me]!.points['skill.blades'] = 20;
    if (withParty)
      freeSlots(s, 3).forEach((slot, i) => {
        setRank(s, slot, ['skill.shieldcraft', 'skill.blades', 'skill.blades'][i]!, 30);
        addMember(s, slot, kind);
      });
    run(s, 60);
    let kills = 0;
    s.events.list.length = 0;
    for (let k = 0; k < n; k++) {
      const [id] = spawnFight(s, { creature: kind, count: 1 });
      for (let t = 0; t < 30 * 60 && !down(s, id!, kind); t++)
        run(s, 1, withParty ? () => [] : playerPolicy, (e) => {
          if (e.type === 'killed' && e.kind === kind) kills++;
        });
      // Keep the player and the party fresh, so the run is about loot and not about falling.
      const pools = s.entities.comps.pools[me]!;
      pools.hp = pools.hpMax;
      run(s, 40);
    }
    const inv = s.entities.comps.inventory[me]!;
    let held = 0;
    for (const st of inv.slots) if (st && st.item !== 'item.dish_bread') held += st.qty;
    return { kills, loot: lootMade(s), held };
  }

  it("the player's loot in a party run is within the same bounds as a solo run", () => {
    // The same world seed both ways: the player's drops come from the loot stream alone, so the
    // party run gives the player exactly what the solo run does, kill for kill.
    const solo = hunt(false, 80, 53);
    const party = hunt(true, 80, 53);
    const mean = expected('creature.mossling');
    const cap = most('creature.mossling');
    console.log(
      `Mossling loot per kill: solo ${(solo.loot / solo.kills).toFixed(2)} over ${solo.kills}, party ${(party.loot / party.kills).toFixed(2)} over ${party.kills}, table mean ${mean.toFixed(2)}.`,
    );
    expect(party.kills).toBe(solo.kills);
    expect(party.loot).toBe(solo.loot);
    for (const r of [solo, party]) {
      expect(r.loot).toBeLessThanOrEqual(r.kills * cap);
      expect(r.loot / r.kills).toBeGreaterThan(mean * 0.6);
      expect(r.loot / r.kills).toBeLessThan(mean * 1.4);
    }
  });

  it("a Traveler's share goes to their stock and never enters the player's state", () => {
    const s = world(61, AWAY);
    run(s, 60);
    const me = findAvatar(s)!;
    const slots = freeSlots(s, 3);
    slots.forEach((slot) => setRank(s, slot, 'skill.blades', 30));
    for (const slot of slots) addMember(s, slot, 'creature.mossling');
    run(s, 60);
    const count = (): number => {
      let n = 0;
      for (const st of s.entities.comps.inventory[me]!.slots) if (st) n += st.qty;
      for (const id of query(s.entities, 'pickup'))
        if (s.entities.comps.pickup[id]!.item !== 'item.coin')
          n += s.entities.comps.pickup[id]!.qty;
      return n;
    };
    const stock = (): number =>
      slots.reduce(
        (a, slot) => a + Object.values(crowdOf(s).stock[slot]!).reduce((x, y) => x + y, 0),
        0,
      );
    const held0 = count();
    const made0 = lootMade(s);
    const stock0 = stock();
    for (let k = 0; k < 20; k++) {
      const [id] = spawnFight(s, { creature: 'creature.mossling', count: 1 });
      for (let t = 0; t < 30 * 60 && !down(s, id!, 'creature.mossling'); t++) run(s, 1);
      run(s, 20);
    }
    // The player holds no more than the loot ledger says was made for them (some lie uncollected or
    // faded), and the Travelers' shares are in their stock.
    expect(count() - held0).toBeLessThanOrEqual(lootMade(s) - made0);
    expect(lootMade(s) - made0).toBeLessThanOrEqual(20 * most('creature.mossling'));
    expect(stock()).toBeGreaterThan(stock0);
  });
});

describe('party chat', () => {
  it('members speak in Party chat about what really happens: joins, downs, rolls', () => {
    const s = world(71, AWAY);
    run(s, 60);
    const lines: { slot: number; text: string; template: string }[] = [];
    const listen = (e: SimEvent): void => {
      if (e.type === 'travelerSpoke' && e.channel === 'party')
        lines.push({ slot: e.slot, text: e.text, template: e.template });
    };
    run(s, 1, () => [{ type: 'party', op: 'post', activity: 'creature.mossling' }]);
    run(s, ABSTRACT_TICKS * (PARTY.listingMinutes + 2), undefined, listen);
    const slots = s.party!.members.map((m) => m.slot);
    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      setRank(s, slot, 'skill.blades', 30);
      s.entities.comps.combatant[crowdOf(s).entOf[slot]!]!.skillRank = 30;
    });
    for (let k = 0; k < 12; k++) {
      const [id] = spawnFight(s, { creature: 'creature.mossling', count: 1 });
      for (let t = 0; t < 30 * 60 && !down(s, id!, 'creature.mossling'); t++)
        run(s, 1, undefined, listen);
      run(s, ABSTRACT_TICKS, undefined, listen);
    }
    // Everyone who answered said so, and said hello.
    for (const slot of slots) {
      expect(lines.some((l) => l.slot === slot && l.template === 'party.answer')).toBe(true);
      expect(lines.some((l) => l.slot === slot && l.template === 'party.join')).toBe(true);
    }
    console.log(
      lines.map((l) => `[Party] ${identitiesOf(s.seed)[l.slot]!.handle}: ${l.text}`).join('\n'),
    );
    for (const l of lines) {
      expect(slots).toContain(l.slot);
      expect(l.text).not.toMatch(/[{}]/);
      expect(l.text).not.toContain('—');
    }
  });

  it('the party lines pass the chat validator', () => {
    expect(validateShippedChat()).toEqual([]);
  });
});
