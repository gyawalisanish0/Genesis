// Roster screen — browse and filter the character collection.

import { useState } from 'react'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import { useBackButton } from '../input/useBackButton'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { UnitPortrait } from '../components/UnitPortrait'
import { PagedGrid } from '../components/PagedGrid'
import { useRosterData } from '../hooks/useRosterData'
import { characterPortraitUrl } from '../services/DataService'
import styles from './RosterScreen.module.css'

const CLASSES  = ['All', 'Hunter', 'Ranger', 'Caster', 'Warrior', 'Enchanter', 'Guardian']
const RARITIES = [0, 1, 2, 3, 4, 5]  // 0 = All

export function RosterScreen() {
  const { navigateTo } = useScreen()
  const handleBack = useBackButton(() => navigateTo(SCREEN_IDS.MAIN_MENU))
  const createHandler = useScrollAwarePointer()
  const { characters, isLoading, error } = useRosterData()

  const [activeClass,  setActiveClass]  = useState('All')
  const [activeRarity, setActiveRarity] = useState(0)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searching,    setSearching]    = useState(false)

  const filtered = characters.filter((c) => {
    const classMatch  = activeClass === 'All'  || c.className === activeClass
    const rarityMatch = activeRarity === 0     || c.rarity    === activeRarity
    const nameMatch   = c.name.toLowerCase().includes(searchQuery.toLowerCase())
    return classMatch && rarityMatch && nameMatch
  })

  return (
    <ScreenShell>
      <div className={styles.root}>

        {/* Header */}
        <header className={styles.header}>
          {searching ? (
            <>
              <button className={styles.iconBtn} onPointerDown={createHandler({ onTap: () => { setSearching(false); setSearchQuery('') } })}>✕</button>
              <input
                className={styles.searchInput}
                placeholder="Search characters…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </>
          ) : (
            <>
              <button className={styles.iconBtn} onPointerDown={createHandler({ onTap: handleBack })} aria-label="Back">←</button>
              <span className={styles.headerTitle}>ROSTER</span>
              <button className={styles.iconBtn} onPointerDown={createHandler({ onTap: () => setSearching(true) })} aria-label="Search">🔍</button>
            </>
          )}
        </header>

        {/* Class filter tabs */}
        <div className={styles.classTabBar}>
          {CLASSES.map((cls) => (
            <button
              key={cls}
              className={`${styles.classTab} ${activeClass === cls ? styles.classTabActive : ''}`}
              onPointerDown={createHandler({ onTap: () => setActiveClass(cls) })}
            >
              {cls}
            </button>
          ))}
        </div>

        {/* Rarity filter chips */}
        <div className={styles.rarityBar}>
          {RARITIES.map((r) => (
            <button
              key={r}
              className={`${styles.rarityChip} ${activeRarity === r ? styles.rarityChipActive : ''}`}
              onPointerDown={createHandler({ onTap: () => setActiveRarity(r) })}
            >
              {r === 0 ? 'All' : '★'.repeat(r)}
            </button>
          ))}
        </div>

        {/* Character grid */}
        <div className={styles.gridWrapper}>
          {isLoading && <p className={styles.statusMsg}>Loading…</p>}
          {error     && <p className={styles.statusMsg}>{error}</p>}
          {!isLoading && !error && (
            <PagedGrid
              items={filtered}
              cols={3}
              rows={3}
              emptyText="No characters match"
              renderItem={(char) => (
                <div
                  key={char.id}
                  className={styles.card}
                  onPointerDown={createHandler({ onTap: () => {} })}
                >
                  <UnitPortrait name={char.name} rarity={char.rarity} size="sm" imageUrl={characterPortraitUrl(char.id)} />
                  <span className={styles.cardName}>{char.name}</span>
                  <span className={styles.cardClass}>{char.className}</span>
                  <span className={styles.cardRarity}>{'★'.repeat(char.rarity)}</span>
                </div>
              )}
            />
          )}
        </div>

      </div>
    </ScreenShell>
  )
}
