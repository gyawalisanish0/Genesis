// OutcomeForecast — what a skill is *about* to do, computed before it is used.
//
// The resolver already derives these numbers at roll time and then discards
// them. The UI needs the same numbers one moment earlier, to show the player
// the odds and the tempo cost before they commit. Both call in here so the
// displayed forecast and the rolled outcome can never disagree.

import type { Unit } from '../types'
// The effects-layer SkillDef — the one carrying `resolution`, and the shape the
// resolver actually holds. `core/types.ts` exports a narrower JSON-facing SkillDef.
import type { SkillDef } from '../effects/types'
import { calculateStrikeChance, tickFactor } from './HitChanceEvaluator'
import { combinedForecast, reactionChance } from './PhaseResolver'
import type { DiceProbabilities } from './HitChanceEvaluator'
import { calculateApGained } from './TickCalculator'

/** Ranged skills pick up `rangedBaseChanceBonus` from any active status. */
export function rangedChanceBonus(caster: Unit, skill: Readonly<SkillDef>): number {
  if (!skill.tags.includes('ranged')) return 0
  return caster.statusSlots.reduce((sum, slot) => {
    const bonus = slot.payload?.rangedBaseChanceBonus
    return typeof bonus === 'number' ? sum + bonus : sum
  }, 0)
}

/**
 * Phase 1's chance for this caster and this skill.
 *
 * Exported because the resolver needs the strike table itself, not the combined
 * forecast — it has to know *which* band it rolled to pick the reaction table.
 * Deriving it twice is how the displayed odds and the rolled ones drift apart,
 * which is the failure this module exists to prevent.
 */
export function strikeChanceFor(caster: Unit, skill: Readonly<SkillDef>): number {
  const baseChance = skill.resolution?.baseChance ?? 1.0
  return calculateStrikeChance(
    caster.stats.precision,
    baseChance + rangedChanceBonus(caster, skill),
  ) * tickFactor(skill.tuCost)
}

/**
 * The four-outcome table for this caster, this skill, and this defender.
 *
 * Both phases fold into one distribution here, because the player is never
 * shown two tables — they are shown what can happen to this action. The
 * resolver rolls the same two tables this sums over, so the strip cannot
 * disagree with the result.
 *
 * `defender` is optional: the action grid shows odds before a target is
 * chosen. Absent means the baseline reaction table, which is the honest answer
 * to "against an average opponent" — and the odds sharpen once the player
 * picks someone.
 */
export function forecastOutcomes(
  caster: Unit,
  skill: Readonly<SkillDef>,
  defender?: Unit | null,
): DiceProbabilities {
  return combinedForecast(
    strikeChanceFor(caster, skill),
    reactionChance(defender?.stats.endurance),
  )
}

/** True when a status is currently suppressing this unit's AP regeneration. */
export function isApRegenFrozen(caster: Unit): boolean {
  return caster.statusSlots.some(slot => slot.payload?.freezesApRegen === true)
}

/**
 * AP this unit will regain by spending `tuCost` ticks on an action.
 * The tempo half of the AP economy: a slow skill costs more AP up front but
 * pays more back, and that trade is invisible without showing it.
 * Mirrors BattleAttackResolver — no regen on the opening tick.
 */
export function forecastApGain(caster: Unit, tuCost: number, currentTick: number): number {
  if (isApRegenFrozen(caster)) return 0
  return calculateApGained(currentTick > 0 ? tuCost : 0, caster.apRegenRate)
}
