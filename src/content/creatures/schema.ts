import { z } from 'zod';

/** Build-time schema for creature and spawner data. Imported only by tools and tests. */
const id = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/, 'id must look like kind.name');
const pos = z.number().int().nonnegative();

const temperament = z.enum([
  'hostile',
  'territorial',
  'defensive',
  'skittish',
  'passive',
  'curious',
]);

export const creatureSchema = z.object({
  id,
  name: z.string().min(1).max(24),
  archetype: z.enum([
    'chaser',
    'shooter',
    'charger',
    'dummy',
    'skirmisher',
    'guard',
    'swarm',
    'flyer',
    'burrower',
  ]),
  tier: z.number().int().min(1).max(8),
  hp: z.number().int().positive(),
  defense: pos,
  power: z.number().int().positive(),
  speed: pos,
  notice: z.number().int().positive(),
  lose: z.number().int().positive(),
  leash: z.number().int().positive(),
  temperament: temperament,
  night: temperament.optional(),
  pack: z.object({ id: z.string().min(1), radius: z.number().int().positive() }).optional(),
  territory: z
    .object({ radius: z.number().int().positive(), warnTicks: z.number().int().positive() })
    .optional(),
  approach: z.number().int().positive().optional(),
  tether: z.number().int().positive().optional(),
  fleeHpPct: z.number().int().min(1).max(50).optional(),
  keepRange: z.object({ min: pos, max: z.number().int().positive() }).optional(),
  wander: z.boolean(),
  staggerMax: z.number().int().positive(),
  bodyW: z.number().int().positive(),
  bodyH: z.number().int().positive(),
  sprite: id,
  attacks: z
    .array(
      z.object({
        attack: id,
        range: z.number().int().positive(),
        cooldown: pos,
        phase: pos.optional(),
      }),
    )
    // A dummy has none. Every other archetype needs one, checked in the validator.
    .min(0),
  phases: z
    .array(
      z.object({
        hpPct: z.number().int().min(1).max(99),
        speedPct: z.number().int().min(50).max(300),
      }),
    )
    .optional(),
  drops: z.array(
    z.object({
      item: id,
      chance: z.number().min(0).max(100),
      min: z.number().int().positive(),
      max: z.number().int().positive(),
    }),
  ),
  sounds: z.object({ notice: id, die: id }),
});

export const spawnerSchema = z.object({
  kind: z.string().regex(/^spawner\.[a-z0-9_]+$/),
  creature: id,
  cap: z.number().int().positive(),
  respawn: z.number().int().positive(),
  radius: pos,
  daily: z.boolean().optional(),
  phases: z
    .object({ day: id.nullable(), night: id.nullable() })
    .refine((p) => p.day !== null || p.night !== null, 'a spawner needs someone by day or night')
    .optional(),
  step: z.enum(['a', 'b', 'c']).optional(),
  route: z
    .array(z.object({ x: pos, y: pos }))
    .min(2)
    .optional(),
});
