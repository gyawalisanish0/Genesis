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
import { BattleArena } from '../components/BattleArena'
import { BattleProvider, useBattleScreen } from './BattleContext'
import { ClashQteOverlay } from './ClashQteOverlay'
import { TeamCollisionOverlay } from './TeamCollisionOverlay'
import type { DiceOutcome } from '../core/combat/DiceResolver'
import { isOnCooldown, ticksRemaining, turnsRemaining } from '../core/combat/CooldownResolver'
import { ResourceBar } from '../components/ResourceBar'
import {
  TIMELINE_PX_PER_TICK, TIMELINE_OVERLAY_PX,
  TIMELINE_RECENTER_DELAY_MS, BACK_DEBOUNCE_MS,
} from '../core/constants'
import styles from './BattleScreen.module.css'
import diceStyles from './DiceResultOverlay.module.css'

// ── Dice outcome colour map (existing design tokens — no new tokens) ─────────

const OUTCOME_COLORS: Record<DiceOutcome, string> = {
  Boosted:  'var(--accent-gold)',
  Success:  'var(--accent-heal)',
  Tumbling: 'var(--accent-danger)',
  GuardUp:  'var(--accent-info)',
  Evasion:  'var(--accent-evasion)',
  Fail:     'var(--text-muted)',
}

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
  const hp    = playerUnit?.hp    ?? 0
  const maxHp = playerUnit?.maxHp ?? 1
  const ap    = playerUnit?.ap    ?? 0
  const maxAp = playerUnit?.maxAp ?? 1
  return (
    <div className={styles.portrait}>
      <span className={styles.turnLabel}>Turn {turnNumber}</span>
      <span className={styles.tickLabel}>Tick: {tickValue}</span>
      <div className={styles.portraitCircle}>{playerUnit?.name.charAt(0) ?? 'P'}</div>
      <span className={styles.lvlBadge}>{playerUnit ? `${playerUnit.className} ★${playerUnit.rarity}` : 'LVL 1'}</span>
      <div className={styles.barRow}>
        <span className={styles.barLabel}>HP</span>
        <ResourceBar variant="hp" value={hp} max={maxHp} />
        <span className={styles.barValue}>{hp}/{maxHp}</span>
      </div>
      <div className={styles.barRow}>
        <span className={styles.barLabel}>AP</span>
        <ResourceBar variant="ap" value={ap} max={maxAp} />
        <span className={styles.barValue}>{ap}/{maxAp}</span>
      </div>
    </div>
  )
}

