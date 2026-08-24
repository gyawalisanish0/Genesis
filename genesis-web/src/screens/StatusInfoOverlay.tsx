// StatusInfoOverlay — tap a status chip to see its description.
// Chrome (backdrop, dismissal, animation) is the shared Sheet; this file owns
// only the status-specific content.

import type { StatusChipData } from '../components/StatusChipBar'
import { Sheet } from '../components/Sheet'
import styles from './StatusInfoOverlay.module.css'

interface Props {
  chip:    StatusChipData
  stacks?: number
  onClose: () => void
}

export function StatusInfoOverlay({ chip, stacks, onClose }: Props) {
  const monogram = chip.label.slice(0, 3).toUpperCase()

  return (
    <Sheet placement="centre" onClose={onClose} accent={chip.colour}>
      <div className={styles.body}>
        <header className={styles.header}>
          <div className={styles.iconSquare} style={{ '--chip-colour': chip.colour } as React.CSSProperties}>
            {chip.iconUrl
              ? <img src={chip.iconUrl} alt="" className={styles.iconImg}
                     onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
              : <span className={styles.iconMonogram}>{monogram}</span>}
          </div>
          <div className={styles.titleBlock}>
            <span className={styles.name}>{chip.label}</span>
            {stacks !== undefined && stacks > 1 && (
              <span className={styles.stacks}>{stacks} stacks</span>
            )}
          </div>
        </header>

        {chip.description && <p className={styles.description}>{chip.description}</p>}
      </div>
    </Sheet>
  )
}
