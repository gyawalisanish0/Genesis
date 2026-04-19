// Hit-chance calculation and probability table shifting.
// Port of app/core/combat/hit_chance_evaluator.py

import { DICE_BASE_PROBABILITIES } from '../constants'

export type DiceProbabilities = Record<keyof typeof DICE_BASE_PROBABILITIES, number>

// Convert Precision stat + skill base_chance into a final multiplier.
// Result can exceed 1.0 (no cap here — the shift handles scaling).
export function calculateFinalChance(precision: number, baseChance: number): number {
  return (precision / 100) * baseChance
}

// Shift the base dice probability table by the final chance multiplier.
// - finalChance > 1.0 → positive outcomes (Boosted + Success) scaled up
// - finalChance < 1.0 → negative outcomes (Tumbling + GuardUp + Evasion) scaled up
// Probabilities always sum to 1.0.
export function shiftProbabilities(finalChance: number): DiceProbabilities {
  const base = { ...DICE_BASE_PROBABILITIES }
  const positivePool = base.Boosted + base.Success
  const negativePool = base.Tumbling + base.GuardUp + base.Evasion + base.Fail

  // Cap ratio so newPositive never exceeds 1.0 (which would give negative negPool)
  const maxRatio = positivePool > 0 ? 1.0 / positivePool : 1.0
  const ratio = Math.min(finalChance, maxRatio)
  const newPositive = positivePool * ratio
  const newNegative = 1 - newPositive

  const posFrac = positivePool > 0 ? newPositive / positivePool : 0
  const negFrac = negativePool > 0 ? newNegative / negativePool : 0

  return {
    Boosted:  base.Boosted  * posFrac,
    Success:  base.Success  * posFrac,
    Tumbling: base.Tumbling * negFrac,
    GuardUp:  base.GuardUp  * negFrac,
    Evasion:  base.Evasion  * negFrac,
    Fail:     base.Fail     * negFrac,
  }
}
