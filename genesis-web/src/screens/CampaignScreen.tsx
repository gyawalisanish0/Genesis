import { useEffect, useState } from 'react'
import { ScreenShell }     from '../navigation/ScreenShell'
import { useScreen }       from '../navigation/useScreen'
import { SCREEN_IDS }      from '../navigation/screenRegistry'
import { loadCampaignIndex, loadStageDef } from '../services/DataService'
import type { StageDef }   from '../core/types'
import styles from './CampaignScreen.module.css'

export function CampaignScreen() {
  const { navigateTo } = useScreen()
  const [stages, setStages] = useState<StageDef[]>([])

  useEffect(() => {
    loadCampaignIndex()
      .then((ids) => Promise.all(ids.map((id) => loadStageDef(id))))
      .then((defs) => setStages(defs.filter(Boolean) as StageDef[]))
      .catch(() => {})
  }, [])

  return (
    <ScreenShell>
      <div className={styles.root}>
        <header className={styles.header}>
          <button className={styles.backBtn} onPointerDown={() => navigateTo(SCREEN_IDS.MAIN_MENU)}>
            ← BACK
          </button>
          <h1 className={styles.title}>CAMPAIGN</h1>
        </header>

        <div className={styles.stageList}>
          {stages.map((stage, idx) => (
            <StageCard
              key={stage.id}
              stage={stage}
              unlocked={idx === 0}
              onPlay={() => navigateTo(SCREEN_IDS.DUNGEON)}
            />
          ))}
        </div>
      </div>
    </ScreenShell>
  )
}

interface StageCardProps {
  stage:    StageDef
  unlocked: boolean
  onPlay:   () => void
}

function StageCard({ stage, unlocked, onPlay }: StageCardProps) {
  return (
    <div className={`${styles.card} ${!unlocked ? styles.cardLocked : ''}`}>
      <div className={styles.cardContent}>
        <div className={styles.cardIndex}>{unlocked ? '01' : '??'}</div>
        <div className={styles.cardInfo}>
          <p className={styles.cardName}>{unlocked ? stage.name : 'LOCKED'}</p>
          <p className={styles.cardDesc}>
            {unlocked ? stage.description : 'Complete earlier stages to unlock.'}
          </p>
        </div>
      </div>
      {unlocked && (
        <button className={styles.playBtn} onPointerDown={onPlay}>
          ENTER →
        </button>
      )}
    </div>
  )
}
