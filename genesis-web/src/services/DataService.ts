// DataService — JSON game-content loader with in-memory cache.
//
// Layer rules: no React imports; Capacitor platform check guards native paths.
// Every fetch is validated against its Zod schema before being cached or
// returned — required content (characters, skills, modes) throws a
// prettified validation error on bad data; optional content (passives,
// statuses, stages, maps, tilesets, animations) logs the same error and
// degrades to null, matching its existing "absent file" behaviour.

import type { CharacterDef, ModeDef, StageDef, MapDef, TilesetDef, AnimationManifest, AnimSequenceManifest } from '../core/types'
import type { AsciiManifest, AsciiSequence, AsciiActionFrames } from '../ascii/types'
import type { SkillDef, PassiveDef, StatusDef } from '../core/effects/types'
import { prettifyError, z, type ZodType } from 'zod'
import { skillDefSchema, passiveDefSchema, statusDefSchema } from '../core/effects/schemas'
import {
  characterDefSchema, modeDefSchema, stageDefSchema, mapDefSchema,
  tilesetDefSchema, animationManifestSchema, animSequenceManifestSchema,
} from '../core/schemas'
import { asciiManifestSchema, asciiSequenceSchema, asciiActionFramesSchema } from '../ascii/schemas'

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = {
  characterIndex:      null as string[] | null,
  campaignIndex:       null as string[] | null,
  characters:          new Map<string, CharacterDef>(),
  characterSkills:     new Map<string, SkillDef[]>(),
  passives:            new Map<string, PassiveDef>(),
  statuses:            new Map<string, StatusDef>(),
  modes:               new Map<string, ModeDef>(),
  stages:              new Map<string, StageDef>(),
  maps:                new Map<string, MapDef>(),
  tilesets:            new Map<string, TilesetDef>(),
  animationManifests:  new Map<string, AnimationManifest>(),
  animSequences:       new Map<string, AnimSequenceManifest | null>(),
  asciiManifests:      new Map<string, AsciiManifest | null>(),
  asciiSequences:      new Map<string, AsciiSequence | null>(),
  asciiActions:        new Map<string, AsciiActionFrames | null>(),
}

