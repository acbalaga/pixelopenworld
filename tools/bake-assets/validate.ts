import { spriteSchema, tileSchema } from '../../src/content/sprites/schema';
import { PALETTE } from '../../src/content/sprites/palette';
import type { SpriteDef, TileDef } from '../../src/content/sprites/types';

/**
 * Validates sprite and tile definitions. Returns human-readable errors, each naming the sprite
 * (and frame and row where it applies). Empty array means valid.
 */
export function validateDefs(sprites: readonly SpriteDef[], tiles: readonly TileDef[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const raw of sprites) {
    const label = `sprite ${raw.id}`;
    if (ids.has(raw.id)) errors.push(`${label}: duplicate id`);
    ids.add(raw.id);

    const parsed = spriteSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${label}: ${issue.path.join('.')}: ${issue.message}`);
      }
      continue;
    }
    const [w, h] = raw.size;
    if (raw.origin[0] < 0 || raw.origin[0] > w || raw.origin[1] < 0 || raw.origin[1] > h) {
      errors.push(`${label}: origin [${raw.origin.join(', ')}] is outside the ${w}x${h} frame`);
    }
    for (const [frame, rows] of Object.entries(raw.frames)) {
      if (rows.length !== h)
        errors.push(`${label} frame ${frame}: ${rows.length} rows, expected ${h}`);
      rows.forEach((row, y) => {
        if (row.length !== w) {
          errors.push(`${label} frame ${frame} row ${y}: width ${row.length}, expected ${w}`);
        }
        for (const ch of row) {
          const idx = raw.key[ch];
          if (idx === undefined) {
            errors.push(`${label} frame ${frame} row ${y}: unknown key character '${ch}'`);
            break;
          }
          if (idx !== null && (idx < 0 || idx >= PALETTE.length)) {
            errors.push(
              `${label} frame ${frame} row ${y}: character '${ch}' maps to palette index ${idx}, outside 0..${PALETTE.length - 1}`,
            );
            break;
          }
        }
      });
    }
    for (const [name, anim] of Object.entries(raw.anims ?? {})) {
      for (const f of anim.frames) {
        if (!(f in raw.frames)) errors.push(`${label} anim ${name}: unknown frame '${f}'`);
      }
    }
  }

  const bySprite = new Map(sprites.map((s) => [s.id, s]));
  const tileIds = new Set<string>();
  for (const t of tiles) {
    const label = `tile ${t.id}`;
    if (tileIds.has(t.id)) errors.push(`${label}: duplicate id`);
    tileIds.add(t.id);
    const parsed = tileSchema.safeParse(t);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${label}: ${issue.path.join('.')}: ${issue.message}`);
      }
      continue;
    }
    const s = bySprite.get(t.sprite);
    if (!s) {
      errors.push(`${label}: unknown sprite '${t.sprite}'`);
      continue;
    }
    if (t.animated) {
      if (!s.anims?.[t.frame])
        errors.push(`${label}: sprite ${s.id} has no animation '${t.frame}'`);
    } else if (!s.frames[t.frame]) {
      errors.push(`${label}: sprite ${s.id} has no frame '${t.frame}'`);
    }
  }

  if (PALETTE.length !== 48) errors.push(`palette has ${PALETTE.length} colors, expected 48`);
  return errors;
}
