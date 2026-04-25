// Screen-local context for the Battle screen.
// Ephemeral within-session state: units, log, tick timeline, skill execution.
// The global Zustand store is NOT written during battle frames — only on end.

import {
  createContext, useContext, useState, useCallback,
  useMemo, useEffect, useRef, type ReactNode,
} from 'react'
import type { Unit, StatusEffect } from '../core/types'
import type { SkillInstance, BattleState as EngineBattleState, EffectContext } from '../core/effects/types'
import { TIMELINE_BUFFER_TICKS, TIMELINE_FUTURE_RANGE, TURN_DISPLAY_DISMISS_MS, DICE_RESULT_DISMISS_MS, CLASH_ANNOUNCE_MS, ENEMY_AI_DELAY_MS, COUNTER_BASE, COUNTER_STEP, COUNTER_MIN, COUNTER_ANNOUNCE_MS, AI_COUNTER_AP_RESERVE, BATTLE_FEEDBACK_HOLD_MS } from '../core/constants'
import { resolveTickDisplacement } from '../core/combat/TickDisplacer'
import { resolveClashWinner, factionAvgSpeed } from '../core/combat/ClashResolver'
import { createUnit, isAlive, setTickPosition, incrementActionCount } from '../core/unit'
import { calculateStartingTick, advanceTick, calculateApGained } from '../core/combat/TickCalculator'
import { calculateFinalChance, shiftProbabilities } from '../core/combat/HitChanceEvaluator'
import { roll, calculateTumblingDelay, resolveCounterRoll, type DiceOutcome } from '../core/combat/DiceResolver'
import { findCounterSkill, canCounter, isSingleTarget } from '../core/combat/CounterResolver'
import { isOnCooldown, applyCooldown } from '../core/combat/CooldownResolver'
import { applyEffect } from '../core/effects/applyEffect'
import { createSkillInstance, getCachedSkill } from '../core/engines/skill/SkillInstance'
import { loadCharacterWithSkills } from '../services/DataService'
import { NarrativeService } from '../services/NarrativeService'
import { NarrativeUnits }   from '../components/NarrativeLayer'
import type { BattleArenaHandle } from '../components/BattleArena'
import { makeHistoryEntry } from '../core/battleHistory'
import type { HistoryEntry } from '../core/battleHistory'
import { useGameStore } from '../core/GameContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TurnPhase = 'player' | 'enemy' | 'resolving'

export interface DiceResult {
  outcome: DiceOutcome  // 'Boosted' | 'Success' | 'Tumbling' | 'GuardUp' | 'Evasion' | 'Fail'
  message: string       // short flavour description shown below the outcome name
  animKey: number       // incremented on each show; React key for animation retrigger
}

export interface TurnDisplayUnit {
  name:        string
  className:   string
  rarity:      number
  hp:          number
  maxHp:       number
  ap:          number
  maxAp:       number
  statusSlots: StatusEffect[]
}

export interface TurnDisplay {
  actor:      TurnDisplayUnit | null  // null = player-controlled; actor row omitted
  skillName:  string
  tuCost:     number
  apCost:     number
  skillLevel: number
  target:     TurnDisplayUnit
  isAlly:     boolean  // drives accent colour: true = blue, false = red
  animKey:    number   // incremented each show; used as React key to retrigger animation
}

export interface LogEntry {
  id:      string
  text:    string
  colour?: string
}

export interface CounterDecision {
  defender:       Unit
  originalCaster: Unit
  counterSkill:   SkillInstance
  snap:           Map<string, Unit>
  depth:          number
}

export interface ClashState {
  playerUnits: Unit[]
  enemyUnits:  Unit[]
}

export interface TeamCollisionState {
  units:   Unit[]
  choices: Map<string, 'now' | 'later' | null>
}

interface BattleContextValue {
  // Phaser arena handle — set by BattleLayout via <BattleArena ref={arenaRef} />
  arenaRef: React.RefObject<BattleArenaHandle | null>
  // State
  phase:           TurnPhase
  narrativePaused: boolean  // true while a dialogue entry is showing — battle is frozen
  turnNumber:      number   // derived: playerUnit.actionCount + 1
  tickValue:       number
  activeUnitIds:   Set<string>
  playerUnit:      Unit | null
  enemies:         Unit[]
  log:             LogEntry[]
  historyEntries:  HistoryEntry[]
  selectedSkill:   SkillInstance | null
  gridCollapsed:   boolean
  isPaused:        boolean
  isLoading:       boolean
  // Dice result overlay
  diceResult:      DiceResult | null
  // Turn display panel
  turnDisplay:     TurnDisplay | null
  // Counter choice prompt — set when player's counter roll succeeds
  pendingCounterDecision: CounterDecision | null
  // Collision overlays
  pendingClash:            ClashState | null
  pendingTeamCollision:    TeamCollisionState | null
  // Timeline
  registeredTicks: Map<string, number>
  scrollBounds:    { min: number; max: number }
  // Skill access
  getUnitSkills:   (unitId: string) => SkillInstance[]
  // Actions
  executeSkill:          (skill: SkillInstance) => void
  skipTurn:              () => void
  confirmCounter:        () => void
  skipCounter:           () => void
  resolveClash:          (winner: 'player' | 'enemy') => void
  resolveTeamCollision:  (choices: Map<string, 'now' | 'later'>) => void
  registerTick:          (id: string, tick: number) => void
  unregisterTick:  (id: string) => void
  pushHistory:     (entry: HistoryEntry) => void
  setPhase:        (p: TurnPhase) => void
  appendLog:       (entry: Omit<LogEntry, 'id'>) => void
  selectSkill:     (skill: SkillInstance | null) => void
  toggleGrid:      () => void
  setPaused:       (v: boolean | ((prev: boolean) => boolean)) => void
}

