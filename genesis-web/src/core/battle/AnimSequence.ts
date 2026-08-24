// AnimSequence — flatten an authored AnimPhase[] into a timed plan.
//
// Pure and synchronous: no React, no timers, no DOM. The renderer replays the
// plan; everything decided here is decided once and is testable.
//
// The executor this replaces (scenes/battle/SequenceRunner.ts) was deleted with
// the Phaser renderer in fd2587b, which left all 15 AnimPhase variants as dead
// letters even though the engine still authors and ships them.

import type { AnimPhase } from '../types'
import type { DiceOutcome } from '../combat/DiceResolver'
import {
  SHOVE_OUT_MS, EVADE_DODGE_MS, FLASH_HOLD_MS, SEQUENCE_BUDGET_MS,
} from '../constants'

/** A leaf phase scheduled at an offset from the start of the sequence. */
export interface AnimStep {
  atMs:  number
  phase: AnimPhase
}

/** How long a leaf phase occupies the timeline before the next one starts. */
function durationOf(phase: AnimPhase): number {
  switch (phase.type) {
    case 'wait':         return phase.ms
    case 'shove':        return SHOVE_OUT_MS
    case 'evasionDodge': return EVADE_DODGE_MS
    case 'flash':        return FLASH_HOLD_MS
    case 'cameraShake':  return phase.duration
    // playAnim hands off to the sprite's own frame clock; the rest are
    // instantaneous cues that do not hold up the sequence.
    default:             return 0
  }
}

/** Flatten one phase, returning the steps it produces and the time it consumes. */
function flatten(phase: AnimPhase, at: number, outcome: DiceOutcome): { steps: AnimStep[]; spent: number } {
  if (phase.type === 'parallel') {
    // Children all start together; the group lasts as long as its longest child.
    const steps: AnimStep[] = []
    let longest = 0
    for (const child of phase.phases) {
      const r = flatten(child, at, outcome)
      steps.push(...r.steps)
      longest = Math.max(longest, r.spent)
    }
    return { steps, spent: longest }
  }

  if (phase.type === 'branch') {
    const chosen = phase.cases[outcome] ?? phase.cases.default
    if (!chosen) return { steps: [], spent: 0 }
    return flattenAll(chosen, at, outcome)
  }

  return { steps: [{ atMs: at, phase }], spent: durationOf(phase) }
}

function flattenAll(phases: AnimPhase[], at: number, outcome: DiceOutcome): { steps: AnimStep[]; spent: number } {
  const steps: AnimStep[] = []
  let cursor = at
  for (const phase of phases) {
    const r = flatten(phase, cursor, outcome)
    steps.push(...r.steps)
    cursor += r.spent
  }
  return { steps, spent: cursor - at }
}

/**
 * Resolve `parallel` and `branch`, schedule every leaf, and compress to fit.
 *
 * Nothing awaits the animation — the engine holds a fixed ANIM_TIMEOUT_MS and
 * moves on regardless — so a long authored sequence must be scaled down rather
 * than allowed to run past the window and be cut mid-beat.
 */
export function planSequence(
  phases:  AnimPhase[],
  outcome: DiceOutcome,
  budgetMs = SEQUENCE_BUDGET_MS,
): AnimStep[] {
  const { steps, spent } = flattenAll(phases, 0, outcome)
  if (spent <= budgetMs || spent === 0) return steps
  const scale = budgetMs / spent
  return steps.map(s => ({ ...s, atMs: Math.round(s.atMs * scale) }))
}

/** Total time the plan occupies, for callers that need to know. */
export function planDuration(steps: AnimStep[]): number {
  return steps.reduce((max, s) => Math.max(max, s.atMs + durationOf(s.phase)), 0)
}

/**
 * The sequence used when a skill authors none.
 *
 * Outcome is expressed through *who moves*: the attacker commits on a hit, the
 * defender slips aside on an evade, and the attacker's swing lands on nothing
 * when it fails. That distinction is the whole reason Evade and Fail were
 * previously indistinguishable on screen — both simply printed a word.
 */
export function defaultSequence(isMelee: boolean): AnimPhase[] {
  const approach: AnimPhase[] = isMelee ? [{ type: 'shove' }] : [{ type: 'projectile' }]
  return [
    {
      type: 'branch',
      cases: {
        Boosted: [
          ...approach,
          { type: 'parallel', phases: [
            { type: 'impact' },
            { type: 'flash', figure: 'target', colour: 'var(--accent-gold)' },
            { type: 'cameraShake', duration: 320, intensity: 2 },
          ] },
          { type: 'parallel', phases: [{ type: 'damageNumber' }, { type: 'feedback' }] },
        ],
        Hit: [
          ...approach,
          { type: 'parallel', phases: [
            { type: 'impact' },
            { type: 'flash', figure: 'target' },
            { type: 'cameraShake', duration: 160, intensity: 1 },
          ] },
          { type: 'parallel', phases: [{ type: 'damageNumber' }, { type: 'feedback' }] },
        ],
        // The defender acts — the read is "they got out of the way".
        Evade: [
          ...approach,
          { type: 'evasionDodge' },
          { type: 'feedback' },
        ],
        // Nobody reacts — the swing simply finds nothing.
        Fail: [
          ...approach,
          { type: 'wait', ms: 120 },
          { type: 'feedback' },
        ],
      },
    },
  ]
}
