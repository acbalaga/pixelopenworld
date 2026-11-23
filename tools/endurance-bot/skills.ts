/**
 * Skill-max model for the current build. Takes event rates (measured by the real-sim bots in
 * rates.ts and gather.ts, or stated assumptions where no bot loop exists yet) and integrates the
 * real curve (`xpToNext`) and the real challenge scaling (`challengePct`) point by point, so every
 * diminishing-return rule in the shipped balance applies.
 *
 * In this build the only Trials are rank 15, so a skill's ceiling in Dawnmeadow is 29 points with
 * a full bar (it banks at 30 until a rank 30 Trial exists). "Cap" below means that.
 */
import { SKILLS, TRIALS } from '../../src/content/skills';
import { AUTHORED_TRIALS } from '../../src/content/skills/dawnmeadowTrials';
import { RECIPES } from '../../src/content/items/recipes';
import { BUILT_DUNGEONS } from '../../src/content/world/dungeons/registry';
import { FIXTURES } from '../../src/content/world/fixtures';
import { SKILLS_BALANCE } from '../../src/content/balance/skills';
import { challengePct, xpToNext } from '../../src/sim/skills';
import { supply } from './gather';
import { loadDawnmeadow } from './world';

const A = JSON.parse(process.argv[2] ?? '{}') as { athleticsXpPerMin?: number; mapBlocks?: number };

/** One way to earn: events per minute, XP per event, scaled by tier or not. */
interface Way {
  perMin: number;
  base: number;
  tier?: number;
  label: string;
  /** Points from which this way is open (a fresh character does not beat a tier 2 foe). */
  from?: number;
}
interface Model {
  skill: string;
  how: 'measured' | 'real-map' | 'modeled' | 'finite';
  note: string;
  ways: Way[];
  /** One-time XP the region holds (first-time bonuses), credited as earned. */
  lump: number;
  /** Total XP the region can ever pay, for skills with no repeatable source. */
  finite?: number;
}

const L = loadDawnmeadow();
const sup = supply();
const gatherWays = (tag: string, base: number): Way[] =>
  sup
    .filter((s) => s.tag === tag)
    .map((s) => ({
      perMin: s.perMinute,
      base,
      tier: s.tier,
      label: `${s.nodes} t${s.tier} nodes`,
    }));
const objs = (pred: (k: string) => boolean): number => L.objects.filter((o) => pred(o.kind)).length;

// Measured by rates.ts on the real sim (sim-bot policies, 20 sim minutes each).
const HITS = 45.9;
const DODGES = 4.4;
const CRAFTS = 1.35;
// 31 creature kinds in Dawnmeadow; a grinder meets a handful, so lumps below use 4.

const recipesOf = (craft: string): number =>
  Object.values(RECIPES).filter((r) => (r as { craft?: string }).craft === craft).length;
const recipeTier = (craft: string): number =>
  Math.max(
    1,
    ...Object.values(RECIPES)
      .filter((r) => (r as { craft?: string }).craft === craft)
      .map((r) => (r as { tier: number }).tier),
  );

const dmg = (skill: string, note: string): Model => ({
  skill,
  how: skill === 'skill.blades' ? 'measured' : 'modeled',
  note,
  ways: [
    { perMin: HITS, base: 10, tier: 1, label: 'tier 1 foes' },
    { perMin: HITS, base: 10, tier: 2, label: 'tier 2 foes', from: 8 },
  ],
  // First hit on a new kind pays 100; a grinder meets a handful, not all 31.
  lump: 100 * 4,
});
const craft = (skill: string, tag: string, base: number, first: number): Model => ({
  skill,
  how: skill === 'skill.cooking' ? 'measured' : 'modeled',
  note: `${recipesOf(tag)} recipes; rate is the measured gather-and-cook loop`,
  ways: [1, recipeTier(tag)].map((t) => ({
    perMin: CRAFTS,
    base,
    tier: t,
    label: `tier ${t} recipes`,
  })),
  lump: first * recipesOf(tag),
});

