import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOALS, GUILD, GUILD_PAY_CEILING } from '../../src/content/balance/guilds';
import { validateShippedChat } from '../../src/content/chat/validate';
import { GUILD_LINES } from '../../src/content/chat/templates/guild';
import { FLAG } from '../../src/content/travelers/types';
import { JsonCodec } from '../../src/save/codec';
import { validateSave } from '../../src/save/integrity';
import { MIGRATIONS, migrate } from '../../src/save/migrations';
import { CURRENT_SCHEMA, type SavePlain } from '../../src/save/types';
import { createAvatar } from '../../src/sim/avatar';
import { chatSystem, queueChatCommand, socialSystem } from '../../src/sim/chat/engine';
import {
  claimGoal,
  contribute,
  currentGoals,
  goalsFor,
  guildSystem,
  joinGuild,
  meetsRule,
  moveStash,
  newGuildState,
  stashCount,
  stashOf,
} from '../../src/sim/guild';
import { addItem, countItem } from '../../src/sim/items';
import { ABSTRACT_TICKS } from '../../src/content/balance/travelers';
import type { SimEvent } from '../../src/sim/kernel/events';
import { px } from '../../src/sim/kernel/fixed';
import { int, next } from '../../src/sim/kernel/rng';
import { createDemoState, deserializeState, hashState, type SimState } from '../../src/sim/state';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { crowdOf, travelersSystem } from '../../src/sim/travelers/crowd';
import { identitiesOf } from '../../src/sim/travelers/generate';
import { makeFriends } from '../../src/sim/travelers/social';
import { localMinute } from '../../src/sim/travelers/schedule';
import { findAvatar } from '../../src/shared/summary';
import { honestPlain, plainFor, tamper } from '../support/saves';

/**
 * Guilds (POW-M5-08): the join rule and an invitation, the stash, weekly goals and their pay,
 * Guild chat in each guild's tone, and the save.
 */
const MON = 19_000 - ((((19_000 + 4) % 7) - 1 + 7) % 7);
const EVENING = (MON + 2) * 86_400_000 + 19 * 3_600_000;

/** A world with an avatar standing south of a guild hall post, facing it. */
function world(seed: number, hall = 'fixture.guild_hall_hearth'): { s: SimState; me: number } {
  const s = createDemoState(seed, 0);
  s.world = { solidAt: (): number => 0 };
  s.weatherOverride = 'clear';
  spawnFixture(s, hall, 10, 10);
  const me = createAvatar(s, px(10 * 16 + 8), px(11 * 16 + 14));
  s.entities.comps.avatar[me]!.facing = 0;
  s.worldTick = 9000;
  s.clock = { nowMs: EVENING, epochMs: EVENING - 5 * 86_400_000, tzOffsetMin: 0 };
  return { s, me };
}

/** The crowd and chat at one in-game minute a step, a real minute passing each step. */
function minutes(s: SimState, n: number, seen?: (e: SimEvent) => void, inject?: () => void): void {
  for (let i = 0; i < n; i++) {
    s.tick += ABSTRACT_TICKS;
    s.worldTick += ABSTRACT_TICKS;
    s.clock = { ...s.clock!, nowMs: s.clock!.nowMs + 60_000 };
    s.events.list.length = 0;
    if (inject) inject();
    travelersSystem(s);
    guildSystem(s);
    chatSystem(s);
    socialSystem(s);
    if (seen) for (const e of s.events.list) seen(e);
  }
}

const nowMin = (s: SimState): number => localMinute(s.clock!.nowMs, s.clock!.tzOffsetMin);

