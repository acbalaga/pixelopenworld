import { SCENES as SCENE_BALANCE } from '../../content/balance/chat';
import { CAMP, YARD } from '../../content/balance/travelers';
import { SCENES } from '../../content/chat/scenes';
import type { ChatScene } from '../../content/chat/types';
import type { SimState } from '../state';
import type { Crowd } from '../travelers/crowd';
import type { SceneKind } from '../travelers/entities';
import { identitiesOf } from '../travelers/generate';
import { PLACE_LIST } from '../travelers/lists';
import type { TravelerIdentity } from '../travelers/types';

/**
 * Small scenes (POW-M5-27): fountain wishes, inn dance-offs, camp ghost stories and arguments with
 * the training dummy. This is the planner. It reads the state, picks a scene that could happen now
 * within its hourly cap, and returns what should be said and which entity effects to start. The chat
 * engine voices and queues the lines and applies the effects. Pure in its inputs: dice and counts are
 * passed in, nothing here touches a sim stream or the clock.
 */

export interface ScenePlan {
  /** The key counted against the hourly cap. */
  kind: ChatScene['kind'];
  scene: ChatScene;
  /** Speakers by slot, one per line. */
  lines: { slot: number; text: string }[];
  fx: { slot: number; kind: SceneKind; ticks: number }[];
  /** Who wished, if this is a wish. */
  wisher?: number;
}

export interface SceneInput {
  state: SimState;
  crowd: Crowd;
  /** The abstract minute, the in-game phase, and the real local hour index (for the cap). */
  minute: number;
  phase: string;
  /** Scenes of each kind already planned this real hour. */
  used: (kind: ChatScene['kind']) => number;
  /** A speaker is free to talk now. */
  canSpeak: (slot: number) => boolean;
  /** Cooldown check and set for a Traveler in a kind of scene. */
  cooled: (kind: string, slot: number) => boolean;
  /** Template ids said lately in Local, so a scene is not repeated inside the window. */
  recent: readonly string[];
  dice: () => number;
}

const placeOf = (crowd: Crowd, slot: number): string | null => {
  const d = crowd.doing[slot];
  return d && d.eta === 0 ? (PLACE_LIST[d.place] ?? null) : null;
};

const pickScene = (
  kind: ChatScene['kind'],
  d: () => number,
  ok?: (s: ChatScene) => boolean,
): ChatScene | null => {
  const pool = SCENES.filter((s) => s.kind === kind && (!ok || ok(s)));
  if (pool.length === 0) return null;
  let r = d() * pool.reduce((a, s) => a + s.weight, 0);
  for (const s of pool) {
    r -= s.weight;
    if (r < 0) return s;
  }
  return pool[pool.length - 1] ?? null;
};

const TIE_GROUP: readonly string[] = ['friend', 'sibling', 'mentor'];

const mates = (state: SimState, ids: readonly TravelerIdentity[], a: number, b: number): boolean =>
  ids[a]!.ties.some((t) => t.slot === b && TIE_GROUP.includes(t.kind)) ||
  (state.travelers[a]!.guild !== 0 && state.travelers[a]!.guild === state.travelers[b]!.guild);

/** Top-skill rank of a Traveler, as the chat engine reads it: points rounded down to 5. */
function rankOf(state: SimState, slot: number): number {
  let top = 0;
  for (const [, p] of state.travelers[slot]!.build) top = Math.max(top, p);
  return Math.floor(top / 5) * 5;
}

