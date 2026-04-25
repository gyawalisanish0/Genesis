// Character portrait slides in from the left or right edge.
// Auto-removes after the fly-in duration.

import { useEffect, useRef } from 'react'
import { UnitPortrait } from './UnitPortrait'
import { NARRATIVE_FLY_MS } from '../core/constants'
import type { Unit } from '../core/types'
import styles from './NarrativePortraitFlyIn.module.css'

interface Props {
  speakerId: string
  side?:     'left' | 'right'
  duration?: number
  units:     Unit[]
  onDone:    () => void
}

export function NarrativePortraitFlyIn({ speakerId, side = 'left', duration = NARRATIVE_FLY_MS, units, onDone }: Props) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ref.current = setTimeout(onDone, duration + 400)
    return () => { if (ref.current) clearTimeout(ref.current) }
  }, [duration, onDone])

  const speaker = units.find((u) => u.defId === speakerId)
  if (!speaker) return null

  return (
    <div
      className={`${styles.container} ${side === 'right' ? styles.right : styles.left}`}
      style={{ '--fly-duration': `${duration}ms` } as React.CSSProperties}
      aria-hidden
    >
      <UnitPortrait name={speaker.name} rarity={speaker.rarity} size="xl" />
    </div>
  )
}
