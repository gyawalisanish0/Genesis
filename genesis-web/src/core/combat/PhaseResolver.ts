// Two-phase resolution. CONCEPT.md § Skill Resolution.
//
// Phase 1 asks how well the actor delivered the blow. Phase 2 asks what the
// target managed to do about it. The outcome is where the two meet, and neither
// phase decides it alone — a Clean strike can still be read, a Loose one can
// still land.
//
// This replaced a single roll whose table carried `Evade`, which put the wrong
// verb on the wrong unit: the attacker rolled and the result said the *defender*
// dodged. The defender was a number the attack was measured against, never a
// participant.

import {
  STRIKE_BASE_PROBABILITIES, REACTION_BASE_TABLES, MIN_OUTCOME_POOL,
  REACTION_BASELINE_ENDURANCE,
} from '../constants'
import type { DiceOutcome } from './DiceResolver'
import type { DiceProbabilities } from './HitChanceEvaluator'

export type StrikeBand   = keyof typeof STRIKE_BASE_PROBABILITIES
export type ReactionBand = keyof typeof REACTION_BASE_TABLES['Solid']

export type StrikeProbabilities   = Record<StrikeBand, number>
export type ReactionProbabilities = Record<ReactionBand, number>

/**
 * Which outcome each pairing produces.
 *
 * Deliberately the same four names and magnitudes the single-roll system used,
 * so every `onHit` / `onEvade` payload and every documented per-outcome number
 * in docs/characters/ keeps its meaning. The route to an outcome changed; the
 * outcome did not.
 */
export const OUTCOME_MATRIX: Record<StrikeBand, Record<ReactionBand, DiceOutcome>> = {
  Clean: { Caught: 'Boosted', Deflect: 'Hit',   Read: 'Evade' },
  Solid: { Caught: 'Hit',     Deflect: 'Graze', Read: 'Evade' },
  Loose: { Caught: 'Graze',   Deflect: 'Graze', Read: 'Evade' },
}

/**
 * Scale one pool of a table against the rest, keeping the total at 1.
 *
 * Both phases shift the same way — a positive pool grows as its chance rises
 * and the remainder shrinks to match — so the rule lives here once rather than
 * being written twice and drifting.
 *
 * The floor is what keeps the dice switched on. Without it a high enough
 * Precision produces a strike nobody can read, and a high enough Endurance a
 * defender nobody can touch; in both cases the table collapses to one result
 * and the resolution system quietly stops applying.
 */
export function shiftPools<K extends string>(
  base: Readonly<Record<K, number>>,
  // NoInfer keeps K pinned to the table's own keys. Without it a call naming a
  // subset of them — every call here does — narrows K to that subset, and the
  // returned table type silently loses the pools that were left alone.
  positive: readonly NoInfer<K>[],
  chance: number,
): Record<K, number> {
  const safeChance = Number.isFinite(chance) ? Math.max(0, chance) : 1
  const keys = Object.keys(base) as K[]
  const positiveSet = new Set<K>(positive)

  const positivePool = keys.filter(k => positiveSet.has(k)).reduce((s, k) => s + base[k], 0)
  const negativePool = 1 - positivePool

  const capped   = positivePool > 0 ? Math.min(safeChance, 1 / positivePool) : safeChance
  const rawPos   = positivePool * capped
  const newPos   = Math.min(1 - MIN_OUTCOME_POOL, Math.max(MIN_OUTCOME_POOL, rawPos))
  const newNeg   = 1 - newPos

  const posFrac = positivePool > 0 ? newPos / positivePool : 0
  const negFrac = negativePool > 0 ? newNeg / negativePool : 0

  return Object.fromEntries(
    keys.map(k => [k, base[k] * (positiveSet.has(k) ? posFrac : negFrac)]),
  ) as Record<K, number>
}

/** Phase 1. Clean and Solid are the actor's positive pool. */
export function strikeTable(strikeChance: number): StrikeProbabilities {
  return shiftPools(STRIKE_BASE_PROBABILITIES, ['Clean', 'Solid'], strikeChance)
}

/** Phase 2. Read and Deflect are the defender's positive pool. */
export function reactionTable(band: StrikeBand, reactionChance: number): ReactionProbabilities {
  return shiftPools(REACTION_BASE_TABLES[band], ['Read', 'Deflect'], reactionChance)
}

/**
 * How well a unit reacts, from Endurance — the defensive stat.
 *
 * An absent defender yields 1, the baseline table. That is the honest answer
 * for "the odds against an average opponent", which is what the action grid
 * shows before a target is chosen.
 */
export function reactionChance(endurance: number | undefined): number {
  if (endurance === undefined || !Number.isFinite(endurance)) return 1
  return Math.max(0, endurance) / REACTION_BASELINE_ENDURANCE
}

export function combineOutcome(strike: StrikeBand, reaction: ReactionBand): DiceOutcome {
  return OUTCOME_MATRIX[strike][reaction]
}

/**
 * The joint distribution over both phases, as the four familiar outcomes.
 *
 * The player is never shown two tables. They are shown what can happen to this
 * action, which is this — and the resolver rolls the same two tables this sums
 * over, so the strip cannot disagree with the result.
 */
export function combinedForecast(
  strikeChance: number,
  defenderReactionChance: number,
): DiceProbabilities {
  const strike = strikeTable(strikeChance)
  const out: DiceProbabilities = { Boosted: 0, Hit: 0, Evade: 0, Graze: 0 }

  for (const band of Object.keys(strike) as StrikeBand[]) {
    const reaction = reactionTable(band, defenderReactionChance)
    for (const react of Object.keys(reaction) as ReactionBand[]) {
      out[combineOutcome(band, react)] += strike[band] * reaction[react]
    }
  }
  return out
}
