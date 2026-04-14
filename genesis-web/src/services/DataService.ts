// DataService — JSON game-content loader with in-memory cache.
//
// Layer rules: no React imports; Capacitor platform check guards native paths.
// All callers receive typed data; Zod validation is deferred to Wave C.

import type { CharacterDef, ModeDef } from '../core/types'
import type { SkillDef } from '../core/effects/types'

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = {
  characters:     new Map<string, CharacterDef>(),
  characterSkills: new Map<string, SkillDef[]>(),  // keyed by characterId
  modes:          new Map<string, ModeDef>(),
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// Base URL from Vite — './' in Capacitor builds, '/' in standard dev/prod.
// Using BASE_URL ensures fetch works in both browser and native webview.
const BASE = import.meta.env.BASE_URL

async function fetchJson(path: string): Promise<unknown> {
  const url = `${BASE}${path}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`DataService: failed to fetch ${url} (${res.status})`)
  return res.json()
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns the list of all available character IDs from the characters index. */
export async function loadCharacterIndex(): Promise<string[]> {
  return fetchJson('data/characters/index.json') as Promise<string[]>
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

/** Load a character definition together with all of its skill definitions. */
export async function loadCharacterWithSkills(id: string): Promise<{
  characterDef: CharacterDef
  skillDefs:    SkillDef[]
}> {
  const [characterDef, skillDefs] = await Promise.all([
    loadCharacter(id),
    loadCharacterSkillDefs(id),
  ])
  return { characterDef, skillDefs }
}

/** Test utility — clears all cached data between test cases. */
export function clearCache(): void {
  cache.characters.clear()
  cache.characterSkills.clear()
  cache.modes.clear()
}
