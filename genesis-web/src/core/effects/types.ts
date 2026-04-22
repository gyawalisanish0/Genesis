// ─────────────────────────────────────────────────────────────────────────────
// Engine Content Contract — v0.1.0 types
//
// Mirrors docs/engine/00_content_contract.md exactly. This file is the
// TypeScript surface the effect registry, the Skill Engine, and the Zod
// schemas build against. It intentionally overlaps in name with the
// legacy SkillDef in core/types.ts — the legacy shape is untouched and
// still drives the existing unit.ts / tests until Wave C wires the new
// engine into combat.
//
// Rules this file follows:
//   1. Pure types — no runtime values, no classes, no functions
//   2. Zero imports from non-core layers
//   3. Every shape matches the canonical JSON example in the contract doc
//   4. Discriminated unions on `event` (WhenClause) and `type` (Effect)
//      so Zod can generate exhaustive schemas and tsc can narrow at use-site
// ─────────────────────────────────────────────────────────────────────────────

import type { DiceOutcome } from '../combat/DiceResolver'
import type { Unit } from '../types'

// ── Core vocabulary ──────────────────────────────────────────────────────────

/** The six character stats referenced by ValueExpr and modifyStat. */
export type StatKey =
  | 'strength'
  | 'endurance'
  | 'power'
  | 'resistance'
  | 'speed'
  | 'precision'

/** Skill tags — a skill carries 1–4. */
export type Tag =
  | 'physical'
  | 'energy'
  | 'melee'
  | 'ranged'
  | 'utility'
  | 'unique'
  | 'special'
  | 'awakened'
  | 'misc'
  | 'counter'        // standard reactive counter — triggers on Evasion
  | 'uniqueCounter'  // character-specific counter with custom effects; same dice + chain rules

// ── ValueExpr — the only mini-syntax ─────────────────────────────────────────

/**
 * A numeric field that may either be a flat value or a reference to a
 * character stat scaled by a percent. This is the ONLY expression form
 * in the contract — no DSL, no parser, no runtime eval.
 */
export type ValueExpr =
  | number
  | { stat: StatKey; percent: number; of?: 'caster' | 'target' }
  | { sum: ValueExpr[] }

// ── WhenClause — trigger events ──────────────────────────────────────────────

/**
 * Trigger clause on every effect. Always an object keyed on `event`;
 * some events carry parameters (onTickInterval, onHpThreshold, ...).
 * Engines listen only to a subset of events — see contract doc §WhenClause.
 */
export type WhenClause =
  | { event: 'onCast' }
  | { event: 'onDiceRoll'; outcome?: DiceOutcome }
  | { event: 'onHit' }
  | { event: 'onMiss' }
  | { event: 'onAfterHit' }
  | { event: 'onEvade' }
  | { event: 'onApply' }
  | { event: 'onExpire' }
  | { event: 'onRemoved' }
  | { event: 'onTickInterval'; interval: number }
  | { event: 'onUnitTurnStart' }
  | { event: 'onTakeDamage' }
  | { event: 'onHpThreshold'; below?: number; above?: number }
  | { event: 'onApChange' }
  | { event: 'onBattleStart' }
  | { event: 'onBattleEnd' }

export type EventName = WhenClause['event']

// ── Condition — first-class effect gating ───────────────────────────────────

/**
 * Optional gate evaluated against the EffectContext when the event fires.
 * If absent or true → effect runs. If false → effect is skipped silently.
 * Recursive for boolean composition (not / all / any).
 */
export type Condition =
  | { chance: number }
  | { selfHpBelow: number }
  | { selfHpAbove: number }
  | { targetHpBelow: number }
  | { targetHpAbove: number }
  | { selfApBelow: number }
  | { selfApAbove: number }
  | { hasStatus: string }
  | { hasTag: string }
  | { diceOutcome: DiceOutcome }
  | { not: Condition }
  | { all: Condition[] }
  | { any: Condition[] }

// ── Targeting ────────────────────────────────────────────────────────────────

/**
 * Effect-level target. A skill declares a default Targeting block; any
 * individual effect may override it with its own `target` field. The
 * `{ tag }` form selects all units carrying any status with the given tag.
 */
export type TargetSelector =
  | 'self'
  | 'enemy'
  | 'ally'
  | 'all-enemies'
  | 'all-allies'
  | 'lowest-hp-ally'
  | 'lowest-hp-enemy'
  | 'random-enemy'
  | 'random-ally'
  | 'caster-and-target'
  | { tag: string }

