import { useEffect, useState } from 'react'
import { ScreenShell }     from '../navigation/ScreenShell'
import { useScreen }       from '../navigation/useScreen'
import { SCREEN_IDS }      from '../navigation/screenRegistry'
import { loadCampaignIndex, loadStageDef } from '../services/DataService'
import { useGameStore }    from '../core/GameContext'
import { isStageUnlocked } from '../core/campaignProgress'
import type { StageDef }   from '../core/types'
import styles from './CampaignScreen.module.css'

export function CampaignScreen() {
  const { navigateTo } = useScreen()
  const completedStages   = useGameStore((s) => s.fleet.completedStages)
  const setSelectedStageId = useGameStore((s) => s.setSelectedStageId)
  const [stages, setStages] = useState<StageDef[]>([])
  // Index order is the authored order, and the unlock rule is sequential over
  // it — so it is kept rather than derived from the loaded defs, whose array
  // order is a Promise.all artefact.
  const [order, setOrder]   = useState<string[]>([])

  useEffect(() => {
    loadCampaignIndex()
      .then((ids) => {
        setOrder(ids)
        return Promise.all(ids.map((id) => loadStageDef(id)))
      })
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
              index={idx}
              unlocked={isStageUnlocked(order, stage.id, completedStages)}
              cleared={completedStages.includes(stage.id)}
              onPlay={() => {
                setSelectedStageId(stage.id)
                navigateTo(SCREEN_IDS.DUNGEON)
              }}
            />
          ))}
        </div>
      </div>
    </ScreenShell>
  )
}

interface StageCardProps {
  stage:    StageDef
  index:    number
  unlocked: boolean
  cleared:  boolean
  onPlay:   () => void
}

function StageCard({ stage, index, unlocked, cleared, onPlay }: StageCardProps) {
  // Locked stages speak as the organisation, not as the UI. "LOCKED /
  // complete earlier stages" reads as an unfinished game; clearance pending
  // reads as a deployment that has not been authorised yet.
  const designation = String(index + 1).padStart(2, '0')

  return (
    <div className={[
      styles.card,
      !unlocked ? styles.cardLocked : '',
      cleared   ? styles.cardCleared : '',
    ].filter(Boolean).join(' ')}>
      <div className={styles.cardContent}>
        <div className={styles.cardIndex}>{unlocked ? designation : '--'}</div>
        <div className={styles.cardInfo}>
          <p className={styles.cardName}>
            {unlocked ? stage.name : 'AWAITING CLEARANCE'}
          </p>
          <p className={styles.cardDesc}>
            {unlocked ? stage.description : 'Authorisation pending prior deployment.'}
          </p>
        </div>
        {cleared && <span className={styles.clearedBadge}>CLEARED</span>}
      </div>
      {unlocked && (
        <button className={styles.playBtn} onPointerDown={onPlay}>
          {cleared ? 'REDEPLOY →' : 'DEPLOY →'}
        </button>
      )}
    </div>
  )
}
