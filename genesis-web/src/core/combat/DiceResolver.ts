// Dice rolling and outcome resolution.
// Port of app/core/combat/dice_resolver.py

import {
  BOOSTED_MULTIPLIER,
  TUMBLING_MULTIPLIER,
  GUARD_UP_MITIGATION,
  TUMBLING_DELAY_MIN,
  TUMBLING_DELAY_MAX,
  EVASION_COUNTER_BASE,
  EVASION_COUNTER_STEP,
  EVASION_COUNTER_MIN,
} from '../constants'
import type { DiceProbabilities } from './HitChanceEvaluator'

export type DiceOutcome = 'Boosted' | 'Success' | 'Tumbling' | 'GuardUp' | 'Evasion'

export interface OutcomeResult {
  output:          number   // final damage or healing value
  tumbleDelay:     number   // extra ticks added (Tumbling only)
  guardMitigation: number   // mitigation applied to target (GuardUp only)
  evaded:          boolean  // true when the attack was fully evaded
}

// Weighted random selection from a probability table.
export function roll(probs: DiceProbabilities): DiceOutcome {
  const rand = Math.random()
  let cumulative = 0
  for (const [outcome, prob] of Object.entries(probs) as [DiceOutcome, number][]) {
    cumulative += prob
    if (rand < cumulative) return outcome
  }
  // Floating-point edge case — fall through to Success
  return 'Success'
}

// Apply a dice outcome to a raw output value and produce the full result.
export function applyOutcome(outcome: DiceOutcome, rawOutput: number): OutcomeResult {
  switch (outcome) {
    case 'Boosted':
      return {
        output:          Math.round(rawOutput * BOOSTED_MULTIPLIER),
        tumbleDelay:     0,
        guardMitigation: 0,
        evaded:          false,
      }
    case 'Tumbling':
      return {
        output:          Math.round(rawOutput * TUMBLING_MULTIPLIER),
        tumbleDelay:     calculateTumblingDelay(),
        guardMitigation: 0,
        evaded:          false,
      }
    case 'GuardUp':
      return {
        output:          rawOutput,
        tumbleDelay:     0,
        guardMitigation: Math.round(rawOutput * GUARD_UP_MITIGATION),
        evaded:          false,
      }
    case 'Evasion':
      return { output: 0, tumbleDelay: 0, guardMitigation: 0, evaded: true }
    default: // 'Success'
      return { output: rawOutput, tumbleDelay: 0, guardMitigation: 0, evaded: false }
  }
}

// Random tumbling delay within [TUMBLING_DELAY_MIN, TUMBLING_DELAY_MAX].
export function calculateTumblingDelay(): number {
  return (
    TUMBLING_DELAY_MIN +
    Math.floor(Math.random() * (TUMBLING_DELAY_MAX - TUMBLING_DELAY_MIN + 1))
  )
}

// Evasion counter chance diminishes with each recursion depth.
export function resolveEvasionCounter(depth: number): boolean {
  const chance = Math.max(
    EVASION_COUNTER_MIN,
    EVASION_COUNTER_BASE - depth * EVASION_COUNTER_STEP,
  )
  return Math.random() < chance
}
