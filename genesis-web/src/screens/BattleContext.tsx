// Screen-local context for the Battle screen.
// Thin React bridge — owns UI state, data loading, and navigation.
// All battle logic lives in BattleEngine (core/battle/BattleEngine.ts).

import {
  createContext, useContext, useState, useCallback,
  useMemo, useEffect, useRef, type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { Unit, AnimationManifest, AnimSequenceManifest } from '../core/types'
import type { SkillInstance, EffectContext } from '../core/effects/types'
import { TIMELINE_BUFFER_TICKS, TIMELINE_FUTURE_RANGE, DICE_RESULT_DISMISS_MS } from '../core/constants'
import { resolveTickDisplacement } from '../core/combat/TickDisplacer'
import { createUnit, isAlive, setTickPosition } from '../core/unit'
import { calculateStartingTick } from '../core/combat/TickCalculator'
import { registerSpawnHandler, clearSpawnHandler } from '../core/combat/SpawnBus'
import type { SpawnRequest } from '../core/combat/SpawnBus'
import { applyEffect } from '../core/effects/applyEffect'
import { createSkillInstance } from '../core/engines/skill/SkillInstance'
import { loadCharacterWithSkills, loadStatusDef, loadAnimationManifest, loadAnimSequenceManifest } from '../services/DataService'
import { registerStatusDef, clearStatusRegistry } from '../core/effects/statusRegistry'
import type { PassiveDef, StatusDef } from '../core/effects/types'
import type { BattleArenaHandle } from '../components/AsciiArena'
import type { StatusChipData } from '../components/StatusChipBar'
import type { HistoryEntry } from '../core/battleHistory'
import { useGameStore } from '../core/GameContext'
import { SCREEN_REGISTRY, SCREEN_IDS } from '../navigation/screenRegistry'
import { makeSnapshot, snapshotToBattleState, collectStatusIds } from '../core/battle/BattleSnapshot'
import { isHyperModeActive } from '../core/battle/BattleDamage'
import { getCachedSkill } from '../core/engines/skill/SkillInstance'
import { unitIsDamaged } from '../core/battle/BattleResolution'
import { BattleEngine } from '../core/battle/BattleEngine'
import type { BattleEngineSnapshot, BattleEngineCallbacks, LogEntry, DiceResult, CounterDecision, ClashState, TeamCollisionState, TurnDisplayData } from '../core/battle/EngineTypes'
import type { TurnPhase } from '../core/battle/EngineTypes'

// ── Re-exports for child components ───────────────────────────────────────────
export type { TurnPhase, LogEntry, DiceResult, CounterDecision, ClashState, TeamCollisionState }

// ── Context value shape — must stay identical to what child components expect ──

interface BattleContextValue {
  arenaRef: React.RefObject<BattleArenaHandle | null>
  phase:            TurnPhase
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
  battleError:           string | null
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
  inspectingChip:     StatusChipData | null
  setInspectingChip:  (chip: StatusChipData | null) => void
}

const BattleContext = createContext<BattleContextValue | null>(null)

export function useBattleScreen(): BattleContextValue {
  const ctx = useContext(BattleContext)
  if (!ctx) throw new Error('useBattleScreen must be used inside BattleProvider')
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────────

interface Props { children: ReactNode }

export function BattleProvider({ children }: Props) {
  const selectedMode = useGameStore((s) => s.selectedMode)
  const navigate     = useNavigate()

  // ── Engine ref ─────────────────────────────────────────────────────────────
  const engineRef = useRef<BattleEngine | null>(null)

  // ── Engine snapshot state ──────────────────────────────────────────────────
  const [snapshot, setSnapshot] = useState<BattleEngineSnapshot>({
    battleStep:             'init',
    playerUnits:            [],
    enemies:                [],
    unitSkillsMap:          new Map(),
    registeredTicks:        new Map(),
    tickValue:              0,
    suppressedChipIds:      new Set(),
    pendingCounterDecision: null,
    pendingClash:           null,
    pendingTeamCollision:   null,
  })

  // ── Pure UI state (not tracked by engine) ─────────────────────────────────
  const [battleError, setBattleError]       = useState<string | null>(null)
  const [isLoading, setIsLoading]           = useState(true)
  const [log, setLog]                       = useState<LogEntry[]>([
    { id: '0', text: 'Loading battle…', colour: 'var(--text-muted)' },
  ])
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [selectedSkill, setSelectedSkill]   = useState<SkillInstance | null>(null)
  const [selectedTarget, setSelectedTarget] = useState<Unit | null>(null)
  const [showTargetPicker, setShowTargetPicker] = useState(false)
  const [gridCollapsed, setGridCollapsed]   = useState(false)
  const [isPaused, setPaused]               = useState(false)
  const [inspectingSkill, setInspectingSkillState] = useState<SkillInstance | null>(null)
  const [inspectingChip, setInspectingChip]        = useState<StatusChipData | null>(null)
  const [diceResult, setDiceResult]                = useState<DiceResult | null>(null)

  // ── Refs for arena and misc ────────────────────────────────────────────────
  const arenaRef        = useRef<BattleArenaHandle>(null)
  const statusDefsRef   = useRef<Map<string, StatusDef>>(new Map())
  const manifestsRef    = useRef<Map<string, AnimationManifest | null>>(new Map())
  const diceKeyRef      = useRef(0)
  const diceShowTimeRef = useRef(0)
  const diceResultRef   = useRef<DiceResult | null>(null)
  const diceTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigateRef     = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])
  useEffect(() => { diceResultRef.current = diceResult }, [diceResult])

  // ── Derived from snapshot ──────────────────────────────────────────────────
  const { battleStep, playerUnits, enemies, unitSkillsMap, registeredTicks, tickValue,
          suppressedChipIds, pendingCounterDecision, pendingClash, pendingTeamCollision } = snapshot

  const controlledIds = useMemo<Set<string>>(() => {
    if (selectedMode?.settings.playerControl === 'all') {
      return new Set(playerUnits.map(u => u.id))
    }
    const primaryId = playerUnits[0]?.id
    return primaryId ? new Set([primaryId]) : new Set<string>()
  }, [selectedMode, playerUnits])

  const activeUnitIds = useMemo(() => {
    const ids = new Set<string>()
    for (const [id, tick] of registeredTicks) {
      if (tick === tickValue) ids.add(id)
    }
    return ids
  }, [registeredTicks, tickValue])

  const phase = useMemo<TurnPhase>(() => {
    if (battleStep === 'player_turn') return 'player'
    if (battleStep === 'enemy_telegraph' || battleStep === 'enemy_acting' || battleStep === 'enemy_applying') return 'enemy'
    return 'resolving'
  }, [battleStep])

  const activePlayerUnit = useMemo<Unit | null>(() => {
    if (battleStep !== 'player_turn') return null
    return playerUnits.find(u => activeUnitIds.has(u.id) && controlledIds.has(u.id) && isAlive(u)) ?? null
  }, [battleStep, playerUnits, activeUnitIds, controlledIds])

  const leader = useMemo<Unit | null>(() => {
    return playerUnits.find(u => controlledIds.has(u.id)) ?? null
  }, [playerUnits, controlledIds])

  // Clear target selection when leaving player_turn step.
  useEffect(() => {
    if (battleStep !== 'player_turn') {
      setSelectedTarget(null)
      setShowTargetPicker(false)
    }
  }, [battleStep])

  const scrollBounds = useMemo(() => {
    const ticks = [...registeredTicks.values()]
    const futureFloor = tickValue + TIMELINE_FUTURE_RANGE
    if (!ticks.length) return { min: Math.max(0, tickValue - TIMELINE_BUFFER_TICKS), max: futureFloor }
    return {
      min: Math.max(0, Math.min(...ticks, tickValue) - TIMELINE_BUFFER_TICKS),
      max: Math.max(Math.max(...ticks) + TIMELINE_BUFFER_TICKS, futureFloor),
    }
  }, [registeredTicks, tickValue])

  // ── Show turn display helper ───────────────────────────────────────────────
  const showTurnDisplay = useCallback((d: TurnDisplayData, dismissAfter?: number) => {
    // Engine drives timing; we just forward to arena
    arenaRef.current?.showTurnDisplay(d)
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    const delay = dismissAfter ?? 2000
    dismissTimerRef.current = setTimeout(() => arenaRef.current?.hideTurnDisplay(), delay)
  }, [])

  // ── Error reporting ───────────────────────────────────────────────────────
  const reportError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[BattleEngine]', err)
    setBattleError(msg)
    engineRef.current?.destroy()
    engineRef.current = null
  }, [])

  const safeEngineCall = useCallback((fn: () => void): void => {
    try { fn() } catch (err) { reportError(err) }
  }, [reportError])

  // ── Dice result overlay ────────────────────────────────────────────────────
  const showDiceResult = useCallback((outcome: import('../core/combat/DiceResolver').DiceOutcome, message: string) => {
    if (diceTimerRef.current) clearTimeout(diceTimerRef.current)
    diceKeyRef.current += 1
    diceShowTimeRef.current = Date.now()
    setDiceResult({ outcome, message, animKey: diceKeyRef.current })
    diceTimerRef.current = setTimeout(() => setDiceResult(null), DICE_RESULT_DISMISS_MS)
  }, [])

  const skipDice = useCallback(() => {
    if (!diceResultRef.current) return
    if (diceTimerRef.current) { clearTimeout(diceTimerRef.current); diceTimerRef.current = null }
    setDiceResult(null)
    arenaRef.current?.skipActiveDice()
    engineRef.current?.skipDiceAnim()
  }, [])

  // ── Engine callbacks ───────────────────────────────────────────────────────
  const buildCallbacks = useCallback((): BattleEngineCallbacks => {
    // Wrap each callback so errors that fire from within engine setTimeout calls
    // surface as the error toast rather than crashing the React tree silently.
    const safe = (fn: () => void) => { try { fn() } catch (err) { reportError(err) } }

    return {
      onSetTurnState(actingDefId, targetDefId, actingMf, targetMf, isDamaged) {
        safe(() => arenaRef.current?.setTurnState(actingDefId, targetDefId, actingMf ?? undefined, targetMf ?? undefined, isDamaged))
      },
      onClearTurn() {
        safe(() => arenaRef.current?.clearTurn())
      },
      onPlayDice(outcome) {
        safe(() => arenaRef.current?.playDice(outcome))
      },
      onPlayAttack(actingDefId, targetDefId, outcome, damage, isMelee, dashDx, projectile, label, colour, seq) {
        safe(() => arenaRef.current?.playAttack(actingDefId, targetDefId, outcome, damage, isMelee, dashDx, projectile, label, colour, seq))
      },
      onPlayDeath(defId) {
        safe(() => arenaRef.current?.playDeath(defId))
      },
      onShowTurnDisplay(data, dismissAfter) {
        safe(() => showTurnDisplay(data, dismissAfter))
      },
      onHideTurnDisplay() {
        safe(() => { if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current); arenaRef.current?.hideTurnDisplay() })
      },
      onShowDiceResult(outcome, message) {
        safe(() => showDiceResult(outcome, message))
      },
      onClearDiceResult() {
        safe(() => { if (diceTimerRef.current) clearTimeout(diceTimerRef.current); setDiceResult(null) })
      },
      onNarrativeEmit() {},
      onStateChanged(s) {
        safe(() => setSnapshot({ ...s }))
      },
      onBattleEnd(outcome, turns, xpGained) {
        safe(() => {
          useGameStore.getState().setBattleResult({ outcome, turns, xpGained })
          setTimeout(() => navigateRef.current(SCREEN_REGISTRY[SCREEN_IDS.BATTLE_RESULT].path), 2500)
        })
      },
      onLog(entry) {
        safe(() => setLog(prev => [...prev, { ...entry, id: String(Date.now() + Math.random()) }]))
      },
      onHistory(entry) {
        safe(() => setHistoryEntries(prev => [...prev, entry]))
      },
    }
  }, [showTurnDisplay, showDiceResult, reportError])

  // ── Load battle data and create engine ─────────────────────────────────────
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
          Promise.all(selectedTeamIds.map(id => loadCharacterWithSkills(id))),
          Promise.all(enemyIds.map(id => loadCharacterWithSkills(id))),
        ])

        const allDefIds = [...new Set([...selectedTeamIds, ...enemyIds])]
        const [manifestResults, seqResults] = await Promise.all([
          Promise.all(allDefIds.map(id => loadAnimationManifest(id))),
          Promise.all(allDefIds.map(id => loadAnimSequenceManifest(id))),
        ])
        const manifestMap = new Map<string, AnimationManifest | null>()
        const seqMap      = new Map<string, AnimSequenceManifest | null>()
        allDefIds.forEach((id, i) => { manifestMap.set(id, manifestResults[i]); seqMap.set(id, seqResults[i]) })
        manifestsRef.current = manifestMap

        const loadedPlayers = playerDataArr.map(d =>
          setTickPosition(createUnit(d.characterDef, true), calculateStartingTick(d.characterDef.stats.speed, d.characterDef.className))
        )
        const loadedEnemies = enemyDataArr.map(d =>
          setTickPosition(createUnit(d.characterDef, false), calculateStartingTick(d.characterDef.stats.speed, d.characterDef.className))
        )

        // Force unique starting ticks.
        const ticks = new Map<string, number>()
        const used  = new Set<number>()
        for (const u of [...loadedPlayers, ...loadedEnemies]) {
          let tick = u.tickPosition
          while (used.has(tick)) tick += 1
          ticks.set(u.id, tick)
          used.add(tick)
        }
        const displacedPlayers = loadedPlayers.map(u => { const t = ticks.get(u.id); return t !== undefined && t !== u.tickPosition ? setTickPosition(u, t) : u })
        const displacedEnemies = loadedEnemies.map(u => { const t = ticks.get(u.id); return t !== undefined && t !== u.tickPosition ? setTickPosition(u, t) : u })

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

        // Apply onBattleStart passives.
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
          // Derive controlledIds for engine config.
          const engineControlledIds = storeMode?.settings.playerControl === 'all'
            ? new Set(startedPlayers.map(u => u.id))
            : startedPlayers[0]?.id ? new Set([startedPlayers[0].id]) : new Set<string>()

          const callbacks = buildCallbacks()
          const engine = new BattleEngine({
            playerUnits:     startedPlayers,
            enemies:         startedEnemies,
            unitSkillsMap:   skillsMap,
            registeredTicks: ticks,
            passiveDefs,
            statusDefs,
            manifests:       manifestMap,
            animSequences:   seqMap,
            controlledIds:   engineControlledIds,
          }, callbacks)

          engineRef.current = engine

          setLog([{ id: '1', text: 'Battle started!', colour: 'var(--accent-genesis)' }])
          setIsLoading(false)
          engine.start()
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

    // SpawnBus handler — loads data then calls engine.spawnUnit().
    registerSpawnHandler(async (req: SpawnRequest) => {
      const engine = engineRef.current
      if (!engine) return
      try {
        const data    = await loadCharacterWithSkills(req.defId)
        const rawUnit = createUnit(data.characterDef, req.isAlly)
        const newUnit = setTickPosition(rawUnit, req.currentTick + 1)
        const skills  = data.skillDefs.map(createSkillInstance)
        const manifest = await loadAnimationManifest(req.defId)

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
          const spawnSnap = new Map<string, typeof newUnit>([[newUnit.id, newUnit]])
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

        engine.spawnUnit(finalUnit, skills, data.passiveDef ?? null, manifest)
        setLog(prev => [...prev, { id: String(Date.now()), text: `${data.characterDef.name} has entered the battle!`, colour: 'var(--accent-genesis)' }])
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

  // ── Destroy engine on unmount ──────────────────────────────────────────────
  useEffect(() => () => {
    engineRef.current?.destroy()
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    if (diceTimerRef.current)    clearTimeout(diceTimerRef.current)
  }, [])

  // ── Misc helpers (shims for child components) ──────────────────────────────
  const appendLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog(prev => [...prev, { ...entry, id: String(Date.now() + Math.random()) }])
  }, [])

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistoryEntries(prev => [...prev, entry])
  }, [])

  const getChipDef = useCallback((statusId: string) => {
    return statusDefsRef.current.get(statusId)?.ui?.chip ?? null
  }, [])

  const getUnitSkills = useCallback((unitId: string): SkillInstance[] => {
    return unitSkillsMap.get(unitId) ?? []
  }, [unitSkillsMap])

  // These forward to engine; engine drives the step machine.
  // safeEngineCall catches any synchronous throws and routes them to the error toast.
  const executeSkill = useCallback((skill: SkillInstance) => {
    safeEngineCall(() => engineRef.current?.executeSkill(skill, selectedTarget))
  }, [selectedTarget, safeEngineCall])

  const skipTurn = useCallback(() => {
    safeEngineCall(() => engineRef.current?.skipTurn())
  }, [safeEngineCall])

  const confirmCounter = useCallback(() => {
    safeEngineCall(() => engineRef.current?.confirmCounter())
  }, [safeEngineCall])

  const skipCounter = useCallback(() => {
    safeEngineCall(() => engineRef.current?.skipCounter())
  }, [safeEngineCall])

  const resolveClash = useCallback((winner: 'player' | 'enemy') => {
    safeEngineCall(() => engineRef.current?.resolveClash(winner))
  }, [safeEngineCall])

  const resolveTeamCollision = useCallback((choices: Map<string, 'now' | 'later'>) => {
    safeEngineCall(() => engineRef.current?.resolveTeamCollision(choices))
  }, [safeEngineCall])

  // registerTick and unregisterTick are still exposed for timeline component.
  // Internally engine owns tick registration; bridge delegates.
  const registerTick = useCallback((id: string, tick: number) => {
    // Update snapshot so timeline components see it; engine manages internally.
    setSnapshot(prev => {
      const next = new Map(prev.registeredTicks)
      const finalTick = resolveTickDisplacement(tick, next, id, prev.tickValue)
      next.set(id, finalTick)
      return { ...prev, registeredTicks: next }
    })
  }, [])

  const unregisterTick = useCallback((id: string) => {
    setSnapshot(prev => {
      const next = new Map(prev.registeredTicks)
      next.delete(id)
      return { ...prev, registeredTicks: next }
    })
  }, [])

  const setPhase = useCallback((p: TurnPhase) => {
    // Shim: not typically called from child components; no-op when engine drives.
    void p
  }, [])

  // ── Skill selection ────────────────────────────────────────────────────────
  const selectSkill = useCallback((skill: SkillInstance | null) => {
    setSelectedSkill(skill)
    if (!skill) {
      setSelectedTarget(null)
      setShowTargetPicker(false)
      return
    }
    const def          = getCachedSkill(skill)
    const selector     = def.targeting.selector
    const aliveEnemies = enemies.filter(isAlive)

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
      const activePlayer = activePlayerUnit
      if (autoTarget && activePlayer) {
        const actingMf = manifestsRef.current.get(activePlayer.defId) ?? null
        const targetMf = manifestsRef.current.get(autoTarget.defId) ?? null
        arenaRef.current?.setTurnState(
          activePlayer.defId, autoTarget.defId, actingMf ?? undefined, targetMf ?? undefined,
          { acting: unitIsDamaged(activePlayer, actingMf), target: unitIsDamaged(autoTarget, targetMf) },
        )
      }
    }
  }, [enemies, activePlayerUnit])

  const selectTarget = useCallback((unit: Unit) => {
    setSelectedTarget(unit)
    setShowTargetPicker(false)
    if (activePlayerUnit) {
      const actingMf = manifestsRef.current.get(activePlayerUnit.defId) ?? null
      const targetMf = manifestsRef.current.get(unit.defId) ?? null
      arenaRef.current?.setTurnState(
        activePlayerUnit.defId, unit.defId, actingMf ?? undefined, targetMf ?? undefined,
        { acting: unitIsDamaged(activePlayerUnit, actingMf), target: unitIsDamaged(unit, targetMf) },
      )
    }
  }, [activePlayerUnit])

  const toggleGrid = useCallback(() => setGridCollapsed(v => !v), [])

  const setInspectingSkill = useCallback((skill: SkillInstance | null) => {
    setInspectingSkillState(skill)
    engineRef.current?.setInspectingSkill(skill !== null)
  }, [])

  const hyperSenseModeActive = useMemo(
    () => leader !== null && isHyperModeActive(leader),
    [leader],
  )

  // ── Provide ────────────────────────────────────────────────────────────────
  return (
    <BattleContext.Provider value={{
      arenaRef,
      phase,
      turnNumber: (leader?.actionCount ?? 0) + 1,
      tickValue, activeUnitIds,
      playerUnits, leader, activePlayerUnit, enemies, log, historyEntries,
      selectedSkill, selectedTarget, showTargetPicker,
      gridCollapsed, isPaused, isLoading,
      suppressedChipIds, getChipDef,
      diceResult, pendingCounterDecision,
      pendingClash, pendingTeamCollision,
      registeredTicks, scrollBounds,
      battleError,
      getUnitSkills, hyperSenseModeActive, executeSkill, skipTurn, confirmCounter, skipCounter,
      resolveClash, resolveTeamCollision,
      registerTick, unregisterTick, pushHistory,
      setPhase, appendLog, selectSkill, selectTarget, toggleGrid, setPaused,
      skipDice,
      inspectingSkill, setInspectingSkill,
      inspectingChip,  setInspectingChip,
    }}>
      {children}
    </BattleContext.Provider>
  )
}
