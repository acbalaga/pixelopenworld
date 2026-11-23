import { describe, expect, it } from 'vitest';
import { DIALOGUES, NPCS } from '../../src/content/dialogue';
import { AUTHORED_TRIALS } from '../../src/content/skills/dawnmeadowTrials';
import { SKILLS, TRIALS } from '../../src/content/skills';
import { TECHNIQUES } from '../../src/content/combat/techniques';
import { DIALOGUE_STRINGS } from '../../src/content/strings/dialogue';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import { spawnEnemy } from '../../src/sim/combat/enemy';
import type { SimEvent } from '../../src/sim/kernel/events';
import { trialPassed } from '../../src/sim/skills';
import { createDemoState, type SimState } from '../../src/sim/state';
import { stepWorld } from '../../src/sim/step';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { mapSystem } from '../../src/sim/systems/map';
import { trialsSystem } from '../../src/sim/systems/trials';

const OPEN = { solidAt: (): number => 0 };
const name = (skill: string): string => skill.replace(/^skill\./, '');

function world(giver: string): { s: SimState; me: number } {
  const s = createDemoState(9, 0);
  s.world = OPEN;
  const f = feetAt(20, 20);
  const me = createAvatar(s, f.x, f.y);
  spawnNpc(s, giver, 21, 20);
  // The ground here is already uncovered, so standing still reveals nothing that counts for an explore Trial.
  mapSystem(s);
  s.events.list.length = 0;
  return { s, me };
}

/** One tick of the Trials system with these events, as the other systems would have sent them. */
function feed(s: SimState, ...evs: SimEvent[]): void {
  s.tick++;
  s.events.list.length = 0;
  s.events.list.push(...evs);
  trialsSystem(s);
}

const passed = (s: SimState, me: number, skill: string): boolean =>
  trialPassed(s.entities.comps.skills[me]!, skill, 15);

