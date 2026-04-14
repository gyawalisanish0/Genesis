// DataService — JSON game-content loader with in-memory cache.
//
// Layer rules: no React imports; Capacitor platform check guards native paths.
// All callers receive typed data; Zod validation is deferred to Wave C.

import type { CharacterDef, ModeDef } from '../core/types'
import type { SkillDef } from '../core/effects/types'

// ── In-memory cache ───────────────────────────────────────────────────────────

const cache = {
  characters: new Map<string, CharacterDef>(),
  skills:     new Map<string, SkillDef>(),
  modes:      new Map<string, ModeDef>(),
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

export async function loadCharacter(id: string): Promise<CharacterDef> {
  const cached = cache.characters.get(id)
  if (cached) return cached
  const raw = await fetchJson(`data/characters/${id}.json`)
  const def = raw as CharacterDef
  cache.characters.set(id, def)
  return def
}

export async function loadSkill(id: string): Promise<SkillDef> {
  const cached = cache.skills.get(id)
  if (cached) return cached
  const raw = await fetchJson(`data/skills/${id}.json`)
  const def = raw as SkillDef
  cache.skills.set(id, def)
  return def
}

export async function loadMode(id: string): Promise<ModeDef> {
  const cached = cache.modes.get(id)
  if (cached) return cached
  const raw = await fetchJson(`data/modes/${id}.json`)
  const def = raw as ModeDef
  cache.modes.set(id, def)
  return def
}

/** Load a character definition together with all skills listed in its `skills` field. */
export async function loadCharacterWithSkills(id: string): Promise<{
  characterDef: CharacterDef
  skillDefs:    SkillDef[]
}> {
  const characterDef = await loadCharacter(id)
  const skillDefs = await Promise.all((characterDef.skills ?? []).map(loadSkill))
  return { characterDef, skillDefs }
}

/** Test utility — clears all cached data between test cases. */
export function clearCache(): void {
  cache.characters.clear()
  cache.skills.clear()
  cache.modes.clear()
}
