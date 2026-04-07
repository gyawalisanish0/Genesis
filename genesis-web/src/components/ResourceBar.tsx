// Animated HP / AP / XP bar. Width tweens on value change.

import styles from './ResourceBar.module.css'

type BarVariant = 'hp' | 'ap' | 'xp'

interface Props {
  variant: BarVariant
  value: number
  max: number
  showLabel?: boolean
}

export function ResourceBar({ variant, value, max, showLabel = false }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const label = `${value}/${max}`

  return (
    <div className={`${styles.track} ${styles[variant]}`} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={styles.fill} style={{ width: `${pct * 100}%` }} />
      {showLabel && <span className={styles.label}>{label}</span>}
    </div>
  )
}
