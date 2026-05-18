// Screen-local context for the Battle screen.
// Ephemeral within-session state: units, log, tick timeline, skill execution.
// Turn sequencing driven by a single step-machine useEffect — no concurrent
// reactive effects; each step explicitly dispatches the next.

import {
  createContext, useContext, useState, useCallback,
  useMemo, useEffect, useRef, type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { Unit, AnimationManifest, AnimationProjectileDef, AnimSequenceManifest } from '../core/types'
import type { SkillInstance, EffectContext } from '../core/effects/types'
import { TIMELINE_BUFFER_TICKS, TIMELINE_FUTURE_RANGE, TURN_DISPLAY_DISMISS_MS, DICE_RESULT_DISMISS_MS, CLASH_ANNOUNCE_MS, AI_THINKING_MIN_MS, AI_THINKING_MAX_MS, AI_INPUT_MIN_MS, AI_INPUT_MAX_MS, COUNTER_BASE, COUNTER_STEP, COUNTER_MIN, COUNTER_ANNOUNCE_MS, AI_COUNTER_AP_RESERVE, BATTLE_FEEDBACK_HOLD_MS, SKIP_TU_COST } from '../core/constants'
import { resolveTickDisplacement } from '../core/combat/TickDisplacer'
import { resolveClashWinner, factionAvgSpeed } from '../core/combat/ClashResolver'
import { createUnit, isAlive, setTickPosition, incrementActionCount, tickStatusDurations, updateStatusIntervalTick, isSkillTagBlocked, addApSpent, takeDamage } from '../core/unit'
import { calculateStartingTick, advanceTick, calculateApGained } from '../core/combat/TickCalculator'
import { calculateFinalChance, shiftProbabilities } from '../core/combat/HitChanceEvaluator'
import { roll, resolveCounterRoll, type DiceOutcome } from '../core/combat/DiceResolver'
import { findCounterSkill, canCounter, isSingleTarget } from '../core/combat/CounterResolver'
import { isOnCooldown, applyCooldown, applyTickCooldown, applyTurnCooldown, isBeforeMinTurns } from '../core/combat/CooldownResolver'
import { registerSpawnHandler, clearSpawnHandler } from '../core/combat/SpawnBus'
import type { SpawnRequest } from '../core/combat/SpawnBus'
import { applyEffect } from '../core/effects/applyEffect'
import { createSkillInstance, getCachedSkill } from '../core/engines/skill/SkillInstance'
import { loadCharacterWithSkills, loadStatusDef, loadAnimationManifest, loadAnimSequenceManifest } from '../services/DataService'
import { registerStatusDef, clearStatusRegistry }  from '../core/effects/statusRegistry'
import type { PassiveDef, StatusDef }               from '../core/effects/types'
import { NarrativeService } from '../services/NarrativeService'
import { NarrativeUnits }   from '../components/NarrativeLayer'
import type { BattleArenaHandle, TurnDisplayData } from '../components/BattleArena'
import { resolveAttackAnimation }                  from '../scenes/battle/AnimationResolver'
import { makeHistoryEntry } from '../core/battleHistory'
import type { HistoryEntry } from '../core/battleHistory'
import { useGameStore } from '../core/GameContext'
import { SCREEN_REGISTRY, SCREEN_IDS } from '../navigation/screenRegistry'
import { makeSnapshot, snapshotToBattleState, collectStatusIds } from './battle/BattleSnapshot'
import { resolveIncomingDodge, makeShieldedBattleState, isHyperModeActive, getEffectiveTuCost, readCritConfig } from './battle/BattleDamage'
import { fireHpThresholdPassives, fireStatusExpiry, fireOpponentActionEffects, fireCounterTriggerEffects, fireCounterCastEffects, fireOnApSpent, fireBattleTickIntervalPassives, fireTurnStartEffects } from './battle/BattlePassive'
import { resolveSkillTargets, unitIsDamaged, outcomeColour, buildOutcomeMessage, buildOutcomeLabel } from './battle/BattleResolution'
import type { BattleStep } from './battle/BattleStepMachine'
import { YIELDED_STEPS } from './battle/BattleStepMachine'
import { computeAITurn } from './battle/BattleAIRunner'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TurnPhase = 'player' | 'enemy' | 'resolving'

export interface DiceResult {
  outcome: DiceOutcome
  message: string
  animKey: number
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

// Data carried through player_acting → player_applying.
interface PendingPlayerTurnData {
  snap:              Map<string, Unit>
  actor:             Unit
  effectiveTu:       number
  primaryTarget:     Unit
  primaryDamage:     number
  outcome:           DiceOutcome
  preStatusSnapshot: Map<string, Set<string>>
}

// Data carried through enemy_acting → enemy_applying.
interface PendingAITurnData {
  aiUnit:        Unit
  snap:          Map<string, Unit>
  effectiveTu:   number
  primaryTarget: Unit
  primaryDamage: number
  outcome:       DiceOutcome
  isAlly:        boolean
}

interface BattleContextValue {
  arenaRef: React.RefObject<BattleArenaHandle | null>
  phase:            TurnPhase
  narrativePaused:  boolean
  turnNumber:       number
  tickValue:        number
  activeUnitIds:    Set<string>
  playerUnits:      Unit[]
  leader:           Unit | null
  activePlayerUnit: Unit | null
  enemies:          Unit[]
  log:             LogEntry[]
  historyEntries:  HistoryEntry[]
  selectedSkill:    SkillInstance | null
  selectedTarget:   Unit | null
  showTargetPicker: boolean
  gridCollapsed:    boolean
  isPaused:         boolean
  isLoading:        boolean
  suppressedChipIds: ReadonlySet<string>
  getChipDef: (statusId: string) => import('../core/types').StatusChipDef | null
  diceResult:      DiceResult | null
  pendingCounterDecision: CounterDecision | null
  pendingClash:            ClashState | null
  pendingTeamCollision:    TeamCollisionState | null
  registeredTicks: Map<string, number>
  scrollBounds:    { min: number; max: number }
  getUnitSkills:     (unitId: string) => SkillInstance[]
  hyperSenseModeActive: boolean
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
  selectTarget:    (unit: Unit) => void
  toggleGrid:      () => void
  setPaused:       (v: boolean | ((prev: boolean) => boolean)) => void
  skipDice:        () => void
  inspectingSkill:    SkillInstance | null
  setInspectingSkill: (skill: SkillInstance | null) => void
}

const BattleContext = createContext<BattleContextValue | null>(null)

export function useBattleScreen(): BattleContextValue {
  const ctx = useContext(BattleContext)
  if (!ctx) throw new Error('useBattleScreen must be used inside BattleProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

const randomMs = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

interface Props { children: ReactNode }

export function BattleProvider({ children }: Props) {
  const selectedMode = useGameStore((s) => s.selectedMode)
  const navigate     = useNavigate()

  const battleEndedRef = useRef(false)

  const passiveDefsRef = useRef<Map<string, PassiveDef | null>>(new Map())
  const statusDefsRef  = useRef<Map<string, StatusDef>>(new Map())
  const globalBattleTickRef = useRef<number>(0)
  const globalApAccumRef    = useRef<number>(0)
  const lastBattleIntervalFireRef  = useRef<Map<string, number>>(new Map())
  const lastBattleIntervalApAccumRef = useRef<Map<string, number>>(new Map())
  const turnStartFiredRef = useRef(new Set<string>())

  // ── Core unit state ────────────────────────────────────────────────────────
  const [isLoading, setIsLoading]     = useState(true)
  const [playerUnits, setPlayerUnits] = useState<Unit[]>([])
  const [enemies, setEnemies]         = useState<Unit[]>([])

  const [unitSkillsMap, setUnitSkillsMap] = useState<Map<string, SkillInstance[]>>(
    () => new Map(),
  )

  // ── Controlled-unit derivation ─────────────────────────────────────────────
  const controlledIds = useMemo<Set<string>>(() => {
    if (selectedMode?.settings.playerControl === 'all') {
      return new Set(playerUnits.map((u) => u.id))
    }
    const primaryId = playerUnits[0]?.id
    return primaryId ? new Set([primaryId]) : new Set<string>()
  }, [selectedMode, playerUnits])

  const controlledIdsRef = useRef<Set<string>>(new Set())

  // ── Battle step machine ────────────────────────────────────────────────────
  const [battleStep, setBattleStep] = useState<BattleStep>('init')
  const battleStepRef = useRef<BattleStep>('init')

  // ── Timeline state ─────────────────────────────────────────────────────────
  const [registeredTicks, setRegisteredTicks] = useState<Map<string, number>>(
    () => new Map(),
  )
  const registeredTicksRef = useRef<Map<string, number>>(new Map())

  const [tickValue, setTickValue] = useState(0)
  const tickValueRef = useRef(0)

  // ── Other battle state ─────────────────────────────────────────────────────
  const [log, setLog]                 = useState<LogEntry[]>([
    { id: '0', text: 'Loading battle…', colour: 'var(--text-muted)' },
  ])
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [selectedSkill, setSelectedSkill]   = useState<SkillInstance | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<Unit | null>(null)
  const [showTargetPicker, setShowTargetPicker] = useState(false)
  const [gridCollapsed, setGridCollapsed]   = useState(false)
  const [isPaused, setPaused]               = useState(false)
  const [narrativePaused, setNarrativePaused] = useState(false)
  const [inspectingSkill, setInspectingSkill] = useState<SkillInstance | null>(null)

  const arenaRef      = useRef<BattleArenaHandle>(null)
  const manifestsRef           = useRef<Map<string, AnimationManifest | null>>(new Map())
  const animSequencesRef       = useRef<Map<string, AnimSequenceManifest | null>>(new Map())
  const pendingExpiryAnimsRef      = useRef<Array<{ ownerDefId: string; sequenceId: string; damage: number }>>([])
  const pendingActivationAnimsRef  = useRef<Array<{ ownerDefId: string; sequenceId: string; slotId: string }>>([])
  const preSkillStatusSnapshotRef  = useRef<Map<string, Set<string>>>(new Map())

  const [suppressedChipIds, setSuppressedChipIds] = useState<ReadonlySet<string>>(new Set())
  const [pendingCounterDecision, setPendingCounterDecision] = useState<CounterDecision | null>(null)
  const [pendingClash, setPendingClash]               = useState<ClashState | null>(null)
  const [pendingTeamCollision, setPendingTeamCollision] = useState<TeamCollisionState | null>(null)

  const pendingClashRef         = useRef<ClashState | null>(null)
  const pendingTeamCollisionRef = useRef<TeamCollisionState | null>(null)

  // Step machine pending-turn refs — carry computed data between steps.
  const pendingPlayerTurnRef = useRef<PendingPlayerTurnData | null>(null)
  const pendingAITurnRef     = useRef<PendingAITurnData | null>(null)
  // Winner decided in clash_check; read when the announce timer fires.
  const clashAnnounceWinnerRef = useRef<'player' | 'enemy' | null>(null)

  // Timers owned by the step machine.
  const telegraphTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clashAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dice result overlay — shown simultaneously with action resolution.
  const [diceResult, setDiceResult]     = useState<DiceResult | null>(null)
  const diceTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const diceKeyRef         = useRef(0)
  const diceResultRef      = useRef<DiceResult | null>(null)
  const diceShowTimeRef    = useRef<number>(0)
  const applyTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const playerApplyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Ref sync effects (must be before driver) ───────────────────────────────
  useEffect(() => { controlledIdsRef.current = controlledIds },       [controlledIds])
  useEffect(() => { registeredTicksRef.current = registeredTicks },   [registeredTicks])
  useEffect(() => { tickValueRef.current = tickValue },               [tickValue])
  useEffect(() => { battleStepRef.current = battleStep },             [battleStep])

  // Fresh-value refs so timer callbacks always see current state.
  const playerUnitsRef   = useRef(playerUnits)
  const enemiesRef       = useRef(enemies)
  const unitSkillsMapRef = useRef(unitSkillsMap)
  useEffect(() => { playerUnitsRef.current = playerUnits },     [playerUnits])
  useEffect(() => { enemiesRef.current = enemies },             [enemies])
  useEffect(() => { unitSkillsMapRef.current = unitSkillsMap }, [unitSkillsMap])
  useEffect(() => { diceResultRef.current = diceResult },       [diceResult])

  // ── Load battle data ───────────────────────────────────────────────────────
  useEffect(() => {
    const { selectedTeamIds } = useGameStore.getState()
    if (!selectedTeamIds.length) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    async function load() {
      try {
        const { selectedMode: storeMode, currentEncounterEnemies } = useGameStore.getState()
        const enemyIds = currentEncounterEnemies.length
          ? currentEncounterEnemies
          : storeMode?.settings.enemies?.length
            ? storeMode.settings.enemies
            : ['hunter_001']

        const [playerDataArr, enemyDataArr] = await Promise.all([
          Promise.all(selectedTeamIds.map((id) => loadCharacterWithSkills(id))),
          Promise.all(enemyIds.map((id) => loadCharacterWithSkills(id))),
        ])

        const allDefIds = [...new Set([...selectedTeamIds, ...enemyIds])]
        const [manifestResults, seqResults] = await Promise.all([
          Promise.all(allDefIds.map((id) => loadAnimationManifest(id))),
          Promise.all(allDefIds.map((id) => loadAnimSequenceManifest(id))),
        ])
        const manifestMap = new Map<string, AnimationManifest | null>()
        const seqMap      = new Map<string, AnimSequenceManifest | null>()
        allDefIds.forEach((id, i) => { manifestMap.set(id, manifestResults[i]); seqMap.set(id, seqResults[i]) })
        manifestsRef.current     = manifestMap
        animSequencesRef.current = seqMap

        const loadedPlayers = playerDataArr.map((d) =>
          setTickPosition(
            createUnit(d.characterDef, true),
            calculateStartingTick(d.characterDef.stats.speed, d.characterDef.className),
          ),
        )
        const loadedEnemies = enemyDataArr.map((d) =>
          setTickPosition(
            createUnit(d.characterDef, false),
            calculateStartingTick(d.characterDef.stats.speed, d.characterDef.className),
          ),
        )

        // Force unique starting ticks to prevent simultaneous multi-unit attacks.
        const ticks = new Map<string, number>()
        const used  = new Set<number>()
        const allLoaded = [...loadedPlayers, ...loadedEnemies]
        for (const u of allLoaded) {
          let tick = u.tickPosition
          while (used.has(tick)) tick += 1
          ticks.set(u.id, tick)
          used.add(tick)
        }
        const displacedPlayers = loadedPlayers.map((u) => {
          const t = ticks.get(u.id)
          return t !== undefined && t !== u.tickPosition ? setTickPosition(u, t) : u
        })
        const displacedEnemies = loadedEnemies.map((u) => {
          const t = ticks.get(u.id)
          return t !== undefined && t !== u.tickPosition ? setTickPosition(u, t) : u
        })

        const skillsMap = new Map<string, SkillInstance[]>()
        playerDataArr.forEach((d, i) => skillsMap.set(displacedPlayers[i].id, d.skillDefs.map(createSkillInstance)))
        enemyDataArr.forEach((d, i)  => skillsMap.set(displacedEnemies[i].id, d.skillDefs.map(createSkillInstance)))

        clearStatusRegistry()
        const passiveDefs = new Map<string, PassiveDef | null>()
        const allData = [
          ...playerDataArr.map((d, i) => ({ unitId: displacedPlayers[i].id, data: d })),
          ...enemyDataArr.map((d, i)  => ({ unitId: displacedEnemies[i].id, data: d })),
        ]
        const passiveResults = await Promise.all(
          allData.map(({ unitId, data }) =>
            data.passiveDef
              ? Promise.resolve(data.passiveDef).then(p => ({ unitId, passive: p }))
              : Promise.resolve({ unitId, passive: null }),
          ),
        )
        passiveResults.forEach(({ unitId, passive }) => passiveDefs.set(unitId, passive))
        passiveDefsRef.current = passiveDefs

        const allEffects = [
          ...allData.flatMap(({ data }) => data.skillDefs.flatMap(s => s.effects)),
          ...passiveResults.flatMap(({ passive }) => passive ? passive.effects : []),
        ]
        const statusIds = [...new Set(collectStatusIds(allEffects))]
        const statusDefs = new Map<string, StatusDef>()
        const loadedStatuses = await Promise.all(statusIds.map(id => loadStatusDef(id)))
        statusIds.forEach((id, idx) => {
          const def = loadedStatuses[idx]
          if (def) {
            registerStatusDef(def)
            statusDefs.set(id, def)
            const nestedIds = collectStatusIds(def.effects)
            Promise.all(nestedIds.map(nid => loadStatusDef(nid))).then(nested => {
              nestedIds.forEach((nid, ni) => {
                const nd = nested[ni]
                if (nd) { registerStatusDef(nd); statusDefs.set(nid, nd) }
              })
            })
          }
        })
        statusDefsRef.current = statusDefs

        const battleStartSnap = makeSnapshot(displacedPlayers, displacedEnemies)
        for (const { unitId, passive } of passiveResults) {
          if (!passive) continue
          const unit = battleStartSnap.get(unitId)
          if (!unit) continue
          for (const effect of passive.effects) {
            if (effect.when.event !== 'onBattleStart') continue
            const ctx: EffectContext = {
              caster: unit, target: unit,
              battle: snapshotToBattleState(battleStartSnap),
              source: 'passive', event: { event: 'onBattleStart' }, currentTick: 0,
            }
            applyEffect(effect, ctx)
          }
        }
        const startedPlayers = displacedPlayers.map(u => battleStartSnap.get(u.id) ?? u)
        const startedEnemies = displacedEnemies.map(u => battleStartSnap.get(u.id) ?? u)

        if (!cancelled) {
          setPlayerUnits(startedPlayers)
          setEnemies(startedEnemies)
          setUnitSkillsMap(skillsMap)
          setRegisteredTicks(ticks)
          setLog([{ id: '1', text: 'Battle started!', colour: 'var(--accent-genesis)' }])
          setIsLoading(false)
          setBattleStep('advance_tick')  // kick off the step machine
          NarrativeUnits.register([...startedPlayers, ...startedEnemies])
          NarrativeService.emit({
            type:     'battle_start',
            actorId:  displacedPlayers[0]?.defId,
            targetId: displacedEnemies[0]?.defId,
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

    registerSpawnHandler(async (req: SpawnRequest) => {
      try {
        const data    = await loadCharacterWithSkills(req.defId)
        const rawUnit = createUnit(data.characterDef, req.isAlly)
        const newUnit = setTickPosition(rawUnit, req.currentTick + 1)

        const skills = data.skillDefs.map(createSkillInstance)
        setUnitSkillsMap(prev => new Map([...prev, [newUnit.id, skills]]))

        const manifest = await loadAnimationManifest(req.defId)
        manifestsRef.current.set(req.defId, manifest)

        if (data.passiveDef) {
          passiveDefsRef.current = new Map([...passiveDefsRef.current, [newUnit.id, data.passiveDef]])
        }

        const allEffects = [
          ...data.skillDefs.flatMap(s => s.effects),
          ...(data.passiveDef ? data.passiveDef.effects : []),
        ]
        const newStatusIds = [...new Set(collectStatusIds(allEffects))]
        const loadedStatuses = await Promise.all(newStatusIds.map(id => loadStatusDef(id)))
        newStatusIds.forEach((id, i) => {
          const def = loadedStatuses[i]
          if (def) { registerStatusDef(def); statusDefsRef.current.set(id, def) }
        })

        let finalUnit = newUnit
        if (data.passiveDef) {
          const spawnSnap = new Map<string, Unit>([[newUnit.id, newUnit]])
          for (const effect of data.passiveDef.effects) {
            if (effect.when.event !== 'onBattleStart') continue
            const ctx: EffectContext = {
              caster: spawnSnap.get(newUnit.id) ?? newUnit,
              target: spawnSnap.get(newUnit.id) ?? newUnit,
              battle: snapshotToBattleState(spawnSnap),
              source: 'passive', event: { event: 'onBattleStart' }, currentTick: req.currentTick,
            }
            applyEffect(effect, ctx)
          }
          finalUnit = spawnSnap.get(newUnit.id) ?? newUnit
        }

        registerTick(finalUnit.id, finalUnit.tickPosition)
        NarrativeUnits.register([finalUnit])

        if (req.isAlly) {
          setPlayerUnits(prev => [...prev, finalUnit])
        } else {
          setEnemies(prev => [...prev, finalUnit])
        }
        appendLog({ text: `${data.characterDef.name} has entered the battle!`, colour: 'var(--accent-genesis)' })
      } catch (err) {
        console.error('[SpawnBus] failed to spawn unit:', err)
      }
    })

    load()
    return () => {
      cancelled = true
      clearSpawnHandler()
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Narrative pause listeners ──────────────────────────────────────────────
  useEffect(() => {
    const unsubPause  = NarrativeService.onNarrativePause(()  => setNarrativePaused(true))
    const unsubResume = NarrativeService.onNarrativeResume(() => setNarrativePaused(false))
    return () => { unsubPause(); unsubResume() }
  }, [])

  // ── Turn display helpers ───────────────────────────────────────────────────
  const showTurnDisplay = useCallback((
    d: TurnDisplayData,
    dismissAfter = TURN_DISPLAY_DISMISS_MS,
  ) => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    arenaRef.current?.showTurnDisplay(d)
    dismissTimerRef.current = setTimeout(
      () => arenaRef.current?.hideTurnDisplay(),
      dismissAfter,
    )
  }, [])

  // ── Dice result overlay ────────────────────────────────────────────────────
  const showDiceResult = useCallback((outcome: DiceOutcome, message: string) => {
    if (diceTimerRef.current) clearTimeout(diceTimerRef.current)
    diceKeyRef.current += 1
    diceShowTimeRef.current = Date.now()
    setDiceResult({ outcome, message, animKey: diceKeyRef.current })
    diceTimerRef.current = setTimeout(
      () => setDiceResult(null),
      DICE_RESULT_DISMISS_MS,
    )
  }, [])

  const skipDice = useCallback(() => {
    if (!diceResultRef.current) return
    if (diceTimerRef.current) {
      clearTimeout(diceTimerRef.current)
      diceTimerRef.current = null
    }
    setDiceResult(null)
    arenaRef.current?.skipActiveDice()
  }, [])

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => () => {
    if (dismissTimerRef.current)    clearTimeout(dismissTimerRef.current)
    if (diceTimerRef.current)       clearTimeout(diceTimerRef.current)
    if (applyTimerRef.current)      clearTimeout(applyTimerRef.current)
    if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
    if (telegraphTimerRef.current)  clearTimeout(telegraphTimerRef.current)
    if (clashAnnounceTimerRef.current) clearTimeout(clashAnnounceTimerRef.current)
  }, [])

  // ── Timeline mechanics ─────────────────────────────────────────────────────
  const registerTick = useCallback((id: string, tick: number) => {
    const finalTick = resolveTickDisplacement(tick, registeredTicksRef.current, id)
    setRegisteredTicks((prev) => new Map(prev).set(id, finalTick))
    setPlayerUnits((prev) => prev.map((u) => u.id === id ? { ...u, tickPosition: finalTick } : u))
    setEnemies((prev) => prev.map((e) => e.id === id ? { ...e, tickPosition: finalTick } : e))
  }, [])

  const unregisterTick = useCallback((id: string) => {
    setRegisteredTicks((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }, [])

  // Active units: those whose registered tick equals the global clock.
  const activeUnitIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, tick] of registeredTicks) {
      if (tick === tickValue) ids.add(id)
    }
    return ids
  }, [registeredTicks, tickValue])

  // Phase derived from battleStep — for UI compatibility.
  const phase = useMemo<TurnPhase>(() => {
    if (battleStep === 'player_turn') return 'player'
    if (
      battleStep === 'enemy_telegraph' ||
      battleStep === 'enemy_acting' ||
      battleStep === 'enemy_applying'
    ) return 'enemy'
    return 'resolving'
  }, [battleStep])

  // The player-controlled unit currently eligible to act.
  const activePlayerUnit = useMemo<Unit | null>(() => {
    if (battleStep !== 'player_turn') return null
    return playerUnits.find((u) => activeUnitIds.has(u.id) && controlledIds.has(u.id)) ?? null
  }, [battleStep, playerUnits, activeUnitIds, controlledIds])

  const activePlayerUnitRef = useRef<Unit | null>(null)
  useEffect(() => { activePlayerUnitRef.current = activePlayerUnit }, [activePlayerUnit])

  const leader = useMemo<Unit | null>(() => {
    return playerUnits.find((u) => controlledIds.has(u.id)) ?? null
  }, [playerUnits, controlledIds])

  // ── Log + history helpers ──────────────────────────────────────────────────
  const appendLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [...prev, { ...entry, id: String(Date.now() + Math.random()) }])
  }, [])

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistoryEntries((prev) => [...prev, entry])
  }, [])

  // Clear target selection when leaving player_turn step.
  useEffect(() => {
    if (battleStep !== 'player_turn') {
      setSelectedTarget(null)
      setShowTargetPicker(false)
    }
  }, [battleStep])

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

  // ── End-of-battle ──────────────────────────────────────────────────────────
  const endBattle = useCallback((outcome: 'victory' | 'defeat') => {
    if (battleEndedRef.current) return
    battleEndedRef.current = true
    const turns    = playerUnitsRef.current.reduce((sum, u) => sum + u.actionCount, 0)
    const xpGained = outcome === 'victory' ? 100 * enemiesRef.current.length : 0
    useGameStore.getState().setBattleResult({ outcome, turns, xpGained })
    setTimeout(() => navigate(SCREEN_REGISTRY[SCREEN_IDS.BATTLE_RESULT].path), 2500)
  }, [navigate])

  const endBattleRef = useRef(endBattle)
  useEffect(() => { endBattleRef.current = endBattle }, [endBattle])

  // ── Mutual-recursion refs for runAttack ↔ scheduleCounterChain ────────────
  const runAttackRef            = useRef<((caster: Unit, target: Unit, skillInst: SkillInstance, snap: Map<string, Unit>, chainDepth?: number) => { outcome: DiceOutcome; damage: number }) | null>(null)
  const scheduleCounterChainRef = useRef<((defender: Unit, originalCaster: Unit, counterSkill: SkillInstance, snap: Map<string, Unit>, depth: number) => void) | null>(null)

  // ── Status chip helpers ────────────────────────────────────────────────────
  const getChipDef = useCallback((statusId: string) => {
    return statusDefsRef.current.get(statusId)?.ui?.chip ?? null
  }, [])

  const detectNewActivations = useCallback((snap: Map<string, Unit>, prior: Map<string, Set<string>>) => {
    const toSuppress: string[] = []
    for (const [unitId, unit] of snap) {
      const priorIds = prior.get(unitId) ?? new Set<string>()
      for (const slot of unit.statusSlots) {
        if (priorIds.has(slot.id)) continue
        const def = statusDefsRef.current.get(slot.id)
        if (!def?.activateSequenceId || !def?.ui?.chip) continue
        toSuppress.push(slot.id)
        pendingActivationAnimsRef.current.push({
          ownerDefId: unit.defId,
          sequenceId: def.activateSequenceId,
          slotId:     slot.id,
        })
      }
    }
    if (toSuppress.length) {
      setSuppressedChipIds(prev => {
        const next = new Set(prev)
        toSuppress.forEach(id => next.add(id))
        return next
      })
    }
  }, [])

  const fireExpiryChain = useCallback((ownerDefId: string, statusId: string, snap: Map<string, Unit>) => {
    const ownerUnit = [...snap.values()].find(u => u.defId === ownerDefId)
    if (!ownerUnit) return
    const def = statusDefsRef.current.get(statusId)
    if (!def) return
    const damage = fireStatusExpiry(snap.get(ownerUnit.id) ?? ownerUnit, def, snap)
    if (def.expireSequenceId) pendingExpiryAnimsRef.current.push({ ownerDefId, sequenceId: def.expireSequenceId, damage })
    const linkedUnit = snap.get(ownerUnit.id) ?? ownerUnit
    for (const slot of linkedUnit.statusSlots) {
      const linkedDef = statusDefsRef.current.get(slot.id)
      if (linkedDef?.expiresWithStatus === statusId) {
        snap.set(ownerUnit.id, { ...snap.get(ownerUnit.id) ?? ownerUnit, statusSlots: (snap.get(ownerUnit.id) ?? ownerUnit).statusSlots.filter(s => s.id !== slot.id) })
        const linkedDamage = fireStatusExpiry(snap.get(ownerUnit.id) ?? ownerUnit, linkedDef, snap)
        if (linkedDef.expireSequenceId) pendingExpiryAnimsRef.current.push({ ownerDefId, sequenceId: linkedDef.expireSequenceId, damage: linkedDamage })
      }
    }
  }, [])

  // ── Animation helpers ──────────────────────────────────────────────────────
  const playPendingActivationAnims = useCallback((arena: BattleArenaHandle) => {
    const pending = pendingActivationAnimsRef.current.splice(0)
    if (!pending.length) return
    for (const { ownerDefId, sequenceId, slotId } of pending) {
      const seq = animSequencesRef.current.get(ownerDefId)?.[sequenceId]
      const release = () => setSuppressedChipIds(prev => {
        const next = new Set(prev)
        next.delete(slotId)
        return next
      })
      if (!seq) { release(); continue }
      arena.setTurnState(ownerDefId, ownerDefId)
      arena.playAttack(ownerDefId, ownerDefId, 'Hit', 0, false, 0, null, '', '', release, seq)
    }
  }, [])

  const playPendingExpiryAnims = useCallback((arena: BattleArenaHandle, snap: Map<string, Unit>) => {
    const pending = pendingExpiryAnimsRef.current.splice(0)
    if (!pending.length) return
    const firstLivingEnemy = [...snap.values()].find(u => !u.isAlly && u.hp > 0)
    if (!firstLivingEnemy) return
    for (const { ownerDefId, sequenceId, damage } of pending) {
      const seq = animSequencesRef.current.get(ownerDefId)?.[sequenceId]
      if (!seq) continue
      arena.setTurnState(ownerDefId, firstLivingEnemy.defId)
      arena.playAttack(ownerDefId, firstLivingEnemy.defId, 'Hit', damage, false, 0, null, '', '', () => arena.clearTurn(), seq)
    }
  }, [])

  // ── Core attack execution ──────────────────────────────────────────────────
  const runAttack = useCallback((
    caster: Unit,
    target: Unit,
    skillInst: SkillInstance,
    snap: Map<string, Unit>,
    chainDepth = 0,
  ): { outcome: DiceOutcome; damage: number } => {
    const skill = getCachedSkill(skillInst)
    const currentTick = tickValueRef.current

    const { dodged, expiredStatusIds } = resolveIncomingDodge(target, skill.targeting.range, snap)
    for (const statusId of expiredStatusIds) {
      fireExpiryChain(target.defId, statusId, snap)
    }

    const baseChance = skill.resolution?.baseChance ?? 1.0
    const casterForDice = snap.get(caster.id) ?? caster
    const rangedBonus = skill.tags.includes('ranged')
      ? casterForDice.statusSlots.reduce((sum, slot) => {
          const b = slot.payload?.rangedBaseChanceBonus
          return typeof b === 'number' ? sum + b : sum
        }, 0)
      : 0
    const finalChance = calculateFinalChance(caster.stats.precision, baseChance + rangedBonus)
    const diceOutcome = dodged ? 'Evade' : roll(shiftProbabilities(finalChance))
    const noDamage    = diceOutcome === 'Evade' || diceOutcome === 'Fail'

    showDiceResult(diceOutcome, buildOutcomeMessage(diceOutcome, caster.name, target.name))
    const targetHpBefore  = snap.get(target.id)?.hp ?? target.hp
    const casterHpBefore  = snap.get(caster.id)?.hp ?? caster.hp

    NarrativeService.emit({ type: 'skill_used', actorId: caster.defId, targetId: target.defId })
    if (diceOutcome === 'Boosted') {
      NarrativeService.emit({ type: 'boosted_hit', actorId: caster.defId, targetId: target.defId })
    }
    if (diceOutcome === 'Evade') {
      NarrativeService.emit({ type: 'evaded', actorId: target.defId, targetId: caster.defId })
    }

    const shieldBrokeIds = new Map<string, { skillId: string; ticks: number } | undefined>()
    const battle = makeShieldedBattleState(snap, shieldBrokeIds)
    const casterSnap   = snap.get(caster.id)
    const apFrozen     = casterSnap?.statusSlots.some(s => s.payload?.freezesApRegen === true) ?? false
    const ticksElapsed = currentTick > 0 ? skill.tuCost : 0
    const apGained     = apFrozen ? 0 : calculateApGained(ticksElapsed, caster.apRegenRate)
    if (apGained > 0 && casterSnap) {
      snap.set(caster.id, { ...casterSnap, ap: Math.min(casterSnap.maxAp, casterSnap.ap + apGained) })
    }

    const ctx: EffectContext = {
      caster,
      target:      noDamage ? undefined : target,
      battle,
      source:      'skill',
      event:       { event: 'onCast' },
      dice:        diceOutcome,
      currentTick,
    }

    for (const effect of skillInst.cachedEffects) {
      if (effect.when.event === 'onCast') applyEffect(effect, ctx)
    }

    if (!noDamage) {
      const hitCtx = { ...ctx, event: { event: 'onHit' } as const }
      for (const effect of skillInst.cachedEffects) {
        if (effect.when.event === 'onHit') applyEffect(effect, hitCtx)
      }
    } else if (diceOutcome === 'Evade') {
      const evadeCtx = { ...ctx, target, event: { event: 'onEvade' } as const }
      for (const effect of skillInst.cachedEffects) {
        if (effect.when.event === 'onEvade') applyEffect(effect, evadeCtx)
      }
    } else {
      const missCtx = { ...ctx, event: { event: 'onMiss' } as const }
      for (const effect of skillInst.cachedEffects) {
        if (effect.when.event === 'onMiss') applyEffect(effect, missCtx)
      }
    }

    if (!noDamage) {
      const casterCurrent = snap.get(caster.id) ?? caster
      const critCfg = readCritConfig(casterCurrent)
      if (critCfg && Math.random() < critCfg.chance) {
        const critAmount = Math.round(casterCurrent.stats.strength * critCfg.attackerStrPercent / 100)
        const targetCurrent = snap.get(target.id) ?? target
        battle.setUnit(takeDamage(targetCurrent, critAmount))
        appendLog({ text: `★ CRITICAL! +${critAmount} bonus damage`, colour: 'var(--accent-gold)' })
      }
    }

    const logMsg =
      diceOutcome === 'Evade' ? `${target.name} evaded ${skill.name}!` :
      diceOutcome === 'Fail'  ? `${caster.name} missed with ${skill.name}!` :
      `${caster.name} → ${skill.name} on ${target.name} [${diceOutcome}]`
    appendLog({ text: logMsg, colour: outcomeColour(diceOutcome) })

    fireOpponentActionEffects(caster, snap, passiveDefsRef.current, currentTick)

    if (diceOutcome === 'Evade' && isSingleTarget(skill)) {
      const defenderSnap   = snap.get(target.id) ?? target
      const defenderSkills = unitSkillsMapRef.current.get(target.id) ?? []
      const counterSkill   = findCounterSkill(defenderSkills)
      if (counterSkill && canCounter(defenderSnap, counterSkill)) {
        scheduleCounterChainRef.current?.(defenderSnap, caster, counterSkill, snap, chainDepth)
      }
    }

    fireHpThresholdPassives(target.id, targetHpBefore, passiveDefsRef.current.get(target.id) ?? null, snap, currentTick)
    if (caster.id !== target.id) {
      fireHpThresholdPassives(caster.id, casterHpBefore, passiveDefsRef.current.get(caster.id) ?? null, snap, currentTick)
    }

    if (shieldBrokeIds.size > 0) {
      setUnitSkillsMap((prev) => {
        const next = new Map(prev)
        for (const [brokenUnitId, breakCd] of shieldBrokeIds) {
          if (!breakCd) continue
          const unitInSnap = snap.get(brokenUnitId)
          if (!unitInSnap) continue
          const skills = next.get(brokenUnitId) ?? []
          next.set(brokenUnitId, skills.map(s =>
            s.defId === breakCd.skillId
              ? applyTickCooldown(s, unitInSnap.tickPosition + breakCd.ticks)
              : s,
          ))
        }
        return next
      })
    }

    const casterAfter = snap.get(caster.id) ?? caster
    const { unit: casterTicked, expired } = tickStatusDurations(casterAfter)
    let casterFinal = casterTicked

    for (const slot of casterTicked.statusSlots) {
      const def = statusDefsRef.current.get(slot.id)
      if (!def) continue
      for (const effect of def.effects) {
        if (effect.when.event !== 'onTickInterval') continue
        const interval = (effect.when as { event: 'onTickInterval'; interval: number }).interval
        if (slot.nextIntervalFireTick === 0 || currentTick < slot.nextIntervalFireTick) continue
        const applier = snap.get(slot.source)
        const ctx: EffectContext = {
          caster: applier ?? casterFinal,
          target: casterFinal,
          battle: snapshotToBattleState(snap),
          source: 'status',
          event:  effect.when,
        }
        applyEffect(effect, ctx)
        casterFinal = snap.get(caster.id) ?? casterFinal
        casterFinal = updateStatusIntervalTick(casterFinal, slot.id, currentTick + interval)
        snap.set(caster.id, casterFinal)
      }
    }

    snap.set(caster.id, casterFinal)
    for (const expiredSlot of expired) {
      fireExpiryChain(caster.defId, expiredSlot.id, snap)
    }

    const damage = Math.max(0, targetHpBefore - (snap.get(target.id)?.hp ?? targetHpBefore))
    return { outcome: diceOutcome, damage }
  }, [appendLog, showDiceResult, fireExpiryChain])

  useEffect(() => { runAttackRef.current = runAttack }, [runAttack])

  // ── Counter chain ──────────────────────────────────────────────────────────
  const confirmCounter = useCallback(() => {
    if (!pendingCounterDecision) return
    const { defender, originalCaster, counterSkill, snap, depth } = pendingCounterDecision
    setPendingCounterDecision(null)

    const defSnap = snap.get(defender.id) ?? defender
    snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })

    const currentTick = tickValueRef.current
    setTimeout(() => {
      runAttackRef.current?.(defender, originalCaster, counterSkill, snap, depth + 1)
      fireCounterCastEffects(defender, originalCaster, counterSkill, snap, currentTick)
      fireCounterTriggerEffects(defender, snap, passiveDefsRef.current, currentTick)
      setTimeout(() => {
        setPlayerUnits((prev) => prev.map((u) => snap.get(u.id) ?? u))
        setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
      }, DICE_RESULT_DISMISS_MS)
    }, 200)
  }, [pendingCounterDecision])

  const skipCounter = useCallback(() => {
    setPendingCounterDecision(null)
  }, [])

  /** Called by ClashQteOverlay — 'player' or 'enemy' side wins. */
  const resolveClash = useCallback((winner: 'player' | 'enemy') => {
    pendingClashRef.current = null
    setPendingClash(null)
    setBattleStep(winner === 'player' ? 'player_turn' : 'enemy_telegraph')
  }, [])

  /** Called by TeamCollisionOverlay when all Now/Later choices are collected. */
  const resolveTeamCollision = useCallback((choices: Map<string, 'now' | 'later'>) => {
    pendingTeamCollisionRef.current = null
    setPendingTeamCollision(null)
    choices.forEach((choice, unitId) => {
      if (choice === 'later') {
        const currentTick = registeredTicksRef.current.get(unitId) ?? 0
        registerTick(unitId, currentTick + 1)
      }
    })
    setBattleStep('advance_tick')
  }, [registerTick])

  const scheduleCounterChain = useCallback((
    defender: Unit,
    originalCaster: Unit,
    counterSkill: SkillInstance,
    snap: Map<string, Unit>,
    depth: number,
  ): void => {
    showDiceResult('Evade', `${defender.name} attempts a counter!`)

    const currentTick = tickValueRef.current
    setTimeout(() => {
      const succeeded     = resolveCounterRoll(depth)
      const chancePercent = Math.round(Math.max(COUNTER_MIN, COUNTER_BASE - depth * COUNTER_STEP) * 100)
      showDiceResult(
        succeeded ? 'Hit' : 'Fail',
        succeeded ? `Counter! (${chancePercent}% chance)` : 'Counter blocked!',
      )

      if (!succeeded) return

      NarrativeService.emit({ type: 'counter', actorId: defender.defId, targetId: originalCaster.defId })

      if (defender.isAlly && controlledIdsRef.current.has(defender.id)) {
        setPendingCounterDecision({ defender, originalCaster, counterSkill, snap, depth })
      } else {
        const defSnap    = snap.get(defender.id) ?? defender
        const shouldFire = defSnap.ap - counterSkill.cachedCosts.apCost >= AI_COUNTER_AP_RESERVE

        if (shouldFire) {
          snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })
          setTimeout(() => {
            runAttackRef.current?.(defender, originalCaster, counterSkill, snap, depth + 1)
            fireCounterCastEffects(defender, originalCaster, counterSkill, snap, currentTick)
            fireCounterTriggerEffects(defender, snap, passiveDefsRef.current, currentTick)
            setTimeout(() => {
              setPlayerUnits((prev) => prev.map((u) => snap.get(u.id) ?? u))
              setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
            }, DICE_RESULT_DISMISS_MS)
          }, DICE_RESULT_DISMISS_MS)
        }
      }
    }, COUNTER_ANNOUNCE_MS)
  }, [showDiceResult])

  useEffect(() => { scheduleCounterChainRef.current = scheduleCounterChain }, [scheduleCounterChain])

  // ── Player skill execution ─────────────────────────────────────────────────
  const executeSkill = useCallback((skillInst: SkillInstance) => {
    const actor = activePlayerUnitRef.current
    if (battleStepRef.current !== 'player_turn') return
    if (!actor) return
    if (narrativePaused || inspectingSkill) return
    if (isOnCooldown(actor, skillInst)) return

    const skill = getCachedSkill(skillInst)
    if (isBeforeMinTurns(actor, skill.minTurns)) return
    if (actor.statusSlots.some(s => s.payload?.blocksRecastOfSkill === skill.id)) return
    if (actor.statusSlots.some(s => s.payload?.stunned === true)) return
    if (isSkillTagBlocked(actor, skill.tags)) return

    const snap = makeSnapshot(playerUnitsRef.current, enemiesRef.current)
    preSkillStatusSnapshotRef.current = new Map(
      [...snap].map(([uid, u]) => [uid, new Set(u.statusSlots.map(s => s.id))])
    )
    const allTargets = resolveSkillTargets(actor, skill.targeting.selector, snap, selectedTarget)
    if (!allTargets.length) return

    const currentTick = tickValueRef.current

    if (skill.apCost > 0) {
      const actorSnap = snap.get(actor.id) ?? actor
      const hpApSwapped = actorSnap.statusSlots.some(s => s.payload?.hpApSwapped === true)
      const withCost = hpApSwapped
        ? addApSpent({ ...actorSnap, hp: Math.max(0, actorSnap.hp - skill.apCost) }, skill.apCost)
        : addApSpent({ ...actorSnap, ap: Math.max(0, actorSnap.ap - skill.apCost) }, skill.apCost)
      snap.set(actor.id, withCost)
      globalApAccumRef.current += skill.apCost
      fireOnApSpent(withCost, passiveDefsRef.current.get(actor.id) ?? null, snap, currentTick)
    }

    const primaryTarget = allTargets[0]
    const { outcome, damage: primaryDamage } = runAttack(actor, primaryTarget, skillInst, snap)

    if (allTargets.length > 1) {
      const noDamage = outcome === 'Evade' || outcome === 'Fail'
      for (const extra of allTargets.slice(1)) {
        const extraSnap = snap.get(extra.id) ?? extra
        if (!isAlive(extraSnap)) continue
        const hpBefore = extraSnap.hp
        const ctx: EffectContext = {
          caster:      actor,
          target:      noDamage ? undefined : extra,
          battle:      snapshotToBattleState(snap),
          source:      'skill',
          event:       { event: 'onCast' },
          dice:        outcome,
          currentTick,
        }
        for (const effect of skillInst.cachedEffects) {
          if (effect.when.event === 'onCast') applyEffect(effect, ctx)
        }
        const hpAfter = (snap.get(extra.id) ?? extra).hp
        const extraDmg = Math.max(0, hpBefore - hpAfter)
        void extraDmg
        appendLog({ text: `${actor.name} → ${skill.name} on ${extra.name} [${outcome}]`, colour: outcomeColour(outcome) })
      }
    }

    const isHyperCast = skill.tags.includes('hyper') && skill.hyperCooldown !== undefined
      && isHyperModeActive(snap.get(actor.id) ?? actor)
    const withCooldown = isHyperCast
      ? applyTurnCooldown(actor, skillInst, skill.hyperCooldown!)
      : applyCooldown(actor, skillInst, skill)
    setUnitSkillsMap((prev) => {
      const next   = new Map(prev)
      const skills = next.get(actor.id) ?? []
      next.set(actor.id, skills.map((s) => s.defId === skillInst.defId ? withCooldown : s))
      return next
    })

    const fromTick    = actor.tickPosition
    const effectiveTu = getEffectiveTuCost(skill.tuCost, snap.get(actor.id) ?? actor)

    pushHistory(makeHistoryEntry(actor.id, actor.defId, actor.name, fromTick, actor.isAlly))

    const postTarget = snap.get(primaryTarget.id) ?? primaryTarget
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

    // Store data for player_applying step.
    pendingPlayerTurnRef.current = {
      snap,
      actor,
      effectiveTu,
      primaryTarget,
      primaryDamage,
      outcome,
      preStatusSnapshot: preSkillStatusSnapshotRef.current,
    }

    // Transition to animated step immediately so the driver won't re-run.
    setBattleStep('player_acting')

    const arena = arenaRef.current
    if (arena) {
      const actorManifest  = manifestsRef.current.get(actor.defId) ?? null
      const actorDamaged   = unitIsDamaged(actor, actorManifest)
      const resolved       = actorManifest ? resolveAttackAnimation(actorManifest, skill.id, skill.tags, actorDamaged) : null
      const isMelee        = resolved?.isMelee ?? false
      const dashDx         = resolved?.dashDx  ?? 0
      const projectile: AnimationProjectileDef | null = actorManifest?.projectile ?? null
      const customSequence = animSequencesRef.current.get(actor.defId)?.[skill.id]
      arena.playDice(outcome, () => {
        arena.playAttack(actor.defId, primaryTarget.defId, outcome, primaryDamage, isMelee, dashDx, projectile, buildOutcomeLabel(outcome), outcomeColour(outcome), () => {
          if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
          playerApplyTimerRef.current = setTimeout(() => setBattleStep('player_applying'), BATTLE_FEEDBACK_HOLD_MS)
        }, customSequence)
      })
    } else {
      if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
      playerApplyTimerRef.current = setTimeout(() => setBattleStep('player_applying'), DICE_RESULT_DISMISS_MS)
    }
  }, [narrativePaused, inspectingSkill, selectedTarget, runAttack, pushHistory, appendLog, showTurnDisplay, setUnitSkillsMap])

  // ── Skip turn ──────────────────────────────────────────────────────────────
  const skipTurn = useCallback(() => {
    const actor = activePlayerUnitRef.current
    if (battleStepRef.current !== 'player_turn') return
    if (!actor) return
    if (narrativePaused || inspectingSkill) return

    setSelectedSkill(null)
    setSelectedTarget(null)
    setShowTargetPicker(false)

    const fromTick  = actor.tickPosition
    const apFrozen  = actor.statusSlots.some(s => s.payload?.freezesApRegen === true)
    const apGained  = apFrozen ? 0 : calculateApGained(SKIP_TU_COST, actor.apRegenRate)
    pushHistory(makeHistoryEntry(actor.id, actor.defId, actor.name, fromTick, actor.isAlly))
    setPlayerUnits((prev) => prev.map((u) =>
      u.id === actor.id
        ? incrementActionCount({ ...u, ap: Math.min(u.maxAp, u.ap + apGained) })
        : u
    ))
    registerTick(actor.id, fromTick + SKIP_TU_COST)
    globalBattleTickRef.current += SKIP_TU_COST
    const skipSnap = makeSnapshot(playerUnitsRef.current, enemiesRef.current)
    fireBattleTickIntervalPassives(
      globalBattleTickRef.current, skipSnap,
      passiveDefsRef.current,
      lastBattleIntervalFireRef.current,
      lastBattleIntervalApAccumRef.current,
      globalApAccumRef.current,
    )
    appendLog({ text: 'You skipped your turn.' })
    arenaRef.current?.clearTurn()
    setBattleStep('advance_tick')
  }, [narrativePaused, inspectingSkill, pushHistory, registerTick, appendLog])

  // ── Step machine driver ────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return
    if (YIELDED_STEPS.has(battleStep)) return
    // Only pause advance/check for narrative/inspect; applying steps always run.
    if (
      (battleStep === 'advance_tick' || battleStep === 'clash_check' || battleStep === 'enemy_telegraph') &&
      (narrativePaused || inspectingSkill)
    ) return

    // ── advance_tick ──────────────────────────────────────────────────────────
    if (battleStep === 'advance_tick') {
      const ticks = [...registeredTicksRef.current.values()]
      if (!ticks.length) return

      const current = tickValueRef.current
      const hasActiveNow = ticks.some(t => t === current)

      if (!hasActiveNow) {
        const next = Math.min(...ticks)
        tickValueRef.current = next
        setTickValue(next)
      }
      setBattleStep('clash_check')
      return
    }

    // ── clash_check ───────────────────────────────────────────────────────────
    if (battleStep === 'clash_check') {
      const current    = tickValueRef.current
      const ticks      = registeredTicksRef.current
      const controlled = controlledIdsRef.current
      const players    = playerUnitsRef.current
      const foes       = enemiesRef.current

      const activeIds = new Set<string>()
      for (const [id, tick] of ticks) {
        if (tick === current) activeIds.add(id)
      }

      const activeControlled = players.filter(u => activeIds.has(u.id) && controlled.has(u.id) && isAlive(u))
      const activeAIAllies   = players.filter(u => activeIds.has(u.id) && !controlled.has(u.id) && isAlive(u))
      const activeEnemies    = foes.filter(e => activeIds.has(e.id) && isAlive(e))
      const hasClash         = activeControlled.length > 0 && activeEnemies.length > 0

      if (hasClash) {
        const allActive    = [...activeControlled, ...activeEnemies]
        const hasUniqueClash = allActive.some(u => u.clashUniqueEnabled)

        if (hasUniqueClash) {
          pendingClashRef.current = { playerUnits: activeControlled, enemyUnits: activeEnemies }
          setPendingClash(pendingClashRef.current)
          setBattleStep('clash_qte')
          return
        }

        // Normal clash: resolve immediately and show a brief log delay.
        const winner    = resolveClashWinner(activeControlled, activeEnemies)
        const winnerUs  = winner === 'player' ? activeControlled : activeEnemies
        const loserUs   = winner === 'player' ? activeEnemies    : activeControlled
        const winnerAvg = Math.round(factionAvgSpeed(winnerUs))
        const loserAvg  = Math.round(factionAvgSpeed(loserUs))
        appendLog({
          text:   `CLASH — ${winnerUs.map(u => u.name).join(' & ')} acts first (avg. speed ${winnerAvg} vs ${loserAvg})`,
          colour: winner === 'player' ? 'var(--accent-info)' : 'var(--accent-danger)',
        })
        winnerUs.forEach(u => NarrativeService.emit({ type: 'clash_resolved', actorId: u.defId }))
        clashAnnounceWinnerRef.current = winner
        setBattleStep('clash_announcing')
        clashAnnounceTimerRef.current = setTimeout(() => {
          const w = clashAnnounceWinnerRef.current
          setBattleStep(w === 'player' ? 'player_turn' : 'enemy_telegraph')
        }, CLASH_ANNOUNCE_MS)
        return
      }

      // Same-team collision: multiple controlled units at the same tick.
      if (activeControlled.length > 1) {
        const bySpeed = [...activeControlled].sort((a, b) => b.stats.speed - a.stats.speed)
        if (bySpeed[0].stats.speed !== bySpeed[1].stats.speed) {
          setBattleStep('player_turn')
        } else {
          const choices = new Map(activeControlled.map(u => [u.id, null as 'now' | 'later' | null]))
          pendingTeamCollisionRef.current = { units: activeControlled, choices }
          setPendingTeamCollision(pendingTeamCollisionRef.current)
          setBattleStep('team_collision')
        }
        return
      }

      // AI units (enemies + non-controlled allies).
      const allActiveAI = [...activeAIAllies, ...activeEnemies]
      if (allActiveAI.length > 0) {
        setBattleStep('enemy_telegraph')
        return
      }

      // Single controlled unit — fire turn-start effects and wait for input.
      if (activeControlled.length === 1) {
        const activeUnit = activeControlled[0]
        const turnKey    = `${activeUnit.id}:${current}`
        if (!turnStartFiredRef.current.has(turnKey)) {
          turnStartFiredRef.current.add(turnKey)
          const snap = makeSnapshot(players, foes)
          fireTurnStartEffects(activeUnit, statusDefsRef.current, snap, current)
          const updated = snap.get(activeUnit.id)
          if (updated) setPlayerUnits(prev => prev.map(u => u.id === updated.id ? updated : u))
        }
        setBattleStep('player_turn')
        return
      }

      // No active units — re-evaluate.
      setBattleStep('advance_tick')
      return
    }

    // ── enemy_telegraph ───────────────────────────────────────────────────────
    if (battleStep === 'enemy_telegraph') {
      const current    = tickValueRef.current
      const ticks      = registeredTicksRef.current
      const controlled = controlledIdsRef.current
      const players    = playerUnitsRef.current
      const foes       = enemiesRef.current

      const activeIds = new Set<string>()
      for (const [id, tick] of ticks) {
        if (tick === current) activeIds.add(id)
      }

      const activeAIAllies = players.filter(u => activeIds.has(u.id) && !controlled.has(u.id) && isAlive(u))
      const activeEnemies  = foes.filter(e => activeIds.has(e.id) && isAlive(e))
      const allAIUnits     = [...activeAIAllies, ...activeEnemies].sort((a, b) => b.stats.speed - a.stats.speed)

      if (!allAIUnits.length) {
        setBattleStep('advance_tick')
        return
      }

      // Fire onUnitTurnStart effects for all AI units at this tick.
      {
        const snap = makeSnapshot(players, foes)
        for (const aiUnit of allAIUnits) {
          const key = `${aiUnit.id}:${current}`
          if (!turnStartFiredRef.current.has(key)) {
            turnStartFiredRef.current.add(key)
            fireTurnStartEffects(aiUnit, statusDefsRef.current, snap, current)
          }
        }
        setPlayerUnits(prev => prev.map(u => snap.get(u.id) ?? u))
        setEnemies(prev => prev.map(e => snap.get(e.id) ?? e))
      }

      const firstAIUnit = allAIUnits[0]

      // Remaining dice display time — thinking starts only after player's dice clear.
      const remainingDice = diceResultRef.current !== null
        ? Math.max(0, DICE_RESULT_DISMISS_MS - (Date.now() - diceShowTimeRef.current))
        : 0

      // Lock the step immediately — enemy_acting is yielded so driver won't re-run.
      setBattleStep('enemy_acting')

      // Phase 1 — Thinking: AI deliberates before revealing its decision.
      telegraphTimerRef.current = setTimeout(() => {
        const thinkPlayers = playerUnitsRef.current
        const thinkEnemies = enemiesRef.current
        if (!thinkPlayers.some(isAlive) && !thinkEnemies.some(isAlive)) return

        // Re-read unit state — turn-start effects may have propagated since the sync phase.
        const freshAIUnit = (firstAIUnit.isAlly ? thinkPlayers : thinkEnemies)
          .find(u => u.id === firstAIUnit.id) ?? firstAIUnit
        const freshSkills = unitSkillsMapRef.current.get(firstAIUnit.id) ?? []
        const result      = computeAITurn(freshAIUnit, freshSkills, thinkPlayers, thinkEnemies)

        if (result.type === 'skip') {
          const fromTick = firstAIUnit.tickPosition
          pushHistory(makeHistoryEntry(firstAIUnit.id, firstAIUnit.defId, firstAIUnit.name, fromTick, firstAIUnit.isAlly))
          registerTick(firstAIUnit.id, advanceTick(fromTick, SKIP_TU_COST))
          globalBattleTickRef.current += SKIP_TU_COST
          const skipSnap = makeSnapshot(thinkPlayers, thinkEnemies)
          fireBattleTickIntervalPassives(
            globalBattleTickRef.current, skipSnap,
            passiveDefsRef.current,
            lastBattleIntervalFireRef.current,
            lastBattleIntervalApAccumRef.current,
            globalApAccumRef.current,
          )
          appendLog({ text: `${firstAIUnit.name} is gathering strength…`, colour: 'var(--text-muted)' })
          arenaRef.current?.clearTurn()
          setBattleStep('advance_tick')
          return
        }

        if (result.type === 'no_targets') {
          const fromTick = firstAIUnit.tickPosition
          pushHistory(makeHistoryEntry(firstAIUnit.id, firstAIUnit.defId, firstAIUnit.name, fromTick, firstAIUnit.isAlly))
          registerTick(firstAIUnit.id, advanceTick(fromTick, SKIP_TU_COST))
          globalBattleTickRef.current += SKIP_TU_COST
          const noTgtSnap = makeSnapshot(thinkPlayers, thinkEnemies)
          fireBattleTickIntervalPassives(
            globalBattleTickRef.current, noTgtSnap,
            passiveDefsRef.current,
            lastBattleIntervalFireRef.current,
            lastBattleIntervalApAccumRef.current,
            globalApAccumRef.current,
          )
          appendLog({ text: `${firstAIUnit.name} has no valid targets.`, colour: 'var(--text-muted)' })
          arenaRef.current?.clearTurn()
          setBattleStep('advance_tick')
          return
        }

        // Decision revealed — show target and skill telegraph.
        const { skillInst, target, allTargets } = result
        const skill    = getCachedSkill(skillInst)
        const actingMf = manifestsRef.current.get(firstAIUnit.defId) ?? null
        const targetMf = manifestsRef.current.get(target.defId) ?? null

        arenaRef.current?.setTurnState(freshAIUnit.defId, target.defId, actingMf, targetMf, {
          acting: unitIsDamaged(freshAIUnit, actingMf),
          target: unitIsDamaged(target, targetMf),
        })

        const inputMs = randomMs(AI_INPUT_MIN_MS, AI_INPUT_MAX_MS)

        showTurnDisplay(
          {
            actor: {
              name:        freshAIUnit.name,
              className:   freshAIUnit.className,
              rarity:      freshAIUnit.rarity,
              hp:          freshAIUnit.hp,
              maxHp:       freshAIUnit.maxHp,
              ap:          freshAIUnit.ap,
              maxAp:       freshAIUnit.maxAp,
              statusSlots: freshAIUnit.statusSlots,
            },
            skillName:  skill.name,
            tuCost:     skill.tuCost,
            apCost:     skill.apCost,
            skillLevel: skillInst.currentLevel,
            target: {
              name:        target.name,
              className:   target.className,
              rarity:      target.rarity,
              hp:          target.hp,
              maxHp:       target.maxHp,
              ap:          target.ap,
              maxAp:       target.maxAp,
              statusSlots: target.statusSlots,
            },
            isAlly: freshAIUnit.isAlly,
          },
          inputMs + DICE_RESULT_DISMISS_MS,
        )

        // Phase 2 — Input: AI commits to the attack after the input delay.
        if (applyTimerRef.current) clearTimeout(applyTimerRef.current)
        applyTimerRef.current = setTimeout(() => {
          const execPlayers = playerUnitsRef.current
          const execEnemies = enemiesRef.current
          if (!execPlayers.some(isAlive) && !execEnemies.some(isAlive)) return

          const snap     = makeSnapshot(execPlayers, execEnemies)
          const thisTick = tickValueRef.current

          if (skill.apCost > 0) {
            const aiSnap      = snap.get(firstAIUnit.id) ?? freshAIUnit
            const hpApSwapped = aiSnap.statusSlots.some(s => s.payload?.hpApSwapped === true)
            const withCost    = hpApSwapped
              ? addApSpent({ ...aiSnap, hp: Math.max(0, aiSnap.hp - skill.apCost) }, skill.apCost)
              : addApSpent({ ...aiSnap, ap: Math.max(0, aiSnap.ap - skill.apCost) }, skill.apCost)
            snap.set(firstAIUnit.id, withCost)
            globalApAccumRef.current += skill.apCost
            fireOnApSpent(withCost, passiveDefsRef.current.get(firstAIUnit.id) ?? null, snap, thisTick)
          }

          const { outcome, damage: primaryDamage } = runAttackRef.current!(freshAIUnit, target, skillInst, snap)

          if (allTargets.length > 1) {
            const noDamage = outcome === 'Evade' || outcome === 'Fail'
            for (const extra of allTargets.slice(1)) {
              const extraSnap = snap.get(extra.id) ?? extra
              if (!isAlive(extraSnap)) continue
              const ctx: EffectContext = {
                caster:      freshAIUnit,
                target:      noDamage ? undefined : extra,
                battle:      snapshotToBattleState(snap),
                source:      'skill',
                event:       { event: 'onCast' },
                dice:        outcome,
                currentTick: thisTick,
              }
              for (const effect of skillInst.cachedEffects) {
                if (effect.when.event === 'onCast') applyEffect(effect, ctx)
              }
              appendLog({ text: `${freshAIUnit.name} → ${skill.name} on ${extra.name} [${outcome}]`, colour: outcomeColour(outcome) })
            }
          }

          const withCooldown = applyCooldown(freshAIUnit, skillInst, skill)
          setUnitSkillsMap((prev) => {
            const next   = new Map(prev)
            const skills = next.get(firstAIUnit.id) ?? []
            next.set(firstAIUnit.id, skills.map(s => s.defId === skillInst.defId ? withCooldown : s))
            return next
          })

          const aiEffectiveTu = getEffectiveTuCost(skill.tuCost, snap.get(firstAIUnit.id) ?? freshAIUnit)

          pendingAITurnRef.current = {
            aiUnit:        freshAIUnit,
            snap,
            effectiveTu:   aiEffectiveTu,
            primaryTarget: target,
            primaryDamage,
            outcome,
            isAlly:        freshAIUnit.isAlly,
          }

          const arena = arenaRef.current
          if (arena) {
            const aiManifest = manifestsRef.current.get(firstAIUnit.defId) ?? null
            const aiDamaged  = unitIsDamaged(freshAIUnit, aiManifest)
            const aiResolved = aiManifest ? resolveAttackAnimation(aiManifest, skill.id, skill.tags, aiDamaged) : null
            const aiIsMelee  = aiResolved?.isMelee ?? false
            const aiDashDx   = aiResolved?.dashDx  ?? 0
            const aiProjectile: AnimationProjectileDef | null = aiManifest?.projectile ?? null
            const aiSequence   = animSequencesRef.current.get(firstAIUnit.defId)?.[skill.id]
            arena.playDice(outcome, () => {
              arena.playAttack(freshAIUnit.defId, target.defId, outcome, primaryDamage, aiIsMelee, aiDashDx, aiProjectile, buildOutcomeLabel(outcome), outcomeColour(outcome), () => {
                if (applyTimerRef.current) clearTimeout(applyTimerRef.current)
                applyTimerRef.current = setTimeout(() => setBattleStep('enemy_applying'), BATTLE_FEEDBACK_HOLD_MS)
              }, aiSequence)
            })
          } else {
            if (applyTimerRef.current) clearTimeout(applyTimerRef.current)
            applyTimerRef.current = setTimeout(() => setBattleStep('enemy_applying'), DICE_RESULT_DISMISS_MS)
          }
        }, inputMs)

      }, remainingDice + randomMs(AI_THINKING_MIN_MS, AI_THINKING_MAX_MS))

      return
    }

    // ── enemy_applying ────────────────────────────────────────────────────────
    if (battleStep === 'enemy_applying') {
      const pending = pendingAITurnRef.current
      if (!pending) { return }   // re-run from narrativePaused change; async callbacks handle advance
      pendingAITurnRef.current = null

      const { aiUnit, snap, effectiveTu, primaryTarget, isAlly: aiIsAlly } = pending
      const currentPlayers = playerUnitsRef.current
      const currentEnemies = enemiesRef.current

      setPlayerUnits((prev) => prev.map((u) => snap.get(u.id) ?? u))
      setEnemies((prev)     => prev.map((e) => snap.get(e.id) ?? e))

      const fromTick = aiUnit.tickPosition
      pushHistory(makeHistoryEntry(aiUnit.id, aiUnit.defId, aiUnit.name, fromTick, aiUnit.isAlly))
      registerTick(aiUnit.id, advanceTick(fromTick, effectiveTu))
      globalBattleTickRef.current += effectiveTu
      fireBattleTickIntervalPassives(
        globalBattleTickRef.current, snap,
        passiveDefsRef.current,
        lastBattleIntervalFireRef.current,
        lastBattleIntervalApAccumRef.current,
        globalApAccumRef.current,
      )

      const arena = arenaRef.current
      arena?.hideTurnDisplay()

      if (!aiIsAlly) {
        const updatedPlayers = currentPlayers.map((u) => snap.get(u.id) ?? u)
        const deadPlayers    = updatedPlayers.filter((u) => !isAlive(u))
        deadPlayers.forEach((u) => NarrativeService.emit({ type: 'unit_death', actorId: u.defId }))
        deadPlayers.forEach((u) => unregisterTick(u.id))
        if (updatedPlayers.every((u) => !isAlive(u))) {
          appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
          NarrativeService.emit({ type: 'battle_defeat' })
          endBattleRef.current('defeat')
          setBattleStep('battle_over')
          return
        }
        const firstDeadPlayer = deadPlayers[0]
        if (firstDeadPlayer && arena) {
          arena.playDeath(firstDeadPlayer.defId, () => {
            arena.clearTurn()
            if (battleStepRef.current === 'enemy_applying') setBattleStep('advance_tick')
          })
          return
        }
      } else {
        const updatedEnemies = currentEnemies.map((e) => snap.get(e.id) ?? e)
        const deadEnemies    = updatedEnemies.filter((e) => !isAlive(e))
        deadEnemies.forEach((e) => NarrativeService.emit({ type: 'unit_death', actorId: e.defId }))
        deadEnemies.forEach((e) => unregisterTick(e.id))
        if (updatedEnemies.every((e) => !isAlive(e))) {
          appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
          NarrativeService.emit({ type: 'battle_victory' })
          endBattleRef.current('victory')
          setBattleStep('battle_over')
          return
        }
        const firstDeadEnemy = deadEnemies[0]
        if (firstDeadEnemy && arena) {
          arena.playDeath(firstDeadEnemy.defId, () => {
            arena.clearTurn()
            if (battleStepRef.current === 'enemy_applying') setBattleStep('advance_tick')
          })
          return
        }
      }

      void primaryTarget  // referenced via pendingAITurnRef; kept for symmetry
      if (arena) arena.clearTurn(() => {
        if (battleStepRef.current === 'enemy_applying') setBattleStep('advance_tick')
      })
      else setBattleStep('advance_tick')
      return
    }

    // ── player_applying ───────────────────────────────────────────────────────
    if (battleStep === 'player_applying') {
      const pending = pendingPlayerTurnRef.current
      if (!pending) { return }   // re-run from narrativePaused change; async callbacks handle advance
      pendingPlayerTurnRef.current = null

      const { snap, actor, effectiveTu, primaryTarget, preStatusSnapshot } = pending
      const currentEnemies = enemiesRef.current

      detectNewActivations(snap, preStatusSnapshot)
      setPlayerUnits((prev) => prev.map((u) => {
        const updated = snap.get(u.id) ?? u
        return u.id === actor.id ? incrementActionCount(updated) : updated
      }))
      setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))

      const nextTick = advanceTick(actor.tickPosition, effectiveTu)
      registerTick(actor.id, nextTick)
      globalBattleTickRef.current += effectiveTu
      fireBattleTickIntervalPassives(
        globalBattleTickRef.current, snap,
        passiveDefsRef.current,
        lastBattleIntervalFireRef.current,
        lastBattleIntervalApAccumRef.current,
        globalApAccumRef.current,
      )

      const snapEnemies = currentEnemies.map((e) => snap.get(e.id) ?? e)
      const deadEnemies = snapEnemies.filter((e) => !isAlive(e))
      deadEnemies.forEach((e) => NarrativeService.emit({ type: 'unit_death', actorId: e.defId }))
      deadEnemies.forEach((e) => unregisterTick(e.id))

      const arena = arenaRef.current
      arena?.hideTurnDisplay()

      if (snapEnemies.every((e) => !isAlive(e))) {
        appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
        NarrativeService.emit({ type: 'battle_victory' })
        endBattleRef.current('victory')
        setBattleStep('battle_over')
        return
      }

      const firstDead = deadEnemies[0]
      if (firstDead && arena) {
        arena.playDeath(firstDead.defId, () => {
          arena.clearTurn()
          playPendingExpiryAnims(arena, snap)
          playPendingActivationAnims(arena)
          if (battleStepRef.current === 'player_applying') setBattleStep('advance_tick')
        })
      } else {
        if (arena) {
          arena.clearTurn()
          playPendingExpiryAnims(arena, snap)
          playPendingActivationAnims(arena)
        }
        setBattleStep('advance_tick')
      }

      void primaryTarget  // referenced via pendingPlayerTurnRef; kept for symmetry
      return
    }
  }, [battleStep, isLoading, narrativePaused, inspectingSkill,
    appendLog, pushHistory, registerTick, unregisterTick,
    showTurnDisplay, setUnitSkillsMap, detectNewActivations,
    playPendingExpiryAnims, playPendingActivationAnims])

  // ── setPhase shim (for external callers that still use it) ─────────────────
  const setPhase = useCallback((p: TurnPhase) => {
    if (p === 'player') setBattleStep('player_turn')
    else if (p === 'enemy') setBattleStep('enemy_telegraph')
    else setBattleStep('advance_tick')
  }, [])

  // ── Misc player actions ────────────────────────────────────────────────────
  const selectSkill = useCallback((skill: SkillInstance | null) => {
    setSelectedSkill(skill)
    if (!skill) {
      setSelectedTarget(null)
      setShowTargetPicker(false)
      return
    }
    const def          = getCachedSkill(skill)
    const selector     = def.targeting.selector
    const aliveEnemies = enemiesRef.current.filter(isAlive)

    if (selector === 'enemy' && aliveEnemies.length > 1) {
      setSelectedTarget(null)
      setShowTargetPicker(true)
    } else {
      setShowTargetPicker(false)
      let autoTarget: Unit | null = null
      if (selector === 'enemy') {
        autoTarget = aliveEnemies[0] ?? null
      } else if (selector === 'lowest-hp-enemy') {
        autoTarget = aliveEnemies.reduce<Unit | null>((a, b) => !a || b.hp < a.hp ? b : a, null)
      } else if (selector === 'random-enemy') {
        autoTarget = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)] ?? null
      } else {
        autoTarget = aliveEnemies[0] ?? null
      }
      setSelectedTarget(autoTarget)
      const activePlayer = activePlayerUnitRef.current
      if (autoTarget && activePlayer) {
        const actingMf = manifestsRef.current.get(activePlayer.defId) ?? null
        const targetMf = manifestsRef.current.get(autoTarget.defId) ?? null
        arenaRef.current?.setTurnState(
          activePlayer.defId, autoTarget.defId, actingMf, targetMf,
          {
            acting: unitIsDamaged(activePlayer, actingMf),
            target: unitIsDamaged(autoTarget, targetMf),
          },
        )
      }
    }
  }, [])

  const selectTarget = useCallback((unit: Unit) => {
    setSelectedTarget(unit)
    setShowTargetPicker(false)
    const activePlayer = activePlayerUnitRef.current
    if (activePlayer) {
      const actingMf = manifestsRef.current.get(activePlayer.defId) ?? null
      const targetMf = manifestsRef.current.get(unit.defId) ?? null
      arenaRef.current?.setTurnState(
        activePlayer.defId, unit.defId, actingMf, targetMf,
        {
          acting: unitIsDamaged(activePlayer, actingMf),
          target: unitIsDamaged(unit, targetMf),
        },
      )
    }
  }, [])

  const toggleGrid = useCallback(() => setGridCollapsed((v) => !v), [])

  const getUnitSkills = useCallback((unitId: string): SkillInstance[] => {
    return unitSkillsMap.get(unitId) ?? []
  }, [unitSkillsMap])

  const hyperSenseModeActive = useMemo(
    () => leader !== null && isHyperModeActive(leader),
    [leader],
  )

  // ── Provide ────────────────────────────────────────────────────────────────
  return (
    <BattleContext.Provider value={{
      arenaRef,
      phase,
      narrativePaused,
      turnNumber: (leader?.actionCount ?? 0) + 1,
      tickValue, activeUnitIds,
      playerUnits, leader, activePlayerUnit, enemies, log, historyEntries,
      selectedSkill, selectedTarget, showTargetPicker,
      gridCollapsed, isPaused, isLoading,
      suppressedChipIds, getChipDef,
      diceResult, pendingCounterDecision,
      pendingClash, pendingTeamCollision,
      registeredTicks, scrollBounds,
      getUnitSkills, hyperSenseModeActive, executeSkill, skipTurn, confirmCounter, skipCounter,
      resolveClash, resolveTeamCollision,
      registerTick, unregisterTick, pushHistory,
      setPhase, appendLog, selectSkill, selectTarget, toggleGrid, setPaused,
      skipDice,
      inspectingSkill, setInspectingSkill,
    }}>
      {children}
    </BattleContext.Provider>
  )
}
