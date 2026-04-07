// Step 1 — Mode Select
// Player picks a game mode (Story, Ranked, Draft).

import { usePreBattleScreen } from './PreBattleContext'
import styles from './PreBattleStepMode.module.css'

interface ModeOption {
  id:          string
  icon:        string
  name:        string
  description: string
  meta:        string
  available:   boolean
}

const MODES: ModeOption[] = [
  { id: 'story',  icon: '▶', name: 'Story Mode',   description: 'Follow the Genesis narrative', meta: 'Single-player · Unlimited time', available: true },
  { id: 'ranked', icon: '⚔', name: 'Ranked',        description: 'Compete on the global leaderboard', meta: 'PvP · Best of 3 · 500 Ticks',  available: true },
  { id: 'draft',  icon: '🎲', name: 'Draft Mode',   description: 'In-combat unit draft',          meta: 'Coming soon',                     available: false },
]

export function PreBattleStepMode() {
  const { selectedModeId, selectMode } = usePreBattleScreen()

  return (
    <div className={styles.root}>
      <h2 className={styles.sectionTitle}>SELECT A MODE</h2>
      <div className={styles.list}>
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={`${styles.card} ${selectedModeId === mode.id ? styles.cardSelected : ''} ${!mode.available ? styles.cardDisabled : ''}`}
            onPointerDown={() => mode.available && selectMode(mode.id)}
            disabled={!mode.available}
          >
            <span className={styles.modeIcon}>{mode.icon}</span>
            <div className={styles.modeBody}>
              <span className={styles.modeName}>{mode.name}</span>
              <span className={styles.modeDesc}>{mode.description}</span>
              <span className={styles.modeMeta}>{mode.meta}</span>
            </div>
            {!mode.available && <span className={styles.comingSoon}>COMING SOON</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
