// Sheet — the one backdrop + dismissible panel in the system.
// Replaces four bespoke overlay implementations. Spec + back-button contract:
// docs/ui/01-components.md § Sheet.

import type { ReactNode, CSSProperties } from 'react'
import { useEffect } from 'react'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { panelClass } from './Panel'
import styles from './Sheet.module.css'

interface Props {
  open?:        boolean
  title?:       string
  onClose?:     () => void
  dismissible?: boolean
  placement?:   'bottom' | 'centre'
  /** Border-colour override (dynamic → inline). Status chip colour, chest gold. */
  accent?:      string
  className?:   string
  children:     ReactNode
}

export function Sheet({
  open = true,
  title,
  onClose,
  dismissible = true,
  placement = 'bottom',
  accent,
  className,
  children,
}: Props) {
  const createHandler = useScrollAwarePointer()
  const close = dismissible ? onClose : undefined

  // Esc closes on desktop; mobile uses backdrop-tap / ✕. Screens own hardware back.
  useEffect(() => {
    if (!open || !close) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  const panelStyle = accent ? ({ '--panel-outer': accent } as CSSProperties) : undefined
  const closeBtn = close && (
    <button className={styles.closeBtn} onPointerDown={createHandler({ onTap: close })} aria-label="Close">
      ✕
    </button>
  )

  return (
    <div
      className={`${styles.backdrop} ${styles[placement]}`}
      onPointerDown={close ? createHandler({ onTap: close }) : undefined}
    >
      <div
        className={`${panelClass('default')} ${styles.panel} ${placement === 'bottom' ? styles.panelBottom : styles.panelCentre} ${className ?? ''}`}
        style={panelStyle}
        onPointerDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title
          ? <div className={styles.header}><span className={styles.title}>{title}</span>{closeBtn}</div>
          : close && <div className={styles.closeFloat}>{closeBtn}</div>}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  )
}
