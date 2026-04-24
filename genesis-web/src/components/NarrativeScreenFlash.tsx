// Full-screen colour burst — plays once and removes itself.
// Used for impact moments: death (red), victory (green), clash win (blue).

import { useEffect, useRef } from 'react'
import { NARRATIVE_FLASH_MS } from '../core/constants'
import styles from './NarrativeScreenFlash.module.css'

interface Props {
  colour:   string
  duration?: number
  onDone:   () => void
}

export function NarrativeScreenFlash({ colour, duration = NARRATIVE_FLASH_MS, onDone }: Props) {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ref.current = setTimeout(onDone, duration)
    return () => { if (ref.current) clearTimeout(ref.current) }
  }, [duration, onDone])

  return (
    <div
      className={styles.flash}
      style={{ '--flash-colour': colour, '--flash-duration': `${duration}ms` } as React.CSSProperties}
      aria-hidden
    />
  )
}
