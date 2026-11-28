import type { WorkAnim } from '../dolls/parts';

/** The crafts M3 builds on the engine, and the crafts M3-14 adds. */
export type Craft =
  'cooking' | 'smithing' | 'woodworking' | 'tailoring' | 'alchemy' | 'enchanting' | 'tinkering';

/** The manual step a station asks for. */
export type StepKind = 'timing' | 'rhythm' | 'trace' | 'hold';

/** A crafting station: what is made there and how the manual step is played. */
export interface StationDef {
  /** The interactable kind of the thing in the world. */
  kind: string;
  craft: Craft;
  step: StepKind;
  /** The avatar's work animation at this station. */
  workAnim: WorkAnim;
}

export const STATIONS: Readonly<Record<string, StationDef>> = {
  camp_pot: { kind: 'camp_pot', craft: 'cooking', step: 'rhythm', workAnim: 'work_stir' },
  // The inn kitchen's oven (M6-04): bread, pies and roasts. Hold to the right heat.
  'fixture.oven': { kind: 'fixture.oven', craft: 'cooking', step: 'hold', workAnim: 'work_hands' },
  'fixture.anvil': {
    kind: 'fixture.anvil',
    craft: 'smithing',
    step: 'timing',
    workAnim: 'work_swing',
  },
  'fixture.workbench': {
    kind: 'fixture.workbench',
    craft: 'woodworking',
    step: 'timing',
    workAnim: 'work_hands',
  },
  'fixture.loom': {
    kind: 'fixture.loom',
    craft: 'tailoring',
    step: 'trace',
    workAnim: 'work_hands',
  },
  'fixture.alchemy_table': {
    kind: 'fixture.alchemy_table',
    craft: 'alchemy',
    step: 'hold',
    workAnim: 'work_stir',
  },
  'fixture.rune_stone': {
    kind: 'fixture.rune_stone',
    craft: 'enchanting',
    step: 'trace',
    workAnim: 'work_hands',
  },
  'fixture.tinker_bench': {
    kind: 'fixture.tinker_bench',
    craft: 'tinkering',
    step: 'timing',
    workAnim: 'work_hands',
  },
};
