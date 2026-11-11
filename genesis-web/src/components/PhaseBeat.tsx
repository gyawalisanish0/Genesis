// PhaseBeat — one resolution phase's reveal: label, band, needle sweep, settle.
//
// Mirrors DiceRoll's own sweep-then-settle shape at a smaller scale. This is
// the build, not the payoff — CONCEPT.md § Skill Resolution splits the roll
// into the actor's strike and the target's reaction, and a beat per phase is
// what makes the reaction read as the target doing something, rather than as
// an invisible step inside one combined number.

import { useEffect, useRef, useState } from 'react'
import { PHASE_SWEEP_MS, PHASE_GAP_MS } from '../core/constants'
import { SoundService } from '../services/SoundService'
import { PhaseBand } from './PhaseBand'
import styles from './PhaseBeat.module.css'

interface Props<K extends string> {
  label:         string
  order:         readonly K[]
  probabilities: Readonly<Record<K, number>>
  result:        K
  tone:          'strike' | 'reaction'
  /** Fires once the settled zone has held long enough to read. */
  onSettled:     () => void
}

/** Centre of the result's zone, as a percentage across the band. */
function needleTarget<K extends string>(
  order: readonly K[], probabilities: Readonly<Record<K, number>>, result: K,
): number {
  let before = 0
  for (const key of order) {
    const width = Math.max(0, probabilities[key]) * 100
    if (key === result) return before + width / 2
    before += width
  }
  return 50
}

export function PhaseBeat<K extends string>({
  label, order, probabilities, result, tone, onSettled,
}: Props<K>) {
  const [settled, setSettled] = useState(false)
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSettled(false)
    SoundService.playSfx('roll_tick')
    const sweepId = setTimeout(() => {
      setSettled(true)
      holdRef.current = setTimeout(onSettled, PHASE_GAP_MS)
    }, PHASE_SWEEP_MS)
    return () => {
      clearTimeout(sweepId)
      if (holdRef.current) clearTimeout(holdRef.current)
    }
    // onSettled is intentionally excluded — a new identity must not restart the beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, probabilities, result])

  return (
    <div className={styles.beat} role="status" aria-label={`${label}: ${result}`}>
      <span className={`${styles.label} ${styles[tone]}`}>{label}</span>
      <div className={styles.bandWrap}>
        <PhaseBand order={order} probabilities={probabilities} landedOn={settled ? result : null} tone={tone} />
        <span
          className={`${styles.needle} ${settled ? styles.needleSettled : styles.needleSweeping}`}
          style={settled ? { left: `${needleTarget(order, probabilities, result)}%` } : undefined}
        />
      </div>
      <span className={`${styles.result} ${styles[tone]} ${settled ? styles.resultIn : ''}`}>
        {result.toUpperCase()}
      </span>
    </div>
  )
}
