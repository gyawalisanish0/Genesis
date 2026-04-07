// Roster screen — browse and filter the character collection.
// Data comes from DataService (not yet wired); renders mock data in the meantime.

import { useState } from 'react'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { UnitPortrait } from '../components/UnitPortrait'
import { ResourceBar } from '../components/ResourceBar'
import styles from './RosterScreen.module.css'

// TODO: replace with DataService.getCharacters() when DataService is implemented.
const MOCK_CHARACTERS = [
  { id: 'warrior_001', name: 'Iron Warden',  className: 'Warrior',   rarity: 3, maxHp: 1200, hp: 980 },
  { id: 'hunter_001',  name: 'Swift Veil',   className: 'Hunter',    rarity: 2, maxHp: 800,  hp: 800 },
  { id: 'caster_001',  name: 'Ember Sage',   className: 'Caster',    rarity: 4, maxHp: 600,  hp: 420 },
  { id: 'ranger_001',  name: 'Dusk Arrow',   className: 'Ranger',    rarity: 2, maxHp: 900,  hp: 900 },
  { id: 'guardian_001',name: 'Stone Bastion',className: 'Guardian',  rarity: 5, maxHp: 1600, hp: 1600 },
  { id: 'enchanter_001',name:'Dream Weave',  className: 'Enchanter', rarity: 3, maxHp: 700,  hp: 550 },
]

const CLASSES = ['All', 'Hunter', 'Ranger', 'Caster', 'Warrior', 'Enchanter', 'Guardian']
const RARITIES = [0, 1, 2, 3, 4, 5]  // 0 = All

export function RosterScreen() {
  const { navigateTo: _navigateTo } = useScreen()
  const [activeClass, setActiveClass]   = useState('All')
  const [activeRarity, setActiveRarity] = useState(0)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searching, setSearching]       = useState(false)

  const filtered = MOCK_CHARACTERS.filter((c) => {
    const classMatch  = activeClass === 'All' || c.className === activeClass
    const rarityMatch = activeRarity === 0    || c.rarity    === activeRarity
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
              <button className={styles.iconBtn} onPointerDown={() => { setSearching(false); setSearchQuery('') }}>✕</button>
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
              <button className={styles.iconBtn} onPointerDown={() => window.history.back()} aria-label="Back">←</button>
              <span className={styles.headerTitle}>ROSTER</span>
              <button className={styles.iconBtn} onPointerDown={() => setSearching(true)} aria-label="Search">🔍</button>
            </>
          )}
        </header>

        {/* Class filter tabs */}
        <div className={styles.classTabBar}>
          {CLASSES.map((cls) => (
            <button
              key={cls}
              className={`${styles.classTab} ${activeClass === cls ? styles.classTabActive : ''}`}
              onPointerDown={() => setActiveClass(cls)}
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
              onPointerDown={() => setActiveRarity(r)}
            >
              {r === 0 ? 'All' : '★'.repeat(r)}
            </button>
          ))}
        </div>

        {/* Character grid */}
        <div className={styles.grid}>
          {filtered.length === 0
            ? <p className={styles.emptyMsg}>No characters match</p>
            : filtered.map((char) => (
              <div key={char.id} className={styles.card} style={{ borderLeftColor: `var(--rarity-${char.rarity})` }}>
                <UnitPortrait name={char.name} rarity={char.rarity} size="lg" />
                <p className={styles.cardName}>{char.name}</p>
                <p className={styles.cardMeta}>{char.className} · {'★'.repeat(char.rarity)}</p>
                <div className={styles.cardBar}>
                  <ResourceBar variant="hp" value={char.hp} max={char.maxHp} />
                </div>
              </div>
            ))
          }
        </div>

      </div>
    </ScreenShell>
  )
}