const BattleContext = createContext<BattleContextValue | null>(null)

export function useBattleScreen(): BattleContextValue {
  const ctx = useContext(BattleContext)
  if (!ctx) throw new Error('useBattleScreen must be used inside BattleProvider')
  return ctx
}

// ── Battle state adapter ──────────────────────────────────────────────────────

/** Creates a mutable snapshot for the effects engine to operate on. */
function makeSnapshot(playerUnit: Unit | null, enemies: Unit[]): Map<string, Unit> {
  const snap = new Map<string, Unit>()
  if (playerUnit) snap.set(playerUnit.id, { ...playerUnit })
  enemies.forEach((e) => snap.set(e.id, { ...e }))
  return snap
}

function snapshotToBattleState(snap: Map<string, Unit>): EngineBattleState {
  return {
    getUnit:     (id) => snap.get(id),
    setUnit:     (unit) => snap.set(unit.id, unit),
    getAllUnits: () => [...snap.values()],
  }
}

// ── Outcome helpers ───────────────────────────────────────────────────────────

function outcomeColour(outcome: DiceOutcome): string {
  switch (outcome) {
    case 'Boosted':  return 'var(--accent-gold)'
    case 'Tumbling': return 'var(--accent-danger)'
    case 'Evasion':  return 'var(--accent-evasion)'
    case 'Fail':     return 'var(--text-muted)'
    case 'GuardUp':  return 'var(--accent-info)'
    default:         return 'var(--text-primary)'  // Success
  }
}

function buildOutcomeMessage(
  outcome: DiceOutcome,
  actorName: string,
  targetName: string,
  tumbleDelay: number,
): string {
  switch (outcome) {
    case 'Boosted':
      return `${actorName} gets +50% skill value boost until next turn`
    case 'Success':
      return `${actorName} successfully hits`
    case 'GuardUp':
      return `${actorName} hits and gains 35% damage reduction for next attack`
    case 'Evasion':
      return `${targetName} evaded`
    case 'Tumbling':
      return `${actorName} hits with half effectiveness, tumbled for ${tumbleDelay} ticks`
    case 'Fail':
      return `${actorName} misses`
  }
}

// ── Arena feedback helpers ────────────────────────────────────────────────────

