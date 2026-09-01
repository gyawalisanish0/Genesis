// PhaseBand — the odds strip for one resolution phase (Strike or Reaction).
//
// Same shape as OutcomeBand — zones sized to probability, best to worst, left
// to right — but over a 3-band phase table rather than the 4 final outcomes,
// and toned by phase rather than by outcome. A phase band isn't itself good or
// bad the way a final outcome is (a Loose strike still lands as a Graze), so
// it gets one colour per phase instead of one per zone.

import styles from './PhaseBand.module.css'

interface Props<K extends string> {
  order:         readonly K[]
  probabilities: Readonly<Record<K, number>>
  landedOn:      K | null
  tone:          'strike' | 'reaction'
}

export function PhaseBand<K extends string>({ order, probabilities, landedOn, tone }: Props<K>) {
  return (
    <div className={`${styles.band} ${styles[tone]}`}>
      {order.map((key) => {
        const pct = Math.max(0, probabilities[key]) * 100
        if (pct <= 0) return null
        const dimmed = landedOn !== null && landedOn !== key
        return (
          <span
            key={key}
            className={`${styles.zone} ${dimmed ? styles.dimmed : ''}`}
            style={{ width: `${pct}%` }}
          />
        )
      })}
    </div>
  )
}
