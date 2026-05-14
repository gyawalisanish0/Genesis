// DefaultSequences — built-in phase sequences for standard melee and ranged attacks.
// Skills can override these by supplying a custom AnimPhase[] in their manifest.

import type { DiceOutcome } from '../../core/combat/DiceResolver'
import type { AnimPhase }   from './SequenceTypes'

/**
 * Returns the default phase sequence for an attack.
 * Impact FX (flash, particles, shake) fire inside `shove` / `projectile` at
 * the moment of contact — not as a separate sequential phase — so timing is
 * always frame-accurate regardless of sequence length.
 */
export function buildDefaultSequence(isMelee: boolean, outcome: DiceOutcome): AnimPhase[] {
  if (outcome === 'Evade') {
    return [
      { type: 'parallel', phases: [
        { type: isMelee ? 'shove' : 'projectile' },
        { type: 'evasionDodge' },
      ]},
    ]
  }

  return [{ type: isMelee ? 'shove' : 'projectile' }]
}
