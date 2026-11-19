/**
 * Singular text (POW-M4-20). Read only through `singularBanner` and `chronicleLines` in
 * `ui/menu/singularModel.ts`, which give nothing for a Singular the avatar has not started. No UI
 * code may import this file anywhere else. No em dashes. Nothing here explains the hidden layer.
 */
export interface SingularText {
  /** Shown when the step of this index is reached: 0 when the trigger fires. */
  steps: readonly string[];
  /** Shown when the last step is done. */
  done: string;
  /** The Chronicle line once it is done. */
  chronicle: string;
}

export const SINGULAR_TEXT: Readonly<Record<string, SingularText>> = {
  'singular.crows_due': {
    steps: [
      'The crow tilts its head. It would like more.',
      'At dusk the crow leaves its post and does not look back.',
      'Where the earth is turned, you find a book wrapped in black feathers.',
    ],
    done: 'The book was about curses. The crow is gone, and a feather is left behind.',
    chronicle:
      'I left bright things for a crow until it showed me where it buries its own. The book it kept was about curses.',
  },
  'singular.eight_beds': {
    steps: ['You sleep better out here than you have a right to.'],
    done: 'Eight places, eight nights. A bundle of straw and cloth is waiting beside you.',
    chronicle:
      'I slept at eight roadside places, one a night. Someone left a cloak beside me at the last.',
  },
  'singular.cold_oven': {
    steps: [
      'The old pot is warm, though no one has lit it.',
      'Firebricks. They look made for an oven.',
      'Tobin sets the bricks. The hammer rings true.',
    ],
    done: 'The loaf rises in the old oven. A long wooden peel is in your hands.',
    chronicle:
      'I lit the cold oven in the empty house. It had been waiting for someone to bring it bricks.',
  },
};

export const WORLD_FIRST_LINE = 'A world first.';
