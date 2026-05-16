import React from 'react'
import styles from './StatusChipBar.module.css'

export interface StatusChipData {
  slotId:          string
  label:           string
  colour:          string
  durationDisplay: 'ticks' | 'turns' | 'fade' | 'none'
  duration:        number
}

interface Props {
  chips: StatusChipData[]
  size:  'full' | 'compact'
}

function durationLabel(chip: StatusChipData): string | null {
  if (chip.durationDisplay === 'ticks')  return `${chip.duration}t`
  if (chip.durationDisplay === 'turns')  return `${chip.duration}`
  return null
}

export function StatusChipBar({ chips, size }: Props) {
  if (!chips.length) return null

  return (
    <div className={`${styles.bar} ${size === 'compact' ? styles.barCompact : ''}`}>
      {chips.map((chip) => {
        const label    = durationLabel(chip)
        const isFading = chip.durationDisplay === 'fade'

        return (
          <div
            key={chip.slotId}
            className={`${styles.chip} ${isFading ? styles.chipFade : ''}`}
            style={{ '--chip-colour': chip.colour } as React.CSSProperties}
          >
            <div className={styles.chipAccent} />
            {/* Icon slot — reserved for future logo system */}
            <div className={styles.chipIcon} />
            {size === 'full' && (
              <span className={styles.chipLabel}>{chip.label}</span>
            )}
            {label && (
              <span className={styles.chipDuration}>{label}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
