// Step 3 — Genesis Items
// Player optionally equips items to each team member. Items are optional.

import { usePreBattleScreen } from './PreBattleContext'
import { UnitPortrait } from '../components/UnitPortrait'
import styles from './PreBattleStepItems.module.css'

export function PreBattleStepItems() {
  const { selectedTeam } = usePreBattleScreen()

  if (selectedTeam.length === 0) {
    return (
      <div className={styles.root}>
        <p className={styles.empty}>No units selected — go back to Step 2.</p>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <h2 className={styles.sectionTitle}>EQUIP GENESIS ITEMS</h2>
      <p className={styles.subtitle}>Items persist across all battles. All slots are optional.</p>

      <div className={styles.unitList}>
        {selectedTeam.map((unit) => (
          <div key={unit.id} className={styles.unitRow}>
            <UnitPortrait name={unit.name} rarity={unit.rarity} size="sm" />
            <div className={styles.unitInfo}>
              <span className={styles.unitName}>{unit.name}</span>
              <div className={styles.slotRow}>
                <button className={styles.itemSlot}>— Empty —</button>
                <button className={styles.itemSlot}>— Empty —</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className={styles.note}>Item system coming in a future update.</p>
    </div>
  )
}
