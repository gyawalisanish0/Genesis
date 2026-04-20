// Screen-local context for the Battle screen.
// Ephemeral within-session state: units, log, tick timeline, skill execution.
// The global Zustand store is NOT written during battle frames — only on end.

import {
  createContext, useContext, useState, useCallback,
  useMemo, useEffect, useRef, type ReactNode,
} from 'react'
import type { Unit, StatusEffect } from '../core/types'
import type { SkillInstance, BattleState as EngineBattleState, EffectContext } from '../core/effects/types'
import { TIMELINE_BUFFER_TICKS, TIMELINE_FUTURE_RANGE, TURN_DISPLAY_DISMISS_MS, DICE_RESULT_DISMISS_MS, ENEMY_AI_DELAY_MS } from '../core/constants'
import { createUnit, isAlive, setTickPosition, incrementActionCount } from '../core/unit'
import { calculateStartingTick, advanceTick, calculateApGained } from '../core/combat/TickCalculator'
import { calculateFinalChance, shiftProbabilities } from '../core/combat/HitChanceEvaluator'
import { roll, calculateTumblingDelay, type DiceOutcome } from '../core/combat/DiceResolver'
import { applyEffect } from '../core/effects/applyEffect'
import { createSkillInstance, getCachedSkill } from '../core/engines/skill/SkillInstance'
import { loadCharacterWithSkills } from '../services/DataService'
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

interface BattleContextValue {
  // State
  phase:           TurnPhase
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
  // Timeline
  registeredTicks: Map<string, number>
  scrollBounds:    { min: number; max: number }
  // Skill access
  getUnitSkills:   (unitId: string) => SkillInstance[]
  // Actions
  executeSkill:    (skill: SkillInstance) => void
  skipTurn:        () => void
  registerTick:    (id: string, tick: number) => void
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

