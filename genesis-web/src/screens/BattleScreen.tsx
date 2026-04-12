// Battle screen — core gameplay view.
// Layout: 28dp timeline strip (left) + main area (right).
// Child components read from BattleContext via useBattleScreen().

import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_REGISTRY, SCREEN_IDS } from '../navigation/screenRegistry'
import { useBackButton } from '../input/useBackButton'
import { BattleProvider, useBattleScreen } from './BattleContext'
import { ResourceBar } from '../components/ResourceBar'
import styles from './BattleScreen.module.css'

// ── Timeline strip ──────────────────────────────────────────────────────────
function BattleTimeline() {
  // TODO: render ally/enemy markers sorted by tickPosition from BattleContext.
  return (
    <div className={styles.timeline}>
      <div className={styles.timelineAxis} />
      <div className={`${styles.marker} ${styles.markerAlly} ${styles.markerActive}`} style={{ top: '15%' }} />
      <div className={`${styles.marker} ${styles.markerEnemy}`} style={{ top: '35%' }} />
      <div className={`${styles.marker} ${styles.markerAlly}`}  style={{ top: '55%' }} />
    </div>
  )
}

// ── Opponent info card ──────────────────────────────────────────────────────
function OpponentCard() {
  const { phase } = useBattleScreen()
  const visible = phase === 'enemy'
  return (
    <div className={`${styles.opponentCard} ${visible ? styles.opponentCardVisible : ''}`} aria-hidden={!visible}>
      <div className={styles.opponentPortrait}>E</div>
      <div className={styles.opponentInfo}>
        <span className={styles.opponentName}>Enemy Unit</span>
        <span className={styles.opponentClass}>Warrior · Rare</span>
        <ResourceBar variant="hp" value={600} max={1000} />
        <ResourceBar variant="ap" value={30} max={100} />
      </div>
      <span className={styles.lvlBadge}>LVL 3</span>
    </div>
  )
}

// ── Action log ──────────────────────────────────────────────────────────────
function ActionLog() {
  const { log } = useBattleScreen()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  return (
    <div className={styles.log}>
      {log.map((entry) => (
        <p key={entry.id} className={styles.logEntry} style={entry.colour ? { color: entry.colour } : undefined}>
          {entry.text}
        </p>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

// ── Status slots ────────────────────────────────────────────────────────────
function StatusSlots() {
  // TODO: render unit.statusSlots chips from BattleContext.playerUnit.
  return (
    <div className={styles.statusSlots}>
      <span className={styles.statusPlaceholder}>No active effects</span>
    </div>
  )
}

// ── Player portrait panel ───────────────────────────────────────────────────
function PortraitPanel() {
  const { turnNumber, tickValue } = useBattleScreen()
  return (
    <div className={styles.portrait}>
      <span className={styles.turnLabel}>Turn {turnNumber}</span>
      <span className={styles.tickLabel}>Tick: {tickValue}</span>
      <div className={styles.portraitCircle}>P</div>
      <span className={styles.lvlBadge}>LVL 1</span>
      <div className={styles.barRow}><span className={styles.barLabel}>HP</span><ResourceBar variant="hp" value={800} max={1200} /></div>
      <div className={styles.barRow}><span className={styles.barLabel}>AP</span><ResourceBar variant="ap" value={40}  max={100}  /></div>
    </div>
  )
}

// ── Action grid ─────────────────────────────────────────────────────────────
function ActionGrid() {
  const { phase, gridCollapsed, toggleGrid, appendLog } = useBattleScreen()
  const disabled = phase !== 'player'

  const handleBasicAttack = () => {
    if (disabled) return
    appendLog({ text: 'You used Basic Attack.', colour: 'var(--text-primary)' })
  }

  const handleEndTurn = () => {
    if (disabled) return
    appendLog({ text: 'You ended your turn.' })
  }

  return (
    <div className={styles.actionGrid}>
      {!gridCollapsed && (
        <>
          <div className={styles.actionRow}>
            <button className={`${styles.actionBtn} ${styles.actionBtnBasic}`} onPointerDown={handleBasicAttack} disabled={disabled}>
              <span className={styles.actionBtnName}>Basic</span>
              <span className={styles.actionBtnMeta}>TU: 6</span>
            </button>
            <button className={`${styles.actionBtn} ${styles.actionBtnEnd}`} onPointerDown={handleEndTurn} disabled={disabled}>
              <span className={styles.actionBtnName}>End/Skip</span>
            </button>
          </div>
          <div className={styles.skillRows}>
            {[1, 2, 3, 4].map((n) => (
              <button key={n} className={`${styles.skillBtn} ${disabled ? styles.skillBtnDisabled : ''}`} disabled={disabled}>
                <span className={styles.skillName}>Skill {n}</span>
                <span className={styles.skillLvl}>Lv 1</span>
                <span className={styles.skillTu}>TU: —</span>
                <span className={styles.skillChrg}>×—</span>
              </button>
            ))}
          </div>
        </>
      )}
      <button className={styles.collapseBtn} onPointerDown={toggleGrid}>
        {gridCollapsed ? '▲' : '▼'}
      </button>
    </div>
  )
}

// ── Pause overlay ───────────────────────────────────────────────────────────
function PauseOverlay() {
  const { setPaused } = useBattleScreen()
  const navigate = useNavigate()
  return (
    <div className={styles.pauseOverlay}>
      <div className={styles.pauseCard}>
        <span className={styles.pauseTitle}>PAUSED</span>
        <button className={styles.pauseBtn} onPointerDown={() => setPaused(false)}>RESUME</button>
        <button className={styles.pauseBtn} onPointerDown={() => navigate(SCREEN_REGISTRY[SCREEN_IDS.MAIN_MENU].path)}>LEAVE BATTLE</button>
      </div>
    </div>
  )
}

// ── Battle layout ───────────────────────────────────────────────────────────
function BattleLayout() {
  const { isPaused, setPaused } = useBattleScreen()
  useScreen()
  // Back toggles pause. LEAVE BATTLE in the overlay handles navigation out.
  useBackButton(() => setPaused(!isPaused))

  return (
    <div className={styles.root}>
      {isPaused && <PauseOverlay />}
      <BattleTimeline />
      <div className={styles.main}>
        <OpponentCard />
        <ActionLog />
        <StatusSlots />
        <div className={styles.bottom}>
          <PortraitPanel />
          <ActionGrid />
        </div>
      </div>
    </div>
  )
}

export function BattleScreen() {
  return (
    <ScreenShell>
      <BattleProvider>
        <BattleLayout />
      </BattleProvider>
    </ScreenShell>
  )
}
