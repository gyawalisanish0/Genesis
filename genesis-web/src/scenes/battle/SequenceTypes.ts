// SequenceTypes — data types for the phase-based animation sequence system.
// Pure data — no Phaser imports. Consumed by SequenceRunner (scenes layer).

import type { DiceOutcome }           from '../../core/combat/DiceResolver'
import type { AnimationProjectileDef } from '../../core/types'

/** Runtime context threaded through every phase during execution. */
export interface SequenceContext {
  actingDefId: string
  targetDefId: string
  outcome:     DiceOutcome
  damage:      number
  isMelee:     boolean
  dashDx:      number
  projectile:  AnimationProjectileDef | null
}

/**
 * Discriminated union of all animation phases.
 *
 * Sequential phases run one after the other (each waits for the previous
 * onDone). Use `parallel` to run multiple phases simultaneously.
 * Use `branch` for outcome-conditional sub-sequences.
 */
export type AnimPhase =
  /** Hold for a fixed duration before advancing. */
  | { type: 'wait';         ms: number }

  /** Play a named animation state on a figure. Advances when frames complete. */
  | { type: 'playAnim';     figure: 'acting' | 'target'; stateKey: string }

  /**
   * Melee shove tween toward the target. Fires impact FX at contact moment
   * (halfway through), then advances onDone when the tween returns.
   */
  | { type: 'shove' }

  /** Target evasion dodge tween. Advances when tween completes. */
  | { type: 'evasionDodge' }

  /**
   * Ranged projectile travel from acting to target. Fires impact FX on
   * arrival, then advances onDone.
   */
  | { type: 'projectile' }

  /**
   * Standalone impact burst — flash, particles, camera shake driven by
   * ctx.outcome. Synchronous: advances immediately after triggering FX.
   */
  | { type: 'impact' }

  /** Camera shake. Advances immediately after triggering (fire-and-forget). */
  | { type: 'cameraShake';  duration: number; intensity: number }

  /** Show or hide the aura for a figure. Advances immediately. */
  | { type: 'aura';         figure: 'acting' | 'target'; show: boolean }

  /** Run all child phases simultaneously. Advances when ALL complete. */
  | { type: 'parallel';     phases: AnimPhase[] }

  /**
   * Branch on ctx.outcome. Runs the matching case sequence, or 'default'
   * if no exact match. Advances when the chosen sub-sequence completes.
   */
  | { type: 'branch';       cases: Partial<Record<DiceOutcome | 'default', AnimPhase[]>> }
