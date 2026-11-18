import type { Mod } from '../items/affixes';
import { STATUS_BALANCE as B } from '../balance/status';

/** The eleven statuses of design/04. Each has one icon with its own shape and one clear rule. */
export type StatusId =
  | 'burning'
  | 'wet'
  | 'chilled'
  | 'staggered'
  | 'poisoned'
  | 'hexed'
  | 'rooted'
  | 'dazed'
  | 'warded'
  | 'fed'
  | 'rested';

/** The six schools, as the element ids attacks and fixtures use. */
export type ElementId = 'ember' | 'tide' | 'gale' | 'stone' | 'mending' | 'hexing';

export interface StatusDef {
  id: StatusId;
  /** Sprite id in the ui atlas. Fed shows its meal's own icon instead. */
  iconKey: string;
  /** Default length in ticks. */
  ticks: number;
  /** `refresh`: applying again restarts the timer. `none`: applying again does nothing. */
  stacks: 'refresh' | 'none';
  mods?: readonly Mod[];
  tickEffect?: { every: number; damage?: number; heal?: number };
  /** Key in `UI_STRINGS.statusRules`: one sentence for Help. */
  rule: string;
}

/** Display order. At most `maxShown` are drawn, taken from the front of this list. */
export const STATUS_PRIORITY: readonly StatusId[] = [
  'staggered',
  'rooted',
  'burning',
  'poisoned',
  'hexed',
  'chilled',
  'dazed',
  'wet',
  'warded',
  'fed',
  'rested',
];

export const STATUSES: Readonly<Record<StatusId, StatusDef>> = {
  burning: {
    id: 'burning',
    iconKey: 'ui.status_burning',
    ticks: B.burning.ticks,
    stacks: 'refresh',
    tickEffect: { every: B.burning.every, damage: B.burning.damage },
    rule: 'burning',
  },
  wet: {
    id: 'wet',
    iconKey: 'ui.status_wet',
    ticks: B.wet.ticks,
    stacks: 'refresh',
    rule: 'wet',
  },
  chilled: {
    id: 'chilled',
    iconKey: 'ui.status_chilled',
    ticks: B.chilled.ticks,
    stacks: 'refresh',
    mods: [{ stat: 'moveSpeed', pct: B.chilled.slowPct }],
    rule: 'chilled',
  },
  staggered: {
    id: 'staggered',
    iconKey: 'ui.status_staggered',
    ticks: B.staggered.ticks,
    stacks: 'refresh',
    rule: 'staggered',
  },
  poisoned: {
    id: 'poisoned',
    iconKey: 'ui.status_poisoned',
    ticks: B.poisoned.ticks,
    stacks: 'refresh',
    tickEffect: { every: B.poisoned.every, damage: B.poisoned.damage },
    rule: 'poisoned',
  },
  hexed: {
    id: 'hexed',
    iconKey: 'ui.status_hexed',
    ticks: B.hexed.ticks,
    stacks: 'refresh',
    mods: [{ stat: 'defense', add: B.hexed.defense }],
    rule: 'hexed',
  },
  rooted: {
    id: 'rooted',
    iconKey: 'ui.status_rooted',
    ticks: B.rooted.ticks,
    stacks: 'none',
    rule: 'rooted',
  },
  dazed: {
    id: 'dazed',
    iconKey: 'ui.status_dazed',
    ticks: B.dazed.ticks,
    stacks: 'none',
    rule: 'dazed',
  },
  warded: {
    id: 'warded',
    iconKey: 'ui.status_warded',
    ticks: B.warded.ticks,
    stacks: 'refresh',
    mods: [{ stat: 'defense', add: B.warded.defense }],
    rule: 'warded',
  },
  // Fed takes its pool bonuses from the meal that started it (see `statusMods`).
  fed: {
    id: 'fed',
    iconKey: 'ui.icon_context',
    ticks: B.fedTicks,
    stacks: 'refresh',
    rule: 'fed',
  },
  rested: {
    id: 'rested',
    iconKey: 'ui.status_rested',
    ticks: B.restedTicks,
    stacks: 'refresh',
    mods: [{ stat: 'xp', pct: B.restedXpPct }],
    rule: 'rested',
  },
};

/** The status an element hit applies when the attack's data says so. Gale and Stone have none: they trigger reactions. */
export const ELEMENT_STATUS: Readonly<Partial<Record<ElementId, StatusId>>> = {
  ember: 'burning',
  tide: 'wet',
  mending: 'warded',
  hexing: 'hexed',
};

export function isElement(e: string | undefined): e is ElementId {
  return (
    e === 'ember' ||
    e === 'tide' ||
    e === 'gale' ||
    e === 'stone' ||
    e === 'mending' ||
    e === 'hexing'
  );
}
