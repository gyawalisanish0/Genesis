// Screen-local context for the Battle screen.
// Ephemeral within-session state: units, log, tick timeline, skill execution.
// The global Zustand store is NOT written during battle frames — only on end.

import {
  createContext, useContext, useState, useCallback,
  useMemo, useEffect, useRef, type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import type { Unit, AnimationManifest, AnimationProjectileDef } from '../core/types'
import type { SkillInstance, BattleState as EngineBattleState, EffectContext, TargetSelector, DodgeConfig } from '../core/effects/types'
import { TIMELINE_BUFFER_TICKS, TIMELINE_FUTURE_RANGE, TURN_DISPLAY_DISMISS_MS, DICE_RESULT_DISMISS_MS, CLASH_ANNOUNCE_MS, ENEMY_AI_DELAY_MS, COUNTER_BASE, COUNTER_STEP, COUNTER_MIN, COUNTER_ANNOUNCE_MS, AI_COUNTER_AP_RESERVE, BATTLE_FEEDBACK_HOLD_MS, SKIP_TU_COST } from '../core/constants'
import { resolveTickDisplacement } from '../core/combat/TickDisplacer'
import { resolveClashWinner, factionAvgSpeed } from '../core/combat/ClashResolver'
import { createUnit, isAlive, setTickPosition, incrementActionCount, tickStatusDurations, consumeStatusStack, updateStatusIntervalTick, isSkillTagBlocked, addApSpent, takeDamage } from '../core/unit'
import { calculateStartingTick, advanceTick, calculateApGained } from '../core/combat/TickCalculator'
import { calculateFinalChance, shiftProbabilities } from '../core/combat/HitChanceEvaluator'
import { roll, resolveCounterRoll, type DiceOutcome } from '../core/combat/DiceResolver'
import { findCounterSkill, canCounter, isSingleTarget } from '../core/combat/CounterResolver'
import { isOnCooldown, applyCooldown, applyTickCooldown, applyTurnCooldown, isBeforeMinTurns } from '../core/combat/CooldownResolver'
import { registerSpawnHandler, clearSpawnHandler } from '../core/combat/SpawnBus'
import type { SpawnRequest } from '../core/combat/SpawnBus'
import { applyEffect } from '../core/effects/applyEffect'
import { createSkillInstance, getCachedSkill } from '../core/engines/skill/SkillInstance'
import { loadCharacterWithSkills, loadStatusDef, loadAnimationManifest } from '../services/DataService'
import { registerStatusDef, clearStatusRegistry }  from '../core/effects/statusRegistry'
import type { PassiveDef, StatusDef, Effect }       from '../core/effects/types'
import { NarrativeService } from '../services/NarrativeService'
import { NarrativeUnits }   from '../components/NarrativeLayer'
import type { BattleArenaHandle, TurnDisplayData } from '../components/BattleArena'
import { resolveAttackAnimation }                  from '../scenes/battle/AnimationResolver'
import { makeHistoryEntry } from '../core/battleHistory'
import type { HistoryEntry } from '../core/battleHistory'
import { useGameStore } from '../core/GameContext'
import { SCREEN_REGISTRY, SCREEN_IDS } from '../navigation/screenRegistry'

// ── Module-level helpers ──────────────────────────────────────────────────────

function unitIsDamaged(unit: Unit, manifest: AnimationManifest | null): boolean {
  return manifest ? unit.hp / unit.maxHp < manifest.idleSwapBelowHpPercent : false
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TurnPhase = 'player' | 'enemy' | 'resolving'

export interface DiceResult {
  outcome: DiceOutcome  // 'Boosted' | 'Success' | 'Tumbling' | 'GuardUp' | 'Evasion' | 'Fail'
  message: string       // short flavour description shown below the outcome name
  animKey: number       // incremented on each show; React key for animation retrigger
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
  phase:            TurnPhase
  narrativePaused:  boolean   // true while a dialogue entry is showing — battle is frozen
  turnNumber:       number    // derived: playerUnits[0].actionCount + 1
  tickValue:        number
  activeUnitIds:    Set<string>
  playerUnits:      Unit[]    // all player-side units (controlled + AI allies)
  leader:           Unit | null  // the controlled leader (always present once loaded); HUD binds here
  activePlayerUnit: Unit | null  // player-controlled unit currently acting; null during enemy phase
  enemies:          Unit[]
  log:             LogEntry[]
  historyEntries:  HistoryEntry[]
  selectedSkill:    SkillInstance | null
  selectedTarget:   Unit | null
  showTargetPicker: boolean
  gridCollapsed:    boolean
  isPaused:         boolean
  isLoading:        boolean
  // Dice result overlay
  diceResult:      DiceResult | null
  // Counter choice prompt — set when player's counter roll succeeds
  pendingCounterDecision: CounterDecision | null
  // Collision overlays
  pendingClash:            ClashState | null
  pendingTeamCollision:    TeamCollisionState | null
  // Timeline
  registeredTicks: Map<string, number>
  scrollBounds:    { min: number; max: number }
  // Skill access
  getUnitSkills:     (unitId: string) => SkillInstance[]
  /** True when the active player unit meets Hyper Mode conditions for Hyper Sense. */
  hyperSenseModeActive: boolean
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
  selectTarget:    (unit: Unit) => void
  toggleGrid:      () => void
  setPaused:       (v: boolean | ((prev: boolean) => boolean)) => void
  // Skip active dice animation early (tap-to-skip UX). Cancels Phaser timers
  // and fires onDone immediately so the attack flow advances without waiting.
  skipDice:        () => void
  // Skill info inspector — long-press a skill to open a centered modal with
  // full description / costs / effects. Setting this also silently freezes the
  // battle (same gate as narrativePaused) so the player can read at leisure.
  inspectingSkill:    SkillInstance | null
  setInspectingSkill: (skill: SkillInstance | null) => void
}

const BattleContext = createContext<BattleContextValue | null>(null)

export function useBattleScreen(): BattleContextValue {
  const ctx = useContext(BattleContext)
  if (!ctx) throw new Error('useBattleScreen must be used inside BattleProvider')
  return ctx
}

// ── Battle state adapter ──────────────────────────────────────────────────────

/** Creates a mutable snapshot for the effects engine to operate on. */
function makeSnapshot(playerUnits: Unit[], enemies: Unit[]): Map<string, Unit> {
  const snap = new Map<string, Unit>()
  playerUnits.forEach((u) => snap.set(u.id, { ...u }))
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

// ── Status / passive helpers ──────────────────────────────────────────────────

/** Collect all status IDs referenced by applyStatus effects in a set of effects. */
function collectStatusIds(effects: readonly Effect[]): string[] {
  return effects
    .filter((e): e is Extract<Effect, { type: 'applyStatus' }> => e.type === 'applyStatus')
    .map(e => e.status)
}

/** After a skill resolves, fire any passive onHpThreshold effects whose threshold was crossed. */
function fireHpThresholdPassives(
  unitId:      string,
  hpBefore:    number,
  passive:     PassiveDef | null,
  snap:        Map<string, Unit>,
  currentTick: number,
): void {
  if (!passive) return
  const unit = snap.get(unitId)
  if (!unit) return

  const maxHp          = unit.maxHp
  const fractionBefore = hpBefore / maxHp
  const fractionAfter  = unit.hp   / maxHp

  for (const effect of passive.effects) {
    if (effect.when.event !== 'onHpThreshold') continue
    const threshold = (effect.when as { event: 'onHpThreshold'; below?: number }).below
    if (threshold === undefined) continue
    if (fractionBefore < threshold) continue   // already below — don't re-fire
    if (fractionAfter  >= threshold) continue  // didn't cross this threshold

    const ctx: EffectContext = {
      caster: unit,
      target: unit,
      battle: snapshotToBattleState(snap),
      source: 'passive',
      event:  effect.when,
      currentTick,
    }
    applyEffect(effect, ctx)
  }
}

/**
 * Check dodge statuses on target before applying damage.
 * Iterates status slots in apply-order (first match wins); each slot's
 * payload.dodgeConfig drives the chance and stack-consumption rules.
 */
function resolveIncomingDodge(
  target:     Unit,
  skillRange: 'melee' | 'ranged' | 'global',
  snap:       Map<string, Unit>,
): { dodged: boolean; consumed: boolean } {
  const targetSnap = snap.get(target.id) ?? target

  for (const slot of targetSnap.statusSlots) {
    if (slot.stacks <= 0) continue
    const cfg = slot.payload?.dodgeConfig as DodgeConfig | undefined
    if (!cfg) continue

    // allChance applies to every range; otherwise use range-specific key.
    const chance = cfg.allChance ?? (skillRange === 'ranged' ? cfg.rangedChance : cfg.meleeChance)
    if (chance === undefined) continue

    const dodged   = Math.random() < chance
    let   consumed = false

    if (cfg.consumeOnAttempt) {
      snap.set(target.id, consumeStatusStack(snap.get(target.id) ?? targetSnap, slot.id))
      consumed = true
    } else if (cfg.consumeOnSuccess && dodged) {
      snap.set(target.id, consumeStatusStack(snap.get(target.id) ?? targetSnap, slot.id))
      consumed = true
    }

    if (dodged) return { dodged: true, consumed }
  }

  return { dodged: false, consumed: false }
}

/**
 * Builds a BattleState that intercepts HP reductions and routes them through
 * any active shield or HP/AP swap on the target unit. Returns the state plus a
 * map populated with break metadata for any unit whose shield broke.
 */
function makeShieldedBattleState(
  snap:          Map<string, Unit>,
  shieldBrokeIds: Map<string, { skillId: string; ticks: number } | undefined>,
): ReturnType<typeof snapshotToBattleState> {
  return {
    getUnit:     (id) => snap.get(id),
    getAllUnits: () => [...snap.values()],
    setUnit:     (unit) => {
      const prev = snap.get(unit.id)
      if (!prev || unit.hp >= prev.hp) { snap.set(unit.id, unit); return }

      // HP/AP swap: damage hits AP pool instead of HP.
      if (prev.statusSlots.some(s => s.payload?.hpApSwapped === true)) {
        const damage = prev.hp - unit.hp
        snap.set(unit.id, { ...prev, ap: Math.max(0, prev.ap - damage) })
        return
      }

      const shieldSlot = prev.statusSlots.find(
        s => typeof s.payload?.shieldHp === 'number' && (s.payload.shieldHp as number) > 0,
      )
      const shieldHp   = typeof shieldSlot?.payload?.shieldHp === 'number' ? shieldSlot.payload.shieldHp : 0
      if (!shieldSlot || shieldHp <= 0) { snap.set(unit.id, unit); return }

      const damage      = prev.hp - unit.hp
      const absorbed    = Math.min(damage, shieldHp)
      const overflow    = damage - absorbed
      const newShieldHp = shieldHp - absorbed

      if (newShieldHp <= 0) {
        // Shield broke — capture break metadata, remove shield + any overflow-doubling companion.
        const breakCd = shieldSlot.payload?.onBreakTickCooldown as { skillId: string; ticks: number } | undefined
        const penaltyActive = prev.statusSlots.some(s => s.payload?.doublesShieldOverflow === true)
        const withoutShield: Unit = {
          ...prev,
          hp: Math.max(0, prev.hp - overflow),
          statusSlots: prev.statusSlots.filter(
            s => s.id !== shieldSlot.id && !s.payload?.doublesShieldOverflow,
          ),
        }
        // Double the overflow when a penalty-window companion status was active.
        if (penaltyActive && overflow > 0) {
          snap.set(unit.id, { ...withoutShield, hp: Math.max(0, withoutShield.hp - overflow) })
        } else {
          snap.set(unit.id, withoutShield)
        }
        shieldBrokeIds.set(unit.id, breakCd)
      } else {
        // Shield absorbed everything — update shield HP, restore HP to prev.
        const updatedSlot = { ...shieldSlot, payload: { ...shieldSlot.payload, shieldHp: newShieldHp } }
        snap.set(unit.id, {
          ...prev,
          statusSlots: prev.statusSlots.map(s =>
            s.id === shieldSlot.id ? updatedSlot : s,
          ),
        })
      }
    },
  }
}

/**
 * Returns true when a unit is in hyper mode — detected purely from slot payloads,
 * no hardcoded status IDs. Conditions (both must hold):
 *   1. At least one slot carries payload.hyperModeTrigger === true
 *   2. At least one slot carries payload.hyperModeConfig and its stacks are
 *      below hyperModeConfig.activeBelowStacks
 * Both fields are copied from StatusDef into the slot payload by applyStatus.
 */
function isHyperModeActive(unit: Unit): boolean {
  const hasTrigger = unit.statusSlots.some(s => s.payload?.hyperModeTrigger === true)
  if (!hasTrigger) return false
  return unit.statusSlots.some(s => {
    const cfg = s.payload?.hyperModeConfig as { activeBelowStacks: number } | undefined
    return cfg !== undefined && s.stacks < cfg.activeBelowStacks
  })
}

/** Fire onExpire effects for a StatusDef using the owning unit as caster. */
function fireStatusExpiry(
  owner:  Unit,
  def:    StatusDef,
  snap:   Map<string, Unit>,
): void {
  const expireEffects = def.effects.filter(e => e.when.event === 'onExpire')
  if (!expireEffects.length) return
  const ctx: EffectContext = {
    caster: snap.get(owner.id) ?? owner,
    battle: snapshotToBattleState(snap),
    source: 'status',
    event:  { event: 'onExpire' },
  }
  for (const effect of expireEffects) {
    applyEffect(effect, ctx)
  }
}

/**
 * Computes the effective TU cost of a skill for a unit by applying all
 * active tuCostConfig status payloads. Accounts for both own secondaryResource
 * and any resourceOverlay values from broadcast statuses.
 * Minimum effective TU is always 1.
 */
function getEffectiveTuCost(baseTu: number, unit: Unit): number {
  const ownFrequency = unit.secondaryResource
  const overlayFrequency = unit.statusSlots.reduce(
    (sum, s) => sum + (((s.payload?.resourceOverlay) as number | undefined) ?? 0),
    0,
  )
  const totalFrequency = ownFrequency + overlayFrequency

  let effective = baseTu
  for (const slot of unit.statusSlots) {
    const config = slot.payload?.tuCostConfig as {
      delta?: number
      percentOfBase?: number
      percentPerSecondary?: number
    } | undefined
    if (!config) continue
    if (config.percentPerSecondary !== undefined) {
      effective = Math.round(effective * (1 - totalFrequency * config.percentPerSecondary / 100))
    } else if (config.percentOfBase !== undefined) {
      effective = Math.round(baseTu * (1 - config.percentOfBase / 100))
    } else if (config.delta !== undefined) {
      effective = effective + config.delta
    }
  }
  return Math.max(1, effective)
}

/**
 * Fires onOpponentAction passive effects for all units opposing the actor.
 * Called after each action so passive observers (e.g. Tactical Scan) can respond.
 */
function fireOpponentActionEffects(
  actor:       Unit,
  snap:        Map<string, Unit>,
  passiveDefs: Map<string, PassiveDef | null>,
  tick:        number,
): void {
  const observers = [...snap.values()].filter(u => u.isAlly !== actor.isAlly && u.hp > 0)
  for (const obs of observers) {
    const passive = passiveDefs.get(obs.id)
    if (!passive) continue
    const unit = snap.get(obs.id) ?? obs
    const ctx: EffectContext = {
      caster:      unit,
      battle:      snapshotToBattleState(snap),
      source:      'passive',
      event:       { event: 'onOpponentAction' },
      currentTick: tick,
    }
    for (const effect of passive.effects) {
      if (effect.when.event === 'onOpponentAction') applyEffect(effect, ctx)
    }
  }
}

/**
 * Fires onCounterTrigger passive effects for the unit whose counter just fired.
 * Enables mechanics that escalate on successful counters (e.g. Vast Influence).
 */
function fireCounterTriggerEffects(
  counterUnit: Unit,
  snap:        Map<string, Unit>,
  passiveDefs: Map<string, PassiveDef | null>,
  tick:        number,
): void {
  const passive = passiveDefs.get(counterUnit.id)
  if (!passive) return
  const unit = snap.get(counterUnit.id) ?? counterUnit
  const ctx: EffectContext = {
    caster:      unit,
    battle:      snapshotToBattleState(snap),
    source:      'passive',
    event:       { event: 'onCounterTrigger' },
    currentTick: tick,
  }
  for (const effect of passive.effects) {
    if (effect.when.event === 'onCounterTrigger') applyEffect(effect, ctx)
  }
}

/**
 * Fires onCounterCast skill effects when a skill is used as a reactive counter.
 * Called in confirmCounter and the AI counter path inside scheduleCounterChain.
 * `attacker` is the original attacking unit (the one that was countered against).
 */
function fireCounterCastEffects(
  counterUnit:  Unit,
  attacker:     Unit,
  counterSkill: SkillInstance,
  snap:         Map<string, Unit>,
  tick:         number,
): void {
  const caster = snap.get(counterUnit.id) ?? counterUnit
  const target = snap.get(attacker.id)   ?? attacker
  const ctx: EffectContext = {
    caster,
    target,
    battle:      snapshotToBattleState(snap),
    source:      'skill',
    event:       { event: 'onCounterCast' },
    currentTick: tick,
  }
  for (const effect of counterSkill.cachedEffects) {
    if (effect.when.event === 'onCounterCast') applyEffect(effect, ctx)
  }
}

/** Returns the first active critConfig from any of the unit's status slot payloads. */
function readCritConfig(unit: Unit): { chance: number; attackerStrPercent: number } | undefined {
  for (const slot of unit.statusSlots) {
    const cfg = slot.payload?.critConfig as { chance: number; attackerStrPercent: number } | undefined
    if (cfg) return cfg
  }
  return undefined
}

/** Fire onApSpent passive effects after a unit spends AP on a skill. */
function fireOnApSpent(
  unit:       Unit,
  _apCost:    number,
  passive:    PassiveDef | null,
  snap:       Map<string, Unit>,
  tick:       number,
): void {
  if (!passive) return
  const ctx: EffectContext = {
    caster:      snap.get(unit.id) ?? unit,
    battle:      snapshotToBattleState(snap),
    source:      'passive',
    event:       { event: 'onApSpent' },
    currentTick: tick,
  }
  for (const effect of passive.effects) {
    if (effect.when.event === 'onApSpent') applyEffect(effect, ctx)
  }
}

/**
 * Fire onBattleTickInterval passive effects for any unit whose interval has elapsed.
 * Called after each unit action; globalTick is the cumulative TU spent so far.
 */
function fireBattleTickIntervalPassives(
  globalTick:    number,
  snap:          Map<string, Unit>,
  passiveDefs:   Map<string, PassiveDef | null>,
  lastFireMap:   Map<string, number>,
  lastApBaseMap: Map<string, number>,
  globalApAccum: number,
): void {
  for (const [unitId, passive] of passiveDefs) {
    if (!passive) continue
    for (const effect of passive.effects) {
      if (effect.when.event !== 'onBattleTickInterval') continue
      const interval = effect.when.interval
      const lastFire = lastFireMap.get(unitId) ?? 0
      if (globalTick - lastFire < interval) continue
      const unit = snap.get(unitId)
      if (!unit || !isAlive(unit)) continue
      const apBase = lastApBaseMap.get(unitId) ?? 0
      const ctx: EffectContext = {
        caster:            unit,
        battle:            snapshotToBattleState(snap),
        source:            'passive',
        event:             { event: 'onBattleTickInterval', interval },
        currentTick:       globalTick,
        globalApSpentPool: globalApAccum - apBase,
      }
      applyEffect(effect, ctx)
      lastFireMap.set(unitId, globalTick)
      lastApBaseMap.set(unitId, globalApAccum)
    }
  }
}

/** Fire onUnitTurnStart status effects for a unit at the start of its turn. */
function fireTurnStartEffects(
  unit:       Unit,
  statusDefs: Map<string, StatusDef>,
  snap:       Map<string, Unit>,
  tick:       number,
): void {
  const current = snap.get(unit.id) ?? unit
  for (const slot of current.statusSlots) {
    const def = statusDefs.get(slot.id)
    if (!def) continue
    for (const effect of def.effects) {
      if (effect.when.event !== 'onUnitTurnStart') continue
      const ctx: EffectContext = {
        caster: snap.get(unit.id) ?? current,
        target: snap.get(unit.id) ?? current,
        battle: snapshotToBattleState(snap),
        source: 'status',
        event:  { event: 'onUnitTurnStart' },
        currentTick: tick,
      }
      applyEffect(effect, ctx)
    }
  }
}

// ── Caster-relative target resolution ────────────────────────────────────────

/**
 * Resolves the full list of targets for a skill cast.
 * Selector semantics are caster-relative: 'enemy' = opposite faction of caster,
 * 'ally' = same faction. Works identically for player and AI casters.
 *
 * @param preferred  Pre-selected target (used only for the 'enemy' single selector).
 */
function resolveSkillTargets(
  caster:    Unit,
  selector:  TargetSelector,
  snap:      Map<string, Unit>,
  preferred: Unit | null = null,
): Unit[] {
  if (typeof selector === 'object') return []   // tag selectors unsupported in v0.1
  const alive   = [...snap.values()].filter(u => u.hp > 0)
  const foes    = alive.filter(u => u.isAlly !== caster.isAlly)
  const friends = alive.filter(u => u.isAlly === caster.isAlly && u.id !== caster.id)
  switch (selector) {
    case 'enemy': {
      const pref = preferred && foes.find(u => u.id === preferred.id)
      return pref ? [pref] : foes.slice(0, 1)
    }
    case 'all-enemies':    return foes
    case 'lowest-hp-enemy': return foes.length ? [[...foes].sort((a, b) => a.hp - b.hp)[0]] : []
    case 'random-enemy':   return foes.length ? [foes[Math.floor(Math.random() * foes.length)]] : []
    case 'self':           return [snap.get(caster.id) ?? caster]
    case 'ally':           return friends.slice(0, 1)
    case 'all-allies':     return friends
    case 'lowest-hp-ally': return friends.length ? [[...friends].sort((a, b) => a.hp - b.hp)[0]] : []
    case 'random-ally':    return friends.length ? [friends[Math.floor(Math.random() * friends.length)]] : []
    case 'caster-and-target': return [caster, ...foes.slice(0, 1)]
    default:               return foes.slice(0, 1)
  }
}

/** Selector-aware skill picker for AI: prefer AoE when 2+ foes, single-target otherwise. */
function pickAiSkill(
  availableSkills: SkillInstance[],
  foeCount:        number,
): SkillInstance {
  const preferAoe   = foeCount > 1
  const preferred   = availableSkills.find(s => {
    const sel = getCachedSkill(s).targeting.selector
    return preferAoe ? sel === 'all-enemies' : sel === 'enemy'
  })
  return preferred ?? availableSkills[0]
}

// ── Outcome helpers ───────────────────────────────────────────────────────────

function outcomeColour(outcome: DiceOutcome): string {
  switch (outcome) {
    case 'Boosted': return 'var(--accent-gold)'
    case 'Evade':   return 'var(--accent-evasion)'
    case 'Fail':    return 'var(--text-muted)'
    default:        return 'var(--text-primary)'  // Hit
  }
}

function buildOutcomeMessage(
  outcome: DiceOutcome,
  actorName: string,
  targetName: string,
): string {
  switch (outcome) {
    case 'Boosted': return `${actorName} lands a boosted hit`
    case 'Hit':     return `${actorName} hits`
    case 'Evade':   return `${targetName} evades`
    case 'Fail':    return `${actorName} misses`
  }
}

// ── Arena feedback helpers ────────────────────────────────────────────────────

function buildFeedbackText(outcome: DiceOutcome, damage: number): string {
  if (outcome === 'Evade') return 'EVADED!'
  if (outcome === 'Fail')  return 'MISS!'
  if (damage <= 0)         return outcome.toUpperCase()
  const prefix = outcome === 'Boosted' ? '★ ' : ''
  return `${prefix}−${damage} HP`
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface Props { children: ReactNode }

export function BattleProvider({ children }: Props) {
  const selectedMode = useGameStore((s) => s.selectedMode)
  const navigate     = useNavigate()

  // Guard: fires only once per battle — prevents double-navigation on multi-kill.
  const battleEndedRef = useRef(false)

  // Maps unitId → PassiveDef (null when the unit has no passive).
  const passiveDefsRef = useRef<Map<string, PassiveDef | null>>(new Map())

  // Maps statusId → StatusDef — populated at load, used by status expiry processing.
  const statusDefsRef  = useRef<Map<string, StatusDef>>(new Map())

  // Global battle-time tracker: cumulative TU spent by all units since battle start.
  const globalBattleTickRef = useRef<number>(0)
  // Total AP spent by all units since battle start — feeds globalApSpentPercent ValueExpr.
  const globalApAccumRef    = useRef<number>(0)
  // Per-unit baseline for AP accumulation at each onBattleTickInterval trigger.
  const lastBattleIntervalFireRef  = useRef<Map<string, number>>(new Map())
  const lastBattleIntervalApAccumRef = useRef<Map<string, number>>(new Map())

  // Tracks "{unitId}:{tickValue}" keys where onUnitTurnStart was already fired this turn.
  const turnStartFiredRef = useRef(new Set<string>())

  // ── Core unit state ────────────────────────────────────────────────────────
  const [isLoading, setIsLoading]     = useState(true)
  const [playerUnits, setPlayerUnits] = useState<Unit[]>([])
  const [enemies, setEnemies]         = useState<Unit[]>([])

  // Per-unit skill instances: Map<unitId, SkillInstance[]>
  const [unitSkillsMap, setUnitSkillsMap] = useState<Map<string, SkillInstance[]>>(
    () => new Map(),
  )

  // ── Controlled-unit derivation ─────────────────────────────────────────────
  // 'single' (default): only playerUnits[0] responds to player input; the rest are AI allies.
  // 'all': every player unit is player-controlled, acting on their own tick turns.
  const controlledIds = useMemo<Set<string>>(() => {
    if (selectedMode?.settings.playerControl === 'all') {
      return new Set(playerUnits.map((u) => u.id))
    }
    const primaryId = playerUnits[0]?.id
    return primaryId ? new Set([primaryId]) : new Set<string>()
  }, [selectedMode, playerUnits])

  const controlledIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => { controlledIdsRef.current = controlledIds }, [controlledIds])

  // Turn display dismiss timer — controls showTurnDisplay auto-hide timing
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
  const [selectedTarget, setSelectedTarget] = useState<Unit | null>(null)
  const [showTargetPicker, setShowTargetPicker] = useState(false)
  const [gridCollapsed, setGridCollapsed]   = useState(false)
  const [isPaused, setPaused]               = useState(false)
  const [narrativePaused, setNarrativePaused] = useState(false)
  const [inspectingSkill, setInspectingSkill] = useState<SkillInstance | null>(null)
  const arenaRef      = useRef<BattleArenaHandle>(null)
  const manifestsRef  = useRef<Map<string, AnimationManifest | null>>(new Map())
  const [pendingCounterDecision, setPendingCounterDecision] = useState<CounterDecision | null>(null)
  const [pendingClash, setPendingClash]               = useState<ClashState | null>(null)
  const [pendingTeamCollision, setPendingTeamCollision] = useState<TeamCollisionState | null>(null)
  // Set to the winner side while the clash-result log entry is briefly shown.
  // Phase is advanced to the winner's side after CLASH_ANNOUNCE_MS.
  const [pendingClashAnnounce, setPendingClashAnnounce] = useState<'player' | 'enemy' | null>(null)
  const clashAnnounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Ref mirrors for the three clash guard values.
  // The phase derivation effect reads these instead of the state values so that
  // clearing any of them (setState → null) does NOT re-trigger the effect and
  // re-detect a clash that was already resolved at the same tick.
  const pendingClashRef         = useRef<ClashState | null>(null)
  const pendingTeamCollisionRef = useRef<TeamCollisionState | null>(null)
  const pendingClashAnnounceRef = useRef<'player' | 'enemy' | null>(null)

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

        // Load animation manifests for all characters in parallel.
        const allDefIds        = [...new Set([...selectedTeamIds, ...enemyIds])]
        const manifestResults  = await Promise.all(allDefIds.map((id) => loadAnimationManifest(id)))
        const manifestMap      = new Map<string, AnimationManifest | null>()
        allDefIds.forEach((id, i) => manifestMap.set(id, manifestResults[i]))
        manifestsRef.current = manifestMap

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

        // Force every unit onto a unique starting tick. The general
        // resolveTickDisplacement only displaces when TICK_MAX_OCCUPANCY (4) is
        // reached, but the synchronous AI for-loop calls arena.playDice once per
        // active unit — a second call destroys the first call's onDone chain,
        // which freezes the battle. Strict uniqueness at battle open prevents
        // any starting collision regardless of party size.
        const ticks = new Map<string, number>()
        const used  = new Set<number>()
        const allLoaded = [...loadedPlayers, ...loadedEnemies]
        for (const u of allLoaded) {
          let tick = u.tickPosition
          while (used.has(tick)) tick += 1
          ticks.set(u.id, tick)
          used.add(tick)
        }
        // Sync displaced ticks back into unit objects so registeredTicks and
        // unit.tickPosition stay consistent.
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

        // Load passives and referenced status defs; register statuses for sync lookup.
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
            // Also collect status IDs referenced inside the status's own effects.
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

        // Fire onBattleStart passive effects for all units before committing state.
        const battleStartSnap = makeSnapshot(displacedPlayers, displacedEnemies)
        for (const { unitId, passive } of passiveResults) {
          if (!passive) continue
          const unit = battleStartSnap.get(unitId)
          if (!unit) continue
          for (const effect of passive.effects) {
            if (effect.when.event !== 'onBattleStart') continue
            const ctx: EffectContext = {
              caster: unit,
              target: unit,
              battle: snapshotToBattleState(battleStartSnap),
              source: 'passive',
              event:  { event: 'onBattleStart' },
              currentTick: 0,
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

        // Register status defs for any statuses the spawned unit references.
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

        // Fire onBattleStart passive effects for the newly spawned unit.
        let finalUnit = newUnit
        if (data.passiveDef) {
          const spawnSnap = new Map<string, Unit>([[newUnit.id, newUnit]])
          for (const effect of data.passiveDef.effects) {
            if (effect.when.event !== 'onBattleStart') continue
            const ctx: EffectContext = {
              caster:      spawnSnap.get(newUnit.id) ?? newUnit,
              target:      spawnSnap.get(newUnit.id) ?? newUnit,
              battle:      snapshotToBattleState(spawnSnap),
              source:      'passive',
              event:       { event: 'onBattleStart' },
              currentTick: req.currentTick,
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
  }, [])

  // ── Turn display helpers ───────────────────────────────────────────────────

  // Shows the Phaser TurnDisplayPanel and schedules its auto-dismiss.
  // Clears any pending dismiss so a new action replaces the previous display.
  // dismissAfter defaults to TURN_DISPLAY_DISMISS_MS; enemy telegraph passes a
  // longer value (ENEMY_AI_DELAY_MS + DICE_RESULT_DISMISS_MS) to keep the panel
  // visible through the full AI delay + dice animation sequence.
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

  // Tap-to-skip dice: cancels the Phaser dice spin animation (firing its
  // onDone immediately so the attack flow advances) AND clears the React-side
  // dice-result auto-dismiss so subsequent enemy AI timing computes 0 remaining.
  const skipDice = useCallback(() => {
    if (!diceResultRef.current) return
    if (diceTimerRef.current) {
      clearTimeout(diceTimerRef.current)
      diceTimerRef.current = null
    }
    setDiceResult(null)
    arenaRef.current?.skipActiveDice()
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
      pendingClashAnnounceRef.current = null
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

  // The player-controlled unit whose tick is currently active during the player phase.
  // null during the enemy phase or while resolving.
  const activePlayerUnit = useMemo<Unit | null>(() => {
    if (phase !== 'player') return null
    return playerUnits.find((u) => activeUnitIds.has(u.id) && controlledIds.has(u.id)) ?? null
  }, [phase, playerUnits, activeUnitIds, controlledIds])

  const activePlayerUnitRef = useRef<Unit | null>(null)
  useEffect(() => { activePlayerUnitRef.current = activePlayerUnit }, [activePlayerUnit])

  // The leader unit — always derived from controlledIds. With the default
  // 'single' control mode, controlledIds has one entry: playerUnits[0].
  // With 'all' mode, the first controlled unit is treated as the HUD anchor.
  const leader = useMemo<Unit | null>(() => {
    return playerUnits.find((u) => controlledIds.has(u.id)) ?? null
  }, [playerUnits, controlledIds])

  // ── Log + history helpers ──────────────────────────────────────────────────
  // Declared here (before phase-derivation) so the phase effect can call appendLog.

  const appendLog = useCallback((entry: Omit<LogEntry, 'id'>) => {
    setLog((prev) => [...prev, { ...entry, id: String(Date.now() + Math.random()) }])
  }, [])

  const pushHistory = useCallback((entry: HistoryEntry) => {
    setHistoryEntries((prev) => [...prev, entry])
  }, [])

  // Derive phase from active unit ids — with collision detection.
  // Guard values are read from refs (not state) so that clearing any of them
  // does not re-trigger this effect and re-detect an already-resolved clash
  // while activeUnitIds still has both units at the same tick.
  useEffect(() => {
    if (isLoading || activeUnitIds.size === 0) return
    if (narrativePaused || inspectingSkill) return
    if (pendingClashRef.current || pendingTeamCollisionRef.current || pendingClashAnnounceRef.current) return

    // Player-controlled units active at this tick vs all AI units (enemies + non-controlled allies).
    const activeControlled = playerUnits.filter((u) => activeUnitIds.has(u.id) && controlledIds.has(u.id))
    const activeAIAllies   = playerUnits.filter((u) => activeUnitIds.has(u.id) && !controlledIds.has(u.id))
    const activeEnemyUnits = enemies.filter((e) => activeUnitIds.has(e.id))
    const hasClash         = activeControlled.length > 0 && activeEnemyUnits.length > 0

    if (hasClash) {
      const allActive = [...activeControlled, ...activeEnemyUnits]
      const hasUniqueClash = allActive.some((u) => u.clashUniqueEnabled)

      if (hasUniqueClash) {
        pendingClashRef.current = { playerUnits: activeControlled, enemyUnits: activeEnemyUnits }
        setPendingClash(pendingClashRef.current)
        return
      }

      // Normal clash: resolve by average effective speed + weighted dice on tie.
      const winner      = resolveClashWinner(activeControlled, activeEnemyUnits)
      const winnerUnits = winner === 'player' ? activeControlled  : activeEnemyUnits
      const loserUnits  = winner === 'player' ? activeEnemyUnits  : activeControlled
      const winnerAvg   = Math.round(factionAvgSpeed(winnerUnits))
      const loserAvg    = Math.round(factionAvgSpeed(loserUnits))
      appendLog({
        text:   `CLASH — ${winnerUnits.map((u) => u.name).join(' & ')} acts first (avg. speed ${winnerAvg} vs ${loserAvg})`,
        colour: winner === 'player' ? 'var(--accent-info)' : 'var(--accent-danger)',
      })
      winnerUnits.forEach((u) => NarrativeService.emit({ type: 'clash_resolved', actorId: u.defId }))
      pendingClashAnnounceRef.current = winner
      setPendingClashAnnounce(winner)
      return
    }

    // Multiple controlled player units at the same tick — speed check or Now/Later prompt.
    if (activeControlled.length > 1) {
      const bySpeed = [...activeControlled].sort((a, b) => b.stats.speed - a.stats.speed)
      if (bySpeed[0].stats.speed !== bySpeed[1].stats.speed) {
        setPhase('player')
      } else {
        const choices = new Map(activeControlled.map((u) => [u.id, null as 'now' | 'later' | null]))
        pendingTeamCollisionRef.current = { units: activeControlled, choices }
        setPendingTeamCollision(pendingTeamCollisionRef.current)
      }
      return
    }

    // AI units (enemies + non-controlled allies) — AI handles all of them.
    const allActiveAI = [...activeAIAllies, ...activeEnemyUnits]
    if (allActiveAI.length > 0) {
      setPhase('enemy')
      return
    }

    if (activeControlled.length === 1) {
      const activeUnit = activeControlled[0]
      const turnKey    = `${activeUnit.id}:${tickValue}`
      if (!turnStartFiredRef.current.has(turnKey)) {
        turnStartFiredRef.current.add(turnKey)
        const snap = makeSnapshot(playerUnitsRef.current, enemiesRef.current)
        fireTurnStartEffects(activeUnit, statusDefsRef.current, snap, tickValue)
        const updated = snap.get(activeUnit.id)
        if (updated) setPlayerUnits(prev => prev.map(u => u.id === updated.id ? updated : u))
      }
      setPhase('player')
      // Canvas stays blank until player selects a target — setTurnState is called in selectTarget/selectSkill.
    }
  }, [activeUnitIds, playerUnits, enemies, controlledIds, isLoading, narrativePaused, inspectingSkill, appendLog, tickValue])

  // Clear pending target selection whenever it is no longer the player's turn.
  useEffect(() => {
    if (phase !== 'player') {
      setSelectedTarget(null)
      setShowTargetPicker(false)
    }
  }, [phase])

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
  const playerUnitsRef   = useRef(playerUnits)
  const enemiesRef       = useRef(enemies)
  const unitSkillsMapRef = useRef(unitSkillsMap)
  useEffect(() => { playerUnitsRef.current = playerUnits },   [playerUnits])
  useEffect(() => { enemiesRef.current = enemies },           [enemies])
  useEffect(() => { unitSkillsMapRef.current = unitSkillsMap }, [unitSkillsMap])
  useEffect(() => { diceResultRef.current = diceResult },    [diceResult])

  // End-of-battle: commit result to the store and navigate to the result screen.
  // Guarded by battleEndedRef so only the first call fires (multi-kill safety).
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

  // Refs for mutual recursion between runAttack and scheduleCounterChain.
  // Both useCallbacks reference each other only through these refs so neither
  // has the other in its dependency array.
  const runAttackRef            = useRef<((caster: Unit, target: Unit, skillInst: SkillInstance, snap: Map<string, Unit>, chainDepth?: number) => { outcome: DiceOutcome; damage: number }) | null>(null)
  const scheduleCounterChainRef = useRef<((defender: Unit, originalCaster: Unit, counterSkill: SkillInstance, snap: Map<string, Unit>, depth: number) => void) | null>(null)

  /** Execute one attack: caster hits target using the given SkillInstance. */
  const runAttack = useCallback((
    caster: Unit,
    target: Unit,
    skillInst: SkillInstance,
    snap: Map<string, Unit>,
    chainDepth = 0,
  ): { outcome: DiceOutcome; damage: number } => {
    const skill       = getCachedSkill(skillInst)

    // Dodge status check: resolve before dice so status-based evasion overrides the roll.
    const { dodged } = resolveIncomingDodge(target, skill.targeting.range, snap)

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
    // AP regen for the caster — skipped when any status has freezesApRegen in its payload.
    const casterSnap   = snap.get(caster.id)
    const apFrozen     = casterSnap?.statusSlots.some(s => s.payload?.freezesApRegen === true) ?? false
    const ticksElapsed = tickValue > 0 ? skill.tuCost : 0
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
      currentTick: tickValue,
    }

    for (const effect of skillInst.cachedEffects) {
      if (effect.when.event === 'onCast') applyEffect(effect, ctx)
    }

    // Dispatch outcome-specific events after onCast.
    if (!noDamage) {
      const hitCtx = { ...ctx, event: { event: 'onHit' } as const }
      for (const effect of skillInst.cachedEffects) {
        if (effect.when.event === 'onHit') applyEffect(effect, hitCtx)
      }
    } else if (diceOutcome === 'Evade') {
      // onEvade effects always receive the target so partial-damage mechanics work.
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

    // Crit bonus damage — fires when attacker has an active critConfig status and
    // the attack landed. Applies 180% (or configured %) of attacker STR as bonus
    // damage on top of normal skill effects. Routes through shield like any damage.
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

    // Notify opposing passives that an action occurred.
    fireOpponentActionEffects(caster, snap, passiveDefsRef.current, tickValue)

    // Reactive counter: check if the evading unit can counter-attack.
    if (diceOutcome === 'Evade' && isSingleTarget(skill)) {
      const defenderSnap   = snap.get(target.id) ?? target
      const defenderSkills = unitSkillsMapRef.current.get(target.id) ?? []
      const counterSkill   = findCounterSkill(defenderSkills)
      if (counterSkill && canCounter(defenderSnap, counterSkill)) {
        scheduleCounterChainRef.current?.(defenderSnap, caster, counterSkill, snap, chainDepth)
      }
    }

    // Fire passive onHpThreshold for the target if HP crossed below a threshold.
    fireHpThresholdPassives(target.id, targetHpBefore, passiveDefsRef.current.get(target.id) ?? null, snap, tickValue)
    // Fire passive onHpThreshold for the caster too (self-damage skills, recoil, etc.).
    if (caster.id !== target.id) {
      fireHpThresholdPassives(caster.id, casterHpBefore, passiveDefsRef.current.get(caster.id) ?? null, snap, tickValue)
    }

    // Apply break cooldown to the relevant skill on any unit whose shield broke.
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

    // Tick down caster's turn-based statuses, fire interval heals and onExpire.
    const casterAfter = snap.get(caster.id) ?? caster
    const { unit: casterTicked, expired } = tickStatusDurations(casterAfter)
    let casterFinal = casterTicked

    for (const slot of casterTicked.statusSlots) {
      const def = statusDefsRef.current.get(slot.id)
      if (!def) continue
      for (const effect of def.effects) {
        if (effect.when.event !== 'onTickInterval') continue
        const interval = (effect.when as { event: 'onTickInterval'; interval: number }).interval
        if (slot.nextIntervalFireTick === 0 || tickValue < slot.nextIntervalFireTick) continue
        // Use the original applier as caster so 'of: caster' stat refs resolve to the applier.
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
        casterFinal = updateStatusIntervalTick(casterFinal, slot.id, tickValue + interval)
        snap.set(caster.id, casterFinal)
      }
    }

    snap.set(caster.id, casterFinal)
    for (const expiredSlot of expired) {
      const def = statusDefsRef.current.get(expiredSlot.id)
      if (def) fireStatusExpiry(casterFinal, def, snap)
    }

    const damage = Math.max(0, targetHpBefore - (snap.get(target.id)?.hp ?? targetHpBefore))
    return { outcome: diceOutcome, damage }
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
      fireCounterCastEffects(defender, originalCaster, counterSkill, snap, tickValue)
      fireCounterTriggerEffects(defender, snap, passiveDefsRef.current, tickValue)
      setTimeout(() => {
        setPlayerUnits((prev) => prev.map((u) => snap.get(u.id) ?? u))
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
    pendingClashRef.current = null
    setPendingClash(null)
    setPhase(winner === 'player' ? 'player' : 'enemy')
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
    showDiceResult('Evade', `${defender.name} attempts a counter!`)

    setTimeout(() => {
      const succeeded     = resolveCounterRoll(depth)
      const chancePercent = Math.round(Math.max(COUNTER_MIN, COUNTER_BASE - depth * COUNTER_STEP) * 100)
      showDiceResult(
        succeeded ? 'Hit' : 'Fail',
        succeeded ? `Counter! (${chancePercent}% chance)` : 'Counter blocked!',
      )

      if (!succeeded) return

      NarrativeService.emit({ type: 'counter', actorId: defender.defId, targetId: originalCaster.defId })

      // Player-controlled ally evades → prompt; AI ally or enemy evades → auto-fire.
      if (defender.isAlly && controlledIdsRef.current.has(defender.id)) {
        // Player counter — present choice prompt; AP deducted only on confirm.
        // Counter reactions bypass cooldown: no applyCooldown here or in confirmCounter.
        setPendingCounterDecision({ defender, originalCaster, counterSkill, snap, depth })
      } else {
        // AI counter (enemy or non-controlled ally) — fire only if AP reserve allows.
        const defSnap    = snap.get(defender.id) ?? defender
        const shouldFire = defSnap.ap - counterSkill.cachedCosts.apCost >= AI_COUNTER_AP_RESERVE

        if (shouldFire) {
          snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })
          // Counter reactions bypass cooldown: no applyCooldown called.
          setTimeout(() => {
            runAttackRef.current?.(defender, originalCaster, counterSkill, snap, depth + 1)
            fireCounterCastEffects(defender, originalCaster, counterSkill, snap, tickValue)
            fireCounterTriggerEffects(defender, snap, passiveDefsRef.current, tickValue)
            setTimeout(() => {
              setPlayerUnits((prev) => prev.map((u) => snap.get(u.id) ?? u))
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
    const actor = activePlayerUnitRef.current
    if (!actor || phase !== 'player') return
    if (narrativePaused || inspectingSkill) return
    if (isOnCooldown(actor, skillInst)) return

    const skill = getCachedSkill(skillInst)

    // Block skills that haven't met the minimum turns requirement.
    if (isBeforeMinTurns(actor, skill.minTurns)) return

    // Block skills that are guarded by an active status's blocksRecastOfSkill payload.
    if (actor.statusSlots.some(s => s.payload?.blocksRecastOfSkill === skill.id)) return

    // Block stunned units from executing any skill.
    if (actor.statusSlots.some(s => s.payload?.stunned === true)) return

    // Block skills whose tags are locked by an active status on the caster.
    if (isSkillTagBlocked(actor, skill.tags)) return
    const snap       = makeSnapshot(playerUnitsRef.current, enemiesRef.current)
    const allTargets = resolveSkillTargets(actor, skill.targeting.selector, snap, selectedTarget)
    if (!allTargets.length) return

    // Deduct skill cost — from HP when HP/AP swap is active, otherwise from AP.
    if (skill.apCost > 0) {
      const actorSnap = snap.get(actor.id) ?? actor
      const hpApSwapped = actorSnap.statusSlots.some(s => s.payload?.hpApSwapped === true)
      const withCost = hpApSwapped
        ? addApSpent({ ...actorSnap, hp: Math.max(0, actorSnap.hp - skill.apCost) }, skill.apCost)
        : addApSpent({ ...actorSnap, ap: Math.max(0, actorSnap.ap - skill.apCost) }, skill.apCost)
      snap.set(actor.id, withCost)
      globalApAccumRef.current += skill.apCost
      fireOnApSpent(withCost, skill.apCost, passiveDefsRef.current.get(actor.id) ?? null, snap, tickValue)
    }

    const primaryTarget = allTargets[0]

    // Primary target: full dice roll + narrative + effects.
    const { outcome, damage: primaryDamage } = runAttack(actor, primaryTarget, skillInst, snap)

    // Additional targets (multi-target skills): same outcome, effects re-applied without re-rolling.
    let extraDamage = 0
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
          currentTick: tickValue,
        }
        for (const effect of skillInst.cachedEffects) {
          if (effect.when.event === 'onCast') applyEffect(effect, ctx)
        }
        const hpAfter = (snap.get(extra.id) ?? extra).hp
        extraDamage += Math.max(0, hpBefore - hpAfter)
        appendLog({ text: `${actor.name} → ${skill.name} on ${extra.name} [${outcome}]`, colour: outcomeColour(outcome) })
      }
    }
    const totalDamage = primaryDamage + extraDamage

    // Apply cooldown immediately at cast time so the badge updates right away.
    // hyper-tagged skills use hyperCooldown (turn-based) when cast in hyper mode.
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

    const fromTick     = actor.tickPosition
    const effectiveTu  = getEffectiveTuCost(skill.tuCost, snap.get(actor.id) ?? actor)
    const nextTick     = advanceTick(fromTick, effectiveTu)

    pushHistory(makeHistoryEntry(actor.id, actor.name, fromTick, actor.isAlly))

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

    // Apply state after animations complete: HP bars + timeline marker jump.
    const applyState = () => {
      setPlayerUnits((prev) => prev.map((u) => {
        const updated = snap.get(u.id) ?? u
        return u.id === actor.id ? incrementActionCount(updated) : updated
      }))
      setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
      registerTick(actor.id, nextTick)
      globalBattleTickRef.current += effectiveTu
      fireBattleTickIntervalPassives(
        globalBattleTickRef.current, snap,
        passiveDefsRef.current,
        lastBattleIntervalFireRef.current,
        lastBattleIntervalApAccumRef.current,
        globalApAccumRef.current,
      )

      const snapEnemies = enemiesRef.current.map((e) => snap.get(e.id) ?? e)
      const deadEnemies = snapEnemies.filter((e) => !isAlive(e))
      deadEnemies.forEach((e) => NarrativeService.emit({ type: 'unit_death', actorId: e.defId }))
      if (snapEnemies.every((e) => !isAlive(e))) {
        appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
        NarrativeService.emit({ type: 'battle_victory' })
        endBattleRef.current('victory')
      }

      const arena     = arenaRef.current
      arena?.hideTurnDisplay()
      const firstDead = deadEnemies[0]
      if (firstDead && arena) {
        arena.playDeath(firstDead.defId, () => arena.clearTurn())
      } else {
        arena?.clearTurn()
      }
    }

    // Phase-gated: dice animation → attack animation → feedback → apply state.
    // Falls back to plain timer when the Phaser canvas is not mounted.
    const feedbackText = buildFeedbackText(outcome, allTargets.length > 1 ? totalDamage : primaryDamage)
    const arena = arenaRef.current
    if (arena) {
      const actorManifest  = manifestsRef.current.get(actor.defId) ?? null
      const actorDamaged   = unitIsDamaged(actor, actorManifest)
      const resolved       = actorManifest ? resolveAttackAnimation(actorManifest, skill.id, skill.tags, actorDamaged) : null
      const isMelee        = resolved?.isMelee ?? false
      const dashDx         = resolved?.dashDx  ?? 0
      const projectile: AnimationProjectileDef | null = actorManifest?.projectile ?? null
      arena.playDice(outcome, () => {
        arena.playAttack(actor.defId, primaryTarget.defId, outcome, primaryDamage, isMelee, dashDx, projectile, () => {
          arena.playFeedback(feedbackText, outcomeColour(outcome))
          if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
          playerApplyTimerRef.current = setTimeout(applyState, BATTLE_FEEDBACK_HOLD_MS)
        })
      })
    } else {
      if (playerApplyTimerRef.current) clearTimeout(playerApplyTimerRef.current)
      playerApplyTimerRef.current = setTimeout(applyState, DICE_RESULT_DISMISS_MS)
    }
  }, [phase, narrativePaused, inspectingSkill, selectedTarget, runAttack, pushHistory, registerTick, appendLog, showTurnDisplay, setUnitSkillsMap])

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
    if (narrativePaused || inspectingSkill) return

    // AI handles: active non-controlled player allies + active enemies (sorted fastest-first).
    const controlled       = controlledIdsRef.current
    const activeAIAllies   = playerUnitsRef.current.filter((u) => activeUnitIds.has(u.id) && isAlive(u) && !controlled.has(u.id))
    const activeEnemies    = enemiesRef.current.filter((e) => activeUnitIds.has(e.id) && isAlive(e))
    const allAIUnits       = [...activeAIAllies, ...activeEnemies]
    if (!allAIUnits.length) return

    // Compute remaining player-dice animation time (0 if no active dice).
    const remainingDice = diceResultRef.current !== null
      ? Math.max(0, DICE_RESULT_DISMISS_MS - (Date.now() - diceShowTimeRef.current))
      : 0

    // Step 1 + 2: after player dice clears, show telegraph + arena unit stage.
    const telegraphTimer = setTimeout(() => {
      const firstAIUnit    = allAIUnits[0]
      const currentPlayers = playerUnitsRef.current
      const currentEnemies = enemiesRef.current
      const previewSkills  = (unitSkillsMapRef.current.get(firstAIUnit.id) ?? [])
        .filter((s) => {
          if (isOnCooldown(firstAIUnit, s)) return false
          const def = getCachedSkill(s)
          if (isBeforeMinTurns(firstAIUnit, def.minTurns)) return false
          if (isSkillTagBlocked(firstAIUnit, def.tags)) return false
          return true
        })
      if (!previewSkills.length) return

      // Foe count for this unit: allies count enemies as foes, enemies count player units.
      const aliveFoes = firstAIUnit.isAlly
        ? currentEnemies.filter(isAlive)
        : currentPlayers.filter(isAlive)
      const previewSkillInst = pickAiSkill(previewSkills, aliveFoes.length)
      const previewSkill     = getCachedSkill(previewSkillInst)

      const telegraphSnap  = makeSnapshot(currentPlayers, currentEnemies)
      const previewTargets = resolveSkillTargets(firstAIUnit, previewSkill.targeting.selector, telegraphSnap)
      const previewTarget  = previewTargets[0] ?? null

      if (previewTarget) {
        const actingMf  = manifestsRef.current.get(firstAIUnit.defId) ?? null
        const targetMf  = manifestsRef.current.get(previewTarget.defId) ?? null
        arenaRef.current?.setTurnState(
          firstAIUnit.defId, previewTarget.defId, actingMf, targetMf,
          {
            acting: unitIsDamaged(firstAIUnit, actingMf),
            target: unitIsDamaged(previewTarget, targetMf),
          },
        )
      }

      showTurnDisplay(
        {
          actor: {
            name:        firstAIUnit.name,
            className:   firstAIUnit.className,
            rarity:      firstAIUnit.rarity,
            hp:          firstAIUnit.hp,
            maxHp:       firstAIUnit.maxHp,
            ap:          firstAIUnit.ap,
            maxAp:       firstAIUnit.maxAp,
            statusSlots: firstAIUnit.statusSlots,
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
          } : { name: '—', className: '—', rarity: 1, hp: 0, maxHp: 1, ap: 0, maxAp: 1, statusSlots: [] },
          isAlly: firstAIUnit.isAlly,
        },
        ENEMY_AI_DELAY_MS + DICE_RESULT_DISMISS_MS,
      )
    }, remainingDice)

    // Step 3: after telegraph delay, fire the attack (dice starts here).
    const actionTimer = setTimeout(() => {
      const currentPlayers = playerUnitsRef.current
      const currentEnemies = enemiesRef.current
      const currentSkills  = unitSkillsMapRef.current
      if (!currentPlayers.some(isAlive) && !currentEnemies.some(isAlive)) return

      const sortedAIUnits = [...allAIUnits].sort((a, b) => b.stats.speed - a.stats.speed)

      // Fire onUnitTurnStart status effects for each AI unit before it acts.
      {
        const snap = makeSnapshot(currentPlayers, currentEnemies)
        for (const aiUnit of sortedAIUnits) {
          const key = `${aiUnit.id}:${tickValue}`
          if (!turnStartFiredRef.current.has(key)) {
            turnStartFiredRef.current.add(key)
            fireTurnStartEffects(aiUnit, statusDefsRef.current, snap, tickValue)
          }
        }
        const updatedPlayers = currentPlayers.map(u => snap.get(u.id) ?? u)
        const updatedEnemies = currentEnemies.map(u => snap.get(u.id) ?? u)
        setPlayerUnits(updatedPlayers)
        setEnemies(updatedEnemies)
      }

      for (const aiUnit of sortedAIUnits) {
        const allUnitSkills   = currentSkills.get(aiUnit.id) ?? []
        const availableSkills = allUnitSkills.filter((s) => {
          if (isOnCooldown(aiUnit, s)) return false
          const def = getCachedSkill(s)
          if (isBeforeMinTurns(aiUnit, def.minTurns)) return false
          if (aiUnit.statusSlots.some(st => st.payload?.blocksRecastOfSkill === def.id)) return false
          if (aiUnit.statusSlots.some(st => st.payload?.stunned === true)) return false
          if (isSkillTagBlocked(aiUnit, def.tags)) return false
          return true
        })
        if (!availableSkills.length) {
          const fromTick = aiUnit.tickPosition
          pushHistory(makeHistoryEntry(aiUnit.id, aiUnit.name, fromTick, aiUnit.isAlly))
          registerTick(aiUnit.id, advanceTick(fromTick, SKIP_TU_COST))
          globalBattleTickRef.current += SKIP_TU_COST
          const aiSkipSnap = makeSnapshot(currentPlayers, currentEnemies)
          fireBattleTickIntervalPassives(
            globalBattleTickRef.current, aiSkipSnap,
            passiveDefsRef.current,
            lastBattleIntervalFireRef.current,
            lastBattleIntervalApAccumRef.current,
            globalApAccumRef.current,
          )
          appendLog({ text: `${aiUnit.name} is gathering strength…`, colour: 'var(--text-muted)' })
          arenaRef.current?.clearTurn()
          continue
        }

        // Selector-aware skill: prefer AoE when caster has multiple foes.
        const aliveFoes = aiUnit.isAlly
          ? currentEnemies.filter(isAlive)
          : currentPlayers.filter(isAlive)
        const skillInst  = pickAiSkill(availableSkills, aliveFoes.length)
        const skill      = getCachedSkill(skillInst)
        const snap       = makeSnapshot(currentPlayers, currentEnemies)
        const allTargets = resolveSkillTargets(aiUnit, skill.targeting.selector, snap)
        if (!allTargets.length) { arenaRef.current?.clearTurn(); continue }

        // Deduct skill cost — from HP when HP/AP swap is active, otherwise from AP.
        if (skill.apCost > 0) {
          const aiSnap     = snap.get(aiUnit.id) ?? aiUnit
          const hpApSwapped = aiSnap.statusSlots.some(s => s.payload?.hpApSwapped === true)
          const withCost   = hpApSwapped
            ? addApSpent({ ...aiSnap, hp: Math.max(0, aiSnap.hp - skill.apCost) }, skill.apCost)
            : addApSpent({ ...aiSnap, ap: Math.max(0, aiSnap.ap - skill.apCost) }, skill.apCost)
          snap.set(aiUnit.id, withCost)
          globalApAccumRef.current += skill.apCost
          fireOnApSpent(withCost, skill.apCost, passiveDefsRef.current.get(aiUnit.id) ?? null, snap, tickValue)
        }

        const primaryTarget = allTargets[0]
        const { outcome, damage: primaryDamage } = runAttack(aiUnit, primaryTarget, skillInst, snap)

        // Additional targets for multi-target skills.
        let extraDamage = 0
        if (allTargets.length > 1) {
          const noDamage = outcome === 'Evade' || outcome === 'Fail'
          for (const extra of allTargets.slice(1)) {
            const extraSnap = snap.get(extra.id) ?? extra
            if (!isAlive(extraSnap)) continue
            const hpBefore = extraSnap.hp
            const ctx: EffectContext = {
              caster:      aiUnit,
              target:      noDamage ? undefined : extra,
              battle:      snapshotToBattleState(snap),
              source:      'skill',
              event:       { event: 'onCast' },
              dice:        outcome,
              currentTick: tickValue,
            }
            for (const effect of skillInst.cachedEffects) {
              if (effect.when.event === 'onCast') applyEffect(effect, ctx)
            }
            extraDamage += Math.max(0, hpBefore - (snap.get(extra.id) ?? extra).hp)
            appendLog({ text: `${aiUnit.name} → ${skill.name} on ${extra.name} [${outcome}]`, colour: outcomeColour(outcome) })
          }
        }
        const totalDamage = primaryDamage + extraDamage

        const withCooldown = applyCooldown(aiUnit, skillInst, skill)
        setUnitSkillsMap((prev) => {
          const next   = new Map(prev)
          const skills = next.get(aiUnit.id) ?? []
          next.set(aiUnit.id, skills.map((s) => s.defId === skillInst.defId ? withCooldown : s))
          return next
        })

        // Step 4: apply state after animations complete.
        const aiEffectiveTu = getEffectiveTuCost(skill.tuCost, snap.get(aiUnit.id) ?? aiUnit)
        const applyAIState = () => {
          setPlayerUnits((prev) => prev.map((u) => snap.get(u.id) ?? u))
          setEnemies((prev) => prev.map((e) => snap.get(e.id) ?? e))
          const fromTick = aiUnit.tickPosition
          pushHistory(makeHistoryEntry(aiUnit.id, aiUnit.name, fromTick, aiUnit.isAlly))
          registerTick(aiUnit.id, advanceTick(fromTick, aiEffectiveTu))
          globalBattleTickRef.current += aiEffectiveTu
          fireBattleTickIntervalPassives(
            globalBattleTickRef.current, snap,
            passiveDefsRef.current,
            lastBattleIntervalFireRef.current,
            lastBattleIntervalApAccumRef.current,
            globalApAccumRef.current,
          )

          const arena = arenaRef.current
          arena?.hideTurnDisplay()

          if (!aiUnit.isAlly) {
            // Enemy attacked: check if all player units are now dead (defeat).
            const updatedPlayers = currentPlayers.map((u) => snap.get(u.id) ?? u)
            const deadPlayers    = updatedPlayers.filter((u) => !isAlive(u))
            deadPlayers.forEach((u) => NarrativeService.emit({ type: 'unit_death', actorId: u.defId }))
            if (updatedPlayers.every((u) => !isAlive(u))) {
              appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
              NarrativeService.emit({ type: 'battle_defeat' })
              endBattleRef.current('defeat')
            }
            const firstDeadPlayer = deadPlayers[0]
            if (firstDeadPlayer && arena) {
              arena.playDeath(firstDeadPlayer.defId, () => arena.clearTurn())
              return
            }
          } else {
            // AI ally attacked: check if all enemies are now dead (victory).
            const updatedEnemies = currentEnemies.map((e) => snap.get(e.id) ?? e)
            const deadEnemies    = updatedEnemies.filter((e) => !isAlive(e))
            deadEnemies.forEach((e) => NarrativeService.emit({ type: 'unit_death', actorId: e.defId }))
            if (updatedEnemies.every((e) => !isAlive(e))) {
              appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
              NarrativeService.emit({ type: 'battle_victory' })
              endBattleRef.current('victory')
            }
            const firstDeadEnemy = deadEnemies[0]
            if (firstDeadEnemy && arena) {
              arena.playDeath(firstDeadEnemy.defId, () => arena.clearTurn())
              return
            }
          }
          arena?.clearTurn()
        }

        const feedbackText = buildFeedbackText(outcome, allTargets.length > 1 ? totalDamage : primaryDamage)
        const arena = arenaRef.current
        if (arena) {
          const aiManifest   = manifestsRef.current.get(aiUnit.defId) ?? null
          const aiDamaged    = unitIsDamaged(aiUnit, aiManifest)
          const aiResolved   = aiManifest ? resolveAttackAnimation(aiManifest, skill.id, skill.tags, aiDamaged) : null
          const aiIsMelee    = aiResolved?.isMelee ?? false
          const aiDashDx     = aiResolved?.dashDx  ?? 0
          const aiProjectile: AnimationProjectileDef | null = aiManifest?.projectile ?? null
          arena.playDice(outcome, () => {
            arena.playAttack(aiUnit.defId, primaryTarget.defId, outcome, primaryDamage, aiIsMelee, aiDashDx, aiProjectile, () => {
              arena.playFeedback(feedbackText, outcomeColour(outcome))
              applyTimerRef.current = setTimeout(applyAIState, BATTLE_FEEDBACK_HOLD_MS)
            })
          })
        } else {
          applyTimerRef.current = setTimeout(applyAIState, DICE_RESULT_DISMISS_MS)
        }
      }
    }, remainingDice + ENEMY_AI_DELAY_MS)

    return () => {
      clearTimeout(telegraphTimer)
      clearTimeout(actionTimer)
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current)
    }
  }, [phase, activeUnitIds, narrativePaused, inspectingSkill, showTurnDisplay]) // refs keep callbacks current; diceResult intentionally excluded

  // ── Misc actions ───────────────────────────────────────────────────────────

  /** Player skips their turn — no dice, immediate timeline update. */
  const skipTurn = useCallback(() => {
    const actor = activePlayerUnitRef.current
    if (!actor || phase !== 'player') return
    if (narrativePaused || inspectingSkill) return
    setSelectedSkill(null)
    setSelectedTarget(null)
    setShowTargetPicker(false)
    const fromTick  = actor.tickPosition
    const apFrozen  = actor.statusSlots.some(s => s.payload?.freezesApRegen === true)
    const apGained  = apFrozen ? 0 : calculateApGained(SKIP_TU_COST, actor.apRegenRate)
    pushHistory(makeHistoryEntry(actor.id, actor.name, fromTick, actor.isAlly))
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
  }, [phase, narrativePaused, inspectingSkill, pushHistory, registerTick, appendLog])

  const selectSkill = useCallback((skill: SkillInstance | null) => {
    setSelectedSkill(skill)
    if (!skill) {
      setSelectedTarget(null)
      setShowTargetPicker(false)
      return
    }
    const def      = getCachedSkill(skill)
    const selector     = def.targeting.selector
    const currentEnemies = enemiesRef.current
    const aliveEnemies   = currentEnemies.filter(isAlive)

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

  /** Player confirms a target from the target picker overlay. */
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

  const toggleGrid  = useCallback(() => setGridCollapsed((v) => !v), [])

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
