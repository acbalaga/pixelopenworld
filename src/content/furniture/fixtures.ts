import type { FixtureDef } from '../world/fixtures';
import { PIECES, type PieceDef } from './pieces';

/**
 * A placed piece is a fixture entity, so the world draws it, blocks on it and uses it with the
 * machinery every fixture has. Each piece has a kind (`fixture.furn_<id>`) and, if it is not
 * square, a turned kind (`_s`) for a quarter turn, whose sprite is drawn on its side.
 */
export const furnKind = (id: string, turned: boolean): string =>
  `fixture.furn_${id}${turned ? '_s' : ''}`;

function def(p: PieceDef, turned: boolean): FixtureDef {
  const type: FixtureDef['type'] =
    p.fn === 'bed'
      ? 'bed'
      : p.fn === 'storage'
        ? 'storage'
        : p.fn === 'mirror'
          ? 'mirror'
          : 'decor';
  return {
    kind: furnKind(p.id, turned),
    type,
    sprite: `furn.${p.id}${turned ? '_s' : ''}`,
    // A rug is flat: no body, drawn on the ground. Everything else blocks.
    size: p.layer === 'rug' ? 0 : 14,
  };
}

export const FURNITURE_FIXTURES: readonly FixtureDef[] = PIECES.flatMap((p) => [
  def(p, false),
  ...(p.w !== p.h ? [def(p, true)] : []),
]);