// ── Action grid ─────────────────────────────────────────────────────────────
function ActionGrid() {
  const {
    phase, gridCollapsed, toggleGrid,
    playerUnit, getUnitSkills, selectedSkill, selectSkill, skipTurn,
  } = useBattleScreen()
  const createHandler = useScrollAwarePointer()
  const disabled = phase !== 'player'

  const playerSkills = playerUnit ? getUnitSkills(playerUnit.id) : []

  // Pad skill list to always show 4 slots.
  const slots = Array.from({ length: 4 }, (_, i) => playerSkills[i] ?? null)

  return (
    <div className={styles.actionGrid}>
      {!gridCollapsed && (
        <>
          <div className={styles.actionRow}>
            <button className={`${styles.actionBtn} ${styles.actionBtnEnd}`} onPointerDown={createHandler({ onTap: skipTurn })} disabled={disabled}>
              <span className={styles.actionBtnName}>End/Skip</span>
            </button>
          </div>
          <div className={styles.skillRows}>
            {slots.map((skillInst, i) => {
              const hasSkill   = skillInst !== null
              const isSelected = hasSkill && selectedSkill?.defId === skillInst.defId
              const tuCost     = hasSkill ? skillInst.cachedCosts.tuCost : null
              const name       = hasSkill ? skillInst.baseDef.name : '—'
              const onCooldown = hasSkill && !!playerUnit && isOnCooldown(playerUnit, skillInst)
              const tickCD     = onCooldown && playerUnit ? ticksRemaining(playerUnit, skillInst) : 0
              const turnCD     = onCooldown && playerUnit ? turnsRemaining(playerUnit, skillInst) : 0
              const isDisabled = !hasSkill || disabled || onCooldown
              return (
                <button
                  key={i}
                  className={[
                    styles.skillBtn,
                    (!hasSkill || disabled) ? styles.skillBtnDisabled : '',
                    onCooldown              ? styles.skillBtnCooldown  : '',
                    isSelected              ? styles.skillBtnSelected  : '',
                  ].join(' ')}
                  disabled={isDisabled}
                  onPointerDown={hasSkill && !onCooldown ? createHandler({ onTap: () => {
                    selectSkill(isSelected ? null : skillInst)
                  }}) : undefined}
                >
                  <span className={styles.skillName}>{name}</span>
                  <span className={styles.skillLvl}>Lv {skillInst?.currentLevel ?? '—'}</span>
                  <span className={styles.skillTu}>{tuCost !== null ? `TU: ${tuCost}` : 'TU: —'}</span>
                  <span className={styles.skillChrg}>{hasSkill ? `Lv${skillInst.baseDef.maxLevel}` : '×—'}</span>
                  {onCooldown && (
                    <span className={styles.skillCdBadge}>
                      {tickCD > 0 ? `⏳${tickCD}t` : ''}
                      {tickCD > 0 && turnCD > 0 ? ' ' : ''}
                      {turnCD > 0 ? `⏳${turnCD}` : ''}
                    </span>
                  )}
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

// ── Roll button ─────────────────────────────────────────────────────────────
// Appears above the portrait when a skill is selected.
// Triggers a 500ms "Rolling…" pulse before the dice fires, then clears the selection.
function RollButton() {
  const { selectedSkill, phase, executeSkill, selectSkill } = useBattleScreen()
  const createHandler = useScrollAwarePointer()
  const [isRolling, setIsRolling] = useState(false)
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (rollTimerRef.current) clearTimeout(rollTimerRef.current)
  }, [])

  if (!selectedSkill || phase !== 'player') return null

  const handleRoll = () => {
    if (isRolling) return
    setIsRolling(true)
    rollTimerRef.current = setTimeout(() => {
      executeSkill(selectedSkill)
      selectSkill(null)
      setIsRolling(false)
    }, 250)
  }

  return (
    <button
      className={`${styles.rollBtn} ${isRolling ? styles.rollBtnRolling : ''}`}
      onPointerDown={createHandler({ onTap: handleRoll })}
      disabled={isRolling}
    >
      {isRolling ? 'Rolling…' : 'ROLL'}
    </button>
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

// ── Counter prompt overlay ───────────────────────────────────────────────────
// Appears when counter roll succeeds for the player — choose to fire or skip.
// Counter reactions bypass cooldown: whichever skill is offered fires freely.
function CounterPromptOverlay() {
  const { pendingCounterDecision, confirmCounter, skipCounter } = useBattleScreen()
  const createHandler = useScrollAwarePointer()
  if (!pendingCounterDecision) return null

  const { counterSkill } = pendingCounterDecision
  const skillName = counterSkill.baseDef.name
  const apCost    = counterSkill.cachedCosts.apCost

  return (
    <div className={styles.counterPromptOverlay}>
      <div className={styles.counterPromptCard}>
        <span className={styles.counterPromptTitle}>Counter Opportunity!</span>
        <span className={styles.counterPromptSkill}>{skillName}</span>
        <span className={styles.counterPromptCost}>AP: {apCost}</span>
        <div className={styles.counterPromptActions}>
          <button
            className={styles.counterPromptFire}
            onPointerDown={createHandler({ onTap: confirmCounter })}
          >
            COUNTER
          </button>
          <button
            className={styles.counterPromptSkip}
            onPointerDown={createHandler({ onTap: skipCounter })}
          >
            SKIP
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dice result overlay ─────────────────────────────────────────────────────
// Full-area centred burst that slams in, holds, and fades over 2s.
// Mounted with key={animKey} so each new roll triggers a fresh CSS animation.
function DiceResultOverlay() {
  const { diceResult } = useBattleScreen()
  if (!diceResult) return null

  const color = OUTCOME_COLORS[diceResult.outcome]

  return (
    <div className={diceStyles.overlay}>
      <div className={diceStyles.burst} style={{ color }}>
        <span className={diceStyles.outcomeName}>
          {diceResult.outcome.toUpperCase()}
        </span>
        <div className={diceStyles.accentLine} />
        {diceResult.message && (
          <span className={diceStyles.outcomeMsg}>{diceResult.message}</span>
        )}
      </div>
    </div>
  )
}

// ── Battle layout ───────────────────────────────────────────────────────────
function BattleLayout() {
  const { arenaRef, isPaused, setPaused, isLoading, playerUnit, diceResult, log } = useBattleScreen()
  const navigate      = useNavigate()
  const lastBackRef   = useRef(0)
  const prevLogLenRef = useRef(0)
  useScreen()

  // Forward new log entries to the Phaser canvas as they arrive.
  useEffect(() => {
    const newEntries = log.slice(prevLogLenRef.current)
    newEntries.forEach((e) => arenaRef.current?.addLog(e.text, e.colour ?? 'var(--text-primary)'))
    prevLogLenRef.current = log.length
  }, [log, arenaRef])

  // Redirect silently to pre-battle if no team was confirmed (direct URL access, etc.).
  useEffect(() => {
    if (!isLoading && !playerUnit) {
      navigate(SCREEN_REGISTRY[SCREEN_IDS.PRE_BATTLE].path, { replace: true })
    }
  }, [isLoading, playerUnit, navigate])
  // Bounded pause loop: back → pause, back → resume. Never navigates away.
  // Guards: (1) no-op during load, (2) 300ms debounce, (3) functional update avoids stale closure.
  useBackButton(() => {
    if (isLoading) return
    const now = Date.now()
    if (now - lastBackRef.current < BACK_DEBOUNCE_MS) return
    lastBackRef.current = now
    setPaused((prev) => !prev)
  })

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
      <CounterPromptOverlay />
      <ClashQteOverlay />
      <TeamCollisionOverlay />
      <DiceResultOverlay key={diceResult?.animKey ?? 0} />
      <BattleTimeline />
      <div className={styles.main}>
        <BattleArena ref={arenaRef} />
        <StatusSlots />
        <div className={styles.bottom}>
          <div className={styles.portraitCol}>
            <RollButton />
            <PortraitPanel />
          </div>
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
