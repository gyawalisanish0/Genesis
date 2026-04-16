// Battle screen — core gameplay view.
// Layout: 28dp timeline strip (left) + main area (right).
// Child components read from BattleContext via useBattleScreen().

import React, { useRef, useEffect, useMemo, useState } from 'react'
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
  TIMELINE_RECENTER_DELAY_MS,
} from '../core/constants'
import styles from './BattleScreen.module.css'
import turnStyles from './TurnDisplayPanel.module.css'

// ── Timeline helpers ─────────────────────────────────────────────────────────

/**
 * Convert a tick → CSS top offset inside the track.
 * tick = maxTick → top: 0 (strip top edge)
 * tick = minTick → top: trackHeight (strip bottom edge)
 */
function tickToTop(tick: number, maxTick: number): number {
  return (maxTick - tick) * TIMELINE_PX_PER_TICK
}

// ── Timeline marker (SVG portrait + HP arc ring) ────────────────────────────
interface TimelineMarkerProps {
  name:       string
  isAlly:     boolean
  hpFraction: number   // 0–1; drives arc fill length
}

function TimelineMarker({ name, isAlly, hpFraction }: TimelineMarkerProps) {
  const circ      = 2 * Math.PI * 10
  const ringColor = isAlly ? 'var(--accent-info)' : 'var(--accent-danger)'

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      {/* Portrait background */}
      <circle cx="12" cy="12" r="9" fill="var(--bg-card)" />
      {/* HP track — always full ring, dim */}
      <circle cx="12" cy="12" r="10" fill="none"
        stroke="var(--bg-elevated)" strokeWidth="2" />
      {/* HP fill arc — length encodes hpFraction */}
      <circle cx="12" cy="12" r="10" fill="none"
        stroke={ringColor} strokeWidth="2"
        strokeDasharray={`${hpFraction * circ} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
      />
      {/* Unit initial as portrait stand-in */}
      <text x="12" y="15.5" textAnchor="middle"
        fontSize="7" fill="var(--text-secondary)"
        fontFamily="var(--font-sans)">
        {name.charAt(0).toUpperCase()}
      </text>
    </svg>
  )
}

// ── Timeline strip ──────────────────────────────────────────────────────────
function BattleTimeline() {
  const { tickValue, playerUnit, enemies, scrollBounds, historyEntries } = useBattleScreen()
  const containerRef = useRef<HTMLDivElement>(null)

  const trackHeight = (scrollBounds.max - scrollBounds.min) * TIMELINE_PX_PER_TICK

  // Tick marks: minor every 10, major every 50, spanning the registered range.
  const tickMarkPositions = useMemo(() => {
    const marks: number[] = []
    for (let t = scrollBounds.min; t <= scrollBounds.max; t += 10) marks.push(t)
    return marks
  }, [scrollBounds])

  // Measure wrap height via ResizeObserver — clientHeight is 0 on mount.
  const [containerHeight, setContainerHeight] = useState(0)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [offset, setOffset] = useState(0)
  const [animated, setAnimated] = useState(false)
  const mountedRef = useRef(false)

  // anchorY: viewport Y where the now-line should sit (top edge of bottom overlay).
  // Snap instantly on first measurement; animate on all subsequent tick advances.
  useEffect(() => {
    if (containerHeight === 0) return
    const anchorY = containerHeight - TIMELINE_OVERLAY_PX - 10
    const nowTop  = tickToTop(tickValue, scrollBounds.max)
    setOffset(anchorY - nowTop)
    if (!mountedRef.current) {
      mountedRef.current = true
      setAnimated(true)
    }
  }, [tickValue, scrollBounds, containerHeight])

  // Drag-to-pan state
  const dragStartY     = useRef(0)
  const dragBaseOffset = useRef(0)
  const recenterTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up any pending recenter timer on unmount.
  useEffect(() => () => {
    if (recenterTimer.current) clearTimeout(recenterTimer.current)
  }, [])

  function handleDragStart(e: React.PointerEvent<HTMLDivElement>) {
    if (recenterTimer.current) clearTimeout(recenterTimer.current)
    dragStartY.current     = e.clientY
    dragBaseOffset.current = offset
    setAnimated(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handleDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    setOffset(dragBaseOffset.current + (e.clientY - dragStartY.current))
  }

  function handleDragEnd() {
    setAnimated(true)
    if (recenterTimer.current) clearTimeout(recenterTimer.current)
    recenterTimer.current = setTimeout(() => {
      const anchorY = containerHeight - TIMELINE_OVERLAY_PX - 10
      const nowTop  = tickToTop(tickValue, scrollBounds.max)
      setOffset(anchorY - nowTop)
    }, TIMELINE_RECENTER_DELAY_MS)
  }

  const allUnits = playerUnit ? [playerUnit, ...enemies] : enemies

  return (
    <div className={styles.timelineWrap} ref={containerRef}>
      <div
        className={`${styles.timelineTrack} ${animated ? styles.timelineTrackAnimated : ''}`}
        style={{ height: trackHeight, transform: `translateY(${offset}px)` }}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={() => handleDragEnd()}
        onPointerCancel={() => handleDragEnd()}
      >
        <div className={styles.timelineAxis} />
        {tickMarkPositions.map((tick) => (
          <div
            key={tick}
            className={`${styles.tickMark} ${tick % 50 === 0 ? styles.tickMarkMajor : ''}`}
            style={{ top: tickToTop(tick, scrollBounds.max) }}
          />
        ))}
        <div className={styles.nowLine} style={{ top: tickToTop(tickValue, scrollBounds.max) }} />
        {/* History ghosts — rendered first so live markers paint on top */}
        {historyEntries.map((entry) => (
          <div
            key={entry.id}
            className={`${styles.marker} ${styles.markerGhost}`}
            style={{ top: tickToTop(entry.tick, scrollBounds.max) }}
          >
            <TimelineMarker name={entry.name} isAlly={entry.isAlly} hpFraction={0} />
          </div>
        ))}
        {/* Live unit markers */}
        {allUnits.map((unit) => (
          <div
            key={unit.id}
            className={`${styles.marker} ${unit === playerUnit ? styles.markerActive : ''}`}
            style={{ top: tickToTop(unit.tickPosition, scrollBounds.max) }}
          >
            <TimelineMarker
              name={unit.name}
              isAlly={unit.isAlly}
              hpFraction={unit.maxHp > 0 ? unit.hp / unit.maxHp : 0}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Turn display panel ──────────────────────────────────────────────────────
// Shows the active unit, their skill, and target in sequence.
// Enemy turn: animates in BEFORE the action fires (telegraph during 700ms delay).
// Player turn: animates in AFTER the action resolves (confirmation summary).
// Auto-dismisses 2s after the action completes. Actor row hidden for player.
function TurnDisplayPanel() {
  const { turnDisplay } = useBattleScreen()
  if (!turnDisplay) return null

  const { actor, skillName, tuCost, target, isAlly } = turnDisplay
  const accent      = isAlly ? 'var(--accent-info)' : 'var(--accent-danger)'
  const skillDelay  = actor ? '150ms' : '0ms'
  const targetDelay = actor ? '300ms' : '150ms'

  return (
    <div className={turnStyles.turnDisplay}>
      {actor && (
        <div className={turnStyles.turnRow}
             style={{ borderLeftColor: accent, animationDelay: '0ms' }}>
          <span className={turnStyles.actorName}>{actor.name}</span>
          <span className={turnStyles.actorMeta}>
            {actor.className} · {'★'.repeat(actor.rarity)}
          </span>
        </div>
      )}
      <div className={turnStyles.turnRow} style={{ animationDelay: skillDelay }}>
        <span className={turnStyles.skillName}>{skillName}</span>
        <span className={turnStyles.skillTu}>TU {tuCost}</span>
      </div>
      <div className={turnStyles.turnRow} style={{ animationDelay: targetDelay }}>
        <span className={turnStyles.target}>→ {target}</span>
      </div>
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
  const { turnNumber, tickValue, playerUnit } = useBattleScreen()
  return (
    <div className={styles.portrait}>
      <span className={styles.turnLabel}>Turn {turnNumber}</span>
      <span className={styles.tickLabel}>Tick: {tickValue}</span>
      <div className={styles.portraitCircle}>{playerUnit?.name.charAt(0) ?? 'P'}</div>
      <span className={styles.lvlBadge}>{playerUnit ? `${playerUnit.className} ★${playerUnit.rarity}` : 'LVL 1'}</span>
      <div className={styles.barRow}><span className={styles.barLabel}>HP</span><ResourceBar variant="hp" value={playerUnit?.hp ?? 0}  max={playerUnit?.maxHp ?? 1} /></div>
      <div className={styles.barRow}><span className={styles.barLabel}>AP</span><ResourceBar variant="ap" value={playerUnit?.ap ?? 0}  max={playerUnit?.maxAp ?? 1} /></div>
    </div>
  )
}

// ── Action grid ─────────────────────────────────────────────────────────────
function ActionGrid() {
  const {
    phase, gridCollapsed, toggleGrid, appendLog,
    playerUnit, pushHistory, registerTick,
    getUnitSkills, executeSkill,
  } = useBattleScreen()
  const createHandler = useScrollAwarePointer()
  const disabled = phase !== 'player'

  const playerSkills = playerUnit ? getUnitSkills(playerUnit.id) : []

  const handleEndTurn = () => {
    if (disabled || !playerUnit) return
    const fromTick = playerUnit.tickPosition
    pushHistory({ id: `${playerUnit.id}-${fromTick}-end`, unitId: playerUnit.id, name: playerUnit.name, tick: fromTick, isAlly: playerUnit.isAlly })
    registerTick(playerUnit.id, fromTick + 10)
    appendLog({ text: 'You skipped your turn.' })
  }

  // Pad skill list to always show 4 slots.
  const slots = Array.from({ length: 4 }, (_, i) => playerSkills[i] ?? null)

  return (
    <div className={styles.actionGrid}>
      {!gridCollapsed && (
        <>
          <div className={styles.actionRow}>
            <button className={`${styles.actionBtn} ${styles.actionBtnEnd}`} onPointerDown={createHandler({ onTap: handleEndTurn })} disabled={disabled}>
              <span className={styles.actionBtnName}>End/Skip</span>
            </button>
          </div>
          <div className={styles.skillRows}>
            {slots.map((skillInst, i) => {
              const hasSkill = skillInst !== null
              const tuCost   = hasSkill ? skillInst.cachedCosts.tuCost : null
              const name     = hasSkill ? skillInst.baseDef.name : '—'
              return (
                <button
                  key={i}
                  className={`${styles.skillBtn} ${(!hasSkill || disabled) ? styles.skillBtnDisabled : ''}`}
                  disabled={!hasSkill || disabled}
                  onPointerDown={hasSkill ? createHandler({ onTap: () => executeSkill(skillInst) }) : undefined}
                >
                  <span className={styles.skillName}>{name}</span>
                  <span className={styles.skillLvl}>Lv {skillInst?.currentLevel ?? '—'}</span>
                  <span className={styles.skillTu}>{tuCost !== null ? `TU: ${tuCost}` : 'TU: —'}</span>
                  <span className={styles.skillChrg}>{hasSkill ? `Lv${skillInst.baseDef.maxLevel}` : '×—'}</span>
                </button>
              )
            })}
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
  const { isPaused, setPaused, isLoading, turnDisplay } = useBattleScreen()
  useScreen()
  // Back toggles pause. LEAVE BATTLE in the overlay handles navigation out.
  useBackButton(() => setPaused(!isPaused))

  if (isLoading) {
    return (
      <div className={styles.root} style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--t-label-size)' }}>
          Loading battle…
        </span>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {isPaused && <PauseOverlay />}
      <BattleTimeline />
      <div className={styles.main}>
        <TurnDisplayPanel key={turnDisplay?.animKey ?? 0} />
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
