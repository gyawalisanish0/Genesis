// DiceRoll — the roll, shown against this caster's real odds.
//
// A needle sweeps the OutcomeBand and settles inside the zone the engine
// already rolled. The engine decides the outcome; this only reveals it. The
// needle is therefore driven to a known destination, never to a random one —
// showing a result the engine did not produce would be a lie.

import { useEffect, useState } from 'react'
import type { DiceProbabilities } from '../core/combat/HitChanceEvaluator'
import { DICE_SWEEP_MS, DICE_SETTLE_MS } from '../core/constants'
import { SoundService } from '../services/SoundService'
import { OutcomeBand, OUTCOME_ORDER } from './OutcomeBand'
import type { OutcomeKey } from './OutcomeBand'
import styles from './DiceRoll.module.css'

/** Sting played the moment the needle locks on, one per outcome. */
const OUTCOME_SFX: Record<OutcomeKey, string> = {
  Boosted: 'dice_boosted',
  Hit:     'dice_hit',
  Evade:   'dice_evade',
  Graze:   'dice_fail',
}

interface Props {
  probabilities: DiceProbabilities
  outcome:       OutcomeKey
  /** Set once the reveal has finished, so callers can advance. */
  onSettled?:    () => void
}

/** Centre of the outcome's zone, as a percentage across the band. */
function needleTarget(probabilities: DiceProbabilities, outcome: OutcomeKey): number {
  let before = 0
  for (const key of OUTCOME_ORDER) {
    const width = Math.max(0, probabilities[key]) * 100
    if (key === outcome) return before + width / 2
    before += width
  }
  return 50
}

export function DiceRoll({ probabilities, outcome, onSettled }: Props) {
  const [phase, setPhase] = useState<'sweep' | 'settled'>('sweep')

  useEffect(() => {
    setPhase('sweep')
    SoundService.playSfx('roll_tick')
    const id = setTimeout(() => {
      setPhase('settled')
      SoundService.playSfx(OUTCOME_SFX[outcome])
      onSettled?.()
    }, DICE_SWEEP_MS)
    return () => clearTimeout(id)
    // onSettled is intentionally excluded — a new identity must not restart the roll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probabilities, outcome])

  const settled = phase === 'settled'

  return (
    <div className={styles.roll} role="status" aria-label={`Roll: ${outcome}`}>
      <div className={styles.bandWrap}>
        <OutcomeBand probabilities={probabilities} size="roll" landedOn={settled ? outcome : null} />
        <span
          className={`${styles.needle} ${settled ? styles.needleSettled : styles.needleSweeping}`}
          style={settled ? { left: `${needleTarget(probabilities, outcome)}%` } : undefined}
        />
      </div>
      <span className={`${styles.result} ${styles[outcome.toLowerCase()]} ${settled ? styles.resultIn : ''}`}>
        {outcome.toUpperCase()}
      </span>
    </div>
  )
}

export { DICE_SETTLE_MS }
