import type { SpriteDef } from '../types';

/**
 * The panel frame, 7 x 7. It is a 9-slice with a 2 px border: the corners are the 2 x 2 blocks at
 * each corner, the edges repeat the 3 px middle, the center is fill. Light comes from the top
 * left, so top and left inner lines are light and bottom and right inner lines are shade.
 * k outline (darkest neutral), t light inner line, b shade inner line, f fill.
 */
export const PANEL_SLICE = 2;

export const uiPanel: SpriteDef = {
  id: 'ui.panel',
  group: 'ui',
  size: [7, 7],
  origin: [0, 0],
  key: { '.': null, k: 0, t: 19, b: 17, f: 16 },
  frames: {
    base: ['.kkkkk.', 'ktttttk', 'ktfffbk', 'ktfffbk', 'ktfffbk', 'kbbbbbk', '.kkkkk.'],
    // Pressed: light and shade swap, so the panel looks pushed in.
    pressed: ['.kkkkk.', 'kbbbbbk', 'kbffftk', 'kbffftk', 'kbffftk', 'ktttttk', '.kkkkk.'],
  },
};
