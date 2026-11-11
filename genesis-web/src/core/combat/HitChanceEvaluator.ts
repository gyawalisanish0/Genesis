// Hit-chance calculation and probability table shifting.

import {
  STRIKE_BASELINE_PRECISION,
  TU_ACCURACY_BASELINE, TU_ACCURACY_PER_TICK,
} from '../constants'
import type { DiceOutcome } from './DiceResolver'

/** The four combined outcomes and their chances — what the player is shown. */
export type DiceProbabilities = Record<DiceOutcome, number>

/**
 * Phase 1's multiplier, from the actor's Precision and the skill's base chance.
 *
 * Precision 50 is the balanced baseline — strikeChance 1.0 and the base strike
 * table. Above tips toward Clean, below toward Loose. Uncapped here; the pool
 * shift handles scaling and the floor.
 */
export function calculateStrikeChance(precision: number, baseChance: number): number {
  return (precision / STRIKE_BASELINE_PRECISION) * baseChance
}

/**
 * How much a skill's tick cost sharpens the strike.
 *
 * A heavier commitment on the timeline is a more deliberate blow. Multiplies
 * strikeChance, so it composes with Precision rather than replacing it.
 */
export function tickFactor(tuCost: number): number {
  // A missing or malformed tuCost must not poison the table. Without this a
  // skill lacking the field produced NaN probabilities, which render as a bar
  // of zero-width zones rather than as an error anyone would notice.
  if (!Number.isFinite(tuCost)) return 1
  return Math.max(0, 1 + (tuCost - TU_ACCURACY_BASELINE) * TU_ACCURACY_PER_TICK)
}
