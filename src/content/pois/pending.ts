/**
 * Land chunks of Dawnmeadow, as `cx,cy`, that hold no discoverable yet (POW-M4-11). The bake fails
 * for a land chunk with none that is not listed here, and for a listed chunk that has one, so
 * this list only shrinks. Each later part of the ticket (the rest of the POIs, the mini-dungeons,
 * the dungeons, the secrets and the node clusters) takes chunks off it. It is empty now: the node
 * clusters cover every chunk the POIs do not. The list stays so the check keeps its shape.
 */
export const DAWNMEADOW_PENDING_DISCOVERABLES: readonly string[] = [];
