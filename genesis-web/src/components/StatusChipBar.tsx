import React from 'react'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import styles from './StatusChipBar.module.css'

export interface StatusChipData {
  slotId:          string
  label:           string
  colour:          string
  durationDisplay: 'ticks' | 'turns' | 'fade' | 'none'
  duration:        number
  iconUrl?:        string
  description?:    string
  portraitGlow?:   boolean
}

interface Props {
  chips:  StatusChipData[]
  size:   'full' | 'compact'
  onTap?: (chip: StatusChipData) => void
}

function durationBadge(chip: StatusChipData): string | null {
  if (chip.durationDisplay === 'ticks') return `${chip.duration}t`
  if (chip.durationDisplay === 'turns') return `${chip.duration}`
  return null
}

export function StatusChipBar({ chips, size, onTap }: Props) {
  const createHandler = useScrollAwarePointer()
  if (!chips.length) return null

  return (
    <div className={`${styles.bar} ${size === 'compact' ? styles.barCompact : ''}`}>
      {chips.map((chip) => (
        <ChipSquare
          key={chip.slotId}
          chip={chip}
          size={size}
          badge={durationBadge(chip)}
          onTap={onTap}
          createHandler={createHandler}
        />
      ))}
    </div>
  )
}

function ChipSquare({
  chip, size, badge, onTap, createHandler,
}: {
  chip:          StatusChipData
  size:          'full' | 'compact'
  badge:         string | null
  onTap?:        (chip: StatusChipData) => void
  createHandler: ReturnType<typeof useScrollAwarePointer>
}) {
  const isFading  = chip.durationDisplay === 'fade'
  const monogram  = chip.label.slice(0, 3).toUpperCase()
  const handleTap = onTap ? () => onTap(chip) : undefined

  return (
    <div
      className={[
        styles.chip,
        size === 'compact' ? styles.chipCompact : '',
        isFading           ? styles.chipFade    : '',
        onTap              ? styles.chipTappable : '',
      ].join(' ')}
      style={{ '--chip-colour': chip.colour } as React.CSSProperties}
      onPointerDown={handleTap ? createHandler({ onTap: handleTap }) : undefined}
      role={onTap ? 'button' : undefined}
      aria-label={onTap ? `${chip.label} — tap for details` : undefined}
    >
      {/* Inset glow ring driven by --chip-colour */}
      <div className={styles.chipGlow} />

      {size === 'full' && (
        <div className={styles.artArea}>
          {chip.iconUrl
            ? (
              <img
                src={chip.iconUrl}
                alt=""
                className={styles.artImg}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )
            : <span className={styles.artMonogram}>{monogram}</span>
          }
        </div>
      )}

      {size === 'compact' && <div className={styles.compactDot} />}

      {badge && <span className={styles.badge}>{badge}</span>}
    </div>
  )
}
