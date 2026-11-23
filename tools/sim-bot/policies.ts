import { MOSSLING, Run } from '../../tests/support/bots';
import { withRustySword } from '../../tests/support/oldKit';
import { SKILLS_BALANCE } from '../../src/content/balance/skills';
import { TIME } from '../../src/content/balance/time';
import { spawnNode } from '../../src/sim/items';
import { spawnFixture } from '../../src/sim/systems/fixtures';
import { spawnNpc } from '../../src/sim/systems/npcs';
import { requestState } from '../../src/sim/journal';

/**
 * Sim bot policies, v1 (POW-M3-12). Each is one iteration of a loop a player runs: gather, fight,
 * craft, take requests. They drive the real sim through `tests/support/bots.ts` (the same bots
 * the xp report used) and take every sweet spot, so the numbers are a fast, careful player's.
 *
 * The world is the slice's own supply: three herb patches and two berry bushes, a camp pot, a
 * shopkeeper and the guard. Nodes come back on the timers in `content/items/recipes.ts`.
 */

/** Herb patches and berry bushes, as tiles, in the order a forager walks them. */
export const FORAGE_NODES: readonly [number, number][] = [
  [25, 30],
  [21, 30],
  [25, 32],
  [21, 32],
  [25, 34],
];

const FORAGED = ['item.sunwort', 'item.dewmint', 'item.berry_red', 'item.berry_blue'];
const DISHES = ['item.herb_tea', 'item.berry_compote', 'item.sunwort_porridge'];
/** What the camp pot can make from foraged things, in the order the cook tries them. */
const COOK: readonly (readonly string[])[] = [
  ['item.sunwort', 'item.dewmint'],
  ['item.berry_red', 'item.berry_blue'],
  ['item.sunwort', 'item.berry_blue'],
];

export interface Policy {
  id: 'gather' | 'fight' | 'craft' | 'request' | 'fish' | 'survive';
  label: string;
  /** The skill whose time to rank 15 this loop measures, if it is the loop for one. */
  skill?: string;
  /**
   * `slow` for the gathering and crafting loops: on the first map they are paced by how fast the
   * nodes come back, so they take longer than combat to rank 15, and are meant to (they pay in
   * kind: each gather and each dish is worth a lot).
   */
  pace?: 'quick' | 'slow';
  seed: number;
  /** Called once with the run, before the first step. */
  setup?(run: Run): void;
  /** One iteration. `n` counts from 0. */
  step(run: Run, n: number): void;
}

/** Works the next node in turn. */
function forage(run: Run, n: number): void {
  const [x, y] = FORAGE_NODES[n % FORAGE_NODES.length] as [number, number];
  run.gather(x, y, true);
  run.run(200);
}

function sellAll(run: Run, items: readonly string[]): void {
  for (const i of items) run.sellAll(i);
}

export const GATHER: Policy = {
  id: 'gather',
  label: 'Forage the herb patches and berry bushes, sell what is gathered',
  skill: 'skill.foraging',
  pace: 'slow',
  seed: 12,
  step(run, n) {
    forage(run, n);
    if (n % 10 === 9) sellAll(run, FORAGED);
  },
};

export const FIGHT: Policy = {
  id: 'fight',
  label: 'Fight Mosslings with the sword, sell the loot',
  skill: 'skill.blades',
  seed: 11,
  // The thresholds measure the loop with the base sword. A new character starts with a dagger.
  setup(run) {
    withRustySword(run.s, run.me);
  },
  step(run, n) {
    run.fight(MOSSLING, { eatBelow: 40 });
    if (run.dead) run.recover();
    run.run(60);
    if (n % 20 === 19) sellAll(run, ['item.moss_tuft']);
  },
};

export const CRAFT: Policy = {
  id: 'craft',
  label: 'Forage, cook at the camp pot, sell the dishes',
  skill: 'skill.cooking',
  pace: 'slow',
  seed: 13,
  step(run, n) {
    forage(run, n);
    for (let again = true; again;) {
      again = false;
      for (const recipe of COOK)
        if (recipe.every((i) => run.count(i) >= 1)) {
          run.cook([...recipe]);
          again = true;
          break;
        }
    }
    if (n % 10 === 9) sellAll(run, DISHES);
  },
};

/** A scholar to take lamp oil to, and a board to take jobs from, placed beside the shop. */
const SCHOLAR = [36, 30] as const;
const BOARD = [30, 23] as const;

