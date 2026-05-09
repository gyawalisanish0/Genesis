// Dice rolling and outcome resolution.

import {
  BOOSTED_MULTIPLIER,
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

// Apply a dice outcome to a raw output value and produce the full result.
export function applyOutcome(outcome: DiceOutcome, rawOutput: number): OutcomeResult {
  switch (outcome) {
    case 'Boosted':
      return { output: Math.round(rawOutput * BOOSTED_MULTIPLIER), evaded: false }
    case 'Evade':
      return { output: 0, evaded: true }
    case 'Fail':
      return { output: 0, evaded: false }
    default: // 'Hit'
      return { output: rawOutput, evaded: false }
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
