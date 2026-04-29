import { ScreenShell }     from '../navigation/ScreenShell'
import { useScreen }       from '../navigation/useScreen'
import { SCREEN_IDS }      from '../navigation/screenRegistry'
import { useBackButton }   from '../input/useBackButton'
import { DungeonProvider, useDungeonScreen } from './DungeonContext'
import { DungeonArena }    from '../components/DungeonArena'
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
  const { arenaRef, phase, stageDef } = useDungeonScreen()

  return (
    <ScreenShell>
      <div className={styles.root}>
        <DungeonHeader stageName={stageDef?.name ?? '...'} onExit={() => navigateTo(SCREEN_IDS.CAMPAIGN)} />
        <DungeonArena ref={arenaRef} />
        {phase === 'exploring' && <DPad />}
        {phase === 'wave'      && <WavePhaseUI />}
        {phase === 'loading'   && <LoadingOverlay />}
      </div>
    </ScreenShell>
  )
}

function DungeonHeader({ stageName, onExit }: { stageName: string; onExit: () => void }) {
  return (
    <div className={styles.header}>
      <button className={styles.exitBtn} onPointerDown={onExit}>✕</button>
      <span className={styles.stageName}>{stageName}</span>
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
