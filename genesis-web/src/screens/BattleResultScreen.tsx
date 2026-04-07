// Battle Result screen — Victory or Defeat summary.
// Reads battleResult from Zustand store; falls back to a mock for dev.

import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_IDS } from '../navigation/screenRegistry'
import { useGameStore } from '../core/GameContext'
import { ResourceBar } from '../components/ResourceBar'
import { UnitPortrait } from '../components/UnitPortrait'
import styles from './BattleResultScreen.module.css'

const MOCK_RESULT = {
  outcome:  'victory' as const,
  turns:    12,
  xpGained: 840,
}

const MOCK_SURVIVING = [
  { id: 'warrior_001', name: 'Iron Warden', rarity: 3, hp: 640, maxHp: 1200, levelFrom: 3, levelTo: 4, xp: 240 },
  { id: 'hunter_001',  name: 'Swift Veil',  rarity: 2, hp: 800, maxHp: 800,  levelFrom: 2, levelTo: 2, xp: 180 },
]

const BATTLE_STATS = [
  { label: 'Total ticks elapsed',  value: 148 },
  { label: 'Boosted outcomes',     value: 3 },
  { label: 'Evasion chains',       value: 1 },
  { label: 'Highest damage hit',   value: 234 },
]

export function BattleResultScreen() {
  const { navigateTo } = useScreen()
  const storedResult = useGameStore((s) => s.battleResult)
  const resetBattle  = useGameStore((s) => s.resetBattle)

  const result  = storedResult ?? MOCK_RESULT
  const victory = result.outcome === 'victory'

  const handlePrimary = () => {
    resetBattle()
    if (victory) navigateTo(SCREEN_IDS.MAIN_MENU)
    else navigateTo(SCREEN_IDS.PRE_BATTLE)
  }

  const handleMainMenu = () => {
    resetBattle()
    navigateTo(SCREEN_IDS.MAIN_MENU)
  }

  return (
    <ScreenShell>
      <div className={styles.root}>

        {/* Result banner */}
        <div className={`${styles.banner} ${victory ? styles.bannerVictory : styles.bannerDefeat}`}>
          <span className={styles.bannerIcon}>{victory ? '★' : '✕'}</span>
          <h1 className={styles.bannerText}>
            {victory ? 'V I C T O R Y' : 'D E F E A T'}
          </h1>
          <p className={styles.bannerSub}>Story Mode</p>
          {victory && <span className={styles.bannerIconRight}>★</span>}
        </div>

        <div className={styles.scroll}>

          {/* Rewards (victory only) */}
          {victory && (
            <div className={styles.rewardsCard}>
              <div className={styles.rewardRow}>
                <span className={styles.rewardLabel}>⚡ XP</span>
                <span className={styles.rewardValue} style={{ color: 'var(--accent-genesis)' }}>+{result.xpGained}</span>
              </div>
              <div className={styles.rewardRow}>
                <span className={styles.rewardLabel}>💎 Currency</span>
                <span className={styles.rewardValue} style={{ color: 'var(--accent-gold)' }}>+120</span>
              </div>
            </div>
          )}

          {/* Unit results */}
          <p className={styles.sectionLabel}>{victory ? 'SURVIVING UNITS' : 'FALLEN UNITS'}</p>
          {MOCK_SURVIVING.map((unit) => (
            <div key={unit.id} className={styles.unitRow}>
              <UnitPortrait name={unit.name} rarity={unit.rarity} size="sm" greyscale={!victory} />
              <div className={styles.unitInfo}>
                <div className={styles.unitMeta}>
                  <span className={styles.unitName}>{unit.name}</span>
                  <span className={styles.unitLevel} style={unit.levelTo > unit.levelFrom ? { color: 'var(--accent-genesis)' } : {}}>
                    Lv {unit.levelFrom}{unit.levelTo > unit.levelFrom ? `→${unit.levelTo}` : ''}
                  </span>
                  <span className={styles.unitXp}>+{unit.xp} XP</span>
                </div>
                <ResourceBar variant="hp" value={victory ? unit.hp : 0} max={unit.maxHp} />
              </div>
            </div>
          ))}

          {/* Battle stats */}
          <p className={styles.sectionLabel}>BATTLE STATS</p>
          <div className={styles.statsCard}>
            {BATTLE_STATS.map((stat) => (
              <div key={stat.label} className={styles.statRow}>
                <span className={styles.statLabel}>{stat.label}</span>
                <span className={styles.statValue}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className={styles.actions}>
            <button
              className={`${styles.primaryBtn} ${!victory ? styles.primaryBtnRetry : ''}`}
              onPointerDown={handlePrimary}
            >
              {victory ? 'CONTINUE →' : '↺ RETRY'}
            </button>
            <button className={styles.ghostBtn} onPointerDown={handleMainMenu}>
              MAIN MENU
            </button>
          </div>

        </div>
      </div>
    </ScreenShell>
  )
}