/** Top-level skill targeting block. `range` is informational for UI only. */
export interface Targeting {
  selector: TargetSelector
  range:    'melee' | 'ranged' | 'global'
}

// ── Effect — the universal shape ─────────────────────────────────────────────

/**
 * Duration vocabulary for temporary modifications. Numbers are tick counts;
 * 'battle' scopes to the end of the current battle; 'untilStatusGone' ties
 * the mod's lifetime to a parent status.
 */
export type ModDuration = number | 'battle' | 'untilStatusGone'

/** Fields every effect shares, regardless of primitive type. */
interface EffectBase {
  /** Required if this effect is referenced by a levelUpgrades patch. */
  id?:        string
  when:       WhenClause
  condition?: Condition
  target?:    TargetSelector
}

/**
 * The effect primitive union. Each variant corresponds to a handler in
 * core/effects/builtins/<name>.ts. Adding a primitive requires:
 *   1. A new variant here
 *   2. A handler module
 *   3. A Zod schema variant in services/DataService
 *   4. A row in the contract doc §Effect Primitives table
 */
export type Effect =
  | (EffectBase & { type: 'damage';            amount: ValueExpr; damageType?: string })
  | (EffectBase & { type: 'heal';              amount: ValueExpr })
  | (EffectBase & { type: 'tickShove';         amount: number })
  | (EffectBase & { type: 'gainAp';            amount: number })
  | (EffectBase & { type: 'spendAp';           amount: number })
  | (EffectBase & { type: 'modifyStat';        stat: StatKey; delta: number; duration: ModDuration })
  | (EffectBase & { type: 'applyStatus';       status: string; duration?: number; chance?: number })
  | (EffectBase & { type: 'removeStatus';      status?: string; tag?: string })
  | (EffectBase & { type: 'shiftProbability';  outcome: DiceOutcome; delta: number })
  | (EffectBase & { type: 'rerollDice';        outcome?: DiceOutcome; uses: number; perBattle?: boolean })
  | (EffectBase & { type: 'forceOutcome';      outcome: DiceOutcome })
  | (EffectBase & { type: 'triggerSkill';      skillId: string; ignoreCost?: boolean })
  | (EffectBase & { type: 'secondaryResource'; delta: number })

/** Discriminator union of all primitive `type` values. */
export type EffectType = Effect['type']

// ── Resolution — dice tuning on a skill ──────────────────────────────────────

/**
 * Pre-roll modifier applied to a specific skill's dice resolution.
 * (Post-roll effects like `rerollDice` live in the effects array with
 * `when: { event: "onDiceRoll" }` instead.)
 */
export interface DiceModifier {
  type:    'shiftProbability' | 'forceOutcome'
  outcome: DiceOutcome
  delta?:  number
}

export interface Resolution {
  /** 0.01 – 1.50, multiplied against caster Precision. */
  baseChance:     number
  diceModifiers?: DiceModifier[]
}

// ── LevelUpgrade — named-key patch ───────────────────────────────────────────

/**
 * Ordered list of patches applied on top of the level-1 base form when a
 * skill reaches each level during a run. Keys are dot-delimited paths that
 * MUST reference effects by id (e.g. "effects.dmg.amount.percent"), never
 * by array index — reordering effects must never break upgrades.
 */
export interface LevelUpgrade {
  /** ≥ 2, strictly increasing across the levelUpgrades array. */
  level: number
  patch: Record<string, unknown>
}

// ── Script schemas ───────────────────────────────────────────────────────────

/**
 * Skill definition — the JSON array under public/data/characters/{id}/skills.json.
 * Skills are character-exclusive; there is no global data/skills/ directory.
 * This is the contract v0.1.0 shape. Replaces core/types.ts:SkillDef in
 * Wave B.
 */
export interface SkillDef {
  type:           'skill'
  id:             string
  name:           string
  description?:   string
  tuCost:         number
  apCost:         number
  tickCooldown?:  number   // ticks that must elapse after use before skill is available
  turnCooldown?:  number   // unit's own actions that must occur after use
  tags:           Tag[]
  maxLevel:       number
  targeting:      Targeting
  resolution?:    Resolution
  effects:        Effect[]
  levelUpgrades?: LevelUpgrade[]
}

