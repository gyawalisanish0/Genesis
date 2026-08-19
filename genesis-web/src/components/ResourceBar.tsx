// Segmented HP / AP / XP bar. Fill is a fixed grid of discrete blocks (not a
// continuous width) so it ticks down visibly. shieldHp draws extra segments
// past the value's own fill. Driven by core engine output.

import {
  RESOURCE_BAR_SEGMENT_COUNT,
  RESOURCE_BAR_LOW_THRESHOLD,
  RESOURCE_BAR_CRITICAL_THRESHOLD,
} from '../core/constants'
import styles from './ResourceBar.module.css'

type BarVariant = 'hp' | 'ap' | 'xp'

interface Props {
  variant:    BarVariant
  value:      number
  max:        number
  shieldHp?:  number
  showLabel?: boolean
}

const SEGMENT_INDICES = Array.from({ length: RESOURCE_BAR_SEGMENT_COUNT }, (_, i) => i)

function hpToneClass(pct: number): string {
  if (pct < RESOURCE_BAR_CRITICAL_THRESHOLD) return styles.critical
  if (pct < RESOURCE_BAR_LOW_THRESHOLD) return styles.low
  return ''
}

function segmentClass(index: number, filled: number, shielded: number): string {
  if (index < filled) return styles.filled
  if (index < filled + shielded) return styles.shielded
  return styles.empty
}

export function ResourceBar({ variant, value, max, shieldHp = 0, showLabel = false }: Props) {
  const pct       = max > 0 ? Math.max(0, Math.min(1, value    / max)) : 0
  const shieldPct = max > 0 ? Math.max(0, Math.min(1, shieldHp / max)) : 0
  const label     = `${value}/${max}`

  const filledCount = Math.round(pct * RESOURCE_BAR_SEGMENT_COUNT)
  const shieldCount = Math.min(
    RESOURCE_BAR_SEGMENT_COUNT - filledCount,
    Math.round(shieldPct * RESOURCE_BAR_SEGMENT_COUNT)
  )
  const toneClass = variant === 'hp' ? hpToneClass(pct) : ''

  return (
    <div
      className={`${styles.track} ${styles[variant]} ${toneClass}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
    >
      {SEGMENT_INDICES.map(i => (
        <span key={i} className={segmentClass(i, filledCount, shieldCount)} />
      ))}
      {showLabel && <span className={styles.label}>{label}</span>}
    </div>
  )
}
