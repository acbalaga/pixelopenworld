/**
 * Standing request templates (M3-11): what the generator may post. Each names the strings it
 * fills. Quantities, caps and the reward formula are in `balance/requests.ts`.
 */
export interface StandingTemplate {
  kind: 'gather' | 'deliver' | 'defeat';
  /** How often it is picked, against the others. */
  weight: number;
  titleKey: string;
  askKey: string;
  wayKey: string;
}

export const STANDING_TEMPLATES: readonly StandingTemplate[] = [
  {
    kind: 'gather',
    weight: 4,
    titleKey: 'request.standing.gather.title',
    askKey: 'request.standing.gather.ask',
    wayKey: 'request.standing.gather.way',
  },
  {
    kind: 'deliver',
    weight: 3,
    titleKey: 'request.standing.deliver.title',
    askKey: 'request.standing.deliver.ask',
    wayKey: 'request.standing.deliver.way',
  },
  {
    kind: 'defeat',
    weight: 3,
    titleKey: 'request.standing.defeat.title',
    askKey: 'request.standing.defeat.ask',
    wayKey: 'request.standing.defeat.way',
  },
];