// Deciphering pays once per tablet KIND, so count distinct kinds.
const tablets = new Set(
  L.objects.filter((o) => FIXTURES[o.kind]?.type === 'tablet').map((o) => o.kind),
).size;
const rooms = BUILT_DUNGEONS.reduce((n, d) => n + d.def.rooms.length, 0);
void objs;
const MODELS: Model[] = [
  dmg('skill.blades', 'sword vs Mosslings, 44 hits/min measured'),
  dmg('skill.heavy_arms', 'same hit rate as Blades assumed'),
  dmg('skill.polearms', 'same hit rate as Blades assumed'),
  dmg('skill.archery', 'same hit rate as Blades assumed'),
  dmg('skill.unarmed', 'same hit rate as Blades assumed'),
  dmg('skill.ember', 'same hit rate as Blades assumed (Focus-limited in practice, so slower)'),
  dmg('skill.tide', 'as Ember'),
  dmg('skill.gale', 'as Ember'),
  dmg('skill.stone', 'as Ember'),
  { ...dmg('skill.hexing', 'as Ember'), lump: 800 },
  {
    skill: 'skill.shieldcraft',
    how: 'modeled',
    note: 'parries at the measured dodge rate',
    ways: [1, 2].map((t) => ({ perMin: DODGES, base: 20, tier: t, label: `parry t${t}` })),
    lump: 0,
  },
  {
    skill: 'skill.evasion',
    how: 'measured',
    note: 'dodges in the fight loop, 4.4/min measured',
    ways: [1, 2].map((t) => ({ perMin: DODGES, base: 12, tier: t, label: `dodge t${t}` })),
    lump: 0,
  },
  {
    skill: 'skill.mending',
    how: 'modeled',
    note: '4 heals/min',
    ways: [{ perMin: 4, base: 4, label: 'heal' }],
    lump: 100,
  },
  { skill: 'skill.mining', how: 'real-map', note: '', ways: gatherWays('mining', 20), lump: 200 },
  { skill: 'skill.logging', how: 'real-map', note: '', ways: gatherWays('logging', 20), lump: 200 },
  {
    skill: 'skill.foraging',
    how: 'real-map',
    note: '',
    ways: gatherWays('foraging', 150),
    lump: 600,
  },
  {
    skill: 'skill.fishing',
    how: 'real-map',
    note: '',
    ways: gatherWays('fishing', 150),
    lump: 300,
  },
  craft('skill.smithing', 'smithing', 25, 100),
  craft('skill.woodworking', 'woodworking', 25, 100),
  craft('skill.tailoring', 'tailoring', 25, 100),
  craft('skill.cooking', 'cooking', 170, 150),
  craft('skill.alchemy', 'alchemy', 25, 100),
  craft('skill.enchanting', 'enchanting', 25, 100),
  craft('skill.tinkering', 'tinkering', 25, 100),
  {
    skill: 'skill.bartering',
    how: 'modeled',
    note: '2 haggles won and 4 sales a minute at the counter',
    ways: [
      { perMin: 2, base: 14, label: 'haggle' },
      { perMin: 4, base: 3, label: 'sale' },
    ],
    lump: 60 * 4,
  },
  {
    skill: 'skill.performance',
    how: 'modeled',
    note: 'a song every 15 s',
    ways: [{ perMin: 4, base: 12, label: 'song' }],
    lump: 80 * 3,
  },
  {
    skill: 'skill.stealth',
    how: 'modeled',
    note: '2 creatures passed unseen a minute',
    ways: [{ perMin: 2, base: 8, label: 'sneak' }],
    lump: 60 * 15,
  },
  {
    skill: 'skill.survival',
    how: 'modeled',
    note: 'a camp circuit: 8 camps (6 placed, 2 on the Fernside climb), 6 paid minutes each a day, 12 minutes of walking between them, one sleep out at each camp, plus night outdoors and raw food',
    ways: [
      // 48 paid minutes in a 48 minute day plus 12 of walking: 48 of every 60 minutes pay. One
      // sleep out a camp visit, eight visits an in-game day (48 real minutes). Camp and sleep
      // are one way, since they are done together on the same circuit.
      {
        perMin:
          (48 / 60) * SKILLS_BALANCE.survival.campXpPerMinute +
          (8 / 48) * SKILLS_BALANCE.survival.sleepOutdoorsXp,
        base: 1,
        label: 'camp circuit',
      },
      {
        perMin: (30 / 2) * (10 / 48),
        base: SKILLS_BALANCE.survival.nightXpPerHour / 30,
        label: 'night outdoors',
      },
      { perMin: 1, base: 8, label: 'eat raw' },
    ],
    lump: 0,
  },
  {
    skill: 'skill.athletics',
    how: 'measured',
    note: 'sprint XP measured by the map bot holding the stick at full extent',
    ways: [{ perMin: A.athleticsXpPerMin ?? 30, base: 1, label: 'sprint' }],
    lump: 0,
  },
  {
    skill: 'skill.cartography',
    how: 'finite',
    note: `1 XP per fog block; ${A.mapBlocks ?? '?'} blocks reachable. Pays NOTHING in the live tick order (see findings)`,
    ways: [],
    lump: 0,
    finite: A.mapBlocks ?? 0,
  },
  {
    skill: 'skill.deciphering',
    how: 'finite',
    note: `100 XP per tablet kind read once; ${tablets} tablet kinds on the map`,
    ways: [],
    lump: 0,
    finite: 100 * tablets,
  },
  {
    skill: 'skill.delving',
    how: 'finite',
    note: `40 per new room (${rooms}), 60 per block puzzle (6), 400 per dungeon cleared (${BUILT_DUNGEONS.length})`,
    ways: [],
    lump: 0,
    finite: 40 * rooms + 60 * 6 + 400 * BUILT_DUNGEONS.length,
  },
];

