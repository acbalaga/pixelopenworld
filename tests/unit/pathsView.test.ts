import { describe, expect, it } from 'vitest';
import { PATHS_BALANCE as B } from '../../src/content/balance/paths';
import { TIME } from '../../src/content/balance/time';
import { PATHS } from '../../src/content/paths';
import { DEEDS } from '../../src/content/paths/deeds';
import { PATH_STRINGS } from '../../src/content/strings/paths';
import { createAvatar, feetAt } from '../../src/sim/avatar';
import type { SimEvent } from '../../src/sim/kernel/events';
import { createDemoState, type SimState } from '../../src/sim/state';
import { deedsSystem, pathsSystem } from '../../src/sim/systems/deeds';
import { characterView, pathsView } from '../../src/ui/menu/model';

const DAY = TIME.phases.reduce((n, p) => n + p.minutes, 0) * TIME.ticksPerMinute;
interface Rig {
  s: SimState;
  me: number;
}
function rig(): Rig {
  const s = createDemoState(7, 0);
  s.world = { solidAt: () => 0 };
  return { s, me: createAvatar(s, feetAt(20, 20).x, feetAt(20, 20).y) };
}
const comps = (r: Rig) => ({
  paths: r.s.entities.comps.paths[r.me]!,
  skills: r.s.entities.comps.skills[r.me]!,
});
function feed(r: Rig, id: string, times: number): void {
  const def = DEEDS[id]!;
  const m = (Array.isArray(def.on) ? def.on : [def.on])[0]!;
  for (let i = 0; i < times; i++) {
    r.s.events.list.length = 0;
    const e: Record<string, unknown> = { type: m.type, [m.by]: r.me, ...(m.is ?? {}) };
    if (m.type === 'killed')
      Object.assign(e, { dst: 99, kind: e.kind ?? 'creature.x', tag: 'blades' });
    r.s.events.list.push(e as unknown as SimEvent);
    deedsSystem(r.s);
  }
  r.s.events.list.length = 0;
  pathsSystem(r.s);
}
function earnDuelist(r: Rig): void {
  const p = PATHS['path.duelist']!;
  for (const [sk, n] of Object.entries(p.requires.skills ?? {})) comps(r).skills.points[sk] = n;
  for (const [d, n] of Object.entries(p.requires.deeds ?? {})) feed(r, d, n);
}

describe('what the UI model shows', () => {
  it('a hidden Path never appears before it is earned, not even as a hint', () => {
    const r = rig();
    // Every requirement but the last of both hidden Paths.
    r.s.worldTick = DAY * 10;
    feed(r, 'deed.mossling_meets', B.mossfriend.meets - 1);
    feed(r, 'deed.mossling_kills', B.pestward.kills - 1);
    expect(pathsView(r.s, r.me).map((p) => p.id)).not.toContain('path.mossfriend');
    expect(pathsView(r.s, r.me).map((p) => p.id)).not.toContain('path.pestward');
    // Even with part of a hidden Path done, the model lists no hidden Path.
    for (const row of pathsView(r.s, r.me)) expect(PATHS[row.id]!.hidden).toBe(false);
    feed(r, 'deed.mossling_kills', 1);
    expect(pathsView(r.s, r.me).map((p) => p.id)).toContain('path.pestward');
    expect(characterView(r.s, r.me).paths.some((p) => p.id === 'path.pestward')).toBe(true);
  });

  it('a standard Path shows as a hint, with no numbers, once one requirement is met, and as a gift once earned', () => {
    const r = rig();
    expect(pathsView(r.s, r.me)).toEqual([]);
    comps(r).skills.points['skill.blades'] = 15;
    const rows = pathsView(r.s, r.me);
    const duel = rows.find((p) => p.id === 'path.duelist')!;
    expect(duel).toMatchObject({ earned: false, worn: false, gift: '' });
    expect(duel.hint).not.toMatch(/\d/);
    earnDuelist(r);
    const after = pathsView(r.s, r.me).find((p) => p.id === 'path.duelist')!;
    expect(after).toMatchObject({ earned: true, worn: true, shown: true });
    expect(after.gift).toBe(PATH_STRINGS['path.duelist.gift']);
    // Earned ones come first.
    expect(pathsView(r.s, r.me)[0]!.earned).toBe(true);
  });
});