describe('Dawnmeadow rank 15 Trials (M4-12)', () => {
  it('are twenty six, for twenty six different skills that exist, each a rank 15 Trial of its own', () => {
    expect(AUTHORED_TRIALS).toHaveLength(26);
    expect(new Set(AUTHORED_TRIALS.map((t) => t.skill)).size).toBe(26);
    for (const t of AUTHORED_TRIALS) {
      expect(SKILLS[t.skill], t.skill).toBeDefined();
      const def = TRIALS[`trial.${name(t.skill)}.15`]!;
      expect(def.threshold).toBe(15);
      expect(def.skill).toBe(t.skill);
      expect(NPCS[t.giver], t.giver).toBeDefined();
      expect(def.estMinutes).toBeGreaterThan(0);
    }
  });

  it('give every wired skill the first map did not test, and the skills named in the doc, a Trial', () => {
    const named = [
      'shieldcraft',
      'bartering',
      'tailoring',
      'alchemy',
      'enchanting',
      'deciphering',
      'stealth',
      'woodworking',
      'logging',
      'tinkering',
      'fishing',
      'mining',
      'survival',
      'cartography',
      // The two the first map gave to the wrong people, now with Tobin and Tamsin.
      'smithing',
      'athletics',
      // The ten that had no Dawnmeadow trainer (the PR 110 query).
      'heavy_arms',
      'archery',
      'unarmed',
      'tide',
      'gale',
      'stone',
      'mending',
      'hexing',
      'performance',
      'delving',
    ];
    for (const n of named) expect(TRIALS[`trial.${n}.15`], n).toBeDefined();
  });

  it('are worded plainly: a clue in the hint, the giver named, no em dash anywhere', () => {
    for (const t of AUTHORED_TRIALS) {
      const all = [t.intro, t.hint, t.button].join('\n');
      expect(all, t.skill).not.toMatch(/[—–]/);
      expect(DIALOGUE_STRINGS[`trial.${name(t.skill)}.15.intro`], t.skill).toBe(t.intro);
      expect(t.hint, t.skill).toContain(NPCS[t.giver]!.name.split(' ')[0]!.replace('Old', 'Old'));
    }
  });

  for (const t of AUTHORED_TRIALS) {
    it(`${name(t.skill)}: offered by ${NPCS[t.giver]!.name}, and passed by what it asks`, () => {
      const { s, me } = world(t.giver);
      const id = `trial.${name(t.skill)}.15`;
      // Offered through the giver's own menu: the test node's choice for this skill.
      const tests = DIALOGUES[t.giver]!.nodes['rq_tests']!;
      const at = tests.choices!.findIndex((c) => c.text === `dlg.rq.t_${name(t.skill)}`);
      expect(at, 'the giver offers it').toBeGreaterThanOrEqual(0);
      stepWorld(s, me, {
        commands: [{ type: 'talk', npc: t.giver, node: 'rq_tests', choice: at }],
      });
      const sk = s.entities.comps.skills[me]!;
      expect(sk.offered, 'offered').toContain(id);
      expect(passed(s, me, t.skill)).toBe(false);

      const o = t.objective;
      if (o.kind === 'craft') {
        feed(s, {
          type: 'crafted',
          id: me,
          tag: 'x',
          recipe: o.recipe,
          tier: 1,
          item: 'item.x',
          qty: 1,
          quality: o.minQuality,
          source: 'manual',
        });
      } else if (o.kind === 'gather') {
        for (let i = 0; i < o.count; i++) {
          // One short of the count is not enough.
          expect(passed(s, me, t.skill)).toBe(false);
          feed(s, { type: 'gathered', id: me, tag: 'x', item: o.item!, tier: 1, qty: 1 });
        }
      } else if (o.kind === 'explore') {
        feed(s, { type: 'revealed', who: me, blocks: o.blocks - 1 });
        expect(passed(s, me, t.skill)).toBe(false);
        feed(s, { type: 'revealed', who: me, blocks: 1 });
      } else if (o.kind === 'defeat') {
        const tag = o.only?.weapon ?? o.only?.element ?? 'blades';
        const kill = (tg: string): SimEvent => {
          const foe = spawnEnemy(s, o.creature!, 400, 300);
          s.entities.comps.fighter[foe]!.state = 'dead';
          return {
            type: 'damageDealt',
            src: me,
            dst: foe,
            amount: 3,
            crit: false,
            bonus: false,
            heavy: false,
            tag: tg,
          };
        };
        // A kill made with something else does not count, however many there are.
        for (let i = 0; i < o.count; i++) feed(s, kill('wrong'));
        expect(passed(s, me, t.skill), 'the wrong weapon').toBe(false);
        for (let i = 0; i < o.count; i++) {
          expect(passed(s, me, t.skill)).toBe(false);
          feed(s, kill(tag));
        }
      } else if (o.kind === 'perform' && o.action === 'technique') {
        const attackless = !TECHNIQUES[o.technique!]!.attack;
        const song = Boolean(TECHNIQUES[o.technique!]!.channel);
        for (let i = 0; i < o.count; i++) {
          expect(passed(s, me, t.skill)).toBe(false);
          // A song counts when it finishes, a self cast when it is cast, an attack when it starts.
          feed(
            s,
            song
              ? { type: 'perform', who: me, technique: o.technique! }
              : attackless
                ? { type: 'techniqueUsed', who: me, technique: o.technique! }
                : { type: 'attackStarted', id: me, attack: TECHNIQUES[o.technique!]!.attack! },
          );
        }
      } else if (o.kind === 'perform') {
        const ev = (): SimEvent =>
          o.action === 'parry'
            ? { type: 'parried', who: me, src: 99 }
            : o.action === 'haggle'
              ? { type: 'haggleWon', who: me, shop: 'shop.brin', item: 'item.x', price: 1 }
              : o.action === 'sleepOutdoors'
                ? { type: 'sleptOutdoors', who: me, wake: null }
                : {
                    type: 'manualRead',
                    who: me,
                    item: 'item.manual_hide',
                    technique: 'technique.x',
                  };
        for (let i = 0; i < o.count; i++) {
          expect(passed(s, me, t.skill)).toBe(false);
          feed(s, ev());
        }
      } else if (o.kind === 'reach') {
        // Touch the portal, then arrive in the room in time.
        spawnFixture(s, o.from, 20, 21);
        feed(s);
        feed(s, { type: 'roomChanged', who: me, from: 'x', to: o.room });
      } else throw new Error(`unhandled objective ${o.kind}`);
      expect(passed(s, me, t.skill), 'passed').toBe(true);
    });
  }

  it('an event from another avatar does not pass it', () => {
    const { s, me } = world('npc.scholar');
    s.entities.comps.skills[me]!.offered.push('trial.deciphering.15');
    feed(s, {
      type: 'manualRead',
      who: me + 5,
      item: 'item.manual_hide',
      technique: 'technique.x',
    });
    expect(passed(s, me, 'skill.deciphering')).toBe(false);
  });
});