  // Timeline tick registry — seeded from real unit positions after load.
  const [registeredTicks, setRegisteredTicks] = useState<Map<string, number>>(
    () => new Map(),
  )

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
  }, [])

  // ── Timeline mechanics ─────────────────────────────────────────────────────

  const registerTick = useCallback((id: string, tick: number) => {
    setRegisteredTicks((prev) => new Map(prev).set(id, tick))
    setPlayerUnit((prev) => prev?.id === id ? { ...prev, tickPosition: tick } : prev)
    setEnemies((prev) => prev.map((e) => e.id === id ? { ...e, tickPosition: tick } : e))
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

  // Derive phase from active unit ids.
  useEffect(() => {
    if (isLoading) return
    if (playerUnit && activeUnitIds.has(playerUnit.id)) {
      setPhase('player')
    } else if (enemies.some((e) => activeUnitIds.has(e.id))) {
      setPhase('enemy')
    }
  }, [activeUnitIds, playerUnit, enemies, isLoading])

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

  // ── Log + history helpers ──────────────────────────────────────────────────

  const appendLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [...prev, { ...entry, id: String(Date.now() + Math.random()) }])
  }, [])

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistoryEntries((prev) => [...prev, entry])
  }, [])

  // ── Core skill execution ───────────────────────────────────────────────────

  // Fresh-value refs so timer callbacks inside enemy AI always see current state.
  const playerUnitRef    = useRef(playerUnit)
  const enemiesRef       = useRef(enemies)
  const unitSkillsMapRef = useRef(unitSkillsMap)
  useEffect(() => { playerUnitRef.current = playerUnit },    [playerUnit])
  useEffect(() => { enemiesRef.current = enemies },          [enemies])
  useEffect(() => { unitSkillsMapRef.current = unitSkillsMap }, [unitSkillsMap])
  useEffect(() => { diceResultRef.current = diceResult },   [diceResult])

  /** Execute one attack: caster hits target using the given SkillInstance. */
  const runAttack = useCallback((
    caster: Unit,
    target: Unit,
    skillInst: SkillInstance,
    snap: Map<string, Unit>,
  ): { tumbleDelay: number } => {
    const skill       = getCachedSkill(skillInst)
    const finalChance = calculateFinalChance(caster.stats.precision, skill.resolution?.baseChance ?? 1.0)
    const diceOutcome = roll(shiftProbabilities(finalChance))
    const tumbleDelay = diceOutcome === 'Tumbling' ? calculateTumblingDelay() : 0
    const noDamage    = diceOutcome === 'Evasion' || diceOutcome === 'Fail'

    showDiceResult(diceOutcome, buildOutcomeMessage(diceOutcome, caster.name, target.name, tumbleDelay))

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

    return { tumbleDelay }
  }, [tickValue, appendLog, showDiceResult])

  /** Player presses ROLL with a skill selected. */
  const executeSkill = useCallback((skillInst: SkillInstance) => {
    if (!playerUnit || phase !== 'player') return
    const target = enemies.find(isAlive)
    if (!target) return

    const snap = makeSnapshot(playerUnit, enemies)
    const { tumbleDelay } = runAttack(playerUnit, target, skillInst, snap)

    const skill    = getCachedSkill(skillInst)
    const fromTick = playerUnit.tickPosition
    const nextTick = advanceTick(fromTick, skill.tuCost + tumbleDelay)

    // Ghost marker appears immediately at the old position.
    pushHistory(makeHistoryEntry(playerUnit.id, playerUnit.name, fromTick, playerUnit.isAlly))

    // Confirmation panel shows immediately using snap values (HP reflects hit).
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

    // Defer HP bars + timeline marker jump until dice animation ends.
    // This creates a clean "dice resolves → world updates" sequence.
    if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
    playerApplyTimerRef.current = setTimeout(() => {
      const updatedPlayer = incrementActionCount(snap.get(playerUnit.id) ?? playerUnit)
      setPlayerUnit(updatedPlayer)
      setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
      registerTick(playerUnit.id, nextTick)

      const allDead = enemies.every((e) => !isAlive(snap.get(e.id) ?? e))
      if (allDead) appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
    }, DICE_RESULT_DISMISS_MS)
  }, [playerUnit, enemies, phase, runAttack, pushHistory, registerTick, appendLog, showTurnDisplay])

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
    const activeEnemies = enemiesRef.current.filter(
      (e) => activeUnitIds.has(e.id) && isAlive(e),
    )
    if (!activeEnemies.length) return

    // Compute remaining player-dice animation time (0 if no active dice).
    const remainingDice = diceResultRef.current !== null
      ? Math.max(0, DICE_RESULT_DISMISS_MS - (Date.now() - diceShowTimeRef.current))
      : 0

    // Step 1 + 2: after player dice clears, show telegraph.
    const telegraphTimer = setTimeout(() => {
      const firstEnemy    = activeEnemies[0]
      const previewSkills = unitSkillsMapRef.current.get(firstEnemy.id) ?? []
      if (previewSkills.length > 0) {
        const previewSkillInst = previewSkills[0]
        const previewSkill     = getCachedSkill(previewSkillInst)
        const previewTarget    = playerUnitRef.current
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
          // Stay visible through the full delay + dice animation window.
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

      for (const enemy of activeEnemies) {
        const enemySkills = currentSkills.get(enemy.id) ?? []
        if (!enemySkills.length) {
          // No skill — advance tick immediately; no dice, no deferral needed.
          const fromTick = enemy.tickPosition
          pushHistory(makeHistoryEntry(enemy.id, enemy.name, fromTick, enemy.isAlly))
          registerTick(enemy.id, advanceTick(fromTick, 10))
          appendLog({ text: `${enemy.name} is gathering strength…`, colour: 'var(--text-muted)' })
          continue
        }

        const skillInst = enemySkills[0]
        const snap      = makeSnapshot(currentPlayer, currentEnemies)
        // runAttack fires showDiceResult internally — dice animation starts now.
        const { tumbleDelay } = runAttack(enemy, currentPlayer, skillInst, snap)

        // Step 4: defer HP/tick commits until the dice animation ends.
        applyTimerRef.current = setTimeout(() => {
          setPlayerUnit(snap.get(currentPlayer.id) ?? currentPlayer)
          setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))

          const skill    = getCachedSkill(skillInst)
          const fromTick = enemy.tickPosition
          pushHistory(makeHistoryEntry(enemy.id, enemy.name, fromTick, enemy.isAlly))
          registerTick(enemy.id, advanceTick(fromTick, skill.tuCost + tumbleDelay))

          const updatedPlayer = snap.get(currentPlayer.id) ?? currentPlayer
          if (!isAlive(updatedPlayer)) {
            appendLog({ text: 'Defeat! You have been slain.', colour: 'var(--accent-danger)' })
          }
        }, DICE_RESULT_DISMISS_MS)
      }
    }, remainingDice + ENEMY_AI_DELAY_MS)

    return () => {
      clearTimeout(telegraphTimer)
      clearTimeout(actionTimer)
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current)
    }
  }, [phase, activeUnitIds, showTurnDisplay]) // refs keep callbacks current; diceResult intentionally excluded

  // ── Misc actions ───────────────────────────────────────────────────────────

  /** Player skips their turn — no dice, immediate timeline update. */
  const skipTurn = useCallback(() => {
    if (!playerUnit || phase !== 'player') return
    setSelectedSkill(null)
    const fromTick = playerUnit.tickPosition
    pushHistory(makeHistoryEntry(playerUnit.id, playerUnit.name, fromTick, playerUnit.isAlly))
    setPlayerUnit(incrementActionCount(playerUnit))
    registerTick(playerUnit.id, fromTick + 10)
    appendLog({ text: 'You skipped your turn.' })
  }, [playerUnit, phase, pushHistory, registerTick, appendLog])

  const selectSkill = useCallback((skill: SkillInstance | null) => setSelectedSkill(skill), [])
  const toggleGrid  = useCallback(() => setGridCollapsed((v) => !v), [])

  const getUnitSkills = useCallback((unitId: string): SkillInstance[] => {
    return unitSkillsMap.get(unitId) ?? []
  }, [unitSkillsMap])

  // ── Provide ────────────────────────────────────────────────────────────────

  return (
    <BattleContext.Provider value={{
      phase,
      turnNumber: (playerUnit?.actionCount ?? 0) + 1,
      tickValue, activeUnitIds,
      playerUnit, enemies, log, historyEntries,
      selectedSkill, gridCollapsed, isPaused, isLoading,
      diceResult, turnDisplay,
      registeredTicks, scrollBounds,
      getUnitSkills, executeSkill, skipTurn,
      registerTick, unregisterTick, pushHistory,
      setPhase, appendLog, selectSkill, toggleGrid, setPaused,
    }}>
      {children}
    </BattleContext.Provider>
  )
}
