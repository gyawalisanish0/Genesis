// Dice rolling and outcome resolution.

import {
  BOOSTED_MULTIPLIER,
  GRAZE_CHIP_MULTIPLIER,
  COUNTER_BASE,
  COUNTER_STEP,
  COUNTER_MIN,
} from '../constants'
import type { DiceProbabilities } from './HitChanceEvaluator'

/**
 * The four outcomes, unchanged in name and magnitude by the move to two phases.
 *
 * `Graze` was called `Fail` when it meant a clean miss. It has delivered chip
 * damage and an AP refund since, so the old name misdescribed it — and a name
 * that lies about behaviour is how the spec and the engine drifted apart in the
 * first place.
 */
export type DiceOutcome = 'Boosted' | 'Hit' | 'Evade' | 'Graze'

export interface OutcomeResult {
  output:  number   // final damage or healing value
  evaded:  boolean  // true when the attack was fully evaded
}

/**
 * Weighted random selection from any probability table.
 *
 * Generic over the band type so both phases roll through one implementation:
 * phase 1 picks a StrikeBand, phase 2 a ReactionBand, and the outcome is their
 * pairing. `fallback` is returned only if the weights never reach the roll,
 * which a table summing to 1 cannot do.
 */
export function rollTable<K extends string>(
  probs: Readonly<Record<K, number>>,
  fallback: K,
): K {
  const rand = Math.random()
  let cumulative = 0
  for (const [band, prob] of Object.entries(probs) as [K, number][]) {
    cumulative += prob
    if (rand < cumulative) return band
  }
  return fallback
}

/** The combined four-outcome table, for callers that already hold one. */
export function roll(probs: DiceProbabilities): DiceOutcome {
  return rollTable(probs, 'Hit')
}

/**
 * How much of a skill's output an outcome delivers.
 *
 * This is the single source of truth for outcome magnitude. It used to live
 * only inside applyOutcome, which nothing in the battle pipeline called — so
 * BOOSTED_MULTIPLIER never fired and a Boosted hit dealt exactly as much as a
 * plain Hit. The dice had four names but two behaviours.
 */
export function outcomeScale(outcome: DiceOutcome): number {
  switch (outcome) {
    case 'Boosted': return BOOSTED_MULTIPLIER
    case 'Hit':     return 1
    case 'Graze':   return GRAZE_CHIP_MULTIPLIER
    case 'Evade':   return 0
  }
}

// Apply a dice outcome to a raw output value and produce the full result.
export function applyOutcome(outcome: DiceOutcome, rawOutput: number): OutcomeResult {
  return {
    output: Math.round(rawOutput * outcomeScale(outcome)),
    evaded: outcome === 'Evade',
  }
}

// Counter chain — chance diminishes with each recursion depth.
export function resolveCounterRoll(depth: number): boolean {
  const chance = Math.max(
    COUNTER_MIN,
    COUNTER_BASE - depth * COUNTER_STEP,
  )
  return Math.random() < chance
}
