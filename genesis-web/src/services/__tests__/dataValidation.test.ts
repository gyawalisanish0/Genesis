// Build/CI-time content validation — walks every JSON file under public/data/
// and parses it against the matching Zod schema, so a malformed content file
// fails loudly here instead of surfacing as a runtime crash or silent bad state.
//
// Run standalone via `npm run validate:data`; wired as a `prebuild` step so
// `npm run build` refuses to ship broken content.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prettifyError, z, type ZodType } from 'zod'
import { skillDefSchema, passiveDefSchema, statusDefSchema } from '../../core/effects/schemas'
import {
  characterDefSchema, modeDefSchema, stageDefSchema, mapDefSchema,
  tilesetDefSchema, animationManifestSchema, animSequenceManifestSchema,
} from '../../core/schemas'

const DATA_ROOT = join(fileURLToPath(import.meta.url), '../../../../public/data')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.json')) out.push(full)
  }
  return out
}

// Content JSON that has no loader/consumer yet (the narrative/VN scene system
// was removed for a redesign — see core/battle/__tests__ session history —
// but the JSON is kept for reuse). Intentionally unvalidated until reused.
const ORPHANED_PATTERNS = [
  /^campaign\/[^/]+\/narrative\.json$/,
  /^characters\/[^/]+\/dialogue\.json$/,
  /^levels\//,
  /^scripts\//,
]

// Known work-in-progress content: not listed in characters/index.json, so no
// loader ever fetches it. Left unvalidated rather than either breaking the
// build over an intentionally-incomplete stub or weakening the schema to fit it.
const WIP_EXEMPT = new Set([
  'characters/celan_001/main.json',
])

/** Maps a public/data-relative path to its schema. `null` = known-orphaned, skip. */
function classify(relPath: string): { schema: ZodType; label: string } | null | undefined {
  if (ORPHANED_PATTERNS.some(p => p.test(relPath))) return null
  if (WIP_EXEMPT.has(relPath)) return null

  const seg = relPath.split('/')

  if (relPath === 'characters/index.json' || relPath === 'campaign/index.json') {
    return { schema: z.array(z.string()), label: 'index' }
  }
  if (seg[0] === 'characters' && seg.length === 3) {
    switch (seg[2]) {
      case 'main.json':          return { schema: characterDefSchema,          label: 'character' }
      case 'skills.json':        return { schema: z.array(skillDefSchema),     label: 'skills' }
      case 'passive.json':       return { schema: passiveDefSchema,            label: 'passive' }
      case 'animations.json':    return { schema: animationManifestSchema,     label: 'animations' }
      case 'anim_sequence.json': return { schema: animSequenceManifestSchema,  label: 'animSequence' }
    }
  }
  if (seg[0] === 'campaign' && seg.length === 3) {
    if (seg[2] === 'stage.json') return { schema: stageDefSchema, label: 'stage' }
    if (seg[2] === 'map.json')   return { schema: mapDefSchema,   label: 'map' }
  }
  if (seg[0] === 'tilesets' && seg.length === 3 && seg[2] === 'tileset.json') {
    return { schema: tilesetDefSchema, label: 'tileset' }
  }
  if (seg[0] === 'modes' && seg.length === 2) {
    return { schema: modeDefSchema, label: 'mode' }
  }
  if (seg[0] === 'statuses' && seg.length === 2) {
    return { schema: statusDefSchema, label: 'status' }
  }
  return undefined
}

describe('public/data content validation', () => {
  const files = walk(DATA_ROOT).map(f => ({ full: f, rel: relative(DATA_ROOT, f).split(/\\|\//).join('/') }))

  it('classifies every JSON file under public/data (fails if a new, unrecognised content path appears)', () => {
    const unrecognised = files
      .map(f => ({ ...f, result: classify(f.rel) }))
      .filter(f => f.result === undefined)
      .map(f => f.rel)

    expect(
      unrecognised,
      `Unrecognised content file(s) — add a classify() rule (or an ORPHANED_PATTERNS entry) in dataValidation.test.ts:\n${unrecognised.join('\n')}`,
    ).toEqual([])
  })

  it('validates every classified JSON file against its schema', () => {
    const failures: string[] = []

    for (const { full, rel } of files) {
      const target = classify(rel)
      if (!target) continue  // orphaned or unrecognised (covered by the test above)

      const raw = JSON.parse(readFileSync(full, 'utf-8'))
      const result = target.schema.safeParse(raw)
      if (!result.success) {
        failures.push(`\n✖ ${rel} (${target.label})\n${prettifyError(result.error)}`)
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
  })
})
