// Battle screen — core gameplay view.
// Layout: 48dp tick stream (left) + main area (right).
// Child components read from BattleContext via useBattleScreen().

import { useRef, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScreenShell } from '../navigation/ScreenShell'
import { useScreen } from '../navigation/useScreen'
import { SCREEN_REGISTRY, SCREEN_IDS } from '../navigation/screenRegistry'
import { useBackButton } from '../input/useBackButton'
import { useScrollAwarePointer } from '../utils/useScrollAwarePointer'
import { SpriteArena as BattleArena } from '../components/SpriteArena'
import { Toaster } from '../components/Toaster'
import { HintQueue } from '../components/HintQueue'
import { PromptOverlay } from '../components/PromptOverlay'
import { Sheet } from '../components/Sheet'
import { DiceRoll } from '../components/DiceRoll'
import { OutcomeBand } from '../components/OutcomeBand'
import { forecastOutcomes, forecastApGain } from '../core/combat/OutcomeForecast'
import { BattleProvider, useBattleScreen } from './BattleContext'
import { StatusInfoOverlay }               from './StatusInfoOverlay'
import { BattleErrorToast } from './BattleErrorToast'
import { BattleLogOverlay } from './BattleLogOverlay'
import { ClashQteOverlay } from './ClashQteOverlay'
import { ClashBanner } from './ClashBanner'
import { TeamCollisionOverlay } from './TeamCollisionOverlay'
import { SkillInfoOverlay } from './SkillInfoOverlay'
import { isOnCooldown, ticksRemaining, turnsRemaining } from '../core/combat/CooldownResolver'
import { BACK_DEBOUNCE_MS, AP_WARN_SHAKE_MS, AP_WARN_DISMISS_MS } from '../core/constants'
import { getCachedSkill } from '../core/engines/skill/SkillInstance'
import { isAlive, isSkillTagBlocked } from '../core/unit'
import { ResourceBar } from '../components/ResourceBar'
import { TimelineStrip } from '../components/TimelineStrip'
import { chipsForUnit } from '../components/statusChips'
import { StatusChipBar } from '../components/StatusChipBar'
import type { StatusChipData } from '../components/StatusChipBar'
import { SoundService } from '../services/SoundService'
import { UnitPortrait } from '../components/UnitPortrait'
import type { TurnDisplayUnitData } from '../core/battle/EngineTypes'
import styles from './BattleScreen.module.css'

// ── Tick stream ─────────────────────────────────────────────────────────────
// Thin adaptor: reads the battle context and hands the strip plain data, so
// TimelineStrip itself stays presentational and testable.
function BattleTimelineStrip() {
  const {
    tickValue, playerUnits, enemies, activeUnitIds, registeredTicks, scrollBounds,
    historyEntries, getChipDef, suppressedChipIds, setInspectingChip,
    selectedSkill, activePlayerUnit, displacement, turnDisplay,
  } = useBattleScreen()

  // Intent is only knowable for the unit whose action is currently telegraphed;
  // the engine does not plan further ahead than that, so nothing else is guessed.
  const actingUnit = [...playerUnits, ...enemies].find(u => activeUnitIds.has(u.id)) ?? null
  const intent = turnDisplay && actingUnit
    ? { unitId: actingUnit.id, tuCost: turnDisplay.tuCost }
    : null

  return (
    <TimelineStrip
      tickValue={tickValue}
      units={[...playerUnits, ...enemies]}
      activeUnitIds={activeUnitIds}
      registeredTicks={registeredTicks}
      scrollBounds={scrollBounds}
      historyEntries={historyEntries}
      projectedTick={selectedSkill && activePlayerUnit
        ? activePlayerUnit.tickPosition + selectedSkill.cachedCosts.tuCost : null}
      projectingId={activePlayerUnit?.id ?? null}
      displacement={displacement}
      intent={intent}
      resolveChip={getChipDef}
      suppressedChipIds={suppressedChipIds}
      onChipTap={setInspectingChip}
    />
  )
}

// ── Status chip bar (leader) ─────────────────────────────────────────────────
function LeaderChipBar({ onTap }: { onTap: (chip: StatusChipData) => void }) {
  const { leader, getChipDef, suppressedChipIds } = useBattleScreen()
  if (!leader) return null
  const chips = chipsForUnit(leader, getChipDef, suppressedChipIds)
  if (!chips.length) return null
  return (
    <div className={styles.statusSlots}>
      <StatusChipBar chips={chips} size="full" onTap={onTap} />
    </div>
  )
}

