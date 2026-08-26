// Script format for the opening sequence.
//
// The narrative/VN system was removed for a redesign and took its player with
// it, but public/data/scripts/opening.json survived — 54 authored lines
// covering the dream, character creation and the wake. This is the minimum
// contract needed to play that back, derived from the file itself rather than
// from the deleted system, so it stays small.

import { z } from 'zod'

/** Who is speaking. Drives presentation only — the script names them. */
export const SPEAKERS = ['player', 'creator', 'narration', 'kali', 'commander', 'celan'] as const
export type Speaker = typeof SPEAKERS[number]

/** Fields on GameContext a script line may write into. */
export const INPUT_KEYS = ['commanderName', 'organisationName'] as const
export type InputKey = typeof INPUT_KEYS[number]

export const scriptLineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('dialogue'),
    who:  z.enum(SPEAKERS),
    text: z.string().min(1),
  }),
  z.object({
    kind:        z.literal('input'),
    inputKey:    z.enum(INPUT_KEYS),
    placeholder: z.string().optional(),
  }),
  z.object({
    kind:  z.literal('transition'),
    style: z.string(),
  }),
])

export const vnScriptSchema = z.object({
  type:     z.literal('vn_script'),
  scriptId: z.string().min(1),
  lines:    z.array(scriptLineSchema).min(1),
})

export type ScriptLine = z.infer<typeof scriptLineSchema>
export type VnScript   = z.infer<typeof vnScriptSchema>