/** How a status merges with an existing instance of itself on the target. */
export type StatusStacking = 'refresh' | 'extend' | 'stack' | 'independent'

/**
 * Status definition — the JSON file under public/data/statuses/<id>.json.
 */
export interface StatusDef {
  type:       'status'
  id:         string
  name:       string
  stacking:   StatusStacking
  /** Required when stacking === 'stack'. */
  maxStacks?: number
  /** Base duration in ticks; may be overridden by the applying skill. */
  duration:   number
  tags?:      string[]
  effects:    Effect[]
}

/**
 * Passive definition — the JSON file under public/data/passives/<id>.json.
 * Always on for the whole battle. Never expires, never stacks.
 */
export interface PassiveDef {
  type:         'passive'
  id:           string
  name:         string
  description?: string
  effects:      Effect[]
}

/** Item tier discriminator. Equipment and Relic are Genesis Items (global). */
export type ItemTier = 'equipment' | 'relic' | 'campaignItem'

/**
 * Item definition — JSON files under public/data/items/{campaign,genesis}/.
 * `slot` is required for equipment and references a unit-defined slot id.
 */
export interface ItemDef {
  type:         ItemTier
  id:           string
  name:         string
  description?: string
  slot?:        string
  effects:      Effect[]
}

// ── Runtime: SkillInstance ───────────────────────────────────────────────────

/**
 * Per-unit runtime instance of an equipped skill. Holds an immutable
 * level-1 baseline plus a patched cache that is recomputed on level-up.
 *
 * Lifecycle:
 *   - Instantiation: currentLevel = 1, cache = base
 *   - levelUp(): bumps currentLevel, applies patches, rewrites cachedEffects
 *                and cachedCosts, bumps cacheVersion
 *   - Cast path: reads exclusively from cachedEffects / cachedCosts
 *   - External re-patch (e.g. by a passive): bumps cacheVersion → next
 *     cast triggers a lazy rebuild
 *   - resetToDefault(): rebuilds cache from baseDef at level 1. Called by
 *     the mode / run lifecycle only — NEVER by the battle engine.
 */
export interface SkillInstance {
  defId:         string
  baseDef:       Readonly<SkillDef>
  currentLevel:  number
  cachedEffects: Effect[]
  cachedCosts:           { tuCost: number; apCost: number }
  cacheVersion:          number
  cooldownReadyAtTick:   number  // 0 = ready; usable when unit.tickPosition >= this
  cooldownReadyAtAction: number  // 0 = ready; usable when unit.actionCount  >= this
}

// ── Runtime: BattleState + EffectContext ────────────────────────────────────

/** Which engine originated the effect — used for logging and telemetry. */
export type EffectSource = 'skill' | 'status' | 'passive' | 'item'

/**
 * Minimal mutable orchestrator that holds the battle's immutable Units
 * and exposes lookup + replace semantics. Effect handlers mutate state
 * only through this interface — they never reach into a store or mutate
 * Unit properties directly.
 *
 * The interface is intentionally small: everything else (target
 * resolution, AP economy, tick advancement) is built on top of these
 * primitives in higher layers.
 */
export interface BattleState {
  getUnit(id: string):       Unit | undefined
  setUnit(unit: Unit):        void
  getAllUnits():              readonly Unit[]
}

/**
 * The single argument every effect handler receives. Handlers mutate
 * battle state exclusively through `battle`; they never import from
 * state singletons and never mutate `caster`/`target` fields directly.
 *
 * `caster` is the unit performing the action. `target` is the default
 * single target resolved from the skill's top-level targeting block.
 * `targets` is populated when an effect-level override resolves to a
 * multi-unit selector (`all-enemies`, `caster-and-target`, etc.).
 */
export interface EffectContext {
  caster:   Unit
  target?:  Unit
  targets?: readonly Unit[]
  battle:   BattleState
  source:   EffectSource
  event:    WhenClause
  /** Present during onDiceRoll / onHit / onAfterHit. */
  dice?:    DiceOutcome
}

// ── Effect handler signature ─────────────────────────────────────────────────

/**
 * Every primitive in core/effects/builtins/ exports a handler of this shape.
 * Handlers are pure with respect to their arguments — all state mutation
 * flows through ctx.battle's typed methods.
 */
export type EffectHandler<E extends Effect = Effect> = (
  effect: E,
  ctx:    EffectContext,
) => void
