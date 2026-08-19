// Toaster — the one transient notification chip. Non-blocking by definition;
// a message that blocks composes PromptOverlay instead (see BattleErrorToast).
// Spec: docs/ui/01-components.md § Toaster.

import { useEffect, useRef, useState } from 'react'
import { HINT_TOASTER_DURATION_MS, HINT_STORAGE_PREFIX } from '../core/constants'
import styles from './Toaster.module.css'

export type ToastTone = 'hint' | 'warn' | 'error'

const GLYPH: Record<ToastTone, string> = { hint: '💡', warn: '⚠', error: '✖' }

interface Props {
  message:      string | null
  tone?:        ToastTone
  position?:    'top' | 'bottom' | 'inline'
  /** localStorage key — when set, the message is shown at most once per device. */
  onceId?:      string
  durationMs?:  number
  dismissible?: boolean
  /** Fired on tap and on auto-expiry, so callers can clear their own state. */
  onDismiss?:   () => void
}

/** localStorage can throw in private modes; treat failure as "not yet shown". */
function alreadyShown(id: string): boolean {
  try { return localStorage.getItem(`${HINT_STORAGE_PREFIX}${id}`) === '1' } catch { return false }
}
function markShown(id: string): void {
  try { localStorage.setItem(`${HINT_STORAGE_PREFIX}${id}`, '1') } catch { /* reappears next session */ }
}

export function Toaster({
  message,
  tone = 'hint',
  position = 'top',
  onceId,
  durationMs = HINT_TOASTER_DURATION_MS,
  dismissible = true,
  onDismiss,
}: Props) {
  const [visible, setVisible] = useState(false)
  // Kept in a ref so the auto-dismiss effect never re-runs on an inline arrow.
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!message) { setVisible(false); return }
    if (onceId) {
      if (alreadyShown(onceId)) { setVisible(false); return }
      markShown(onceId)
    }
    setVisible(true)
    const t = setTimeout(() => { setVisible(false); onDismissRef.current?.() }, durationMs)
    return () => clearTimeout(t)
  }, [message, onceId, durationMs])

  if (!visible || !message) return null

  const dismiss = () => { setVisible(false); onDismiss?.() }

  return (
    <div
      className={[
        styles.toaster, styles[tone], styles[position],
        dismissible ? styles.tappable : styles.inert,
      ].join(' ')}
      role="status"
      onPointerDown={dismissible ? dismiss : undefined}
      aria-label={dismissible ? 'Dismiss notification' : undefined}
    >
      {position !== 'inline' && <span className={styles.glyph}>{GLYPH[tone]}</span>}
      <span>{message}</span>
    </div>
  )
}
