import { z } from 'zod';

/** Build-time schemas. Imported only by tools, never by the client. */
const id = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/, 'id must look like kind.name');

export const animSchema = z.object({
  frames: z.array(z.string()).min(1),
  fps: z.number().positive(),
  flipX: z.boolean().optional(),
});

export const spriteSchema = z.object({
  id,
  group: z.string().regex(/^(core|ui|region-\d+)$/),
  size: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  origin: z.tuple([z.number().int(), z.number().int()]),
  key: z.record(z.string().length(1), z.number().int().nullable()),
  frames: z.record(z.string(), z.array(z.string())),
  anims: z.record(z.string(), animSchema).optional(),
});

export const tileSchema = z.object({
  id,
  sprite: z.string(),
  frame: z.string(),
  animated: z.boolean().optional(),
  layer: z.enum(['ground', 'detail', 'object', 'overhead']),
  offset: z.tuple([z.number().int(), z.number().int()]).optional(),
  collision: z.enum(['none', 'full', 'half_top', 'half_bottom', 'water', 'ledge']),
  tags: z.array(z.enum(['flammable', 'diggable', 'climbable'])),
});
