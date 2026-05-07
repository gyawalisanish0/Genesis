// DataService — JSON game-content loader with in-memory cache.
//
// Layer rules: no React imports; Capacitor platform check guards native paths.
// All callers receive typed data; Zod validation is deferred to Wave C.

import type { CharacterDef, ModeDef, StageDef, MapDef, TilesetDef } from '../core/types'
import type { SkillDef, PassiveDef, StatusDef } from '../core/effects/types'
import type { CharacterDialogueDef, LevelNarrativeDef } from '../core/narrative'

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = {
  characterIndex:    null as string[] | null,
  campaignIndex:     null as string[] | null,
  characters:        new Map<string, CharacterDef>(),
  characterSkills:   new Map<string, SkillDef[]>(),  // keyed by characterId
  passives:          new Map<string, PassiveDef>(),   // keyed by passiveId
  statuses:          new Map<string, StatusDef>(),    // keyed by statusId
  modes:             new Map<string, ModeDef>(),
  characterDialogue: new Map<string, CharacterDialogueDef>(),
  levelNarrative:    new Map<string, LevelNarrativeDef>(),
  stages:            new Map<string, StageDef>(),
  maps:              new Map<string, MapDef>(),
  tilesets:          new Map<string, TilesetDef>(),
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

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the list of all available character IDs from the characters index. */
export async function loadCharacterIndex(): Promise<string[]> {
  if (cache.characterIndex) return cache.characterIndex
  const raw = await fetchJson('data/characters/index.json')
  cache.characterIndex = raw as string[]
  return cache.characterIndex
}

export async function loadCharacter(id: string): Promise<CharacterDef> {
  const cached = cache.characters.get(id)
  if (cached) return cached
  const raw = await fetchJson(`data/characters/${id}/main.json`)
  const def = raw as CharacterDef
  cache.characters.set(id, def)
  return def
}

/** Returns all SkillDef objects owned by a character. */
export async function loadCharacterSkillDefs(id: string): Promise<SkillDef[]> {
  const cached = cache.characterSkills.get(id)
  if (cached) return cached
  const raw = await fetchJson(`data/characters/${id}/skills.json`)
  const defs = raw as SkillDef[]
  cache.characterSkills.set(id, defs)
  return defs
}

export async function loadMode(id: string): Promise<ModeDef> {
  const cached = cache.modes.get(id)
  if (cached) return cached
  const raw = await fetchJson(`data/modes/${id}.json`)
  const def = raw as ModeDef
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
  try {
    const raw    = await fetchJson(`data/characters/${id}/passive.json`)
    const result = raw as PassiveDef
    cache.passives.set(def.passive, result)
    return result
  } catch {
    return null
  }
}

/**
 * Load a status definition by ID.
 * Returns null silently when absent.
 */
export async function loadStatusDef(id: string): Promise<StatusDef | null> {
  const cached = cache.statuses.get(id)
  if (cached) return cached
  try {
    const raw    = await fetchJson(`data/statuses/${id}.json`)
    const result = raw as StatusDef
    cache.statuses.set(id, result)
    return result
  } catch {
    return null
  }
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

/**
 * Load a character's universal dialogue definitions.
 * Returns null silently when the file is absent — not every character has dialogue.
 */
export async function loadCharacterDialogue(id: string): Promise<CharacterDialogueDef | null> {
  const cached = cache.characterDialogue.get(id)
  if (cached) return cached
  try {
    const raw = await fetchJson(`data/characters/${id}/dialogue.json`)
    const def = raw as CharacterDialogueDef
    cache.characterDialogue.set(id, def)
    return def
  } catch {
    return null
  }
}

/**
 * Load level-specific narrative for a given level / mode id.
 * Returns null silently when the file is absent.
 */
export async function loadLevelNarrative(levelId: string): Promise<LevelNarrativeDef | null> {
  const cached = cache.levelNarrative.get(levelId)
  if (cached) return cached
  try {
    const raw = await fetchJson(`data/levels/${levelId}/narrative.json`)
    const def = raw as LevelNarrativeDef
    cache.levelNarrative.set(levelId, def)
    return def
  } catch {
    return null
  }
}

/** Returns the list of available campaign stage IDs. */
export async function loadCampaignIndex(): Promise<string[]> {
  if (cache.campaignIndex) return cache.campaignIndex
  const raw = await fetchJson('data/campaign/index.json')
  cache.campaignIndex = raw as string[]
  return cache.campaignIndex
}

/** Load stage definition. Returns null silently when absent. */
export async function loadStageDef(stageId: string): Promise<StageDef | null> {
  const cached = cache.stages.get(stageId)
  if (cached) return cached
  try {
    const raw = await fetchJson(`data/campaign/${stageId}/stage.json`)
    const def = raw as StageDef
    cache.stages.set(stageId, def)
    return def
  } catch {
    return null
  }
}

/** Load dungeon map definition. Returns null silently when absent. */
export async function loadMapDef(stageId: string): Promise<MapDef | null> {
  const cached = cache.maps.get(stageId)
  if (cached) return cached
  try {
    const raw = await fetchJson(`data/campaign/${stageId}/map.json`)
    const def = raw as MapDef
    cache.maps.set(stageId, def)
    return def
  } catch {
    return null
  }
}

/** Load tileset visual definition. Returns null silently when absent. */
export async function loadTilesetDef(key: string): Promise<TilesetDef | null> {
  const cached = cache.tilesets.get(key)
  if (cached) return cached
  try {
    const raw = await fetchJson(`data/tilesets/${key}/tileset.json`)
    const def = raw as TilesetDef
    cache.tilesets.set(key, def)
    return def
  } catch {
    return null
  }
}

/** Test utility — clears all cached data between test cases. */
export function clearCache(): void {
  cache.characterIndex = null
  cache.campaignIndex  = null
  cache.characters.clear()
  cache.characterSkills.clear()
  cache.passives.clear()
  cache.statuses.clear()
  cache.modes.clear()
  cache.characterDialogue.clear()
  cache.levelNarrative.clear()
  cache.stages.clear()
  cache.maps.clear()
  cache.tilesets.clear()
}
