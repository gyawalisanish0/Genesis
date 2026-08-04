// StatusInfoOverlay — tap a status chip to open a modal showing its description.
// Same UX pattern as SkillInfoOverlay: backdrop tap or ✕ to close.

import { useEffect } from 'react'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import type { StatusChipData } from '../components/StatusChipBar'
import styles from './StatusInfoOverlay.module.css'

interface Props {
  chip:    StatusChipData
  stacks?: number
  onClose: () => void
}

export function StatusInfoOverlay({ chip, stacks, onClose }: Props) {
  const createHandler = useScrollAwarePointer()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const monogram  = chip.label.slice(0, 3).toUpperCase()

  return (
    <div
      className={styles.backdrop}
      onPointerDown={createHandler({ onTap: onClose })}
    >
      <div
        className={styles.card}
        style={{ '--chip-colour': chip.colour } as React.CSSProperties}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          className={styles.closeBtn}
          onPointerDown={createHandler({ onTap: onClose })}
          aria-label="Close status info"
        >
          ✕
        </button>

        <header className={styles.header}>
          <div
            className={styles.iconSquare}
            style={{ '--chip-colour': chip.colour } as React.CSSProperties}
          >
            {chip.iconUrl
              ? (
                <img
                  src={chip.iconUrl}
                  alt=""
                  className={styles.iconImg}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                />
              )
              : <span className={styles.iconMonogram}>{monogram}</span>
            }
          </div>
          <div className={styles.titleBlock}>
            <span className={styles.name}>{chip.label}</span>
            {stacks !== undefined && stacks > 1 && (
              <span className={styles.stacks}>{stacks} stacks</span>
            )}
          </div>
        </header>

        {chip.description && (
          <p className={styles.description}>{chip.description}</p>
        )}
      </div>
    </div>
  )
}