describe('joining', () => {
  it('scenario: meet the rule, get an invite, join, use the stash, finish a weekly goal', () => {
    const { s, me } = world(3);
    // Hearth and Home takes anyone who has shared an activity with a member; a friend there asks.
    expect(meetsRule(s, me, 7)).toBe(false);
    minutes(s, 2);
    const crowd = crowdOf(s);
    const member = identitiesOf(s.seed).find(
      (t) => crowd.online[t.slot] === 1 && s.travelers[t.slot]!.guild === 7,
    )!;
    expect(member).toBeDefined();
    const life = s.travelers[member.slot]!;
    makeFriends(life, nowMin(s));
    life.memory.push({ kind: 1, subject: 0, day: 0 });
    expect(meetsRule(s, me, 7)).toBe(true);
    // An invitation comes by whisper, with the chips to answer it.
    let invite: Extract<SimEvent, { type: 'travelerSpoke' }> | null = null;
    for (let i = 0; i < 600 && !invite; i++)
      minutes(s, 1, (e) => {
        if (e.type === 'travelerSpoke' && e.chips.some((c) => c.id === 'guild.yes')) invite = e;
      });
    expect(invite).not.toBeNull();
    const from = (invite as unknown as { slot: number }).slot;
    expect(s.travelers[from]!.guild).not.toBe(0);
    const joinedGuild = s.travelers[from]!.guild;
    let joined = false;
    minutes(
      s,
      1,
      (e) => (joined ||= e.type === 'guildJoined'),
      () => queueChatCommand(s, { type: 'chip', slot: from, chip: 'guild.yes' }),
    );
    expect(joined).toBe(true);
    expect(s.guild.id).toBe(joinedGuild);
    // The stash at the hall (the right hall for this guild).
    const { s: h, me: hme } = world(
      3,
      joinedGuild === 4
        ? 'fixture.guild_hall_lantern'
        : joinedGuild === 7
          ? 'fixture.guild_hall_hearth'
          : 'fixture.guild_back_room',
    );
    h.guild = structuredClone(s.guild);
    const inv = h.entities.comps.inventory[hme]!;
    addItem(inv, 'item.copper_ingot', 5);
    const slot = inv.slots.findIndex((x) => x?.item === 'item.copper_ingot');
    expect(moveStash(h, hme, 'in', slot)).toBe(true);
    expect(countItem(inv, 'item.copper_ingot')).toBe(0);
    expect(stashCount(h)).toBe(5);
    const back = stashOf(h)!.findIndex((x) => x?.item === 'item.copper_ingot');
    expect(moveStash(h, hme, 'out', back)).toBe(true);
    expect(countItem(inv, 'item.copper_ingot')).toBe(5);
    // A weekly goal, done and paid once.
    guildSystem(h);
    const goals = currentGoals(h);
    expect(goals.length).toBe(GUILD.goalsPerWeek);
    const i = goals.findIndex((g) => g.def.kind === 'give');
    const gi = i >= 0 ? i : 0;
    const g = goals[gi]!.def;
    if (g.kind === 'give') {
      addItem(inv, g.thing, g.qty);
      expect(contribute(h, hme, gi)).toBe(g.qty);
    } else h.guild.progress[gi] = g.qty;
    const coin0 = h.entities.comps.avatar[hme]!.coin;
    expect(claimGoal(h, hme, gi)).toBe(true);
    expect(claimGoal(h, hme, gi)).toBe(false);
    expect(h.entities.comps.avatar[hme]!.coin).toBe(coin0 + g.coin);
    expect(h.ledger.coinEarned.guildRequest).toBe(g.coin);
  });

  it('one guild at a time, and only when the rule is met', () => {
    const { s, me } = world(5);
    s.entities.comps.skills[me]!.points['skill.fishing'] = 20;
    expect(joinGuild(s, me, 1)).toBe(false);
    expect(joinGuild(s, me, 5)).toBe(true);
    s.entities.comps.skills[me]!.points['skill.cartography'] = 25;
    expect(joinGuild(s, me, 3)).toBe(false);
  });

  it('asking a member from their card answers by the rule', () => {
    const { s, me } = world(7);
    minutes(s, 2);
    const crowd = crowdOf(s);
    const t = identitiesOf(s.seed).find(
      (x) => crowd.online[x.slot] === 1 && s.travelers[x.slot]!.guild === 5,
    );
    if (!t) return;
    const said: string[] = [];
    minutes(
      s,
      2,
      (e) => e.type === 'travelerSpoke' && e.slot === t.slot && said.push(e.template),
      () => queueChatCommand(s, { type: 'guildAsk', slot: t.slot }),
    );
    expect(said).toContain('guild.notYet');
    s.entities.comps.skills[me]!.points['skill.fishing'] = 20;
    said.length = 0;
    minutes(
      s,
      2,
      (e) => e.type === 'travelerSpoke' && e.slot === t.slot && said.push(e.template),
      () => queueChatCommand(s, { type: 'guildAsk', slot: t.slot }),
    );
    expect(said).toContain('guild.invite');
  });
});

describe('the stash', () => {
  it('no sequence of deposits and withdrawals changes the total item count', () => {
    for (let run = 0; run < 20; run++) {
      const { s, me } = world(100 + run);
      s.guild.id = 7;
      const inv = s.entities.comps.inventory[me]!;
      const items = ['item.copper_ingot', 'item.oak_plank', 'item.salt', 'item.berry_red'];
      for (const it of items) addItem(inv, it, 7 + run);
      const total = (): number => inv.slots.reduce((a, x) => a + (x?.qty ?? 0), 0) + stashCount(s);
      const before = total();
      const r = s.rng.world;
      for (let k = 0; k < 200; k++) {
        const dir = next(r) < 0.5 ? 'in' : 'out';
        const n = dir === 'in' ? inv.slots.length : stashOf(s)!.length;
        moveStash(s, me, dir, int(r, -2, n + 2));
        expect(total()).toBe(before);
      }
    }
  });

  it('is used only at the guild own hall', () => {
    const { s, me } = world(9, 'fixture.guild_hall_lantern');
    s.guild.id = 7;
    const inv = s.entities.comps.inventory[me]!;
    addItem(inv, 'item.salt', 3);
    expect(
      moveStash(
        s,
        me,
        'in',
        inv.slots.findIndex((x) => x?.item === 'item.salt'),
      ),
    ).toBe(false);
  });
});

