/** The crafts M3 builds on the engine, and the crafts M3-14 adds. */
export type Craft =
  'cooking' | 'smithing' | 'woodworking' | 'tailoring' | 'alchemy' | 'enchanting' | 'tinkering';

/** The manual step a station asks for. `trace` and `hold` arrive with M3-14. */
export type StepKind = 'timing' | 'rhythm' | 'trace' | 'hold';

/** A crafting station: what is made there and how the manual step is played. */
export interface StationDef {
  /** The interactable kind of the thing in the world. */
  kind: string;
  craft: Craft;
  step: StepKind;
}

export const STATIONS: Readonly<Record<string, StationDef>> = {
  camp_pot: { kind: 'camp_pot', craft: 'cooking', step: 'rhythm' },
  'fixture.anvil': { kind: 'fixture.anvil', craft: 'smithing', step: 'timing' },
  'fixture.workbench': { kind: 'fixture.workbench', craft: 'woodworking', step: 'timing' },
};
