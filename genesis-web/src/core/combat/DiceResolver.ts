// Dice rolling and outcome resolution.

import {
  BOOSTED_MULTIPLIER,
  FAIL_CHIP_MULTIPLIER,
  COUNTER_BASE,
  COUNTER_STEP,
  COUNTER_MIN,
} from '../constants'
import type { DiceProbabilities } from './HitChanceEvaluator'

export type DiceOutcome = 'Boosted' | 'Hit' | 'Evade' | 'Fail'

export interface OutcomeResult {
  output:  number   // final damage or healing value
  evaded:  boolean  // true when the attack was fully evaded
}

// Weighted random selection from a probability table.
export function roll(probs: DiceProbabilities): DiceOutcome {
  const rand = Math.random()
  let cumulative = 0
  for (const [outcome, prob] of Object.entries(probs) as [DiceOutcome, number][]) {
    cumulative += prob
    if (rand < cumulative) return outcome
  }
  return 'Hit'
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
    case 'Fail':    return FAIL_CHIP_MULTIPLIER
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