// In-flight deduplication: store the pending promise so concurrent callers
// for the same character share one fetch instead of issuing duplicate requests.
const inflight = {
  characters: new Map<string, Promise<CharacterDef>>(),
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// Base URL from Vite. Normalize to always end with '/' so path concatenation
// is safe regardless of how the base is passed (e.g. GitHub Pages CI passes
// --base /Genesis without a trailing slash, causing '/Genesis'+'data/...' to
// produce '/Genesisdata/...' instead of '/Genesis/data/...').
const BASE = import.meta.env.BASE_URL
const BASE_NORMALIZED = BASE.endsWith('/') ? BASE : `${BASE}/`

async function fetchJson(path: string): Promise<unknown> {
  const url = `${BASE_NORMALIZED}${path}`
  console.debug('[DataService] fetch', url, '(BASE=', JSON.stringify(BASE), ')')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DataService: failed to fetch ${url} (${res.status})`)
  return res.json()
}

/** Parses `raw` against `schema`; throws a prettified, path-annotated error on mismatch. */
function parseOrThrow<T>(schema: ZodType<T>, raw: unknown, path: string): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error(`DataService: invalid content at ${path}\n${prettifyError(result.error)}`)
  }
  return result.data
}

/** Fetches + validates optional content. Logs and returns null on fetch failure or bad data. */
async function fetchOptional<T>(schema: ZodType<T>, path: string): Promise<T | null> {
  try {
    const raw = await fetchJson(path)
    return parseOrThrow(schema, raw, path)
  } catch (err) {
    console.error(err instanceof Error ? err.message : `DataService: failed to load ${path}: ${String(err)}`)
    return null
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the list of all available character IDs from the characters index. */
export async function loadCharacterIndex(): Promise<string[]> {
  if (cache.characterIndex) return cache.characterIndex
  const raw = await fetchJson('data/characters/index.json')
  cache.characterIndex = parseOrThrow(z.array(z.string()), raw, 'data/characters/index.json')
  return cache.characterIndex
}

export function loadCharacter(id: string): Promise<CharacterDef> {
  const cached = cache.characters.get(id)
  if (cached) return Promise.resolve(cached)
  const existing = inflight.characters.get(id)
  if (existing) return existing
  const path = `data/characters/${id}/main.json`
  const promise = fetchJson(path).then(raw => {
    const def = parseOrThrow(characterDefSchema, raw, path)
    cache.characters.set(id, def)
    inflight.characters.delete(id)
    return def
  })
  inflight.characters.set(id, promise)
  return promise
}

/** Returns all SkillDef objects owned by a character. */
export async function loadCharacterSkillDefs(id: string): Promise<SkillDef[]> {
  const cached = cache.characterSkills.get(id)
  if (cached) return cached
  const path = `data/characters/${id}/skills.json`
  const raw  = await fetchJson(path)
  const defs = parseOrThrow(z.array(skillDefSchema), raw, path)
  cache.characterSkills.set(id, defs)
  return defs
}

export async function loadMode(id: string): Promise<ModeDef> {
  const cached = cache.modes.get(id)
  if (cached) return cached
  const path = `data/modes/${id}.json`
  const raw  = await fetchJson(path)
  const def  = parseOrThrow(modeDefSchema, raw, path)
  cache.modes.set(id, def)
  return def
}

/**
 * Load a character's passive definition.
 * Returns null silently when absent or when the character has no passive.
 */
export async function loadCharacterPassive(id: string): Promise<PassiveDef | null> {
  const def = await loadCharacter(id)
  if (!def.passive) return null

  const cached = cache.passives.get(def.passive)
  if (cached) return cached
  const result = await fetchOptional(passiveDefSchema, `data/characters/${id}/passive.json`)
  if (result) cache.passives.set(def.passive, result)
  return result
}

/**
 * Load a status definition by ID.
 * Returns null silently when absent.
 */
export async function loadStatusDef(id: string): Promise<StatusDef | null> {
  const cached = cache.statuses.get(id)
  if (cached) return cached
  const result = await fetchOptional(statusDefSchema, `data/statuses/${id}.json`)
  if (result) cache.statuses.set(id, result)
  return result
}

/** Load a character definition together with all of its skill definitions and passive. */
export async function loadCharacterWithSkills(id: string): Promise<{
  characterDef: CharacterDef
  skillDefs:    SkillDef[]
  passiveDef:   PassiveDef | null
}> {
  const [characterDef, skillDefs, passiveDef] = await Promise.all([
    loadCharacter(id),
    loadCharacterSkillDefs(id),
    loadCharacterPassive(id),
  ])
  return { characterDef, skillDefs, passiveDef }
}

/** Returns the list of available campaign stage IDs. */
export async function loadCampaignIndex(): Promise<string[]> {
  if (cache.campaignIndex) return cache.campaignIndex
  const raw = await fetchJson('data/campaign/index.json')
  cache.campaignIndex = parseOrThrow(z.array(z.string()), raw, 'data/campaign/index.json')
  return cache.campaignIndex
}

/** Load stage definition. Returns null silently when absent. */
export async function loadStageDef(stageId: string): Promise<StageDef | null> {
  const cached = cache.stages.get(stageId)
  if (cached) return cached
  const result = await fetchOptional(stageDefSchema, `data/campaign/${stageId}/stage.json`)
  if (result) cache.stages.set(stageId, result)
  return result
}

/** Load dungeon map definition. Returns null silently when absent. */
export async function loadMapDef(stageId: string): Promise<MapDef | null> {
  const cached = cache.maps.get(stageId)
  if (cached) return cached
  const result = await fetchOptional(mapDefSchema, `data/campaign/${stageId}/map.json`)
  if (result) cache.maps.set(stageId, result)
  return result
}

/** Load tileset visual definition. Returns null silently when absent. */
export async function loadTilesetDef(key: string): Promise<TilesetDef | null> {
  const cached = cache.tilesets.get(key)
  if (cached) return cached
  const result = await fetchOptional(tilesetDefSchema, `data/tilesets/${key}/tileset.json`)
  if (result) cache.tilesets.set(key, result)
  return result
}

/**
 * Load a character's animation manifest.
 * Returns null silently when absent — characters without a manifest use engine fallbacks.
 */
export async function loadAnimationManifest(defId: string): Promise<AnimationManifest | null> {
  const cached = cache.animationManifests.get(defId)
  if (cached) return cached
  const result = await fetchOptional(animationManifestSchema, `data/characters/${defId}/animations.json`)
  if (result) cache.animationManifests.set(defId, result)
  return result
}

/**
 * Load a character's animation sequence overrides.
 * Returns null silently when absent — skills without a sequence entry use
 * the engine default (buildDefaultSequence).
 */
export async function loadAnimSequenceManifest(defId: string): Promise<AnimSequenceManifest | null> {
  if (cache.animSequences.has(defId)) return cache.animSequences.get(defId) ?? null
  const result = await fetchOptional(animSequenceManifestSchema, `data/characters/${defId}/anim_sequence.json`)
  cache.animSequences.set(defId, result)
  return result
}

/**
 * Load a character's ASCII animation manifest.
 * Returns null silently when absent — characters without ASCII art use generic fallback.
 */
export async function loadAsciiManifest(defId: string): Promise<AsciiManifest | null> {
  if (cache.asciiManifests.has(defId)) return cache.asciiManifests.get(defId) ?? null
  const result = await fetchOptional(asciiManifestSchema, `data/characters/${defId}/animations/animations.json`)
  cache.asciiManifests.set(defId, result)
  return result
}

/**
 * Load a character's ASCII animation sequence (state machine + timing).
 * Returns null silently when absent — engine falls back to DEFAULT_CONFIGS.
 */
export async function loadAsciiSequence(defId: string): Promise<AsciiSequence | null> {
  if (cache.asciiSequences.has(defId)) return cache.asciiSequences.get(defId) ?? null
  const result = await fetchOptional(asciiSequenceSchema, `data/characters/${defId}/animations/anim_sequence.json`)
  cache.asciiSequences.set(defId, result)
  return result
}

/**
 * Load frame data for a specific action (idle, attack, hurt, death, dodge, or skill ID).
 * Returns null silently when absent — FigureAnimator falls back to generic frames.
 */
export async function loadAsciiAction(defId: string, action: string): Promise<AsciiActionFrames | null> {
  const key = `${defId}/${action}`
  if (cache.asciiActions.has(key)) return cache.asciiActions.get(key) ?? null
  const result = await fetchOptional(asciiActionFramesSchema, `data/characters/${defId}/animations/${action}_anim.json`)
  cache.asciiActions.set(key, result)
  return result
}

/** Synchronous URL for a character's portrait PNG at the standard path. */
export function characterPortraitUrl(defId: string): string {
  return `${BASE_NORMALIZED}images/characters/${defId}/portrait.png`
}

/** Synchronous URL for a status/passive chip icon PNG.
 *  iconKey is the bare filename stem from StatusDef.ui.chip.icon (e.g. 'psv_logo').
 *  Resolves to: images/characters/{defId}/UI/Status/{iconKey}.png
 */
export function characterStatusIconUrl(defId: string, iconKey: string): string {
  return `${BASE_NORMALIZED}images/characters/${defId}/UI/Status/${iconKey}.png`
}

export function clearCache(): void {
  cache.characterIndex = null
  cache.campaignIndex  = null
  cache.characters.clear()
  cache.characterSkills.clear()
  cache.passives.clear()
  cache.statuses.clear()
  cache.modes.clear()
  cache.stages.clear()
  cache.maps.clear()
  cache.tilesets.clear()
  cache.animationManifests.clear()
  cache.animSequences.clear()
  cache.asciiManifests.clear()
  cache.asciiSequences.clear()
  cache.asciiActions.clear()
  inflight.characters.clear()
}
