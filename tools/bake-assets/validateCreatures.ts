import { TEMPERAMENT } from '../../src/content/balance/temperament';
import { ATTACKS } from '../../src/content/combat/attacks';
import { minTelegraphMs, minTelegraphTicks } from '../../src/content/creatures/rules';
import { creatureSchema, spawnerSchema } from '../../src/content/creatures/schema';
import type { CreatureDef, SpawnerDef } from '../../src/content/creatures/types';

/** What creatures may point at. Passed in so tests can break one thing at a time. */
export interface ContentRefs {
  attacks: Readonly<Record<string, { windup: number; projectile?: unknown; dash?: number }>>;
  sprites: ReadonlySet<string>;
  sfx: ReadonlySet<string>;
}

/**
 * Validates creature and spawner data: schema, cross references, and the rule that no attack is
 * telegraphed for less than the tier minimum (design/04: 350 ms at tier 1, 200 ms at tier 8).
 * Returns readable errors naming the creature and attack. Empty means valid.
 */
export function validateCreatures(
  creatures: Readonly<Record<string, CreatureDef>>,
  spawners: Readonly<Record<string, SpawnerDef>>,
  refs: ContentRefs = { attacks: ATTACKS, sprites: new Set(), sfx: new Set() },
): string[] {
  const errors: string[] = [];
  for (const [key, raw] of Object.entries(creatures)) {
    const label = `creature ${key}`;
    if (raw.id !== key) errors.push(`${label}: id ${raw.id} does not match its key`);
    const parsed = creatureSchema.safeParse(raw);
    if (!parsed.success) {
      for (const i of parsed.error.issues)
        errors.push(`${label}: ${i.path.join('.')}: ${i.message}`);
      continue;
    }
    const c = raw;
    if (!refs.sprites.has(c.sprite)) errors.push(`${label}: sprite ${c.sprite} does not exist`);
    for (const s of [c.sounds.notice, c.sounds.die])
      if (!refs.sfx.has(s)) errors.push(`${label}: sound ${s} does not exist`);
    for (const t of [c.temperament, c.night]) {
      if (t === 'territorial' && !c.territory)
        errors.push(`${label}: a territorial creature needs territory`);
      if (t === 'curious' && c.approach === undefined)
        errors.push(`${label}: a curious creature needs approach`);
      if (t === 'skittish' && c.fleeHpPct === undefined)
        errors.push(`${label}: a skittish creature needs fleeHpPct`);
    }
    if (c.territory && c.tier === 1 && c.territory.warnTicks < TEMPERAMENT.warnMinTicksTier1)
      errors.push(
        `${label}: warnTicks ${c.territory.warnTicks} is under the tier 1 minimum ${TEMPERAMENT.warnMinTicksTier1}`,
      );
    if (c.territory && c.territory.radius > c.notice)
      errors.push(`${label}: territory ${c.territory.radius} is wider than notice ${c.notice}`);
    if (c.leash < c.notice)
      errors.push(`${label}: leash ${c.leash} is shorter than notice ${c.notice}`);
    if (c.lose < c.notice)
      errors.push(`${label}: lose ${c.lose} is shorter than notice ${c.notice}`);
    if (c.archetype !== 'shooter' && c.archetype !== 'dummy' && c.speed === 0)
      errors.push(`${label}: only a shooter or a dummy may be rooted`);
    if (c.archetype !== 'dummy' && c.attacks.length === 0)
      errors.push(`${label}: needs at least one attack`);
    if (c.archetype === 'dummy' && c.attacks.length > 0)
      errors.push(`${label}: a dummy does not attack`);
    if (c.archetype === 'shooter' && !c.keepRange)
      errors.push(`${label}: a shooter needs keepRange`);
    for (const d of c.drops)
      if (d.min > d.max)
        errors.push(`${label}: drop ${d.item} has min ${d.min} above max ${d.max}`);
    let last = 100;
    for (const p of c.phases ?? []) {
      if (p.hpPct >= last)
        errors.push(`${label}: phase thresholds must fall (${p.hpPct} after ${last})`);
      last = p.hpPct;
    }
    const maxPhase = (c.phases ?? []).length;
    for (const a of c.attacks) {
      const def = refs.attacks[a.attack];
      if (!def) {
        errors.push(`${label}: attack ${a.attack} does not exist`);
        continue;
      }
      if ((a.phase ?? 0) > maxPhase)
        errors.push(
          `${label}: attack ${a.attack} needs phase ${a.phase}, the creature has ${maxPhase}`,
        );
      const min = minTelegraphTicks(c.tier);
      if (def.windup < min)
        errors.push(
          `${label}: attack ${a.attack} telegraphs ${def.windup} ticks (${Math.round((def.windup * 1000) / 30)} ms), tier ${c.tier} needs at least ${minTelegraphMs(c.tier)} ms`,
        );
    }
    if (c.archetype === 'shooter' && !c.attacks.some((a) => refs.attacks[a.attack]?.projectile))
      errors.push(`${label}: a shooter needs an attack that launches a projectile`);
    if (
      c.archetype === 'charger' &&
      !c.attacks.some((a) => (refs.attacks[a.attack]?.dash ?? 0) > 0)
    )
      errors.push(`${label}: a charger needs an attack with a dash`);
  }
  for (const [key, raw] of Object.entries(spawners)) {
    const label = `spawner ${key}`;
    if (raw.kind !== key) errors.push(`${label}: kind ${raw.kind} does not match its key`);
    const parsed = spawnerSchema.safeParse(raw);
    if (!parsed.success) {
      for (const i of parsed.error.issues)
        errors.push(`${label}: ${i.path.join('.')}: ${i.message}`);
      continue;
    }
    if (!creatures[raw.creature]) errors.push(`${label}: creature ${raw.creature} does not exist`);
  }
  return errors;
}
