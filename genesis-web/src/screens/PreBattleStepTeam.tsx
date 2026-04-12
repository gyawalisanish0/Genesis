// Step 2 — Team Compose
// Player picks up to 2 units for the battle team.

import { useRef } from 'react'
import { usePreBattleScreen } from './PreBattleContext'
import { UnitPortrait } from '../components/UnitPortrait'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import styles from './PreBattleStepTeam.module.css'

// TODO: replace with DataService.getCharacters() when implemented.
const ROSTER = [
  { id: 'warrior_001', name: 'Iron Warden',   className: 'Warrior',   rarity: 3, maxHp: 1200, hp: 980 },
  { id: 'hunter_001',  name: 'Swift Veil',    className: 'Hunter',    rarity: 2, maxHp: 800,  hp: 800 },
  { id: 'caster_001',  name: 'Ember Sage',    className: 'Caster',    rarity: 4, maxHp: 600,  hp: 420 },
  { id: 'ranger_001',  name: 'Dusk Arrow',    className: 'Ranger',    rarity: 2, maxHp: 900,  hp: 900 },
  { id: 'guardian_001',name: 'Stone Bastion', className: 'Guardian',  rarity: 5, maxHp: 1600, hp: 1600 },
  { id: 'enchanter_001',name:'Dream Weave',   className: 'Enchanter', rarity: 3, maxHp: 700,  hp: 550 },
]

const TEAM_MAX = 2

export function PreBattleStepTeam() {
  const { selectedTeam, toggleTeamMember } = usePreBattleScreen()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const createScrollAwareHandler = useScrollAwarePointer(scrollContainerRef)
  const teamFull = selectedTeam.length >= TEAM_MAX

  return (
    <div ref={scrollContainerRef} className={styles.root}>
      <h2 className={styles.sectionTitle}>SELECT YOUR TEAM ({TEAM_MAX} max)</h2>

      {/* Selected team slots */}
      <div className={styles.slots}>
        {Array.from({ length: TEAM_MAX }).map((_, i) => {
          const unit = selectedTeam[i]
          return (
            <div key={i} className={`${styles.slot} ${!unit ? styles.slotEmpty : ''}`}>
              {unit ? (
                <>
                  <UnitPortrait name={unit.name} rarity={unit.rarity} size="md" />
                  <span className={styles.slotName}>{unit.name}</span>
                  <button className={styles.removeBtn} onPointerDown={() => toggleTeamMember(unit)} aria-label="Remove">✕</button>
                </>
              ) : (
                <span className={styles.addIcon}>+</span>
              )}
            </div>
          )
        })}
      </div>

      {/* Roster grid */}
      <div className={styles.grid}>
        {ROSTER.map((char) => {
          const selected = selectedTeam.some((c) => c.id === char.id)
          const dimmed   = teamFull && !selected
          return (
            <button
              key={char.id}
              className={`${styles.card} ${selected ? styles.cardSelected : ''} ${dimmed ? styles.cardDimmed : ''}`}
              onPointerDown={createScrollAwareHandler(() => toggleTeamMember(char))}
            >
              <UnitPortrait name={char.name} rarity={char.rarity} size="lg" />
              <span className={styles.cardName}>{char.name}</span>
              <span className={styles.cardMeta}>{'★'.repeat(char.rarity)}</span>
              {selected && <span className={styles.checkmark}>✓</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