function buildFeedbackText(outcome: DiceOutcome, damage: number): string {
  if (outcome === 'Evasion') return 'EVADED!'
  if (outcome === 'Fail')    return 'MISS!'
  if (damage <= 0)           return outcome.toUpperCase()
  const prefix = outcome === 'Boosted' ? '★ ' : ''
  return `${prefix}−${damage} HP`
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface Props { children: ReactNode }

export function BattleProvider({ children }: Props) {
  // ── Core unit state ────────────────────────────────────────────────────────
  const [isLoading, setIsLoading]   = useState(true)
  const [playerUnit, setPlayerUnit] = useState<Unit | null>(null)
  const [enemies, setEnemies]       = useState<Unit[]>([])

  // Per-unit skill instances: Map<unitId, SkillInstance[]>
  const [unitSkillsMap, setUnitSkillsMap] = useState<Map<string, SkillInstance[]>>(
    () => new Map(),
  )

  // Turn display panel — ephemeral, set immediately before/after each action
  const [turnDisplay, setTurnDisplay]   = useState<TurnDisplay | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animKeyRef      = useRef(0)

  // Dice result overlay — shown simultaneously with action resolution
  const [diceResult, setDiceResult]     = useState<DiceResult | null>(null)
  const diceTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const diceKeyRef         = useRef(0)
  const diceResultRef      = useRef<DiceResult | null>(null)   // ref copy — keeps enemy AI current without adding diceResult to its deps
  const diceShowTimeRef    = useRef<number>(0)                 // Date.now() when the last dice animation started
  const applyTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null) // enemy deferred state-apply timer
  const playerApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null) // player deferred state-apply timer

  // ── Other battle state ─────────────────────────────────────────────────────
  const [phase, setPhase]             = useState<TurnPhase>('resolving')
  const [log, setLog]                 = useState<LogEntry[]>([
    { id: '0', text: 'Loading battle…', colour: 'var(--text-muted)' },
  ])
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [selectedSkill, setSelectedSkill]   = useState<SkillInstance | null>(null)
  const [gridCollapsed, setGridCollapsed]   = useState(false)
  const [isPaused, setPaused]               = useState(false)
  const [narrativePaused, setNarrativePaused] = useState(false)
  const arenaRef = useRef<BattleArenaHandle>(null)
  const [pendingCounterDecision, setPendingCounterDecision] = useState<CounterDecision | null>(null)
  const [pendingClash, setPendingClash]               = useState<ClashState | null>(null)
  const [pendingTeamCollision, setPendingTeamCollision] = useState<TeamCollisionState | null>(null)
  // Set to the winner side while the clash-result log entry is briefly shown.
  // Phase is advanced to the winner's side after CLASH_ANNOUNCE_MS.
  const [pendingClashAnnounce, setPendingClashAnnounce] = useState<'player' | 'enemy' | null>(null)
  const clashAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Timeline tick registry — seeded from real unit positions after load.
  const [registeredTicks, setRegisteredTicks] = useState<Map<string, number>>(
    () => new Map(),
  )

  // Ref copy of registeredTicks so registerTick (a useCallback) can read
  // current occupancy synchronously without a stale closure.
  const registeredTicksRef = useRef<Map<string, number>>(new Map())
  useEffect(() => { registeredTicksRef.current = registeredTicks }, [registeredTicks])

  // Global battle clock — starts at 0, auto-advances when all units have acted.
  const [tickValue, setTickValue] = useState(0)

  // ── Load battle data ───────────────────────────────────────────────────────
  useEffect(() => {
    // If no team was confirmed at pre-battle, skip loading — BattleScreen will show a warning.
    const { selectedTeamIds } = useGameStore.getState()
    if (!selectedTeamIds.length) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      try {
        const [playerData, enemyData] = await Promise.all([
          loadCharacterWithSkills(selectedTeamIds[0]),
          loadCharacterWithSkills('hunter_001'),
        ])

        const player = setTickPosition(
          createUnit(playerData.characterDef, true),
          calculateStartingTick(playerData.characterDef.stats.speed, playerData.characterDef.className),
        )
        const enemy = setTickPosition(
          createUnit(enemyData.characterDef, false),
          calculateStartingTick(enemyData.characterDef.stats.speed, enemyData.characterDef.className),
        )

        const playerSkills = playerData.skillDefs.map(createSkillInstance)
        const enemySkills  = enemyData.skillDefs.map(createSkillInstance)

        if (!cancelled) {
          setPlayerUnit(player)
          setEnemies([enemy])
          setUnitSkillsMap(new Map([
            [player.id, playerSkills],
            [enemy.id,  enemySkills],
          ]))
          setRegisteredTicks(new Map([
            [player.id, player.tickPosition],
            [enemy.id,  enemy.tickPosition],
          ]))
          setLog([{ id: '1', text: 'Battle started!', colour: 'var(--accent-genesis)' }])
          setIsLoading(false)
          NarrativeUnits.register([player, enemy])
          NarrativeService.emit({
            type:     'battle_start',
            actorId:  player.defId,
            targetId: enemy.defId,
          })
        }
      } catch (err) {
        console.error('BattleContext: failed to load battle data', err)
        if (!cancelled) {
          setLog([{
            id: 'err',
            text: `Failed to load battle data: ${err instanceof Error ? err.message : String(err)}`,
            colour: 'var(--accent-danger)',
          }])
          setIsLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // ── Turn display helpers ───────────────────────────────────────────────────

  // Shows the action panel and schedules its auto-dismiss.
  // Clears any pending dismiss so a new action replaces the previous display.
  // dismissAfter defaults to TURN_DISPLAY_DISMISS_MS; enemy telegraph passes a
  // longer value (ENEMY_AI_DELAY_MS + DICE_RESULT_DISMISS_MS) to keep the panel
  // visible through the full AI delay + dice animation sequence.
  const showTurnDisplay = useCallback((
    d: Omit<TurnDisplay, 'animKey'>,
    dismissAfter = TURN_DISPLAY_DISMISS_MS,
  ) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    animKeyRef.current += 1
    setTurnDisplay({ ...d, animKey: animKeyRef.current })
    dismissTimerRef.current = setTimeout(
      () => setTurnDisplay(null),
      dismissAfter,
    )
  }, [])

  // Freeze battle while a narrative dialogue is showing.
  useEffect(() => {
    const unsubPause  = NarrativeService.onNarrativePause(()  => setNarrativePaused(true))
    const unsubResume = NarrativeService.onNarrativeResume(() => setNarrativePaused(false))
    return () => { unsubPause(); unsubResume() }
  }, [])

  // Cleanup pending dismiss on unmount.
  useEffect(() => () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
  }, [])

  // Shows the dice outcome burst and schedules its auto-dismiss.
  // Clears any pending dismiss so a rapid new roll replaces the previous display.
  const showDiceResult = useCallback((outcome: DiceOutcome, message: string) => {
    if (diceTimerRef.current) clearTimeout(diceTimerRef.current)
    diceKeyRef.current += 1
    diceShowTimeRef.current = Date.now()   // record start so enemy AI can compute remaining time
    setDiceResult({ outcome, message, animKey: diceKeyRef.current })
    diceTimerRef.current = setTimeout(
      () => setDiceResult(null),
      DICE_RESULT_DISMISS_MS,
    )
  }, [])

  // Cleanup pending dice dismiss on unmount.
  useEffect(() => () => {
    if (diceTimerRef.current) clearTimeout(diceTimerRef.current)
  }, [])

  // Cleanup deferred state-apply timers on unmount.
  useEffect(() => () => {
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current)
    if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
    if (clashAnnounceTimerRef.current) clearTimeout(clashAnnounceTimerRef.current)
  }, [])

  // After clash winner is determined, advance to the winning phase.
  useEffect(() => {
    if (!pendingClashAnnounce) return
    clashAnnounceTimerRef.current = setTimeout(() => {
      setPhase(pendingClashAnnounce === 'player' ? 'player' : 'enemy')
      setPendingClashAnnounce(null)
    }, CLASH_ANNOUNCE_MS)
    return () => {
      if (clashAnnounceTimerRef.current) clearTimeout(clashAnnounceTimerRef.current)
    }
  }, [pendingClashAnnounce])

  // ── Timeline mechanics ─────────────────────────────────────────────────────

  const registerTick = useCallback((id: string, tick: number) => {
    const finalTick = resolveTickDisplacement(tick, registeredTicksRef.current, id)
    setRegisteredTicks((prev) => new Map(prev).set(id, finalTick))
    setPlayerUnit((prev) => prev?.id === id ? { ...prev, tickPosition: finalTick } : prev)
    setEnemies((prev) => prev.map((e) => e.id === id ? { ...e, tickPosition: finalTick } : e))
  }, [])

  const unregisterTick = useCallback((id: string) => {
    setRegisteredTicks((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Auto-advance global clock when all registered units have moved past it.
  useEffect(() => {
    const ticks = [...registeredTicks.values()]
    if (!ticks.length) return
    if (ticks.every((t) => t > tickValue)) setTickValue(Math.min(...ticks))
  }, [registeredTicks, tickValue])

  // Active units: those whose registered tick equals the global clock.
  const activeUnitIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, tick] of registeredTicks) {
      if (tick === tickValue) ids.add(id)
    }
    return ids
  }, [registeredTicks, tickValue])

  // ── Log + history helpers ──────────────────────────────────────────────────
  // Declared here (before phase-derivation) so the phase effect can call appendLog.

  const appendLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [...prev, { ...entry, id: String(Date.now() + Math.random()) }])
  }, [])

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistoryEntries((prev) => [...prev, entry])
  }, [])

  // Derive phase from active unit ids — with collision detection.
  useEffect(() => {
    if (isLoading || activeUnitIds.size === 0) return
    if (narrativePaused) return
    // Don't re-trigger while another resolution is in progress.
    if (pendingClash || pendingTeamCollision || pendingClashAnnounce) return

    const activePlayerUnits = playerUnit && activeUnitIds.has(playerUnit.id) ? [playerUnit] : []
    const activeEnemyUnits  = enemies.filter((e) => activeUnitIds.has(e.id))
    const hasClash          = activePlayerUnits.length > 0 && activeEnemyUnits.length > 0

    if (hasClash) {
      const allActive = [...activePlayerUnits, ...activeEnemyUnits]
      const hasUniqueClash = allActive.some((u) => u.clashUniqueEnabled)

      if (hasUniqueClash) {
        // Unique clash mechanism defined in character data — activate QTE path.
        setPendingClash({ playerUnits: activePlayerUnits, enemyUnits: activeEnemyUnits })
        return
      }

      // Normal clash: resolve by average effective speed + weighted dice on tie.
      const winner       = resolveClashWinner(activePlayerUnits, activeEnemyUnits)
      const winnerUnits  = winner === 'player' ? activePlayerUnits : activeEnemyUnits
      const loserUnits   = winner === 'player' ? activeEnemyUnits  : activePlayerUnits
      const winnerAvg    = Math.round(factionAvgSpeed(winnerUnits))
      const loserAvg     = Math.round(factionAvgSpeed(loserUnits))
      const winnerLabel  = winnerUnits.map((u) => u.name).join(' & ')
      appendLog({
        text:   `CLASH — ${winnerLabel} acts first (avg. speed ${winnerAvg} vs ${loserAvg})`,
        colour: winner === 'player' ? 'var(--accent-info)' : 'var(--accent-danger)',
      })
      winnerUnits.forEach((u) =>
        NarrativeService.emit({ type: 'clash_resolved', actorId: u.defId }),
      )
      setPendingClashAnnounce(winner)
      return
    }

    // Multiple allied player units at the same tick — speed check or Now/Later prompt.
    if (activePlayerUnits.length > 1) {
      const bySpeed = [...activePlayerUnits].sort((a, b) => b.stats.speed - a.stats.speed)
      if (bySpeed[0].stats.speed !== bySpeed[1].stats.speed) {
        setPhase('player')  // fastest acts first, no prompt needed
      } else {
        const choices = new Map(activePlayerUnits.map((u) => [u.id, null as 'now' | 'later' | null]))
        setPendingTeamCollision({ units: activePlayerUnits, choices })
      }
      return
    }

    // Multiple same-team enemies — AI resolves by speed, no player prompt.
    if (activeEnemyUnits.length > 1) {
      setPhase('enemy')
      return
    }

    if (activePlayerUnits.length === 1) {
      setPhase('player')
      const firstEnemy = enemies.find(isAlive)
      if (firstEnemy) arenaRef.current?.setTurnState(playerUnit!.defId, firstEnemy.defId)
    } else if (activeEnemyUnits.length === 1) {
      setPhase('enemy')
      // setTurnState for enemy is called in the AI telegraph below, timed with the delay.
    }
  }, [activeUnitIds, playerUnit, enemies, isLoading, narrativePaused, pendingClash, pendingTeamCollision, pendingClashAnnounce, appendLog])

  // Timeline scroll bounds.
  const scrollBounds = useMemo(() => {
    const ticks = [...registeredTicks.values()]
    const futureFloor = tickValue + TIMELINE_FUTURE_RANGE
    if (!ticks.length) return { min: Math.max(0, tickValue - TIMELINE_BUFFER_TICKS), max: futureFloor }
    return {
      min: Math.max(0, Math.min(...ticks, tickValue) - TIMELINE_BUFFER_TICKS),
      max: Math.max(Math.max(...ticks) + TIMELINE_BUFFER_TICKS, futureFloor),
    }
  }, [registeredTicks, tickValue])

  // ── Core skill execution ───────────────────────────────────────────────────

  // Fresh-value refs so timer callbacks inside enemy AI always see current state.
  const playerUnitRef    = useRef(playerUnit)
  const enemiesRef       = useRef(enemies)
  const unitSkillsMapRef = useRef(unitSkillsMap)
  useEffect(() => { playerUnitRef.current = playerUnit },    [playerUnit])
  useEffect(() => { enemiesRef.current = enemies },          [enemies])
  useEffect(() => { unitSkillsMapRef.current = unitSkillsMap }, [unitSkillsMap])
  useEffect(() => { diceResultRef.current = diceResult },   [diceResult])

  // Refs for mutual recursion between runAttack and scheduleCounterChain.
  // Both useCallbacks reference each other only through these refs so neither
  // has the other in its dependency array.
  const runAttackRef            = useRef<((caster: Unit, target: Unit, skillInst: SkillInstance, snap: Map<string, Unit>, chainDepth?: number) => { tumbleDelay: number; outcome: DiceOutcome; damage: number }) | null>(null)
  const scheduleCounterChainRef = useRef<((defender: Unit, originalCaster: Unit, counterSkill: SkillInstance, snap: Map<string, Unit>, depth: number) => void) | null>(null)

  /** Execute one attack: caster hits target using the given SkillInstance. */
  const runAttack = useCallback((
    caster: Unit,
    target: Unit,
    skillInst: SkillInstance,
    snap: Map<string, Unit>,
    chainDepth = 0,
  ): { tumbleDelay: number; outcome: DiceOutcome; damage: number } => {
    const skill       = getCachedSkill(skillInst)
    const finalChance = calculateFinalChance(caster.stats.precision, skill.resolution?.baseChance ?? 1.0)
    const diceOutcome = roll(shiftProbabilities(finalChance))
    const tumbleDelay = diceOutcome === 'Tumbling' ? calculateTumblingDelay() : 0
    const noDamage    = diceOutcome === 'Evasion' || diceOutcome === 'Fail'

    showDiceResult(diceOutcome, buildOutcomeMessage(diceOutcome, caster.name, target.name, tumbleDelay))
    const targetHpBefore = snap.get(target.id)?.hp ?? target.hp

    NarrativeService.emit({ type: 'skill_used', actorId: caster.defId, targetId: target.defId })
    if (diceOutcome === 'Boosted') {
      NarrativeService.emit({ type: 'boosted_hit', actorId: caster.defId, targetId: target.defId })
    }
    if (diceOutcome === 'Evasion') {
      NarrativeService.emit({ type: 'evaded', actorId: target.defId, targetId: caster.defId })
    }

    const battle = snapshotToBattleState(snap)
    // AP regen for the caster based on ticks elapsed since last action.
    const ticksElapsed = tickValue > 0 ? skill.tuCost : 0
    const apGained     = calculateApGained(ticksElapsed, caster.apRegenRate)
    if (apGained > 0) {
      const casterSnap = snap.get(caster.id)
      if (casterSnap) snap.set(caster.id, { ...casterSnap, ap: Math.min(casterSnap.maxAp, casterSnap.ap + apGained) })
    }

    const ctx: EffectContext = {
      caster,
      target: noDamage ? undefined : target,
      battle,
      source: 'skill',
      event:  { event: 'onCast' },
      dice:   diceOutcome,
    }

    for (const effect of skillInst.cachedEffects) {
      if (effect.when.event === 'onCast') applyEffect(effect, ctx)
    }

    const logMsg =
      diceOutcome === 'Evasion' ? `${target.name} evaded ${skill.name}!` :
      diceOutcome === 'Fail'    ? `${caster.name} missed with ${skill.name}!` :
      `${caster.name} → ${skill.name} on ${target.name} [${diceOutcome}]`
    appendLog({ text: logMsg, colour: outcomeColour(diceOutcome) })

    // Reactive counter: check if the evading unit can counter-attack.
    if (diceOutcome === 'Evasion' && isSingleTarget(skill)) {
      const defenderSnap   = snap.get(target.id) ?? target
      const defenderSkills = unitSkillsMapRef.current.get(target.id) ?? []
      const counterSkill   = findCounterSkill(defenderSkills)
      if (counterSkill && canCounter(defenderSnap, counterSkill)) {
        scheduleCounterChainRef.current?.(defenderSnap, caster, counterSkill, snap, chainDepth)
      }
    }

    const damage = Math.max(0, targetHpBefore - (snap.get(target.id)?.hp ?? targetHpBefore))
    return { tumbleDelay, outcome: diceOutcome, damage }
  }, [tickValue, appendLog, showDiceResult])

  // Keep both refs current so the mutual-recursion closures always see the
  // latest callbacks without adding them to each other's dependency arrays.
  useEffect(() => { runAttackRef.current = runAttack }, [runAttack])

  /** Player confirms the counter prompt — deducts AP and fires the counter attack. */
  const confirmCounter = useCallback(() => {
    if (!pendingCounterDecision) return
    const { defender, originalCaster, counterSkill, snap, depth } = pendingCounterDecision
    setPendingCounterDecision(null)

    const defSnap = snap.get(defender.id) ?? defender
    snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })

    // Brief pause so the overlay visually dismisses before the dice animation starts.
    setTimeout(() => {
      runAttackRef.current?.(defender, originalCaster, counterSkill, snap, depth + 1)
      setTimeout(() => {
        const currentPlayer = playerUnitRef.current
        if (currentPlayer) setPlayerUnit(snap.get(currentPlayer.id) ?? currentPlayer)
        setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
      }, DICE_RESULT_DISMISS_MS)
    }, 200)
  }, [pendingCounterDecision])

  /** Player skips the counter opportunity — no AP spent, no attack fired. */
  const skipCounter = useCallback(() => {
    setPendingCounterDecision(null)
  }, [])

  /** Called by ClashQteOverlay when bar settles — 'player' = player side wins. */
  const resolveClash = useCallback((winner: 'player' | 'enemy') => {
    setPendingClash(null)
    setPhase(winner === 'player' ? 'player' : 'enemy')
  }, [])

  /** Called by TeamCollisionOverlay when all Now/Later choices are collected. */
  const resolveTeamCollision = useCallback((choices: Map<string, 'now' | 'later'>) => {
    setPendingTeamCollision(null)
    choices.forEach((choice, unitId) => {
      if (choice === 'later') {
        const currentTick = registeredTicksRef.current.get(unitId) ?? 0
        registerTick(unitId, currentTick + 1)
      }
    })
    setPhase('player')
  }, [registerTick])

  /** Animate a counter attempt and, on success, present a choice (player) or decide (enemy AI). */
  const scheduleCounterChain = useCallback((
    defender: Unit,
    originalCaster: Unit,
    counterSkill: SkillInstance,
    snap: Map<string, Unit>,
    depth: number,
  ): void => {
    showDiceResult('Evasion', `${defender.name} attempts a counter!`)

    setTimeout(() => {
      const succeeded     = resolveCounterRoll(depth)
      const chancePercent = Math.round(Math.max(COUNTER_MIN, COUNTER_BASE - depth * COUNTER_STEP) * 100)
      showDiceResult(
        succeeded ? 'Success' : 'Fail',
        succeeded ? `Counter! (${chancePercent}% chance)` : 'Counter blocked!',
      )

      if (!succeeded) return

      NarrativeService.emit({ type: 'counter', actorId: defender.defId, targetId: originalCaster.defId })

      if (defender.isAlly) {
        // Player counter — present choice prompt; AP deducted only on confirm.
        // Counter reactions bypass cooldown: no applyCooldown here or in confirmCounter.
        setPendingCounterDecision({ defender, originalCaster, counterSkill, snap, depth })
      } else {
        // Enemy AI counter — fire only if the AP reserve after cost is comfortable.
        const defSnap   = snap.get(defender.id) ?? defender
        const shouldFire = defSnap.ap - counterSkill.cachedCosts.apCost >= AI_COUNTER_AP_RESERVE

        if (shouldFire) {
          snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })
          // Counter reactions bypass cooldown: no applyCooldown called.
          setTimeout(() => {
            runAttackRef.current?.(defender, originalCaster, counterSkill, snap, depth + 1)
            setTimeout(() => {
              const currentPlayer = playerUnitRef.current
              if (currentPlayer) setPlayerUnit(snap.get(currentPlayer.id) ?? currentPlayer)
              setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
            }, DICE_RESULT_DISMISS_MS)
          }, DICE_RESULT_DISMISS_MS)
        }
        // If not firing: the calling flow's deferred snap commit handles evasion state.
      }
    }, COUNTER_ANNOUNCE_MS)
  }, [showDiceResult])

  useEffect(() => { scheduleCounterChainRef.current = scheduleCounterChain }, [scheduleCounterChain])

  /** Player presses ROLL with a skill selected. */
  const executeSkill = useCallback((skillInst: SkillInstance) => {
    if (!playerUnit || phase !== 'player') return
    if (narrativePaused) return
    if (isOnCooldown(playerUnit, skillInst)) return
    const target = enemies.find(isAlive)
    if (!target) return

    const skill = getCachedSkill(skillInst)
    const snap  = makeSnapshot(playerUnit, enemies)
    const { tumbleDelay, outcome, damage } = runAttack(playerUnit, target, skillInst, snap)

    // Apply cooldown immediately at cast time so the badge updates right away.
    const withCooldown = applyCooldown(playerUnit, skillInst, skill)
    setUnitSkillsMap((prev) => {
      const next   = new Map(prev)
      const skills = next.get(playerUnit.id) ?? []
      next.set(playerUnit.id, skills.map((s) => s.defId === skillInst.defId ? withCooldown : s))
      return next
    })

    const fromTick = playerUnit.tickPosition
    const nextTick = advanceTick(fromTick, skill.tuCost + tumbleDelay)

    pushHistory(makeHistoryEntry(playerUnit.id, playerUnit.name, fromTick, playerUnit.isAlly))

    const postTarget = snap.get(target.id) ?? target
    showTurnDisplay({
      actor:      null,
      skillName:  skill.name,
      tuCost:     skill.tuCost,
      apCost:     skill.apCost,
      skillLevel: skillInst.currentLevel,
      target: {
        name:        postTarget.name,
        className:   postTarget.className,
        rarity:      postTarget.rarity,
        hp:          postTarget.hp,
        maxHp:       postTarget.maxHp,
        ap:          postTarget.ap,
        maxAp:       postTarget.maxAp,
        statusSlots: postTarget.statusSlots,
      },
      isAlly: true,
    })

    // Apply state after animations complete: HP bars + timeline marker jump.
    const applyState = () => {
      const updatedPlayer = incrementActionCount(snap.get(playerUnit.id) ?? playerUnit)
      setPlayerUnit(updatedPlayer)
      setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
      registerTick(playerUnit.id, nextTick)

      const snapEnemies = enemies.map((e) => snap.get(e.id) ?? e)
      const deadEnemies = snapEnemies.filter((e) => !isAlive(e))
      deadEnemies.forEach((e) =>
        NarrativeService.emit({ type: 'unit_death', actorId: e.defId }),
      )
      if (snapEnemies.every((e) => !isAlive(e))) {
        appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
        NarrativeService.emit({ type: 'battle_victory' })
      }

      // Stage 4: collapse the dead unit figure before sliding out survivors.
      const arena     = arenaRef.current
      const firstDead = deadEnemies[0]
      if (firstDead && arena) {
        arena.playDeath(firstDead.defId, () => arena.clearTurn())
      } else {
        arenaRef.current?.clearTurn()
      }
    }

    // Phase-gated: dice animation → attack animation → feedback → apply state.
    // Falls back to plain timer when the Phaser canvas is not mounted.
    const arena = arenaRef.current
    if (arena) {
      arena.playDice(outcome, () => {
        arena.playAttack(playerUnit.defId, target.defId, outcome, damage, () => {
          arena.playFeedback(buildFeedbackText(outcome, damage), outcomeColour(outcome))
          if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
          playerApplyTimerRef.current = setTimeout(applyState, BATTLE_FEEDBACK_HOLD_MS)
        })
      })
    } else {
      if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
      playerApplyTimerRef.current = setTimeout(applyState, DICE_RESULT_DISMISS_MS)
    }
  }, [playerUnit, enemies, phase, narrativePaused, runAttack, pushHistory, registerTick, appendLog, showTurnDisplay, setUnitSkillsMap])

  // ── Enemy AI ───────────────────────────────────────────────────────────────
  //
  // Sequencing (full chain):
  //   1. Wait for any player dice animation to finish (remainingDice ms).
  //   2. Show enemy telegraph for ENEMY_AI_DELAY_MS + DICE_RESULT_DISMISS_MS total.
  //   3. After ENEMY_AI_DELAY_MS, fire attack → dice animation starts.
  //   4. After another DICE_RESULT_DISMISS_MS, commit HP/tick state changes.
  //
  // diceResult is intentionally NOT in deps. We read it via diceResultRef so the
  // effect doesn't restart when the enemy's own dice fires during step 3.

  useEffect(() => {
    if (phase !== 'enemy') return
    if (narrativePaused) return
    const activeEnemies = enemiesRef.current.filter(
      (e) => activeUnitIds.has(e.id) && isAlive(e),
    )
    if (!activeEnemies.length) return

    // Compute remaining player-dice animation time (0 if no active dice).
    const remainingDice = diceResultRef.current !== null
      ? Math.max(0, DICE_RESULT_DISMISS_MS - (Date.now() - diceShowTimeRef.current))
      : 0

    // Step 1 + 2: after player dice clears, show telegraph + arena unit stage.
    const telegraphTimer = setTimeout(() => {
      const firstEnemy    = activeEnemies[0]
      const previewSkills = (unitSkillsMapRef.current.get(firstEnemy.id) ?? [])
        .filter((s) => !isOnCooldown(firstEnemy, s))
      const previewTarget = playerUnitRef.current
      // Show enemy (acting) on left, player (target) on right in the arena.
      if (previewTarget) {
        arenaRef.current?.setTurnState(firstEnemy.defId, previewTarget.defId)
      }
      if (previewSkills.length > 0) {
        const previewSkillInst = previewSkills[0]
        const previewSkill     = getCachedSkill(previewSkillInst)
        showTurnDisplay(
          {
            actor: {
              name:        firstEnemy.name,
              className:   firstEnemy.className,
              rarity:      firstEnemy.rarity,
              hp:          firstEnemy.hp,
              maxHp:       firstEnemy.maxHp,
              ap:          firstEnemy.ap,
              maxAp:       firstEnemy.maxAp,
              statusSlots: firstEnemy.statusSlots,
            },
            skillName:  previewSkill.name,
            tuCost:     previewSkill.tuCost,
            apCost:     previewSkill.apCost,
            skillLevel: previewSkillInst.currentLevel,
            target: previewTarget ? {
              name:        previewTarget.name,
              className:   previewTarget.className,
              rarity:      previewTarget.rarity,
              hp:          previewTarget.hp,
              maxHp:       previewTarget.maxHp,
              ap:          previewTarget.ap,
              maxAp:       previewTarget.maxAp,
              statusSlots: previewTarget.statusSlots,
            } : { name: 'Player', className: '—', rarity: 1, hp: 0, maxHp: 1, ap: 0, maxAp: 1, statusSlots: [] },
            isAlly: false,
          },
          ENEMY_AI_DELAY_MS + DICE_RESULT_DISMISS_MS,
        )
      }
    }, remainingDice)

    // Step 3: after telegraph delay, fire the attack (dice starts here).
    const actionTimer = setTimeout(() => {
      const currentPlayer  = playerUnitRef.current
      const currentEnemies = enemiesRef.current
      const currentSkills  = unitSkillsMapRef.current
      if (!currentPlayer || !isAlive(currentPlayer)) return

      const sortedActiveEnemies = [...activeEnemies].sort((a, b) => b.stats.speed - a.stats.speed)
      for (const enemy of sortedActiveEnemies) {
        const allEnemySkills  = currentSkills.get(enemy.id) ?? []
        const availableSkills = allEnemySkills.filter((s) => !isOnCooldown(enemy, s))
        if (!availableSkills.length) {
          const fromTick = enemy.tickPosition
          pushHistory(makeHistoryEntry(enemy.id, enemy.name, fromTick, enemy.isAlly))
          registerTick(enemy.id, advanceTick(fromTick, 10))
          appendLog({ text: `${enemy.name} is gathering strength…`, colour: 'var(--text-muted)' })
          arenaRef.current?.clearTurn()
          continue
        }

        const skillInst = availableSkills[0]
        const skill     = getCachedSkill(skillInst)
        const snap      = makeSnapshot(currentPlayer, currentEnemies)
        const { tumbleDelay, outcome, damage } = runAttack(enemy, currentPlayer, skillInst, snap)

        const withCooldown = applyCooldown(enemy, skillInst, skill)
        setUnitSkillsMap((prev) => {
          const next   = new Map(prev)
          const skills = next.get(enemy.id) ?? []
          next.set(enemy.id, skills.map((s) => s.defId === skillInst.defId ? withCooldown : s))
          return next
        })

        // Step 4: apply state after animations complete.
        const applyEnemyState = () => {
          setPlayerUnit(snap.get(currentPlayer.id) ?? currentPlayer)
          setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
          const fromTick = enemy.tickPosition
          pushHistory(makeHistoryEntry(enemy.id, enemy.name, fromTick, enemy.isAlly))
          registerTick(enemy.id, advanceTick(fromTick, skill.tuCost + tumbleDelay))

          const updatedPlayer = snap.get(currentPlayer.id) ?? currentPlayer
          if (!isAlive(updatedPlayer)) {
            NarrativeService.emit({ type: 'unit_death', actorId: updatedPlayer.defId })
            appendLog({ text: 'Defeat! You have been slain.', colour: 'var(--accent-danger)' })
            NarrativeService.emit({ type: 'battle_defeat' })
          }

          // Stage 4: collapse dead player figure before sliding out survivors.
          const arena = arenaRef.current
          if (!isAlive(updatedPlayer) && arena) {
            arena.playDeath(updatedPlayer.defId, () => arena.clearTurn())
          } else {
            arenaRef.current?.clearTurn()
          }
        }

        const arena = arenaRef.current
        if (arena) {
          arena.playDice(outcome, () => {
            arena.playAttack(enemy.defId, currentPlayer.defId, outcome, damage, () => {
              arena.playFeedback(buildFeedbackText(outcome, damage), outcomeColour(outcome))
              applyTimerRef.current = setTimeout(applyEnemyState, BATTLE_FEEDBACK_HOLD_MS)
            })
          })
        } else {
          applyTimerRef.current = setTimeout(applyEnemyState, DICE_RESULT_DISMISS_MS)
        }
      }
    }, remainingDice + ENEMY_AI_DELAY_MS)

    return () => {
      clearTimeout(telegraphTimer)
      clearTimeout(actionTimer)
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current)
    }
  }, [phase, activeUnitIds, narrativePaused, showTurnDisplay]) // refs keep callbacks current; diceResult intentionally excluded

  // ── Misc actions ───────────────────────────────────────────────────────────

  /** Player skips their turn — no dice, immediate timeline update. */
  const skipTurn = useCallback(() => {
    if (!playerUnit || phase !== 'player') return
    if (narrativePaused) return
    setSelectedSkill(null)
    const fromTick = playerUnit.tickPosition
    pushHistory(makeHistoryEntry(playerUnit.id, playerUnit.name, fromTick, playerUnit.isAlly))
    setPlayerUnit(incrementActionCount(playerUnit))
    registerTick(playerUnit.id, fromTick + 10)
    appendLog({ text: 'You skipped your turn.' })
    arenaRef.current?.clearTurn()
  }, [playerUnit, phase, narrativePaused, pushHistory, registerTick, appendLog])

  const selectSkill = useCallback((skill: SkillInstance | null) => setSelectedSkill(skill), [])
  const toggleGrid  = useCallback(() => setGridCollapsed((v) => !v), [])

  const getUnitSkills = useCallback((unitId: string): SkillInstance[] => {
    return unitSkillsMap.get(unitId) ?? []
  }, [unitSkillsMap])

  // ── Provide ────────────────────────────────────────────────────────────────

  return (
    <BattleContext.Provider value={{
      arenaRef,
      phase,
      narrativePaused,
      turnNumber: (playerUnit?.actionCount ?? 0) + 1,
      tickValue, activeUnitIds,
      playerUnit, enemies, log, historyEntries,
      selectedSkill, gridCollapsed, isPaused, isLoading,
      diceResult, turnDisplay, pendingCounterDecision,
      pendingClash, pendingTeamCollision,
      registeredTicks, scrollBounds,
      getUnitSkills, executeSkill, skipTurn, confirmCounter, skipCounter,
      resolveClash, resolveTeamCollision,
      registerTick, unregisterTick, pushHistory,
      setPhase, appendLog, selectSkill, toggleGrid, setPaused,
    }}>
      {children}
    </BattleContext.Provider>
  )
}