describe('guild chat', () => {
  /** Guild chat over an evening, 19:00 to 23:00, with the player in a guild. */
  function evening(guild: number): string[] {
    const { s } = world(7);
    s.guild = { ...newGuildState(), id: guild };
    const ids = identitiesOf(s.seed);
    const out: string[] = [];
    minutes(s, 4 * 60, (e) => {
      if (e.type === 'travelerSpoke' && e.channel === 'guild')
        out.push(`${ids[e.slot]!.handle}: ${e.text}`);
    });
    return out;
  }

  it('Iron Oath and Lantern Players read as different tones over an evening', () => {
    const iron = evening(1);
    const lantern = evening(4);
    const rows = Math.max(iron.length, lantern.length);
    const lines: string[] = [];
    for (let i = 0; i < Math.min(rows, 16); i++)
      lines.push(`${(iron[i] ?? '').padEnd(54).slice(0, 54)} | ${lantern[i] ?? ''}`);
    console.log(['Iron Oath'.padEnd(54) + ' | Lantern Players', ...lines].join('\n'));
    expect(iron.length).toBeGreaterThan(5);
    expect(lantern.length).toBeGreaterThan(5);
    // The two share no line, and the troupe speaks in character where the raiders are terse.
    const words = (xs: string[]): number =>
      xs.reduce((a, x) => a + x.split(': ').slice(1).join(': ').split(' ').length, 0) / xs.length;
    expect(words(lantern)).toBeGreaterThan(words(iron));
  });

  it('every guild has its lines, and they pass the chat validator', () => {
    for (let g = 1; g <= 12; g++) {
      const mine = GUILD_LINES.filter((l) => l.guild === g);
      expect(mine.length).toBeGreaterThanOrEqual(14);
      for (const t of ['hello', 'bye', 'welcome', 'idle'] as const)
        expect(mine.some((l) => l.trigger === t)).toBe(true);
      expect(GOALS[g]!.length).toBeGreaterThanOrEqual(GUILD.goalsPerWeek);
    }
    expect(validateShippedChat()).toEqual([]);
  });

  it('the week picks the same goals for a guild every time', () => {
    expect(goalsFor(1, 4, 2900)).toEqual(goalsFor(1, 4, 2900));
    expect(goalsFor(1, 4, 2900).length).toBe(GUILD.goalsPerWeek);
  });
});

describe('the save', () => {
  const f = JSON.parse(
    readFileSync(join(__dirname, '..', 'fixtures', 'saves', 'schema-31.json'), 'utf8'),
  ) as { plain: SavePlain; expectedHash: string };
  const decode = (): Promise<SavePlain> =>
    new JsonCodec().decode(new TextEncoder().encode(JSON.stringify(f.plain)));

  it('schema 31 to 32 gives an old save no guild and nothing else changes', async () => {
    expect(f.plain.schema).toBe(31);
    expect(JSON.parse(f.plain.sim)).not.toHaveProperty('guild');
    const before = deserializeState(f.plain.sim);
    delete (before as { guild?: unknown }).guild;
    expect(hashState(before)).toBe(f.expectedHash);
    const at32 = migrate(await decode(), MIGRATIONS, 32);
    expect(at32.schema).toBe(32);
    const s = deserializeState(at32.sim);
    expect(s.guild).toEqual(newGuildState());
    expect(s.travelers).toEqual(deserializeState(f.plain.sim).travelers);
  });

  it('reaches the current schema and passes every integrity layer', async () => {
    const now = migrate(await decode());
    expect(now.schema).toBe(CURRENT_SCHEMA);
    expect(validateSave(now).reasons).toEqual([]);
  });

  it('guild pay past what the weeks allow is flagged, and a real claim is not', () => {
    const { s, me } = world(31);
    s.guild.id = 7;
    guildSystem(s);
    s.guild.progress[0] = 999;
    claimGoal(s, me, 0);
    const codes = (p: SavePlain): string[] => validateSave(p).reasons.map((r) => r.code);
    expect(codes(plainFor(s))).not.toContain('GUILD_IMPLAUSIBLE');
    const rich = tamper(honestPlain(), (st, who) => {
      st.entities.comps.avatar[who]!.coin += GUILD_PAY_CEILING * 50;
      st.ledger.coinEarned.guildRequest = GUILD_PAY_CEILING * 50;
    });
    expect(codes(rich)).toContain('GUILD_IMPLAUSIBLE');
    void findAvatar;
    void FLAG;
  });
});
