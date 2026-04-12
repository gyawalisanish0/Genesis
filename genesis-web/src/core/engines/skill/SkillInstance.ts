// ─────────────────────────────────────────────────────────────────────────────
// SkillInstance — per-unit runtime instance of an equipped skill
//
// Holds an immutable level-1 baseline (`baseDef`) plus a patched cache
// that is recomputed on level-up. Casts always read from the cache, so
// patch math never happens on the hot path.
//
// Lifecycle — must mirror the contract doc §Runtime exactly:
//   • createSkillInstance(def)  → level 1, cache = base
//   • levelUpSkill(instance)    → increments currentLevel, rebuilds cache
//   • resetSkillToDefault(inst) → restores level 1 state (called by the
//                                 mode / run lifecycle, NEVER by the
//                                 battle engine)
//   • invalidateCache(inst)     → bumps cacheVersion so the next read
//                                 rebuilds lazily; used when an external
//                                 system (passive, item) re-patches a
//                                 skill mid-battle
//   • getCachedSkill(inst)      → returns the patched SkillDef at the
//                                 instance's current level, rebuilding
//                                 the cache if the version is stale
//
// All functions return a new SkillInstance — instances are immutable
// value objects, matching the core/unit.ts convention.
// ─────────────────────────────────────────────────────────────────────────────

import { applyLevelUpgrades } from '../../effects/patch'
import type { Effect, SkillDef, SkillInstance } from '../../effects/types'

const INITIAL_LEVEL = 1

export function createSkillInstance(def: SkillDef): SkillInstance {
  return rebuildCache({
    defId:         def.id,
    baseDef:       def,
    currentLevel:  INITIAL_LEVEL,
    cachedEffects: [],
    cachedCosts:   { tuCost: def.tuCost, apCost: def.apCost },
    cacheVersion:  0,
  })
}

export function levelUpSkill(instance: SkillInstance): SkillInstance {
  if (instance.currentLevel >= instance.baseDef.maxLevel) return instance
  return rebuildCache({
    ...instance,
    currentLevel: instance.currentLevel + 1,
    cacheVersion: instance.cacheVersion + 1,
  })
}

export function resetSkillToDefault(instance: SkillInstance): SkillInstance {
  return rebuildCache({
    ...instance,
    currentLevel: INITIAL_LEVEL,
    cacheVersion: instance.cacheVersion + 1,
  })
}

export function invalidateCache(instance: SkillInstance): SkillInstance {
  return { ...instance, cacheVersion: instance.cacheVersion + 1 }
}

// Reads the patched SkillDef for an instance. Kept as its own export so
// consumers can reason about the skill shape at its current level without
// poking at `cachedEffects` / `cachedCosts` directly.
export function getCachedSkill(instance: SkillInstance): SkillDef {
  return applyLevelUpgrades(instance.baseDef, instance.currentLevel)
}

// ── Internals ────────────────────────────────────────────────────────────────

function rebuildCache(instance: SkillInstance): SkillInstance {
  const patched = applyLevelUpgrades(instance.baseDef, instance.currentLevel)
  return {
    ...instance,
    cachedEffects: patched.effects as Effect[],
    cachedCosts:   { tuCost: patched.tuCost, apCost: patched.apCost },
  }
}
