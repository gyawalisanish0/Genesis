// Animated HP / AP / XP bar. Width tweens on value change.
// shieldHp: when > 0, a semi-transparent white overlay shows the shielded portion
// of the bar. Width = shieldHp / max, clamped 0..1. Driven by core engine output.

import styles from './ResourceBar.module.css'

type BarVariant = 'hp' | 'ap' | 'xp'

interface Props {
  variant:    BarVariant
  value:      number
  max:        number
  shieldHp?:  number
  showLabel?: boolean
}

export function ResourceBar({ variant, value, max, shieldHp = 0, showLabel = false }: Props) {
  const pct       = max > 0 ? Math.max(0, Math.min(1, value   / max)) : 0
  const shieldPct = max > 0 ? Math.max(0, Math.min(1, shieldHp / max)) : 0
  const label     = `${value}/${max}`

  return (
    <div className={`${styles.track} ${styles[variant]}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={styles.fill} style={{ width: `${pct * 100}%` }} />
      {shieldPct > 0 && (
        <div className={styles.shieldOverlay} style={{ width: `${shieldPct * 100}%` }} />
      )}
      {showLabel && <span className={styles.label}>{label}</span>}
    </div>
  )
}

