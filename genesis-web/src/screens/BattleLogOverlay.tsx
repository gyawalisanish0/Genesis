// BattleLogOverlay — the full battle log history. Chrome (backdrop, header,
// dismissal, animation) is the shared Sheet; this file owns the scrolling list.
// Battle back-button closes it via BattleScreen's central handler.

import { useEffect, useRef } from 'react'
import { useBattleScreen } from './BattleContext'
import { Sheet } from '../components/Sheet'
import styles from './BattleLogOverlay.module.css'

interface Props {
  onClose: () => void
}

export function BattleLogOverlay({ onClose }: Props) {
  const { log } = useBattleScreen()
  const listRef = useRef<HTMLDivElement>(null)

  // Scroll to the latest entry whenever the overlay opens or new entries arrive.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [log])

  return (
    <Sheet title="BATTLE LOG" onClose={onClose}>
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
    </Sheet>
  )
}
