// Zod schemas for the ASCII animation data types — parallel to
// core/schemas.ts / core/effects/schemas.ts. Strict: unknown keys throw.

import { z } from 'zod'

export const asciiManifestSchema = z.object({
  type:         z.literal('ascii_manifest'),
  defId:        z.string(),
  frameSize:    z.tuple([z.number(), z.number()]),
  palette:      z.record(z.string(), z.string()),
  actions:      z.array(z.string()),
  skillActions: z.array(z.string()),
}).strict()

const asciiProjectileDefSchema = z.object({
  symbol:        z.string(),
  path:          z.enum(['straight', 'arc', 'burst']),
  speedMs:       z.number(),
  launchOnFrame: z.number(),
}).strict()

const asciiStateConfigSchema = z.object({
  frameMs:     z.number(),
  loop:        z.boolean(),
  breathPause: z.number().optional(),
  returnTo:    z.string().optional(),
  terminal:    z.boolean().optional(),
  onFrame:     z.record(z.string(), z.string()).optional(),
  projectile:  asciiProjectileDefSchema.optional(),
  queuesOn:    z.array(z.string()).optional(),
}).strict()

export const asciiSequenceSchema = z.object({
  type:           z.literal('ascii_sequence'),
  defId:          z.string(),
  states:         z.record(z.string(), asciiStateConfigSchema),
  skillOverrides: z.record(z.string(), asciiStateConfigSchema).optional(),
}).strict()

export const asciiActionFramesSchema = z.object({
  type:   z.literal('ascii_action'),
  defId:  z.string(),
  action: z.string(),
  frames: z.array(z.array(z.string())),
}).strict()
