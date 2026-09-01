// TwoPhaseDiceRoll — plays the strike beat, then the reaction beat, then hands
// off to the existing DiceRoll for the combined outcome.
//
// CONCEPT.md § Skill Resolution: phase 1 is the actor's blow, phase 2 is the
// target's answer to it. Showing only the combined result put both rolls
// under one settle, so the reaction never read as the target doing anything —
// this sequences the two so each gets its own beat before the payoff.

import { useState } from 'react'
import type { DiceOutcome } from '../core/combat/DiceResolver'
import type { DicePhaseData } from '../core/battle/EngineTypes'
import type { DiceProbabilities } from '../core/combat/HitChanceEvaluator'
import type { StrikeBand, ReactionBand } from '../core/combat/PhaseResolver'
import { DiceRoll } from './DiceRoll'
import { PhaseBeat } from './PhaseBeat'

const STRIKE_ORDER:   readonly StrikeBand[]   = ['Clean', 'Solid', 'Loose']
const REACTION_ORDER: readonly ReactionBand[] = ['Read', 'Deflect', 'Caught']

interface Props {
  phases:        DicePhaseData
  probabilities: DiceProbabilities
  outcome:       DiceOutcome
}

type Beat = 'strike' | 'reaction' | 'outcome'

export function TwoPhaseDiceRoll({ phases, probabilities, outcome }: Props) {
  const [beat, setBeat] = useState<Beat>('strike')

  if (beat === 'strike') {
    return (
      <PhaseBeat
        label="STRIKE" tone="strike" order={STRIKE_ORDER}
        probabilities={phases.strikeProbabilities} result={phases.strike}
        onSettled={() => setBeat('reaction')}
      />
    )
  }
  if (beat === 'reaction') {
    return (
      <PhaseBeat
        label="REACTION" tone="reaction" order={REACTION_ORDER}
        probabilities={phases.reactionProbabilities} result={phases.reaction}
        onSettled={() => setBeat('outcome')}
      />
    )
  }
  return <DiceRoll probabilities={probabilities} outcome={outcome} />
}