// ── Player portrait panel ───────────────────────────────────────────────────
// HUD binds to a single controlled unit — the leader. AI allies fight alongside
// but never appear in the action HUD. Mode-dependent control: the default is
// 'single' (one HUD slot); a future 'all' mode could swap which leader is shown
// per active tick, but only ever one slot is rendered here.
function PortraitPanel() {
  const { turnNumber, tickValue, leader, getChipDef, suppressedChipIds } = useBattleScreen()
  if (!leader) return null

  const leaderShieldHp = leader.statusSlots
    .filter(s => typeof s.payload?.shieldHp === 'number' && (s.payload.shieldHp as number) > 0)
    .reduce((sum, s) => sum + (s.payload.shieldHp as number), 0)

  // Portrait glow: first active chip with portraitGlow=true drives the ring colour.
  const glowColour = leader.statusSlots.reduce<string | null>((found, slot) => {
    if (found || suppressedChipIds.has(slot.id)) return found
    const chip = getChipDef(slot.id)
    return chip?.portraitGlow ? chip.colour : found
  }, null)

  const portraitGlowStyle = glowColour ? {
    borderColor: glowColour,
    boxShadow:   `0 0 8px ${glowColour}, 0 0 20px ${glowColour}55, inset 0 0 14px ${glowColour}18`,
  } : undefined

  // SVG arc ring: r=52 inside a 110×110 viewBox so the stroke sits just outside
  // the 100dp portrait circle. strokeDasharray uses circumference = 2π×52 ≈ 326.7.
  const ARC_R           = 52
  const ARC_CIRC        = 2 * Math.PI * ARC_R
  const secPct          = Math.max(0, Math.min(100, leader.secondaryResource)) / 100
  const secDash         = secPct * ARC_CIRC

  return (
    <div className={styles.portrait}>
      <span className={styles.turnLabel}>Turn {turnNumber}</span>
      <span className={styles.tickLabel}>Tick: {tickValue}</span>
      <div className={`${styles.unitEntry} ${styles.unitEntryActive}`}>
        <div className={styles.portraitWrap}>
          <div className={styles.portraitCircle} style={portraitGlowStyle}>
            <UnitPortrait name={leader.name} rarity={leader.rarity} defId={leader.defId} size="lg" />
          </div>
          {leader.secondaryResource > 0 && (
            <>
              <svg
                className={styles.secondaryArc}
                viewBox="0 0 110 110"
                aria-hidden="true"
              >
                {/* Track ring */}
                <circle
                  cx="55" cy="55" r={ARC_R}
                  fill="none"
                  strokeWidth="3"
                  stroke="var(--bg-elevated)"
                />
                {/* Fill arc — starts at top (−90°) */}
                <circle
                  cx="55" cy="55" r={ARC_R}
                  fill="none"
                  strokeWidth="3"
                  stroke="var(--accent-info)"
                  strokeLinecap="round"
                  strokeDasharray={`${secDash} ${ARC_CIRC}`}
                  transform="rotate(-90 55 55)"
                  style={{ filter: 'drop-shadow(0 0 3px var(--accent-info))' }}
                />
              </svg>
              <span className={styles.secondaryLabel}>
                {Math.round(leader.secondaryResource)}
              </span>
            </>
          )}
        </div>
        <span className={styles.lvlBadge}>{leader.name} ★{leader.rarity}</span>
        <div className={styles.barRow}>
          <div className={styles.barHeader}>
            <span className={styles.barLabel}>HP</span>
            <span className={styles.barValue}>{leader.hp}/{leader.maxHp}</span>
          </div>
          <ResourceBar variant="hp" value={leader.hp} max={leader.maxHp} shieldHp={leaderShieldHp} />
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
    setInspectingSkill, hyperSenseModeActive, tickValue,
    playerUnits, enemies, activeUnitIds,
  } = useBattleScreen()
  const createHandler = useScrollAwarePointer()
  const disabled = phase !== 'player'

  const [apWarning, setApWarning]   = useState<{ needed: number; have: number } | null>(null)
  const [shakingKey, setShakingKey] = useState<string | null>(null)
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current)
  }, [])

  const triggerApWarning = (apCost: number, key: string) => {
    if (!activePlayerUnit) return
    if (shakeTimer.current) clearTimeout(shakeTimer.current)
    SoundService.playSfx('ap_short')
    setApWarning({ needed: apCost, have: activePlayerUnit.ap })
    setShakingKey(key)
    shakeTimer.current = setTimeout(() => setShakingKey(null), AP_WARN_SHAKE_MS)
    // Dismissal is the Toaster's job — it clears apWarning via onDismiss.
  }

  const playerSkills  = activePlayerUnit ? getUnitSkills(activePlayerUnit.id) : []
  const basicSkill    = playerSkills.find(s => s.baseDef.tags.includes('basic')) ?? null
  const activeSkills  = playerSkills.filter(s => !s.baseDef.tags.includes('basic'))

  // Pad skill list to always show 4 slots.
  const slots = Array.from({ length: 4 }, (_, i) => activeSkills[i] ?? null)

  // Off-turn the grid has no unit to bind to, so every card renders as an em
  // dash. With AI allies that happens constantly and reads as a broken screen
  // rather than "someone else is acting", so name who has the tick.
  const actingElsewhere = !activePlayerUnit
    ? [...playerUnits, ...enemies].find(u => activeUnitIds.has(u.id)) ?? null
    : null

  return (
    <div className={[styles.actionGrid, phase === 'player' ? styles.actionGridActive : ''].join(' ')}>
      <Toaster
        message={apWarning ? `Need ${apWarning.needed} AP · have ${apWarning.have}` : null}
        tone="warn"
        position="inline"
        durationMs={AP_WARN_DISMISS_MS}
        dismissible={false}
        onDismiss={() => setApWarning(null)}
      />
      {actingElsewhere && (
        <span className={styles.waitingFor}>
          {actingElsewhere.name} is acting
        </span>
      )}
      {!gridCollapsed && (
        <>
          <div className={styles.actionRow}>
            {basicSkill && (() => {
              const isSelected     = selectedSkill?.defId === basicSkill.defId
              const notEnoughAp    = !!activePlayerUnit && basicSkill.cachedCosts.apCost > activePlayerUnit.ap
              const tapHandler     = !disabled
                ? (notEnoughAp
                  ? () => triggerApWarning(basicSkill.cachedCosts.apCost, 'basic')
                  : () => { SoundService.playSfx('select'); selectSkill(isSelected ? null : basicSkill) })
                : undefined
              const holdHandler = () => setInspectingSkill(basicSkill)
              const targetLabel = isSelected && selectedTarget ? selectedTarget.name : null
              return (
                <button
                  className={[
                    styles.actionBtn, styles.actionBtnBasic,
                    isSelected    ? styles.skillBtnSelected : '',
                    notEnoughAp   ? styles.skillBtnApShort  : '',
                    shakingKey === 'basic' ? styles.skillBtnShake : '',
                  ].join(' ')}
                  onPointerDown={createHandler({ onTap: tapHandler, onHold: holdHandler })}
                  aria-disabled={disabled || notEnoughAp}
                >
                  <span className={styles.actionBtnName}>Attack</span>
                  <span className={styles.actionBtnMeta}>TU: {basicSkill.cachedCosts.tuCost} · AP: {basicSkill.cachedCosts.apCost}</span>
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
              const notEnoughAp = hasSkill && !!activePlayerUnit && skillInst.cachedCosts.apCost > activePlayerUnit.ap
              const tickCD      = onCooldown && activePlayerUnit ? ticksRemaining(activePlayerUnit, skillInst) : 0
              const turnCD      = onCooldown && activePlayerUnit ? turnsRemaining(activePlayerUnit, skillInst) : 0
              const isDisabled  = !hasSkill || disabled || onCooldown || tagBlocked || notEnoughAp
              // Show selected target name on the active skill button.
              const targetLabel = isSelected && selectedTarget ? selectedTarget.name : null
              const canTap      = hasSkill && !disabled && !onCooldown && !tagBlocked
              // Same helper the resolver rolls against, so the strip cannot lie.
              const odds        = hasSkill && activePlayerUnit
                ? forecastOutcomes(activePlayerUnit, skillInst.baseDef) : null
              const apBack      = hasSkill && activePlayerUnit && tuCost !== null
                ? forecastApGain(activePlayerUnit, tuCost, tickValue) : 0
              const tapHandler  = canTap
                ? (notEnoughAp
                  ? () => triggerApWarning(skillInst.cachedCosts.apCost, String(i))
                  : () => { SoundService.playSfx('select'); selectSkill(isSelected ? null : skillInst) })
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
                    notEnoughAp             ? styles.skillBtnApShort   : '',
                    isSelected              ? styles.skillBtnSelected  : '',
                    shakingKey === String(i) ? styles.skillBtnShake    : '',
                  ].join(' ')}
                  // Note: no `disabled` attribute — long-press for skill info must
                  // work even on cooldown / off-turn. Tap is gated inside tapHandler.
                  aria-disabled={isDisabled}
                  onPointerDown={hasSkill ? createHandler({ onTap: tapHandler, onHold: holdHandler }) : undefined}
                >
                  <span className={styles.skillName}>{name}</span>
                  <span className={styles.skillLvl}>Lv {skillInst?.currentLevel ?? '—'}</span>
                  <span className={styles.skillMeta}>
                    <span className={styles.skillTu}>{tuCost !== null ? `TU: ${tuCost}` : 'TU: —'}</span>
                    <span className={styles.skillAp}>
                      {hasSkill ? `AP: ${skillInst.cachedCosts.apCost}` : '—'}
                      {apBack > 0 && <span className={styles.skillApBack}> +{apBack}</span>}
                    </span>
                  </span>
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
                  {odds && (
                    <span className={styles.skillOdds}>
                      <OutcomeBand probabilities={odds} size="card" />
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
  return (
    <PromptOverlay
      title="PAUSED"
      actions={[
        { label: 'RESUME', onPress: () => setPaused(false) },
        { label: 'LEAVE BATTLE', variant: 'danger', onPress: () => navigate(SCREEN_REGISTRY[SCREEN_IDS.MAIN_MENU].path) },
      ]}
    />
  )
}

// ── Counter prompt overlay ───────────────────────────────────────────────────
// Appears when counter roll succeeds for the player — choose to fire or skip.
// Counter reactions bypass cooldown: whichever skill is offered fires freely.
function CounterPromptOverlay() {
  const { pendingCounterDecision, confirmCounter, skipCounter } = useBattleScreen()
  if (!pendingCounterDecision) return null

  const { counterSkill } = pendingCounterDecision
  const skillName = counterSkill.baseDef.name
  const apCost    = counterSkill.cachedCosts.apCost

  return (
    <PromptOverlay
      title="COUNTER OPPORTUNITY!"
      subtitle={skillName}
      actions={[
        { label: 'COUNTER', onPress: confirmCounter },
        { label: 'SKIP', variant: 'secondary', onPress: skipCounter },
      ]}
    >
      <span className={styles.counterPromptCost}>AP: {apCost}</span>
    </PromptOverlay>
  )
}

// ── Target select overlay ────────────────────────────────────────────────────
// Centered modal — only shown when 2+ enemies are alive for a single-target skill.
// Auto-confirms if enemies die while the picker is open and only 1 remains.
function TargetSelectOverlay() {
  const { showTargetPicker, enemies, selectedSkill, selectTarget, selectSkill, getChipDef, suppressedChipIds, setInspectingChip } = useBattleScreen()
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
    <Sheet title="SELECT TARGET" placement="centre" onClose={() => selectSkill(null)}>
      <div className={styles.targetPickerList}>
        {aliveEnemies.map((enemy) => {
          const chips  = chipsForUnit(enemy, getChipDef, suppressedChipIds)
          return (
            <button
              key={enemy.id}
              className={styles.targetPickerRow}
              onPointerDown={createHandler({ onTap: () => selectTarget(enemy) })}
            >
              <div className={styles.targetPickerInfo}>
                <div className={styles.targetPickerTopRow}>
                  <span className={styles.targetPickerName}>{enemy.name}</span>
                  <span className={styles.targetPickerHpText}>{enemy.hp}/{enemy.maxHp}</span>
                </div>
                <ResourceBar variant="hp" value={enemy.hp} max={enemy.maxHp} />
                {chips.length > 0 && (
                  <StatusChipBar chips={chips} size="compact" onTap={setInspectingChip} />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

// ── Battle layout ───────────────────────────────────────────────────────────
function BattleLayout() {
  const { arenaRef, isPaused, setPaused, isLoading, playerUnits, diceResult, diceForecast, displacement, skipDice, inspectingSkill, setInspectingSkill, battleError, leader, getChipDef, suppressedChipIds, inspectingChip, setInspectingChip } = useBattleScreen()
  const navigate    = useNavigate()
  const lastBackRef = useRef(0)
  const createHandler = useScrollAwarePointer()
  const [logOpen, setLogOpen] = useState(false)
  useScreen()

  // Live player figure info — mirrors portrait panel data in the acting arena column.
  const playerFigureInfo = useMemo<TurnDisplayUnitData | undefined>(() => {
    if (!leader) return undefined
    const shieldHp = leader.statusSlots
      .filter(s => typeof s.payload?.shieldHp === 'number' && (s.payload.shieldHp as number) > 0)
      .reduce((sum, s) => sum + (s.payload.shieldHp as number), 0)
    return {
      name:              leader.name,
      className:         leader.className,
      rarity:            leader.rarity,
      hp:                leader.hp,
      maxHp:             leader.maxHp,
      ap:                leader.ap,
      maxAp:             leader.maxAp,
      secondaryResource: leader.secondaryResource,
      statusSlots:       leader.statusSlots
        .filter(s => !suppressedChipIds.has(s.id))
        .map(s => ({ id: s.id, name: s.name, stacks: s.stacks, duration: s.duration })),
      shieldHp,
    }
  }, [leader, suppressedChipIds])

  // Which defIds belong to the player's side — the arena uses this to decide
  // which slot a combatant occupies, so an acting enemy never lands in the
  // lower-left ally position.
  const allyDefIds = useMemo(
    () => new Set(playerUnits.map((u) => u.defId)),
    [playerUnits],
  )

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
    if (inspectingChip)  { setInspectingChip(null);  return }
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
      {battleError && (
        <BattleErrorToast
          message={battleError}
          onLeave={() => navigate(SCREEN_REGISTRY[SCREEN_IDS.MAIN_MENU].path, { replace: true })}
        />
      )}
      {isPaused && <PauseOverlay />}
      {logOpen && <BattleLogOverlay onClose={() => setLogOpen(false)} />}
      {inspectingSkill && <SkillInfoOverlay skill={inspectingSkill} onClose={() => setInspectingSkill(null)} />}
      {inspectingChip  && <StatusInfoOverlay chip={inspectingChip} onClose={() => setInspectingChip(null)} />}
      <CounterPromptOverlay />
      <TargetSelectOverlay />
      <ClashBanner />
      <ClashQteOverlay />
      <TeamCollisionOverlay />
      {/* One at a time — rendered together these fired simultaneously and
          stacked unreadably on first entry. */}
      <HintQueue
        hints={[
          { id: 'battle-skill',     message: 'Tap a skill, then ROLL to attack.' },
          { id: 'battle-inspect',   message: 'Long-press any skill to see its full details.', position: 'bottom' },
          ...(diceResult ? [{ id: 'battle-skip-dice', message: 'Tap the arena to skip the roll.', position: 'bottom' as const }] : []),
        ]}
      />
      {/* Displacement is an event, not a hint — it interrupts on purpose and is
          not queued behind first-run copy. The strip shows the landing; this
          names the cause, which will not fit on a 48 dp strip. */}
      <Toaster
        key={displacement?.key}
        message={displacement ? `Tick ${displacement.fromTick} was full — shoved to ${displacement.toTick}` : null}
        tone="warn"
      />
      <BattleTimelineStrip />
      <div className={styles.main}>
        <div className={styles.arenaWrap}>
          <BattleArena
            ref={arenaRef}
            playerFigureInfo={playerFigureInfo}
            allyDefIds={allyDefIds}
            resolveChip={getChipDef}
            onChipTap={setInspectingChip}
          />
          {diceResult && (
            <button
              className={styles.diceSkipHotzone}
              onPointerDown={createHandler({ onTap: skipDice })}
              aria-label="Skip dice roll"
            >
              {/* The band is the player's own committed odds. Enemy rolls have no
                  forecast (the player chose nothing), so they get the callout only. */}
              {diceForecast && (
                <DiceRoll
                  key={diceResult.animKey}
                  probabilities={diceForecast}
                  outcome={diceResult.outcome}
                />
              )}
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
        <LeaderChipBar onTap={setInspectingChip} />
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
