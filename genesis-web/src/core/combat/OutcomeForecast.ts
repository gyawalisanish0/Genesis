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
import { calculateFinalChance, shiftProbabilities, tuAccuracyFactor } from './HitChanceEvaluator'
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
 * The four-outcome probability table for this caster using this skill.
 * Differs per caster and per skill: finalChance is (precision / 50) x baseChance
 * scaled by the skill's tick investment, so the same skill reads differently in
 * different hands and a heavier skill lands more reliably than a jab.
 */
export function forecastOutcomes(caster: Unit, skill: Readonly<SkillDef>): DiceProbabilities {
  const baseChance = skill.resolution?.baseChance ?? 1.0
  const finalChance = calculateFinalChance(
    caster.stats.precision,
    baseChance + rangedChanceBonus(caster, skill),
  ) * tuAccuracyFactor(skill.tuCost)
  return shiftProbabilities(finalChance)
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