export const REQUEST: Policy = {
  id: 'request',
  label: "Take Orla's and Wren's requests, then the board's gathering jobs",
  seed: 14,
  setup(run) {
    spawnNpc(run.s, 'npc.scholar', SCHOLAR[0], SCHOLAR[1]);
    spawnFixture(run.s, 'fixture.board', BOARD[0], BOARD[1]);
  },
  step(run, n) {
    const j = run.s.entities.comps.journal[run.me]!;
    const st = (id: string): string => requestState(j, id);
    // Orla's pests: four Mosslings.
    if (st('request.clear_pests') === 'none') run.talk('npc.guard', 'ask', 0);
    if (st('request.clear_pests') === 'active') {
      run.fight(MOSSLING, { eatBelow: 40 });
      if (run.dead) run.recover();
      return;
    }
    if (st('request.clear_pests') === 'ready') run.talk('npc.guard', 'report', -1);
    // Wren's oil: two flasks from the shop, handed over by the context button.
    if (st('request.old_lamps') === 'none' && st('request.clear_pests') === 'done') {
      run.stand(SCHOLAR[0] - 2, SCHOLAR[1], 2);
      run.tick({ type: 'talk', npc: 'npc.scholar', node: 'lamps_ask', choice: 0 });
    }
    if (st('request.old_lamps') === 'active') {
      if (run.count('item.lantern_oil') < 2) run.buy('item.lantern_oil', 2);
      run.stand(SCHOLAR[0] - 1, SCHOLAR[1], 2);
      run.tick({ type: 'interact' });
      run.run(10);
    }
    if (st('request.old_lamps') === 'ready') {
      run.stand(SCHOLAR[0] - 2, SCHOLAR[1], 2);
      run.tick({ type: 'talk', npc: 'npc.scholar', node: 'lamps_report', choice: -1 });
    }
    if (st('request.clear_pests') !== 'done' || st('request.old_lamps') === 'active') return;
    // Then the board: take what is posted, work it, hand it in.
    run.stand(BOARD[0], BOARD[1] + 1, 0);
    for (const id of Object.keys(j.requests))
      if (j.requests[id]?.state === 'ready') run.tick({ type: 'turnInRequest', id });
    const open = Object.values(j.requests).some((r) => r.state === 'active');
    if (!open) {
      const board = run.s.entities.comps.board.find((b) => b);
      // Take a job the bot can do: something it forages (handed in at the board) or a creature
      // it can fight. The rest stay posted.
      const next = board?.posted.find((d) => {
        const s = d.solutions[0]?.steps[0];
        return (
          (s?.kind === 'deliver' && s.to === board.id && FORAGED.includes(s.item)) ||
          s?.kind === 'defeat'
        );
      });
      if (board && next) run.tick({ type: 'takeRequest', board: board.id, id: next.id });
      else run.run(600);
    }
    for (const r of Object.values(j.requests)) {
      if (r.state !== 'active') continue;
      const step = r.gen?.solutions[0]?.steps[0];
      // A board gather job is a hand-in (POW-M4-22A): forage what it asks for, and the loop
      // above hands it in at the board once the bag holds enough.
      if (
        step?.kind === 'gather' ||
        (step?.kind === 'deliver' &&
          r.gen &&
          'board' in r.gen.giver &&
          step.to === r.gen.giver.board)
      )
        forage(run, n);
      else if (step?.kind === 'defeat') run.fight(step.creature ?? MOSSLING, { eatBelow: 40 });
      else run.run(300);
    }
  },
};

/**
 * Four fishing spots along one stretch of bank, a few tiles apart, as the river east of
 * Hearthford has them in Dawnmeadow (POW-M4-23B). Each comes back after three minutes.
 */
export const FISH_SPOTS: readonly [number, number][] = [
  [45, 40],
  [45, 43],
  [45, 46],
  [45, 49],
];

/** Casts at the spot, waits for the bite and takes it. */
function fish(run: Run, n: number): void {
  const [x, y] = FISH_SPOTS[n % FISH_SPOTS.length] as [number, number];
  run.stand(x + 1, y, 6);
  run.tick({ type: 'interact' });
  const g = (): { t: number; wait: number } | null | undefined =>
    run.s.entities.comps.gather[run.me];
  for (let i = 0; i < 400; i++) {
    const c = g();
    if (!c || c.t >= c.wait) break;
    run.tick();
  }
  run.tick({ type: 'interact' });
  run.run(30);
}

export const FISH: Policy = {
  id: 'fish',
  label: 'Fish a stretch of river bank, sell the catch',
  skill: 'skill.fishing',
  pace: 'slow',
  seed: 15,
  setup(run) {
    for (const [x, y] of FISH_SPOTS) spawnNode(run.s, 'node.fishing_spot', x * 16 + 8, y * 16 + 14);
  },
  step(run, n) {
    fish(run, n);
    if (n % 10 === 9) sellAll(run, ['item.fish_river', 'item.fish_silver']);
  },
};

/**
 * Eight camps across the open ground, as in Dawnmeadow (six placed, two on the Fernside climb),
 * far enough apart that standing at one is not standing at another.
 */
export const CAMPS: readonly [number, number][] = [
  [10, 10],
  [30, 10],
  [50, 10],
  [70, 10],
  [10, 80],
  [30, 80],
  [50, 80],
  [70, 80],
];

/** Minutes the bot stands at each camp: what a camp pays in a day. */
const CAMP_STAY = SKILLS_BALANCE.survival.campMinutesPerDay;

export const SURVIVE: Policy = {
  id: 'survive',
  label: 'Walk a circuit of camps, sleep out at each and stand there a while',
  skill: 'skill.survival',
  pace: 'slow',
  seed: 16,
  setup(run) {
    for (const [x, y] of CAMPS) spawnFixture(run.s, 'fixture.rest_point', x + 1, y);
  },
  // One step is one minute at a camp. The circuit walk between camps is taken as free here: the
  // real map's camps are a minute or two apart on foot.
  step(run, n) {
    const [x, y] = CAMPS[Math.floor(n / CAMP_STAY) % CAMPS.length] as [number, number];
    if (n % CAMP_STAY === 0) {
      run.stand(x, y, 2);
      run.tick({ type: 'sleep' });
    }
    run.run(TIME.ticksPerMinute);
  },
};

export const POLICIES: readonly Policy[] = [GATHER, FIGHT, CRAFT, REQUEST, FISH, SURVIVE];
