import { z } from 'zod';
import type { RegionSpec } from '../../src/content/world/regions/types';
import { BakeError } from '../../src/sim/world/bakeError';

/** Build-time schema for a region spec. Imported only by tools, never by the client. */
const id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'must be lowercase letters, digits and underscores');
const dotted = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/, 'must look like kind.name');
const point = z.object({ x: z.number().int(), y: z.number().int() }).strict();
const named = z.object({ id, x: z.number().int(), y: z.number().int() }).strict();
const width = z.number().int().min(1).max(9);

const specSchema = z
  .object({
    id,
    seed: z.number().int(),
    chunks: z
      .object({ w: z.number().int().min(1).max(64), h: z.number().int().min(1).max(64) })
      .strict(),
    biomeLegend: z.record(z.string().length(1), id),
    biomes: z.array(z.string()),
    elevation: z.array(z.string()),
    roads: z
      .object({
        nodes: z.record(id, point),
        edges: z.array(
          z.object({ a: id, b: id, width, surface: z.enum(['dirt', 'cobble', 'planks']) }).strict(),
        ),
      })
      .strict(),
    rivers: z.array(z.object({ id, points: z.array(point).min(2), width }).strict()),
    placements: z.array(
      z
        .object({
          kind: dotted,
          x: z.number().int(),
          y: z.number().int(),
          stamp: id.optional(),
          variant: id.optional(),
          rotate: z
            .union([
              z.literal(0),
              z.literal(90),
              z.literal(180),
              z.literal(270),
              z.literal('mirror'),
            ])
            .optional(),
        })
        .strict(),
    ),
    zones: z.array(z.object({ id, roster: dotted, polygon: z.array(point).min(3) }).strict()),
    interiors: z.array(z.object({ id, stamp: id }).strict()),
    landmarks: z.array(named),
    wakePoints: z.array(named),
    waystones: z.array(named),
    districts: z
      .array(
        z
          .object({
            id,
            kind: z.enum([
              'square',
              'street',
              'craft_row',
              'rune_house',
              'inn',
              'guard_yard',
              'market',
              'home',
              'gate',
              'hall',
            ]),
            x: z.number().int(),
            y: z.number().int(),
            w: z.number().int().min(1),
            h: z.number().int().min(1),
          })
          .strict(),
      )
      .optional(),
    pois: z
      .array(z.object({ id: dotted, x: z.number().int(), y: z.number().int() }).strict())
      .optional(),
    secrets: z.array(z.object({ id: z.string(), skill: z.string().optional() })).optional(),
    pendingDiscoverables: z.array(z.string().regex(/^\d+,\d+$/)).optional(),
    landmarkHeights: z.record(id, z.number().int().min(1)).optional(),
  })
  .strict();

/** Validates a spec's shape. Throws a {@link BakeError} naming the field path. */
export function parseRegionSpec(raw: unknown): RegionSpec {
  const r = specSchema.safeParse(raw);
  if (r.success) return r.data as RegionSpec;
  const name = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : '?';
  const i = r.error.issues[0];
  throw new BakeError(
    `region ${name} spec`,
    'schema',
    `${(i?.path ?? []).join('.') || '(root)'}: ${i?.message ?? 'invalid'}`,
  );
}