const TRIAL_MIN: Record<string, number> = {};
for (const t of AUTHORED_TRIALS) TRIAL_MIN[t.skill] = t.estMinutes;
for (const t of Object.values(TRIALS)) TRIAL_MIN[t.skill] ??= t.estMinutes;

function xpToReach(p: number): number {
  let a = 0;
  for (let i = 0; i < p; i++) a += xpToNext(i);
  return a;
}

/** Minutes to go from 0 to `to` points, taking the best-paying way at each point. */
function minutesTo(m: Model, to: number): number | null {
  if (m.finite !== undefined) return m.finite >= xpToReach(to) ? NaN : null;
  let min = 0;
  let lump = m.lump;
  for (let p = 0; p < to; p++) {
    let need = xpToNext(p);
    const take = Math.min(lump, need);
    lump -= take;
    need -= take;
    if (need <= 0) continue;
    const rate = m.ways.reduce(
      (best, w) =>
        (w.from ?? 0) > p
          ? best
          : Math.max(best, (w.perMin * w.base * (w.tier ? challengePct(w.tier, p) : 100)) / 100),
      0,
    );
    if (rate <= 0) return null;
    min += need / rate;
  }
  return min;
}

/** Points reachable from a finite pool of XP. */
function pointsFrom(xp: number): number {
  let p = 0;
  while (p < 29 && xp >= xpToNext(p)) xp -= xpToNext(p++);
  return p;
}

/** Fights, deaths and walking between loops: measured Blades 29.6 min over this model's tier 1 figure. */
const DOWNTIME = 29.6 / calib0();
function calib0(): number {
  return (
    minutesTo(
      {
        skill: 'x',
        how: 'measured',
        note: '',
        ways: [{ perMin: HITS, base: 10, tier: 1, label: '' }],
        lump: 100,
      },
      15,
    ) ?? 1
  );
}
const rows = MODELS.map((m) => {
  const k = m.how === 'real-map' ? 1 : DOWNTIME;
  const a = minutesTo(m, 15);
  const b = minutesTo(m, 30);
  const to15 = a === null || Number.isNaN(a) ? a : a * k;
  const to30 = b === null || Number.isNaN(b) ? b : b * k;
  return {
    skill: SKILLS[m.skill]?.name ?? m.skill,
    how: m.how,
    to15: to15,
    to30: to30,
    trial: TRIAL_MIN[m.skill] ?? null,
    finitePoints: m.finite !== undefined ? pointsFrom(m.finite) : null,
    finiteXp: m.finite ?? null,
    note: m.note || m.ways.map((w) => `${w.label} ${w.perMin}/min`).join(', '),
  };
});
// Calibration: Blades on tier 1 only, no lump, against the measured 29.6 min (reports/sim-bot.md).
const calib = minutesTo(
  {
    skill: 'x',
    how: 'measured',
    note: '',
    ways: [{ perMin: HITS, base: 10, tier: 1, label: '' }],
    lump: 100,
  },
  15,
);
const pending = Object.keys(SKILLS).filter((k) => !MODELS.some((m) => m.skill === k));
console.log(
  JSON.stringify(
    {
      calibBladesT1To14Full: calib,
      rows,
      pending,
      supply: sup,
      xpTo15: xpToReach(15),
      xpTo30: xpToReach(30),
    },
    null,
    1,
  ),
);
