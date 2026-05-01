// HintToaster — one-shot contextual hint for new players. Mounts inside any
// screen; renders nothing if the hint has already been shown.
//
// Persistence: hint shown-state is keyed in localStorage by `id` so each hint
// appears at most once per browser/install. Tap or auto-timeout dismisses it.

import { useEffect, useState } from 'react'
import { HINT_TOASTER_DURATION_MS, HINT_STORAGE_PREFIX } from '../core/constants'
import styles from './HintToaster.module.css'

interface Props {
  id:       string   // unique key — used as the localStorage primary key
  message:  string   // hint copy (kept short, fits two lines max)
  position?: 'top' | 'bottom'  // default 'top'
}

function isHintAlreadyShown(id: string): boolean {
  try {
    return localStorage.getItem(`${HINT_STORAGE_PREFIX}${id}`) === '1'
  } catch {
    // localStorage may throw in private modes — fall back to "always show".
    return false
  }
}

function markHintShown(id: string): void {
  try {
    localStorage.setItem(`${HINT_STORAGE_PREFIX}${id}`, '1')
  } catch {
    // Safe to ignore — worst case the hint reappears next session.
  }
}

export function HintToaster({ id, message, position = 'top' }: Props) {
  // null = not yet decided (first render). Avoids a flash of the toast before
  // the localStorage check runs.
  const [visible, setVisible] = useState<boolean | null>(null)

  useEffect(() => {
    if (isHintAlreadyShown(id)) {
      setVisible(false)
      return
    }
    markHintShown(id)
    setVisible(true)
    const t = setTimeout(() => setVisible(false), HINT_TOASTER_DURATION_MS)
    return () => clearTimeout(t)
  }, [id])

  if (!visible) return null

  return (
    <button
      className={`${styles.toaster} ${position === 'bottom' ? styles.toasterBottom : styles.toasterTop}`}
      onPointerDown={() => setVisible(false)}
      aria-label="Dismiss hint"
    >
      <span className={styles.bulb}>💡</span>
      <span className={styles.message}>{message}</span>
    </button>
  )
}
