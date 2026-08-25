// Hit-chance calculation and probability table shifting.

import {
  DICE_BASE_PROBABILITIES, MIN_OUTCOME_POOL,
  TU_ACCURACY_BASELINE, TU_ACCURACY_PER_TICK,
} from '../constants'

export type DiceProbabilities = Record<keyof typeof DICE_BASE_PROBABILITIES, number>

// Convert Precision stat + skill base_chance into a final multiplier.
// precision=50 is the balanced baseline (finalChance=1.0 → 50/50 good/bad split).
// Above 50 tips toward good outcomes; below 50 tips toward bad.
// Result can exceed 1.0 (no cap here — the shift handles scaling).
export function calculateFinalChance(precision: number, baseChance: number): number {
  return (precision / 50) * baseChance
}

/**
 * How much a skill's tick cost shifts its accuracy.
 *
 * A heavier commitment on the timeline is a more deliberate strike. Returns a
 * multiplier applied to finalChance, so it composes with Precision instead of
 * replacing it.
 */
export function tuAccuracyFactor(tuCost: number): number {
  // A missing or malformed tuCost must not poison the table. Without this a
  // skill lacking the field produced NaN probabilities, which render as a bar
  // of zero-width zones rather than as an error anyone would notice.
  if (!Number.isFinite(tuCost)) return 1
  return Math.max(0, 1 + (tuCost - TU_ACCURACY_BASELINE) * TU_ACCURACY_PER_TICK)
}

// Shift the base dice probability table by the final chance multiplier.
// - finalChance > 1.0 → positive outcomes (Boosted + Hit) scaled up
// - finalChance < 1.0 → negative outcomes (Evade + Fail) scaled up
// Probabilities always sum to 1.0.
export function shiftProbabilities(finalChance: number): DiceProbabilities {
  // Fall back to the neutral table on a non-finite input. A NaN here propagates
  // into all four probabilities, and NaN weights make roll() fall through to
  // its default while the odds band renders as four zero-width zones — wrong
  // silently, in both the simulation and the thing the player is reading.
  const chance = Number.isFinite(finalChance) ? finalChance : 1
  const base = { ...DICE_BASE_PROBABILITIES }
  const positivePool = base.Boosted + base.Hit
  const negativePool = base.Evade   + base.Fail

  // Clamp so neither pool can reach zero. Without the floor, high Precision
  // produced a unit that could not miss and low Precision one that could not
  // hit — in both cases the four-outcome table collapsed to a single result.
  const maxRatio    = positivePool > 0 ? 1.0 / positivePool : 1.0
  const ratio       = Math.min(chance, maxRatio)
  const rawPositive = positivePool * ratio
  const newPositive = Math.min(1 - MIN_OUTCOME_POOL, Math.max(MIN_OUTCOME_POOL, rawPositive))
  const newNegative = 1 - newPositive

  const posFrac = positivePool > 0 ? newPositive / positivePool : 0
  const negFrac = negativePool > 0 ? newNegative / negativePool : 0

  return {
    Boosted: base.Boosted * posFrac,
    Hit:     base.Hit     * posFrac,
    Evade:   base.Evade   * negFrac,
    Fail:    base.Fail    * negFrac,
  }
}
