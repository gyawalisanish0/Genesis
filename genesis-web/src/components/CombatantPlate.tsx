// CombatantPlate — the floating name/HP box beside a combatant, GBA-style.
// Composes Panel + ResourceBar + StatusChipBar; owns no chrome of its own.
// Spec: docs/ui/01-components.md § CombatantPlate.

import type { TurnDisplayUnitData } from '../core/battle/EngineTypes'
import type { StatusChipData } from './StatusChipBar'
import { panelClass } from './Panel'
import { ResourceBar } from './ResourceBar'
import { StatusChipBar } from './StatusChipBar'
import styles from './CombatantPlate.module.css'

interface Props {
  info:      TurnDisplayUnitData
  side:      'ally' | 'enemy'
  chips?:    StatusChipData[]
  onChipTap?: (chip: StatusChipData) => void
}

export function CombatantPlate({ info, side, chips = [], onChipTap }: Props) {
  return (
    <div className={`${panelClass('default')} ${styles.plate} ${styles[side]}`}>
      <div className={styles.head}>
        <span className={styles.name}>{info.name}</span>
        <span className={styles.hp}>{info.hp}/{info.maxHp}</span>
      </div>
      <ResourceBar variant="hp" value={info.hp} max={info.maxHp} shieldHp={info.shieldHp} />
      {/* AP is the player's tempo resource — shown only where it is actionable. */}
      {side === 'ally' && <ResourceBar variant="ap" value={info.ap} max={info.maxAp} />}
      {chips.length > 0 && (
        <StatusChipBar chips={chips} size="compact" onTap={onChipTap} />
      )}
    </div>
  )
}
