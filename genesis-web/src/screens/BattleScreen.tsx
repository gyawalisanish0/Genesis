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
import { HintToaster } from '../components/HintToaster'
import { BattleProvider, useBattleScreen } from './BattleContext'
import { BattleLogOverlay } from './BattleLogOverlay'
import { ClashQteOverlay } from './ClashQteOverlay'
import { TeamCollisionOverlay } from './TeamCollisionOverlay'
import { SkillInfoOverlay } from './SkillInfoOverlay'
import { isOnCooldown, ticksRemaining, turnsRemaining } from '../core/combat/CooldownResolver'
import {
  TIMELINE_PX_PER_TICK, TIMELINE_OVERLAY_PX,
  TIMELINE_RECENTER_DELAY_MS, BACK_DEBOUNCE_MS,
} from '../core/constants'
import { getCachedSkill } from '../core/engines/skill/SkillInstance'
import { isAlive, isSkillTagBlocked } from '../core/unit'
import { ResourceBar } from '../components/ResourceBar'
import { StatusChipBar } from '../components/StatusChipBar'
import type { StatusChipData } from '../components/StatusChipBar'
import type { Unit } from '../core/types'
import { characterPortraitUrl } from '../services/DataService'
import styles from './BattleScreen.module.css'

// ── Status chip helpers ──────────────────────────────────────────────────────

function buildChips(
  unit: Unit,
  getChipDef: (id: string) => import('../core/types').StatusChipDef | null,
  suppressedChipIds: ReadonlySet<string>,
): StatusChipData[] {
  return unit.statusSlots.flatMap((slot) => {
    if (suppressedChipIds.has(slot.id)) return []
    const chip = getChipDef(slot.id)
    if (!chip) return []
    return [{
      slotId:          slot.id,
      label:           chip.label,
      colour:          chip.colour,
      durationDisplay: chip.durationDisplay,
      // For indefinite statuses (no fixed duration), fall back to showing stacks.
      duration:        slot.duration > 0 ? slot.duration : slot.stacks,
    }]
  })
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
  name:        string
  defId:       string
  isAlly:      boolean
  hpFraction:  number   // 0–1; drives arc fill length
}

function TimelineMarker({ name, defId, isAlly, hpFraction }: TimelineMarkerProps) {
  const circ      = 2 * Math.PI * 10
  const ringColor = isAlly ? 'var(--accent-info)' : 'var(--accent-danger)'
  const clipId    = `tm-clip-${defId}`

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <circle cx="12" cy="12" r="9" />
        </clipPath>
      </defs>
      {/* Portrait background */}
      <circle cx="12" cy="12" r="9" fill="var(--bg-card)" />
      {/* Portrait image — clipped to circle; falls back to initial below */}
      <image
        href={characterPortraitUrl(defId)}
        x="3" y="3" width="18" height="18"
        clipPath={`url(#${clipId})`}
        preserveAspectRatio="xMidYMid slice"
      />
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
    </svg>
  )
}

// Vertical gap between markers that share the same tick position.
// Centered on the tick line so the group's midpoint stays at the actual tick.
const STACK_OFFSET_PX = 8

