// SequenceTypes — re-exports AnimPhase from core/types and adds the runtime
// SequenceContext that is threaded through phase execution.
//
// AnimPhase lives in core/ so it can be referenced by the JSON manifest type
// (AnimSequenceManifest) without pulling Phaser into the core layer.

import type { DiceOutcome }           from '../../core/combat/DiceResolver'
import type { AnimationProjectileDef } from '../../core/types'

// Re-export so all scene-layer consumers can import from one place.
export type { AnimPhase } from '../../core/types'

/** Runtime context threaded through every phase during execution. */
export interface SequenceContext {
  actingDefId:    string
  targetDefId:    string
  outcome:        DiceOutcome
  damage:         number
  isMelee:        boolean
  dashDx:         number
  projectile:     AnimationProjectileDef | null
  /** Outcome label shown by the `feedback` phase, e.g. "BOOSTED!", "EVADED!". */
  feedbackText:   string
  /** CSS colour token for the feedback label, e.g. 'var(--accent-gold)'. */
  feedbackColour: string
}
