// Battle screen — core gameplay view.
// Layout: 28dp timeline strip (left) + main area (right).
// Child components read from BattleContext via useBattleScreen().

import { useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_REGISTRY, SCREEN_IDS } from '../navigation/screenRegistry'
import { useBackButton } from '../input/useBackButton'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { BattleProvider, useBattleScreen } from './BattleContext'
import { ResourceBar } from '../components/ResourceBar'
import {
  TIMELINE_PX_PER_TICK, TIMELINE_OVERLAY_PX,
  TIMELINE_NOW_FRACTION, TIMELINE_RECENTER_DELAY_MS,
} from '../core/constants'
import styles from './BattleScreen.module.css'

// ── Timeline helpers ─────────────────────────────────────────────────────────

/**
 * Convert a tick → CSS top offset inside the track.
 * tick = maxTick → top: 0 (strip top edge)
 * tick = minTick → top: trackHeight (strip bottom edge)
 */
function tickToTop(tick: number, maxTick: number): number {
  return (maxTick - tick) * TIMELINE_PX_PER_TICK
}

// ── Timeline strip ──────────────────────────────────────────────────────────
function BattleTimeline() {
  const { tickValue, playerUnit, enemies, scrollBounds } = useBattleScreen()
  const scrollRef = useRef<HTMLDivElement>(null)

  const trackHeight = (scrollBounds.max - scrollBounds.min) * TIMELINE_PX_PER_TICK

  // Tick marks: minor every 10, major every 50, spanning the registered range.
  const tickMarkPositions = useMemo(() => {
    const marks: number[] = []
    for (let t = scrollBounds.min; t <= scrollBounds.max; t += 10) marks.push(t)
    return marks
  }, [scrollBounds])

  // Smooth-scroll "now" to TIMELINE_NOW_FRACTION from the top whenever tickValue or bounds change.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = tickToTop(tickValue, scrollBounds.max)
      - el.clientHeight * TIMELINE_NOW_FRACTION + TIMELINE_OVERLAY_PX
    el.scrollTo({ top: target, behavior: 'smooth' })
  }, [tickValue, scrollBounds])

  // Auto-recenter: if the user scrolls the now-line out of the visible band,
  // smooth-scroll back to center it after TIMELINE_RECENTER_DELAY_MS of idle.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | null = null

    function onScroll() {
      if (timer) clearTimeout(timer)
      const nowTop  = tickToTop(tickValue, scrollBounds.max)
      const bandTop = el!.scrollTop + TIMELINE_OVERLAY_PX
      const bandBot = el!.scrollTop + el!.clientHeight - TIMELINE_OVERLAY_PX
      if (nowTop < bandTop || nowTop > bandBot) {
        timer = setTimeout(() => {
          const target = nowTop - el!.clientHeight * TIMELINE_NOW_FRACTION + TIMELINE_OVERLAY_PX
          el!.scrollTo({ top: target, behavior: 'smooth' })
        }, TIMELINE_RECENTER_DELAY_MS)
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (timer) clearTimeout(timer)
    }
  }, [tickValue, scrollBounds])

  const allUnits = playerUnit ? [playerUnit, ...enemies] : enemies

  return (
    <div className={styles.timelineWrap}>
      <div className={styles.timeline} ref={scrollRef}>
        <div className={styles.timelineTrack} style={{ height: trackHeight }}>
          <div className={styles.timelineAxis} />
          {tickMarkPositions.map((tick) => (
            <div
              key={tick}
              className={`${styles.tickMark} ${tick % 50 === 0 ? styles.tickMarkMajor : ''}`}
              style={{ top: tickToTop(tick, scrollBounds.max) }}
            />
          ))}
          <div className={styles.nowLine} style={{ top: tickToTop(tickValue, scrollBounds.max) }} />
          {allUnits.map((unit) => (
            <div
              key={unit.id}
              className={`${styles.marker} ${unit.isAlly ? styles.markerAlly : styles.markerEnemy} ${unit === playerUnit ? styles.markerActive : ''}`}
              style={{ top: tickToTop(unit.tickPosition, scrollBounds.max) }}
            />
          ))}
        </div>
      </div>
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
  const {
    phase, gridCollapsed, toggleGrid, appendLog,
    tickValue, playerUnit, setTickValue, registerTick,
  } = useBattleScreen()
  const createHandler = useScrollAwarePointer()
  const disabled = phase !== 'player'

  const handleBasicAttack = () => {
    if (disabled) return
    const newTick = tickValue + 6
    setTickValue(newTick)
    if (playerUnit) registerTick(playerUnit.id, newTick)
    appendLog({ text: 'You used Basic Attack.', colour: 'var(--text-primary)' })
  }

  const handleEndTurn = () => {
    if (disabled) return
    const newTick = tickValue + 10
    setTickValue(newTick)
    if (playerUnit) registerTick(playerUnit.id, newTick)
    appendLog({ text: 'You ended your turn.' })
  }

  return (
    <div className={styles.actionGrid}>
      {!gridCollapsed && (
        <>
          <div className={styles.actionRow}>
            <button className={`${styles.actionBtn} ${styles.actionBtnBasic}`} onPointerDown={createHandler({ onTap: handleBasicAttack })} disabled={disabled}>
              <span className={styles.actionBtnName}>Basic</span>
              <span className={styles.actionBtnMeta}>TU: 6</span>
            </button>
            <button className={`${styles.actionBtn} ${styles.actionBtnEnd}`} onPointerDown={createHandler({ onTap: handleEndTurn })} disabled={disabled}>
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
      <button className={styles.collapseBtn} onPointerDown={createHandler({ onTap: toggleGrid })}>
        {gridCollapsed ? '▲' : '▼'}
      </button>
    </div>
  )
}

// ── Pause overlay ───────────────────────────────────────────────────────────
function PauseOverlay() {
  const { setPaused } = useBattleScreen()
  const navigate = useNavigate()
  const createHandler = useScrollAwarePointer()
  return (
    <div className={styles.pauseOverlay}>
      <div className={styles.pauseCard}>
        <span className={styles.pauseTitle}>PAUSED</span>
        <button className={styles.pauseBtn} onPointerDown={createHandler({ onTap: () => setPaused(false) })}>RESUME</button>
        <button className={styles.pauseBtn} onPointerDown={createHandler({ onTap: () => navigate(SCREEN_REGISTRY[SCREEN_IDS.MAIN_MENU].path) })}>LEAVE BATTLE</button>
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
