// OutcomeBand — the four-outcome probability table drawn as a bar.
//
// The same strip appears in two places: at rest on a skill card, and under the
// needle during a roll. That is deliberate — the shape a player reads while
// choosing is the shape the needle lands on, so the odds are learned by playing
// rather than explained. Spec: docs/ui/01-components.md § OutcomeBand.

import type { DiceProbabilities } from '../core/combat/HitChanceEvaluator'
import styles from './OutcomeBand.module.css'

/** Draw order is best → worst, so the bar always reads left-to-right as odds decay. */
export const OUTCOME_ORDER = ['Boosted', 'Hit', 'Evade', 'Graze'] as const
export type OutcomeKey = typeof OUTCOME_ORDER[number]

/** Below this share of the band a zone is too narrow for its label to fit. */
const LABEL_MIN_PCT = 16

interface Props {
  probabilities: DiceProbabilities
  /** 'card' is the compact resting strip; 'roll' is the tall labelled band. */
  size?:   'card' | 'roll'
  /** Dims every zone except this one — used when the roll settles. */
  landedOn?: OutcomeKey | null
}

export function OutcomeBand({ probabilities, size = 'card', landedOn = null }: Props) {
  return (
    <div className={`${styles.band} ${styles[size]}`} aria-hidden={size === 'card'}>
      {OUTCOME_ORDER.map((key) => {
        const pct = Math.max(0, probabilities[key]) * 100
        if (pct <= 0) return null
        const dimmed = landedOn !== null && landedOn !== key
        return (
          <span
            key={key}
            className={`${styles.zone} ${styles[key.toLowerCase()]} ${dimmed ? styles.dimmed : ''}`}
            style={{ width: `${pct}%` }}
          >
            {size === 'roll' && (
              // A narrow zone keeps its percentage but drops the name, which
              // would otherwise clip mid-word — Boosted is only 10% at baseline.
              <>
                {pct >= LABEL_MIN_PCT && <span className={styles.zoneLabel}>{key.toUpperCase()}</span>}
                <span className={styles.zonePct}>{Math.round(pct)}%</span>
              </>
            )}
          </span>
        )
      })}
    </div>
  )
}
