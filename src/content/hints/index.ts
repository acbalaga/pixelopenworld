/**
 * Contextual hints (design/09 Onboarding). One line, shown the first time an action becomes
 * possible, gone when the player does it (or after `expire` ticks), never shown twice. They never
 * concern hidden-layer content. Text lives in `content/strings/ui.ts` under `hints`.
 */

/** When a hint may appear. */
export type Opportunity =
  /** Right away, once the avatar has had a moment to arrive. */
  | { kind: 'start'; afterTicks: number }
  /** A creature has noticed the avatar. */
  | { kind: 'foeNoticed' }
  /** A creature has begun an attack. */
  | { kind: 'foeAttacking' }
  /** A ready gathering node is within reach. */
  | { kind: 'nodeInReach' }
  /** A camp pot is within reach. */
  | { kind: 'potInReach' }
  /** The avatar has been playing this many ticks in all. */
  | { kind: 'playTime'; ticks: number };

/** What clears it. */
export type Done =
  /** The avatar has walked this far (px) from where the hint appeared. */
  | { kind: 'moved'; px: number }
  /** A sim event of this type, with the extra test the system applies for that type. */
  | {
      kind: 'event';
      type: 'lockChanged' | 'dodgeStarted' | 'techniqueUsed' | 'gatherStarted' | 'cooked';
    }
  /** The interface reports it (the Menu opened), by the `hint` command. */
  | { kind: 'ui' };

export interface HintDef {
  id: string;
  /** Key under `UI_STRINGS.hints`. */
  text: string;
  when: Opportunity;
  done: Done;
  /** Ticks on screen before it counts as shown and goes away on its own (30 ticks per second). */
  expire: number;
}

const SEC = 30;

/** In the order they are offered when more than one could show. */
export const HINTS: readonly HintDef[] = [
  {
    id: 'hint.move',
    text: 'move',
    when: { kind: 'start', afterTicks: SEC },
    done: { kind: 'moved', px: 32 },
    expire: 25 * SEC,
  },
  {
    id: 'hint.lock',
    text: 'lock',
    when: { kind: 'foeNoticed' },
    done: { kind: 'event', type: 'lockChanged' },
    expire: 20 * SEC,
  },
  {
    id: 'hint.dodge',
    text: 'dodge',
    when: { kind: 'foeAttacking' },
    done: { kind: 'event', type: 'dodgeStarted' },
    expire: 15 * SEC,
  },
  {
    id: 'hint.technique',
    text: 'technique',
    when: { kind: 'foeNoticed' },
    done: { kind: 'event', type: 'techniqueUsed' },
    expire: 20 * SEC,
  },
  {
    id: 'hint.gather',
    text: 'gather',
    when: { kind: 'nodeInReach' },
    done: { kind: 'event', type: 'gatherStarted' },
    expire: 20 * SEC,
  },
  {
    id: 'hint.cook',
    text: 'cook',
    when: { kind: 'potInReach' },
    done: { kind: 'event', type: 'cooked' },
    expire: 25 * SEC,
  },
  {
    id: 'hint.menu',
    text: 'menu',
    when: { kind: 'playTime', ticks: 90 * SEC },
    done: { kind: 'ui' },
    expire: 25 * SEC,
  },
];

export const HINT_BY_ID: Readonly<Record<string, HintDef>> = Object.fromEntries(
  HINTS.map((h) => [h.id, h]),
);
