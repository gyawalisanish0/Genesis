// DefaultSequences — built-in phase sequences for standard melee and ranged attacks.
// Skills can override these by supplying a custom AnimPhase[] in their manifest.

import type { DiceOutcome } from '../../core/combat/DiceResolver'
import type { AnimPhase }   from './SequenceTypes'

/**
 * Returns the default phase sequence for an attack.
 *
 * Impact FX (flash, particles, shake) fire inside `shove` / `projectile` at
 * the moment of contact — not as a separate sequential phase — so timing is
 * always frame-accurate regardless of sequence length.
 *
 * After the contact phase completes, a parallel pair of `damageNumber` and
 * `feedback` fires simultaneously so both text elements pop at the same moment
 * but at different vertical positions (number below centre, label above).
 */
export function buildDefaultSequence(isMelee: boolean, outcome: DiceOutcome): AnimPhase[] {
  const contactPhase: AnimPhase = { type: isMelee ? 'shove' : 'projectile' }

  const textPhase: AnimPhase = {
    type: 'parallel',
    phases: [
      { type: 'damageNumber' },
      { type: 'feedback' },
    ],
  }

  if (outcome === 'Evade') {
    return [
      { type: 'parallel', phases: [contactPhase, { type: 'evasionDodge' }] },
      textPhase,
    ]
  }

  return [contactPhase, textPhase]
}
