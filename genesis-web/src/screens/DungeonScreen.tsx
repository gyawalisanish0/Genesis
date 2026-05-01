import { ScreenShell }     from '../navigation/ScreenShell'
import { useScreen }       from '../navigation/useScreen'
import { SCREEN_IDS }      from '../navigation/screenRegistry'
import { useBackButton }   from '../input/useBackButton'
import { DungeonProvider, useDungeonScreen } from './DungeonContext'
import { DungeonArena }    from '../components/DungeonArena'
import { HintToaster }     from '../components/HintToaster'
import { ErrorToaster }    from '../components/ErrorToaster'
import styles from './DungeonScreen.module.css'

export function DungeonScreen() {
  return (
    <DungeonProvider>
      <DungeonLayout />
    </DungeonProvider>
  )
}

function DungeonLayout() {
  const { navigateTo } = useScreen()
  useBackButton(() => navigateTo(SCREEN_IDS.CAMPAIGN))
  const { arenaRef, phase, stageDef, encounterBanner, mapDef, defeatedEntityIds, partyLeader, tilesetError } = useDungeonScreen()

  // Compute enemy progress (defeated / total) so the player can see how close
  // they are to clearing the stage at a glance.
  const totalEnemies    = mapDef?.entities.filter((e) => e.type === 'enemy').length ?? 0
  const defeatedEnemies = mapDef
    ? mapDef.entities.filter((e) => e.type === 'enemy' && defeatedEntityIds.has(e.entityId)).length
    : 0

  return (
    <ScreenShell>
      <div className={styles.root}>
        <DungeonHeader
          stageName={stageDef?.name ?? '...'}
          defeated={defeatedEnemies}
          total={totalEnemies}
          onExit={() => navigateTo(SCREEN_IDS.CAMPAIGN)}
        />
        <DungeonArena ref={arenaRef} />
        {phase === 'exploring' && <DPad />}
        {phase === 'wave'      && <WavePhaseUI />}
        {phase === 'loading'   && <LoadingOverlay />}
        {partyLeader           && <PartyHpPill leader={partyLeader} />}
        {encounterBanner       && <EncounterBanner enemyName={encounterBanner} />}
        {phase === 'exploring' && (
          <HintToaster id="dungeon-move" message="Tap arrows to move. Step on enemies to engage." />
        )}
        {phase === 'wave' && (
          <HintToaster id="dungeon-wave" message="Multiple foes spotted — tap one to engage." />
        )}
        <ErrorToaster message={tilesetError} />
      </div>
    </ScreenShell>
  )
}

function PartyHpPill({ leader }: { leader: { name: string; hp: number; maxHp: number } }) {
  const fraction = leader.maxHp > 0 ? leader.hp / leader.maxHp : 0
  const low      = fraction <= 0.3
  return (
    <div className={`${styles.hpPill} ${low ? styles.hpPillLow : ''}`}>
      <span className={styles.hpName}>{leader.name}</span>
      <div className={styles.hpBarTrack}>
        <div className={styles.hpBarFill} style={{ width: `${fraction * 100}%` }} />
      </div>
      <span className={styles.hpValue}>{leader.hp}/{leader.maxHp}</span>
    </div>
  )
}

function EncounterBanner({ enemyName }: { enemyName: string }) {
  return (
    <div className={styles.encounterBanner}>
      <span className={styles.encounterTitle}>ENCOUNTER!</span>
      <span className={styles.encounterEnemy}>{enemyName}</span>
    </div>
  )
}

function DungeonHeader({ stageName, defeated, total, onExit }: {
  stageName: string
  defeated:  number
  total:     number
  onExit:    () => void
}) {
  const cleared = total > 0 && defeated >= total
  return (
    <div className={styles.header}>
      <button className={styles.exitBtn} onPointerDown={onExit}>✕</button>
      <span className={styles.stageName}>{stageName}</span>
      {total > 0 && (
        <span className={`${styles.objectivePill} ${cleared ? styles.objectivePillDone : ''}`}>
          <span className={styles.objectiveIcon}>{cleared ? '✓' : '⚔'}</span>
          <span className={styles.objectiveCount}>{defeated}/{total}</span>
        </span>
      )}
    </div>
  )
}

function DPad() {
  const { moveParty } = useDungeonScreen()
  return (
    <div className={styles.dpad}>
      <button className={styles.dpadBtn} onPointerDown={() => moveParty( 0, -1)}>▲</button>
      <div className={styles.dpadRow}>
        <button className={styles.dpadBtn} onPointerDown={() => moveParty(-1,  0)}>◀</button>
        <div className={styles.dpadCenter} />
        <button className={styles.dpadBtn} onPointerDown={() => moveParty( 1,  0)}>▶</button>
      </div>
      <button className={styles.dpadBtn} onPointerDown={() => moveParty( 0,  1)}>▼</button>
    </div>
  )
}

function WavePhaseUI() {
  const { waveEnemies, selectWaveEnemy } = useDungeonScreen()
  return (
    <div className={styles.waveUi}>
      <p className={styles.waveLabel}>TAP AN ENEMY TO ENGAGE</p>
      <div className={styles.waveList}>
        {waveEnemies.map((e) => (
          <button
            key={e.entityId}
            className={styles.waveBtn}
            onPointerDown={() => selectWaveEnemy(e.entityId)}
          >
            {e.defId.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

function LoadingOverlay() {
  return <div className={styles.loading}>Loading…</div>
}
