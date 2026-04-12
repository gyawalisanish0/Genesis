// ─────────────────────────────────────────────────────────────────────────────
// Named-key patch engine
//
// Applies a skill's levelUpgrades patches on top of its level-1 base. Keys
// are dot-delimited paths; any segment preceded by the literal "effects"
// is resolved against the effects array by matching an entry's `id` field
// rather than by numeric index. This keeps upgrades refactor-safe: adding,
// reordering, or removing effects never silently shifts a patch target.
//
// Examples (all from the contract doc):
//   "apCost"                            → skill.apCost
//   "resolution.baseChance"             → skill.resolution.baseChance
//   "effects.dmg.amount.percent"        → skill.effects[i].amount.percent
//                                         where skill.effects[i].id === "dmg"
//
// Patches are strictly *updates*. Creating new fields or new effects is
// not allowed; the level-1 base must declare the final shape.
// ─────────────────────────────────────────────────────────────────────────────

import type { Effect, LevelUpgrade, SkillDef } from './types'

const EFFECTS_SEGMENT = 'effects'

export function applyLevelUpgrades(base: SkillDef, level: number): SkillDef {
  if (level <= 1) return deepClone(base)
  const patches = collectPatchesUpTo(base.levelUpgrades ?? [], level)
  return patches.reduce(applyPatch, deepClone(base))
}

function collectPatchesUpTo(upgrades: LevelUpgrade[], level: number): LevelUpgrade[] {
  return upgrades
    .filter(u => u.level <= level)
    .sort((a, b) => a.level - b.level)
}

function applyPatch(skill: SkillDef, patch: LevelUpgrade): SkillDef {
  for (const [key, value] of Object.entries(patch.patch)) {
    writeByPath(skill as unknown as Record<string, unknown>, splitKey(key), value, skill.effects)
  }
  return skill
}

function splitKey(key: string): string[] {
  return key.split('.')
}

// Walks a path and sets the final segment to `value`. Resolves the
// `effects.<id>` pattern against the caller-provided effect list; that
// pattern consumes TWO path segments in one step.
function writeByPath(
  root:    Record<string, unknown>,
  path:    string[],
  value:   unknown,
  effects: Effect[],
): void {
  let cursor: Record<string, unknown> = root
  let i = 0
  while (i < path.length - 1) {
    const consumed = stepInto(cursor, path, i, effects)
    cursor = consumed.next
    i      = consumed.index
  }
  const leaf = path[path.length - 1]
  if (!(leaf in cursor)) {
    throw new Error(`Patch path does not exist on base: ${path.join('.')}`)
  }
  cursor[leaf] = value
}

// One step of the walk. When we hit `effects` at the root, consume the
// following id segment in the same step; otherwise advance by one.
function stepInto(
  cursor:  Record<string, unknown>,
  path:    string[],
  i:       number,
  effects: Effect[],
): { next: Record<string, unknown>; index: number } {
  const segment = path[i]
  if (i === 0 && segment === EFFECTS_SEGMENT) {
    const effect = findEffectById(effects, path[i + 1])
    return { next: effect as unknown as Record<string, unknown>, index: i + 2 }
  }
  const next = cursor[segment]
  if (typeof next !== 'object' || next === null) {
    throw new Error(`Patch path walks into non-object at segment "${segment}"`)
  }
  return { next: next as Record<string, unknown>, index: i + 1 }
}

function findEffectById(effects: Effect[], id: string): Effect {
  const found = effects.find(e => e.id === id)
  if (!found) throw new Error(`Effect id not found in base: "${id}"`)
  return found
}

// Patches mutate their target, so callers need a deep copy of the base
// that they can safely scribble on. JSON round-trip is sufficient because
// all contract types are JSON-serialisable by construction.
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