// ── Timeline strip ──────────────────────────────────────────────────────────
function BattleTimeline() {
  const { tickValue, playerUnits, enemies, activeUnitIds, scrollBounds, historyEntries, getChipDef, suppressedChipIds } = useBattleScreen()
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

  const allUnits = [...playerUnits, ...enemies]

  // Group live units by tick so we can fan same-tick markers vertically.
  const tickGroups = new Map<number, string[]>()
  for (const unit of allUnits) {
    const ids = tickGroups.get(unit.tickPosition) ?? []
    ids.push(unit.id)
    tickGroups.set(unit.tickPosition, ids)
  }

  // Top value for a unit, offset within its tick group (centered on the tick line).
  function stackedTop(unitId: string, tick: number): number {
    const ids = tickGroups.get(tick) ?? []
    const n   = ids.length
    const i   = ids.indexOf(unitId)
    return tickToTop(tick, scrollBounds.max) + (i - (n - 1) / 2) * STACK_OFFSET_PX
  }

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
            <TimelineMarker name={entry.name} defId={entry.defId} isAlly={entry.isAlly} hpFraction={0} />
          </div>
        ))}
        {/* Live unit markers */}
        {allUnits.map((unit) => {
          const chips = buildChips(unit, getChipDef, suppressedChipIds)
          return (
            <div
              key={unit.id}
              className={[
                styles.marker,
                activeUnitIds.has(unit.id)
                  ? (unit.isAlly ? styles.markerActiveAlly : styles.markerActiveEnemy)
                  : '',
              ].join(' ')}
              style={{ top: stackedTop(unit.id, unit.tickPosition) }}
            >
              <TimelineMarker
                name={unit.name}
                defId={unit.defId}
                isAlly={unit.isAlly}
                hpFraction={unit.maxHp > 0 ? unit.hp / unit.maxHp : 0}
              />
              {chips.length > 0 && (
                <StatusChipBar chips={chips} size="compact" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Status chip bar (leader) ─────────────────────────────────────────────────
function LeaderChipBar() {
  const { leader, getChipDef, suppressedChipIds } = useBattleScreen()
  if (!leader) return null
  const chips = buildChips(leader, getChipDef, suppressedChipIds)
  if (!chips.length) return null
  return (
    <div className={styles.statusSlots}>
      <StatusChipBar chips={chips} size="full" />
    </div>
  )
}

// ── Player portrait panel ───────────────────────────────────────────────────
// HUD binds to a single controlled unit — the leader. AI allies fight alongside
// but never appear in the action HUD. Mode-dependent control: the default is
// 'single' (one HUD slot); a future 'all' mode could swap which leader is shown
// per active tick, but only ever one slot is rendered here.
function PortraitPanel() {
  const { turnNumber, tickValue, leader } = useBattleScreen()
  if (!leader) return null
  return (
    <div className={styles.portrait}>
      <span className={styles.turnLabel}>Turn {turnNumber}</span>
      <span className={styles.tickLabel}>Tick: {tickValue}</span>
      <div className={`${styles.unitEntry} ${styles.unitEntryActive}`}>
        <div className={styles.portraitCircle}>
          <span className={styles.portraitInitial}>{leader.name.charAt(0)}</span>
          <img
            src={characterPortraitUrl(leader.defId)}
            alt=""
            className={styles.portraitImg}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <span className={styles.lvlBadge}>{leader.className} ★{leader.rarity}</span>
        <div className={styles.barRow}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>HP</span>
            <span className={styles.barValue}>{leader.hp}/{leader.maxHp}</span>
          </div>
          <ResourceBar variant="hp" value={leader.hp} max={leader.maxHp} />
        </div>
        <div className={styles.barRow}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>AP</span>
            <span className={styles.barValue}>{leader.ap}/{leader.maxAp}</span>
          </div>
          <ResourceBar variant="ap" value={leader.ap} max={leader.maxAp} />
        </div>
      </div>
    </div>
  )
}

// ── Action grid ─────────────────────────────────────────────────────────────
function ActionGrid() {
  const {
    phase, gridCollapsed, toggleGrid,
    activePlayerUnit, getUnitSkills, selectedSkill, selectedTarget, selectSkill, skipTurn,
    setInspectingSkill, hyperSenseModeActive,
  } = useBattleScreen()
  const createHandler = useScrollAwarePointer()
  const disabled = phase !== 'player'

  const playerSkills  = activePlayerUnit ? getUnitSkills(activePlayerUnit.id) : []
  const basicSkill    = playerSkills.find(s => s.baseDef.tags.includes('basic')) ?? null
  const activeSkills  = playerSkills.filter(s => !s.baseDef.tags.includes('basic'))

  // Pad skill list to always show 4 slots.
  const slots = Array.from({ length: 4 }, (_, i) => activeSkills[i] ?? null)

  return (
    <div className={[styles.actionGrid, phase === 'player' ? styles.actionGridActive : ''].join(' ')}>
      {!gridCollapsed && (
        <>
          <div className={styles.actionRow}>
            {basicSkill && (() => {
              const isSelected  = selectedSkill?.defId === basicSkill.defId
              const tapHandler  = !disabled ? () => selectSkill(isSelected ? null : basicSkill) : undefined
              const holdHandler = () => setInspectingSkill(basicSkill)
              const targetLabel = isSelected && selectedTarget ? selectedTarget.name : null
              return (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnBasic} ${isSelected ? styles.skillBtnSelected : ''}`}
                  onPointerDown={createHandler({ onTap: tapHandler, onHold: holdHandler })}
                  aria-disabled={disabled}
                >
                  <span className={styles.actionBtnName}>Attack</span>
                  <span className={styles.skillTu}>TU: {basicSkill.cachedCosts.tuCost}</span>
                  {targetLabel && <span className={styles.skillTargetBadge}>→ {targetLabel}</span>}
                </button>
              )
            })()}
            <button className={`${styles.actionBtn} ${styles.actionBtnEnd}`} onPointerDown={createHandler({ onTap: skipTurn })} disabled={disabled}>
              <span className={styles.actionBtnName}>End/Skip</span>
            </button>
          </div>
          <div className={styles.skillRows}>
            {slots.map((skillInst, i) => {
              const hasSkill    = skillInst !== null
              const isSelected  = hasSkill && selectedSkill?.defId === skillInst.defId
              const isHyperSlot = hasSkill && hyperSenseModeActive && skillInst.baseDef.id === 'hugo_001_hyper_sense'
              const tuCost      = hasSkill ? (isHyperSlot ? 6  : skillInst.cachedCosts.tuCost) : null
              const name        = hasSkill ? (isHyperSlot ? 'Hyper Sense ★' : skillInst.baseDef.name) : '—'
              const onCooldown  = hasSkill && !!activePlayerUnit && isOnCooldown(activePlayerUnit, skillInst)
              const tagBlocked  = hasSkill && !!activePlayerUnit && isSkillTagBlocked(activePlayerUnit, skillInst.baseDef.tags)
              const tickCD     = onCooldown && activePlayerUnit ? ticksRemaining(activePlayerUnit, skillInst) : 0
              const turnCD     = onCooldown && activePlayerUnit ? turnsRemaining(activePlayerUnit, skillInst) : 0
              const isDisabled = !hasSkill || disabled || onCooldown || tagBlocked
              // Show selected target name on the active skill button.
              const targetLabel = isSelected && selectedTarget ? selectedTarget.name : null
              const tapHandler = (hasSkill && !disabled && !onCooldown && !tagBlocked)
                ? () => selectSkill(isSelected ? null : skillInst)
                : undefined
              const holdHandler = hasSkill
                ? () => setInspectingSkill(skillInst)
                : undefined
              return (
                <button
                  key={i}
                  className={[
                    styles.skillBtn,
                    (!hasSkill || disabled) ? styles.skillBtnDisabled : '',
                    onCooldown              ? styles.skillBtnCooldown  : '',
                    tagBlocked              ? styles.skillBtnBlocked   : '',
                    isSelected              ? styles.skillBtnSelected  : '',
                  ].join(' ')}
                  // Note: no `disabled` attribute — long-press for skill info must
                  // work even on cooldown / off-turn. Tap is gated inside tapHandler.
                  aria-disabled={isDisabled}
                  onPointerDown={hasSkill ? createHandler({ onTap: tapHandler, onHold: holdHandler }) : undefined}
                >
                  <span className={styles.skillName}>{name}</span>
                  <span className={styles.skillLvl}>Lv {skillInst?.currentLevel ?? '—'}</span>
                  <span className={styles.skillTu}>{tuCost !== null ? `TU: ${tuCost}` : 'TU: —'}</span>
                  <span className={styles.skillChrg}>{hasSkill ? `Lv${skillInst.baseDef.maxLevel}` : '×—'}</span>
                  {onCooldown && (
                    <span className={styles.skillCdBadgeRow}>
                      {tickCD > 0 && (
                        <span className={`${styles.skillCdChip} ${styles.skillCdChipTick}`}>
                          ⏳ {tickCD}t
                        </span>
                      )}
                      {turnCD > 0 && (
                        <span className={`${styles.skillCdChip} ${styles.skillCdChipTurn}`}>
                          ↻ {turnCD}
                        </span>
                      )}
                    </span>
                  )}
                  {targetLabel && (
                    <span className={styles.skillTargetBadge}>→ {targetLabel}</span>
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
// Appears above the portrait when a skill is selected AND a target is ready.
// Single-target skills require the player to confirm a target first.
// Auto-targeting skills (all-enemies, etc.) show ROLL immediately on skill select.
function RollButton() {
  const { selectedSkill, selectedTarget, showTargetPicker, phase, executeSkill, selectSkill } = useBattleScreen()
  const createHandler = useScrollAwarePointer()
  const [isRolling, setIsRolling] = useState(false)
  const rollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (rollTimerRef.current) clearTimeout(rollTimerRef.current)
  }, [])

  if (!selectedSkill || phase !== 'player') return null
  // Single-target: hide ROLL while the picker is open or no target is chosen yet.
  const skillDef      = getCachedSkill(selectedSkill)
  const needsTarget   = skillDef.targeting.selector === 'enemy'
  const targetReady   = !needsTarget || (selectedTarget !== null && !showTargetPicker)
  if (!targetReady) return null

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

// ── Target select overlay ────────────────────────────────────────────────────
// Centered modal — only shown when 2+ enemies are alive for a single-target skill.
// Auto-confirms if enemies die while the picker is open and only 1 remains.
function TargetSelectOverlay() {
  const { showTargetPicker, enemies, selectedSkill, selectTarget, selectSkill } = useBattleScreen()
  const createHandler = useScrollAwarePointer()

  const aliveEnemies = enemies.filter(isAlive)

  // Auto-confirm the last surviving enemy while picker is open.
  useEffect(() => {
    if (showTargetPicker && aliveEnemies.length === 1) {
      selectTarget(aliveEnemies[0])
    }
  }, [showTargetPicker, aliveEnemies.length]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!showTargetPicker || !selectedSkill) return null

  return (
    <div className={styles.targetPickerOverlay}>
      <div className={styles.targetPickerCard}>
        <div className={styles.targetPickerHeader}>
          <span className={styles.targetPickerTitle}>SELECT TARGET</span>
          <button
            className={styles.targetPickerCancel}
            onPointerDown={createHandler({ onTap: () => selectSkill(null) })}
          >
            ✕
          </button>
        </div>
        <div className={styles.targetPickerList}>
          {aliveEnemies.map((enemy) => (
            <button
              key={enemy.id}
              className={styles.targetPickerRow}
              onPointerDown={createHandler({ onTap: () => selectTarget(enemy) })}
            >
              <span className={styles.targetPickerName}>{enemy.name}</span>
              <span className={styles.targetPickerHp}>{enemy.hp}/{enemy.maxHp} HP</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Battle layout ───────────────────────────────────────────────────────────
function BattleLayout() {
  const { arenaRef, isPaused, setPaused, isLoading, playerUnits, diceResult, skipDice, inspectingSkill, setInspectingSkill } = useBattleScreen()
  const navigate    = useNavigate()
  const lastBackRef = useRef(0)
  const createHandler = useScrollAwarePointer()
  const [logOpen, setLogOpen] = useState(false)
  useScreen()

  // Redirect silently to pre-battle if no team was confirmed (direct URL access, etc.).
  useEffect(() => {
    if (!isLoading && playerUnits.length === 0) {
      navigate(SCREEN_REGISTRY[SCREEN_IDS.PRE_BATTLE].path, { replace: true })
    }
  }, [isLoading, playerUnits, navigate])

  // Bounded pause loop: back → pause, back → resume. Never navigates away.
  // Log overlay intercepts back before the pause handler so it closes first.
  // Guards: (1) no-op during load, (2) 300ms debounce, (3) functional update avoids stale closure.
  useBackButton(() => {
    if (isLoading) return
    const now = Date.now()
    if (now - lastBackRef.current < BACK_DEBOUNCE_MS) return
    lastBackRef.current = now
    if (inspectingSkill) { setInspectingSkill(null); return }
    if (logOpen) { setLogOpen(false); return }
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
      {logOpen && <BattleLogOverlay onClose={() => setLogOpen(false)} />}
      {inspectingSkill && <SkillInfoOverlay skill={inspectingSkill} onClose={() => setInspectingSkill(null)} />}
      <CounterPromptOverlay />
      <TargetSelectOverlay />
      <ClashQteOverlay />
      <TeamCollisionOverlay />
      <HintToaster id="battle-skill"  message="Tap a skill, then ROLL to attack." />
      <HintToaster id="battle-inspect" message="Long-press any skill to see its full details." position="bottom" />
      {diceResult && (
        <HintToaster id="battle-skip-dice" message="Tap the canvas to skip the dice animation." position="bottom" />
      )}
      <BattleTimeline />
      <div className={styles.main}>
        <div className={styles.arenaWrap}>
          <BattleArena ref={arenaRef} />
          {diceResult && (
            <button
              className={styles.diceSkipHotzone}
              onPointerDown={createHandler({ onTap: skipDice })}
              aria-label="Skip dice animation"
            >
              <span className={styles.diceSkipHint}>TAP TO SKIP</span>
            </button>
          )}
        </div>
        <div className={styles.logButtonRow}>
          <button
            className={styles.logButton}
            onPointerDown={createHandler({ onTap: () => setLogOpen(true) })}
          >
            BATTLE LOG
          </button>
        </div>
        <LeaderChipBar />
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
