// TickToken — one unit's marker on the tick stream.
//
// Carries three things the old marker did not: who the unit is (tinted by
// rarity, so three allies are no longer three identical rings), how hurt it is
// (the arc), and what it is about to spend (the TU badge, shown only while that
// unit's action is telegraphed). Spec: docs/ui/01-components.md § TimelineStrip.

import { TICK_TOKEN_DP } from '../core/constants'
import styles from './TickToken.module.css'

const RARITY_VARS: Record<number, string> = {
  1: 'var(--rarity-1)', 2: 'var(--rarity-2)', 3: 'var(--rarity-3)',
  4: 'var(--rarity-4)', 5: 'var(--rarity-5)', 6: 'var(--rarity-6)',
  7: 'var(--rarity-4)',
}

interface Props {
  name:       string
  rarity:     number
  isAlly:     boolean
  /** 0–1; drives the arc length. */
  hpFraction: number
  /** Ticks this unit is about to spend, when its action is telegraphed. */
  tuIntent?:  number | null
  ghost?:     boolean
}

export function TickToken({ name, rarity, isAlly, hpFraction, tuIntent = null, ghost = false }: Props) {
  const r      = TICK_TOKEN_DP / 2
  const radius = r - 2
  const circ   = 2 * Math.PI * radius
  // Faction decides the arc (ally vs enemy is the read that matters most);
  // rarity tints the body so individual allies stay tellable apart.
  const arc  = isAlly ? 'var(--accent-info)' : 'var(--accent-danger)'
  const body = ghost ? 'var(--bg-card)' : (RARITY_VARS[rarity] ?? 'var(--rarity-1)')

  return (
    <span className={`${styles.token} ${ghost ? styles.ghost : ''}`} aria-label={name}>
      <svg width={TICK_TOKEN_DP} height={TICK_TOKEN_DP} viewBox={`0 0 ${TICK_TOKEN_DP} ${TICK_TOKEN_DP}`} aria-hidden>
        <circle cx={r} cy={r} r={radius - 2} fill={body} opacity={ghost ? 1 : 0.85} />
        <circle cx={r} cy={r} r={radius} fill="none" stroke="var(--bg-elevated)" strokeWidth="2" />
        <circle
          cx={r} cy={r} r={radius} fill="none"
          stroke={arc} strokeWidth="2"
          strokeDasharray={`${hpFraction * circ} ${circ}`}
          transform={`rotate(-90 ${r} ${r})`}
        />
      </svg>
      {tuIntent !== null && <span className={styles.intent}>{tuIntent}</span>}
    </span>
  )
}
