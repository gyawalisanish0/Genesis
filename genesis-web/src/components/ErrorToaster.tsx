// ErrorToaster — transient error notification chip.
//
// Unlike HintToaster this has no localStorage backing — it shows every time
// a non-null message is passed. A new message re-starts the auto-dismiss timer.
// Shares HintToaster.module.css for visual consistency; uses the .toasterError
// variant for the amber warning border.

import { useEffect, useState } from 'react'
import { HINT_TOASTER_DURATION_MS } from '../core/constants'
import styles from './HintToaster.module.css'

interface Props {
  message:   string | null   // null = hidden; any string = show and start timer
  position?: 'top' | 'bottom'
}

export function ErrorToaster({ message, position = 'top' }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) { setVisible(false); return }
    setVisible(true)
    const t = setTimeout(() => setVisible(false), HINT_TOASTER_DURATION_MS)
    return () => clearTimeout(t)
  }, [message])

  if (!visible || !message) return null

  const posClass = position === 'bottom' ? styles.toasterBottom : styles.toasterTop

  return (
    <button
      className={`${styles.toaster} ${styles.toasterError} ${posClass}`}
      onPointerDown={() => setVisible(false)}
      aria-label="Dismiss error"
    >
      <span className={styles.bulb}>⚠</span>
      <span className={styles.message}>{message}</span>
    </button>
  )
}