export function planScenes(inp: SceneInput): ScenePlan[] {
  const { state, crowd, phase, dice } = inp;
  const ids = identitiesOf(crowd.seed);
  const plans: ScenePlan[] = [];
  const promoted = [...crowd.ents.values()].filter((e) => !e.scene && crowd.online[e.slot]);
  const room = (kind: ChatScene['kind']): boolean => inp.used(kind) < SCENE_BALANCE.capPerHour;
  const at = (e: { slot: number }, place: string | readonly string[]): boolean => {
    const p = placeOf(crowd, e.slot);
    if (p === null) return false;
    return typeof place === 'string' ? p === place : place.includes(p);
  };
  const fresh = (s: ChatScene): boolean => !inp.recent.includes(s.id);
  const social = (e: { slot: number }): boolean => crowd.doing[e.slot]?.kind === 'social';
  const pick = <T>(list: readonly T[]): T => list[Math.floor(dice() * list.length)] as T;

  // A wish at the well.
  if (room('wish') && dice() < SCENE_BALANCE.chance.wish) {
    const c = promoted.filter(
      (e) =>
        social(e) &&
        at(e, 'hearthford.square') &&
        inp.canSpeak(e.slot) &&
        inp.cooled('wish', e.slot),
    );
    const scene = c.length > 0 ? pickScene('wish', dice, fresh) : null;
    if (scene) {
      const w = pick(c);
      plans.push({
        kind: 'wish',
        scene,
        lines: scene.lines.map((l) => ({ slot: w.slot, text: l.text })),
        fx: [{ slot: w.slot, kind: 'wish', ticks: SCENE_BALANCE.wishTicks }],
        wisher: w.slot,
      });
    }
  }

  // A dance-off at the inn at dusk: two or three mates in a social group.
  if (phase === 'dusk' && room('dance') && dice() < SCENE_BALANCE.chance.dance) {
    const c = promoted.filter(
      (e) => social(e) && at(e, 'hearthford.inn') && inp.cooled('dance', e.slot),
    );
    const scene = c.length >= 2 ? pickScene('dance', dice, fresh) : null;
    if (scene) {
      const lead = pick(c);
      const rest = c.filter((e) => e !== lead && mates(state, ids, lead.slot, e.slot));
      const crew = [lead, ...rest.slice(0, 2)];
      if (crew.length >= 2 && crew.every((e) => inp.canSpeak(e.slot))) {
        const [a, b, third] = crew as [typeof lead, typeof lead, typeof lead | undefined];
        const who = { a, b, c: third ?? a };
        plans.push({
          kind: 'dance',
          scene,
          lines: scene.lines.map((l) => ({ slot: who[l.role].slot, text: l.text })),
          fx: crew.map((e) => ({
            slot: e.slot,
            kind: 'dance' as const,
            ticks:
              SCENE_BALANCE.danceTicks[0] +
              Math.floor(dice() * (SCENE_BALANCE.danceTicks[1] - SCENE_BALANCE.danceTicks[0])),
          })),
        });
      }
    }
  }

  // A ghost story at a camp at night: two who are sitting up.
  if (phase === 'night' && room('ghost') && dice() < SCENE_BALANCE.chance.ghost) {
    for (const camp of CAMP.places) {
      const c = promoted.filter((e) => social(e) && at(e, camp) && inp.canSpeak(e.slot));
      if (c.length < 2) continue;
      const scene = pickScene('ghost', dice, fresh);
      if (!scene) break;
      const a = pick(c);
      const b = pick(c.filter((e) => e !== a));
      if (!inp.cooled('ghost', a.slot)) break;
      plans.push({
        kind: 'ghost',
        scene,
        lines: scene.lines.map((l) => ({ slot: l.role === 'a' ? a.slot : b.slot, text: l.text })),
        fx: [],
      });
      break;
    }
  }

  // A low-rank Traveler argues with the dummy, and a friend sometimes teases.
  if (room('dummy') && dice() < SCENE_BALANCE.chance.dummy) {
    const c = promoted.filter(
      (e) =>
        social(e) &&
        at(e, YARD.place) &&
        rankOf(state, e.slot) < SCENE_BALANCE.dummyRankUnder &&
        inp.canSpeak(e.slot) &&
        inp.cooled('dummy', e.slot),
    );
    if (c.length > 0) {
      const a = pick(c);
      const friend =
        crowd.ents.size === 0
          ? undefined
          : [...crowd.ents.values()].find(
              (e) =>
                e.slot !== a.slot &&
                ids[a.slot]!.ties.some((t) => t.slot === e.slot && t.kind === 'friend') &&
                inp.canSpeak(e.slot),
            );
      const scene = pickScene(
        'dummy',
        dice,
        (s) => fresh(s) && (friend !== undefined || s.lines.every((l) => l.role === 'a')),
      );
      if (scene)
        plans.push({
          kind: 'dummy',
          scene,
          lines: scene.lines.map((l) => ({
            slot: l.role === 'a' || !friend ? a.slot : friend.slot,
            text: l.text,
          })),
          fx: [{ slot: a.slot, kind: 'dummy', ticks: SCENE_BALANCE.dummyTicks }],
        });
    }
  }
  return plans;
}

/** The scene for a wish that came true after `on`, or null. */
export function cameTrue(
  on: 'rank' | 'drop',
  dice: () => number,
  recent: readonly string[],
): ChatScene | null {
  return pickScene('wishCame', dice, (s) => s.on === on && !recent.includes(s.id));
}
