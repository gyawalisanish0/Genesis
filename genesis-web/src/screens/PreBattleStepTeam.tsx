// Step 2 — Team Compose
// Player picks up to 2 units for the battle team.

import { usePreBattleScreen } from './PreBattleContext'
import { UnitPortrait } from '../components/UnitPortrait'
import { PagedGrid } from '../components/PagedGrid'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { useRosterData } from '../hooks/useRosterData'
import { characterPortraitUrl } from '../services/DataService'
import styles from './PreBattleStepTeam.module.css'

const TEAM_MAX = 2

export function PreBattleStepTeam() {
  const { selectedTeam, toggleTeamMember } = usePreBattleScreen()
  const createScrollAwareHandler = useScrollAwarePointer()
  const { characters, isLoading, error } = useRosterData()
  const teamFull = selectedTeam.length >= TEAM_MAX

  return (
    <div className={styles.root}>
      <h2 className={styles.sectionTitle}>SELECT YOUR TEAM ({TEAM_MAX} max)</h2>

      {/* Selected team slots */}
      <div className={styles.slots}>
        {Array.from({ length: TEAM_MAX }).map((_, i) => {
          const unit = selectedTeam[i]
          return (
            <div key={i} className={`${styles.slot} ${!unit ? styles.slotEmpty : ''}`}>
              {unit ? (
                <>
                  <UnitPortrait name={unit.name} rarity={unit.rarity} size="md" imageUrl={characterPortraitUrl(unit.id)} />
                  <span className={styles.slotName}>{unit.name}</span>
                  <button className={styles.removeBtn} onPointerDown={createScrollAwareHandler({ onTap: () => toggleTeamMember(unit) })} aria-label="Remove">✕</button>
                </>
              ) : (
                <span className={styles.addIcon}>+</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Character grid — 5×4 paged */}
      <div className={styles.gridWrapper}>
        {isLoading && <p className={styles.statusMsg}>Loading…</p>}
        {error     && <p className={styles.statusMsg}>{error}</p>}
        {!isLoading && !error && (
          <PagedGrid
            items={characters}
            cols={5}
            rows={4}
            emptyText="No characters available"
            renderItem={(char) => {
              const selected = selectedTeam.some((c) => c.id === char.id)
              const dimmed   = teamFull && !selected
              return (
                <button
                  key={char.id}
                  className={`${styles.card} ${selected ? styles.cardSelected : ''} ${dimmed ? styles.cardDimmed : ''}`}
                  onPointerDown={createScrollAwareHandler({ onTap: () => toggleTeamMember({
                    id:        char.id,
                    name:      char.name,
                    className: char.className,
                    rarity:    char.rarity,
                    maxHp:     char.maxHp,
                    hp:        char.maxHp,
                  }) })}
                >
                  <UnitPortrait name={char.name} rarity={char.rarity} size="sm" imageUrl={characterPortraitUrl(char.id)} />
                  <span className={styles.cardName}>{char.name}</span>
                  {selected && <span className={styles.checkmark}>✓</span>}
                </button>
              )
            }}
          />
        )}
      </div>
    </div>
  )
}
