// BattleLogOverlay — slide-up panel showing the full battle log history.
// Opened by the BATTLE LOG button below the arena canvas.
// Closed by: X button, tap on the semi-transparent backdrop, or back button.

import { useEffect, useRef } from 'react'
import { useBattleScreen } from './BattleContext'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import styles from './BattleLogOverlay.module.css'

interface Props {
  onClose: () => void
}

export function BattleLogOverlay({ onClose }: Props) {
  const { log } = useBattleScreen()
  const listRef = useRef<HTMLDivElement>(null)
  const createHandler = useScrollAwarePointer()

  // Scroll to the latest entry whenever the overlay opens or new entries arrive.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  return (
    <div
      className={styles.backdrop}
      onPointerDown={createHandler({ onTap: onClose })}
    >
      <div
        className={styles.panel}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.title}>BATTLE LOG</span>
          <button
            className={styles.closeBtn}
            onPointerDown={createHandler({ onTap: onClose })}
          >
            ✕
          </button>
        </div>
        <div className={styles.list} ref={listRef}>
          {log.map((entry) => (
            <div
              key={entry.id}
              className={styles.entry}
              style={{ color: entry.colour ?? 'var(--text-muted)' }}
            >
              {entry.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
