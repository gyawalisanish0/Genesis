// BattleEngine — pure TypeScript class that drives the entire battle loop.
// No React, no Phaser, no Capacitor, no service imports.
// All side-effects fire outward through BattleEngineCallbacks.

import type { Unit, AnimationManifest, AnimationProjectileDef, AnimSequenceManifest, AnimPhase } from '../types'
import type { SkillInstance, EffectContext, PassiveDef, StatusDef } from '../effects/types'
import type { DiceOutcome } from '../combat/DiceResolver'
import type {
  BattleEngineConfig, BattleEngineCallbacks, BattleEngineSnapshot,
  PendingPlayerTurnData, PendingAITurnData, CounterDecision, ClashState, TeamCollisionState,
  TurnDisplayData,
} from './EngineTypes'
import type { BattleStep } from './BattleStepMachine'
import { YIELDED_STEPS } from './BattleStepMachine'
import {
  DICE_RESULT_DISMISS_MS, TURN_DISPLAY_DISMISS_MS, CLASH_ANNOUNCE_MS,
  AI_THINKING_MIN_MS, AI_THINKING_MAX_MS, AI_INPUT_MIN_MS, AI_INPUT_MAX_MS,
  COUNTER_BASE, COUNTER_STEP, COUNTER_MIN, COUNTER_ANNOUNCE_MS, AI_COUNTER_AP_RESERVE,
  ANIM_TIMEOUT_MS, SKIP_TU_COST, BETWEEN_TURN_PAUSE_MS,
} from '../constants'
import { resolveTickDisplacement } from '../combat/TickDisplacer'
import { resolveClashWinner, factionAvgSpeed } from '../combat/ClashResolver'
import { isAlive, incrementActionCount, tickStatusDurations, updateStatusIntervalTick, isSkillTagBlocked, addApSpent, takeDamage } from '../unit'
import { advanceTick, calculateApGained } from '../combat/TickCalculator'
import { calculateFinalChance, shiftProbabilities } from '../combat/HitChanceEvaluator'
import { roll, resolveCounterRoll } from '../combat/DiceResolver'
import { findCounterSkill, canCounter, isSingleTarget } from '../combat/CounterResolver'
import { isOnCooldown, applyCooldown, applyTickCooldown, applyTurnCooldown, isBeforeMinTurns } from '../combat/CooldownResolver'
import { applyEffect } from '../effects/applyEffect'
import { getCachedSkill } from '../engines/skill/SkillInstance'
import { makeHistoryEntry } from '../battleHistory'
import { makeSnapshot, snapshotToBattleState } from './BattleSnapshot'
import { resolveIncomingDodge, makeShieldedBattleState, isHyperModeActive, getEffectiveTuCost, readCritConfig, resolveIncomingDeflect } from './BattleDamage'
import {
  fireHpThresholdPassives, fireStatusExpiry, fireOpponentActionEffects,
  fireCounterTriggerEffects, fireCounterCastEffects, fireOnApSpent,
  fireBattleTickIntervalPassives, fireTurnStartEffects,
} from './BattlePassive'
import { resolveSkillTargets, unitIsDamaged, outcomeColour, buildOutcomeMessage, buildOutcomeLabel } from './BattleResolution'
import { computeAITurn } from './BattleAIRunner'
import { resolveAttackAnimation } from './AnimationResolver'

// ── Helpers ────────────────────────────────────────────────────────────────────

const randomMs = (min: number, max: number): number =>
  min + Math.floor(Math.random() * (max - min + 1))

// ── BattleEngine ───────────────────────────────────────────────────────────────

export class BattleEngine {
  // ── Core state ───────────────────────────────────────────────────────────────
  private step:           BattleStep
  private playerUnits:    Unit[]
  private enemies:        Unit[]
  private unitSkillsMap:  Map<string, SkillInstance[]>
  private registeredTicks: Map<string, number>
  private tickValue:      number
  private globalBattleTick:   number
  private globalApAccum:      number
  private lastIntervalFire:   Map<string, number>
  private lastIntervalApAccum: Map<string, number>
  private turnStartFired: Set<string>
  private battleEnded:    boolean

  // ── Config / maps ────────────────────────────────────────────────────────────
  private readonly controlledIds: Set<string>
  private readonly passiveDefs:   Map<string, PassiveDef | null>
  private readonly statusDefs:    Map<string, StatusDef>
  private manifests:    Map<string, AnimationManifest | null>
  private animSequences: Map<string, AnimSequenceManifest | null>

  // ── Pending turn data ────────────────────────────────────────────────────────
  private pendingPlayerTurn:   PendingPlayerTurnData | null
  private pendingAITurn:       PendingAITurnData | null
  private clashAnnounceWinner: 'player' | 'enemy' | null

  // ── Decision overlays ────────────────────────────────────────────────────────
  private pendingCounterDecision: CounterDecision | null
  private pendingClash:           ClashState | null
  private pendingTeamCollision:   TeamCollisionState | null
  private suppressedChipIds:      Set<string>

  // ── Animation queues ─────────────────────────────────────────────────────────
  private pendingExpiryAnims:     Array<{ ownerDefId: string; sequenceId: string; damage: number }>
  private pendingActivationAnims: Array<{ ownerDefId: string; sequenceId: string; slotId: string }>

  // ── Dice overlay state ───────────────────────────────────────────────────────
  private diceShowTime: number
  private diceKey:      number
  private diceActive:   boolean

  // ── Pause flags ──────────────────────────────────────────────────────────────
  private narrativePaused: boolean
  private inspectingSkill: boolean

  // ── Timers ───────────────────────────────────────────────────────────────────
  private telegraphTimer:      ReturnType<typeof setTimeout> | null
  private applyTimer:          ReturnType<typeof setTimeout> | null
  private playerApplyTimer:    ReturnType<typeof setTimeout> | null
  private attackTimer:         ReturnType<typeof setTimeout> | null
  private pendingAttackCb:     (() => void) | null
  private clashAnnounceTimer:  ReturnType<typeof setTimeout> | null
  private diceTimer:           ReturnType<typeof setTimeout> | null
  private dismissTimer:        ReturnType<typeof setTimeout> | null

  // ── Callbacks ────────────────────────────────────────────────────────────────
  private readonly cb: BattleEngineCallbacks

  constructor(config: BattleEngineConfig, callbacks: BattleEngineCallbacks) {
    this.step           = 'init'
    this.playerUnits    = config.playerUnits
    this.enemies        = config.enemies
    this.unitSkillsMap  = new Map(config.unitSkillsMap)
    this.registeredTicks = new Map(config.registeredTicks)
    this.tickValue      = 0
    this.globalBattleTick    = 0
    this.globalApAccum       = 0
    this.lastIntervalFire    = new Map()
    this.lastIntervalApAccum = new Map()
    this.turnStartFired = new Set()
    this.battleEnded    = false

    this.controlledIds = config.controlledIds
    this.passiveDefs   = config.passiveDefs
    this.statusDefs    = config.statusDefs
    this.manifests     = config.manifests
    this.animSequences = config.animSequences

    this.pendingPlayerTurn   = null
    this.pendingAITurn       = null
    this.clashAnnounceWinner = null

    this.pendingCounterDecision = null
    this.pendingClash           = null
    this.pendingTeamCollision   = null
    this.suppressedChipIds      = new Set()

    this.pendingExpiryAnims     = []
    this.pendingActivationAnims = []

    this.diceShowTime = 0
    this.diceKey      = 0
    this.diceActive   = false

    this.narrativePaused = false
    this.inspectingSkill = false

    this.telegraphTimer     = null
    this.applyTimer         = null
    this.playerApplyTimer   = null
    this.attackTimer        = null
    this.pendingAttackCb    = null
    this.clashAnnounceTimer = null
    this.diceTimer          = null
    this.dismissTimer       = null

    this.cb = callbacks
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  start(): void {
    this.setStep('advance_tick')
    this.drive()
  }

  destroy(): void {
    if (this.dismissTimer)        clearTimeout(this.dismissTimer)
    if (this.diceTimer)           clearTimeout(this.diceTimer)
    if (this.applyTimer)          clearTimeout(this.applyTimer)
    if (this.playerApplyTimer)    clearTimeout(this.playerApplyTimer)
    if (this.attackTimer)         clearTimeout(this.attackTimer)
    if (this.telegraphTimer)      clearTimeout(this.telegraphTimer)
    if (this.clashAnnounceTimer)  clearTimeout(this.clashAnnounceTimer)
  }

  // ── Public state mutations (from React bridge) ─────────────────────────────

  setNarrativePaused(v: boolean): void {
    this.narrativePaused = v
    this.drive()
  }

  setInspectingSkill(v: boolean): void {
    this.inspectingSkill = v
    this.drive()
  }

  spawnUnit(
    unit: Unit,
    skills: SkillInstance[],
    passive: PassiveDef | null,
    manifest: AnimationManifest | null,
  ): void {
    this.unitSkillsMap = new Map([...this.unitSkillsMap, [unit.id, skills]])
    this.manifests.set(unit.defId, manifest)
    if (passive) {
      this.passiveDefs.set(unit.id, passive)
    }
    this.registerTickInternal(unit.id, unit.tickPosition)
    if (unit.isAlly) {
      this.playerUnits = [...this.playerUnits, unit]
    } else {
      this.enemies = [...this.enemies, unit]
    }
    this.notify()
  }

  // ── Public action methods ──────────────────────────────────────────────────

  executeSkill(skillInst: SkillInstance, selectedTarget: Unit | null): void {
    if (this.step !== 'player_turn') return
    const actor = this.getActivePlayerUnit()
    if (!actor) return
    if (!isAlive(actor)) return
    if (this.narrativePaused || this.inspectingSkill) return
    if (isOnCooldown(actor, skillInst)) return

    const skill = getCachedSkill(skillInst)
    if (isBeforeMinTurns(actor, skill.minTurns)) return
    if (actor.statusSlots.some(s => s.payload?.blocksRecastOfSkill === skill.id)) return
    if (actor.statusSlots.some(s => s.payload?.stunned === true)) return
    if (isSkillTagBlocked(actor, skill.tags)) return

    const snap = makeSnapshot(this.playerUnits, this.enemies)
    const preStatusSnapshot = new Map(
      [...snap].map(([uid, u]) => [uid, new Set(u.statusSlots.map(s => s.id))])
    )

    const allTargets = resolveSkillTargets(actor, skill.targeting.selector, snap, selectedTarget)
    if (!allTargets.length) return

    const currentTick = this.tickValue

    this.applySkillAPCost(actor.id, skill.apCost, snap, currentTick)

    const primaryTarget = allTargets[0]
    const { outcome, damage: primaryDamage } = this.runAttack(actor, primaryTarget, skillInst, snap)

    if (allTargets.length > 1) {
      this.applySplashEffects(actor, skillInst, allTargets.slice(1), snap, outcome, currentTick)
    }

    const isHyperCast = skill.tags.includes('hyper') && skill.hyperCooldown !== undefined
      && isHyperModeActive(snap.get(actor.id) ?? actor)
    const withCooldown = isHyperCast
      ? applyTurnCooldown(actor, skillInst, skill.hyperCooldown!)
      : applyCooldown(actor, skillInst, skill)

    const updatedMap = new Map(this.unitSkillsMap)
    const actorSkills = updatedMap.get(actor.id) ?? []
    updatedMap.set(actor.id, actorSkills.map(s => s.defId === skillInst.defId ? withCooldown : s))
    this.unitSkillsMap = updatedMap

    const fromTick    = actor.tickPosition
    const effectiveTu = getEffectiveTuCost(skill.tuCost, snap.get(actor.id) ?? actor)

    this.cb.onHistory(makeHistoryEntry(actor.id, actor.defId, actor.name, fromTick, actor.isAlly))

    const postTarget = snap.get(primaryTarget.id) ?? primaryTarget
    this.showTurnDisplay({
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
        shieldHp:    this.sumShieldHp(postTarget.statusSlots),
      },
      isAlly: true,
    })

    this.pendingPlayerTurn = {
      snap,
      actor,
      effectiveTu,
      primaryTarget,
      primaryDamage,
      outcome,
      preStatusSnapshot,
    }

    this.setStep('player_acting')

    const actorManifest = this.manifests.get(actor.defId) ?? null
    const actorDamaged  = unitIsDamaged(actor, actorManifest)
    const { isMelee, dashDx, projectile, customSequence } =
      this.buildAttackAnimConfig(actor.defId, skill.id, skill.tags, actorDamaged)

    this.cb.onPlayDice(outcome)
    if (this.attackTimer) clearTimeout(this.attackTimer)
    this.pendingAttackCb = () => {
      this.pendingAttackCb = null
      this.cb.onPlayAttack(
        actor.defId, primaryTarget.defId, outcome, primaryDamage, isMelee, dashDx,
        projectile, buildOutcomeLabel(outcome), outcomeColour(outcome),
        customSequence,
      )
      if (this.playerApplyTimer) clearTimeout(this.playerApplyTimer)
      this.playerApplyTimer = setTimeout(() => {
        this.setStep('player_applying')
        this.drive()
      }, ANIM_TIMEOUT_MS)
    }
    this.attackTimer = setTimeout(this.pendingAttackCb, DICE_RESULT_DISMISS_MS)
  }

  skipTurn(): void {
    if (this.step !== 'player_turn') return
    const actor = this.getActivePlayerUnit()
    if (!actor) return
    if (!isAlive(actor)) {
      this.unregisterTickInternal(actor.id)
      this.setStep('advance_tick')
      this.drive()
      return
    }
    if (this.narrativePaused || this.inspectingSkill) return

    const fromTick = actor.tickPosition
    const apFrozen = actor.statusSlots.some(s => s.payload?.freezesApRegen === true)
    const apGained = apFrozen ? 0 : calculateApGained(SKIP_TU_COST, actor.apRegenRate)
    this.cb.onHistory(makeHistoryEntry(actor.id, actor.defId, actor.name, fromTick, actor.isAlly))
    this.globalBattleTick += SKIP_TU_COST

    const skipSnap  = makeSnapshot(this.playerUnits, this.enemies)
    const skipEntry = skipSnap.get(actor.id) ?? actor
    skipSnap.set(actor.id, incrementActionCount({ ...skipEntry, ap: Math.min(skipEntry.maxAp, skipEntry.ap + apGained) }))
    const { unit: skipTicked, expired: skipExpired } = tickStatusDurations(skipSnap.get(actor.id)!)
    skipSnap.set(actor.id, skipTicked)
    for (const slot of skipExpired) this.fireExpiryChain(actor.defId, slot.id, skipSnap)
    fireBattleTickIntervalPassives(
      this.globalBattleTick, skipSnap,
      this.passiveDefs,
      this.lastIntervalFire,
      this.lastIntervalApAccum,
      this.globalApAccum,
    )

    const snapPlayers = this.playerUnits
    const snapEnemies = this.enemies
    this.playerUnits = this.playerUnits.map(u => skipSnap.get(u.id) ?? u)
    this.enemies     = this.enemies.map(e => skipSnap.get(e.id) ?? e)
    this.registerTickInternal(actor.id, fromTick + SKIP_TU_COST)

    const skipDeadPlayers = snapPlayers.map(u => skipSnap.get(u.id) ?? u).filter(u => !isAlive(u))
    const skipDeadEnemies = snapEnemies.map(e => skipSnap.get(e.id) ?? e).filter(e => !isAlive(e))
    for (const u of [...skipDeadPlayers, ...skipDeadEnemies]) {
      this.cb.onNarrativeEmit({ type: 'unit_death', actorId: u.defId })
      this.unregisterTickInternal(u.id)
    }

    if (snapPlayers.map(u => skipSnap.get(u.id) ?? u).every(u => !isAlive(u))) {
      this.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
      this.cb.onNarrativeEmit({ type: 'battle_defeat' })
      this.endBattle('defeat')
      this.setStep('battle_over')
      this.notify()
      return
    }
    if (snapEnemies.map(e => skipSnap.get(e.id) ?? e).every(e => !isAlive(e))) {
      this.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
      this.cb.onNarrativeEmit({ type: 'battle_victory' })
      this.endBattle('victory')
      this.setStep('battle_over')
      this.notify()
      return
    }

    this.appendLog({ text: 'You skipped your turn.' })
    this.cb.onClearTurn()
    this.setStep('advance_tick')
    this.notify()
    this.drive()
  }

  confirmCounter(): void {
    if (!this.pendingCounterDecision) return
    const { defender, originalCaster, counterSkill, snap, depth } = this.pendingCounterDecision
    this.pendingCounterDecision = null

    const defSnap = snap.get(defender.id) ?? defender
    snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })

    const currentTick = this.tickValue
    setTimeout(() => {
      this.runAttack(defender, originalCaster, counterSkill, snap, depth + 1)
      fireCounterCastEffects(defender, originalCaster, counterSkill, snap, currentTick)
      fireCounterTriggerEffects(defender, snap, this.passiveDefs, currentTick)
      // snap is the same reference as pendingPlayerTurn.snap — runPlayerApplying
      // will apply it at the correct time; no delayed re-apply here.
    }, 200)

    this.notify()
  }

  skipCounter(): void {
    this.pendingCounterDecision = null
    this.notify()
  }

  skipDiceAnim(): void {
    if (!this.pendingAttackCb) return
    if (this.attackTimer) { clearTimeout(this.attackTimer); this.attackTimer = null }
    const cb = this.pendingAttackCb
    this.pendingAttackCb = null
    cb()
  }

  resolveClash(winner: 'player' | 'enemy'): void {
    this.pendingClash = null
    if (winner === 'player') {
      const activeIds = new Set<string>()
      for (const [id, tick] of this.registeredTicks) {
        if (tick === this.tickValue) activeIds.add(id)
      }
      const actor = this.playerUnits.find(u => activeIds.has(u.id) && this.controlledIds.has(u.id) && isAlive(u)) ?? null
      if (actor) this.showPlayerTurnUnits(actor)
    }
    this.setStep(winner === 'player' ? 'player_turn' : 'enemy_telegraph')
    this.notify()
    this.drive()
  }

  resolveTeamCollision(choices: Map<string, 'now' | 'later'>): void {
    this.pendingTeamCollision = null
    choices.forEach((choice, unitId) => {
      if (choice === 'later') {
        const currentTick = this.registeredTicks.get(unitId) ?? 0
        this.registerTickInternal(unitId, currentTick + 1)
      }
    })
    this.setStep('advance_tick')
    this.notify()
    this.drive()
  }

  // ── Internal: timeline ────────────────────────────────────────────────────────

  private registerTickInternal(id: string, tick: number): void {
    const finalTick = resolveTickDisplacement(tick, this.registeredTicks, id, this.tickValue)
    this.registeredTicks = new Map(this.registeredTicks).set(id, finalTick)
    this.playerUnits = this.playerUnits.map(u => u.id === id ? { ...u, tickPosition: finalTick } : u)
    this.enemies     = this.enemies.map(e => e.id === id ? { ...e, tickPosition: finalTick } : e)
  }

  private unregisterTickInternal(id: string): void {
    const next = new Map(this.registeredTicks)
    next.delete(id)
    this.registeredTicks = next
  }

  // ── Internal: step machine ────────────────────────────────────────────────────

  private setStep(s: BattleStep): void {
    this.step = s
  }

  private notify(): void {
    this.cb.onStateChanged(this.snapshot())
  }

  private snapshot(): Readonly<BattleEngineSnapshot> {
    return {
      battleStep:             this.step,
      playerUnits:            this.playerUnits,
      enemies:                this.enemies,
      unitSkillsMap:          this.unitSkillsMap,
      registeredTicks:        this.registeredTicks,
      tickValue:              this.tickValue,
      suppressedChipIds:      this.suppressedChipIds,
      pendingCounterDecision: this.pendingCounterDecision,
      pendingClash:           this.pendingClash,
      pendingTeamCollision:   this.pendingTeamCollision,
    }
  }

  drive(): void {
    if (YIELDED_STEPS.has(this.step)) return
    if (
      (this.step === 'advance_tick' || this.step === 'clash_check' || this.step === 'enemy_telegraph') &&
      (this.narrativePaused || this.inspectingSkill)
    ) return

    if (this.step === 'advance_tick') {
      this.runAdvanceTick()
      return
    }
    if (this.step === 'clash_check') {
      this.runClashCheck()
      return
    }
    if (this.step === 'enemy_telegraph') {
      this.runEnemyTelegraph()
      return
    }
    if (this.step === 'enemy_applying') {
      this.runEnemyApplying()
      return
    }
    if (this.step === 'player_applying') {
      this.runPlayerApplying()
      return
    }
  }

  // ── Step: advance_tick ────────────────────────────────────────────────────────

  private runAdvanceTick(): void {
    const ticks = [...this.registeredTicks.values()]
    if (!ticks.length) {
      const alivePlayers = this.playerUnits.filter(isAlive)
      const aliveEnemies = this.enemies.filter(isAlive)
      if (!alivePlayers.length) {
        this.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
        this.endBattle('defeat')
        this.setStep('battle_over')
        this.notify()
      } else if (!aliveEnemies.length) {
        this.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
        this.endBattle('victory')
        this.setStep('battle_over')
        this.notify()
      }
      return
    }

    const hasActiveNow = ticks.some(t => t === this.tickValue)
    if (!hasActiveNow) {
      const next = Math.min(...ticks)
      this.tickValue = next
    }
    this.setStep('clash_check')
    this.notify()
    this.drive()
  }

  // ── Step: clash_check ─────────────────────────────────────────────────────────

  private runClashCheck(): void {
    const current    = this.tickValue
    const ticks      = this.registeredTicks
    const controlled = this.controlledIds
    const players    = this.playerUnits
    const foes       = this.enemies

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
        this.pendingClash = { playerUnits: activeControlled, enemyUnits: activeEnemies }
        this.setStep('clash_qte')
        this.notify()
        return
      }

      const winner    = resolveClashWinner(activeControlled, activeEnemies)
      const winnerUs  = winner === 'player' ? activeControlled : activeEnemies
      const loserUs   = winner === 'player' ? activeEnemies    : activeControlled
      const winnerAvg = Math.round(factionAvgSpeed(winnerUs))
      const loserAvg  = Math.round(factionAvgSpeed(loserUs))
      this.appendLog({
        text:   `CLASH — ${winnerUs.map(u => u.name).join(' & ')} acts first (avg. speed ${winnerAvg} vs ${loserAvg})`,
        colour: winner === 'player' ? 'var(--accent-info)' : 'var(--accent-danger)',
      })
      winnerUs.forEach(u => this.cb.onNarrativeEmit({ type: 'clash_resolved', actorId: u.defId }))
      this.clashAnnounceWinner = winner
      const clashWinActor = winner === 'player' ? (activeControlled[0] ?? null) : null
      this.setStep('clash_announcing')
      this.notify()
      this.clashAnnounceTimer = setTimeout(() => {
        const w = this.clashAnnounceWinner
        if (w === 'player' && clashWinActor) this.showPlayerTurnUnits(clashWinActor)
        this.setStep(w === 'player' ? 'player_turn' : 'enemy_telegraph')
        this.notify()
        this.drive()
      }, CLASH_ANNOUNCE_MS)
      return
    }

    if (activeControlled.length > 1) {
      const bySpeed = [...activeControlled].sort((a, b) => b.stats.speed - a.stats.speed)
      if (bySpeed[0].stats.speed !== bySpeed[1].stats.speed) {
        this.showPlayerTurnUnits(bySpeed[0])
        this.setStep('player_turn')
        this.notify()
      } else {
        const choices = new Map(activeControlled.map(u => [u.id, null as 'now' | 'later' | null]))
        this.pendingTeamCollision = { units: activeControlled, choices }
        this.setStep('team_collision')
        this.notify()
      }
      return
    }

    const allActiveAI = [...activeAIAllies, ...activeEnemies]
    if (allActiveAI.length > 0) {
      this.setStep('enemy_telegraph')
      this.notify()
      this.drive()
      return
    }

    if (activeControlled.length === 1) {
      const activeUnit = activeControlled[0]
      const turnKey    = `${activeUnit.id}:${current}`
      let postTurnStart: Unit = activeUnit
      if (!this.turnStartFired.has(turnKey)) {
        this.turnStartFired.add(turnKey)
        const snap = makeSnapshot(players, foes)
        fireTurnStartEffects(activeUnit, this.statusDefs, snap, current)
        const updated = snap.get(activeUnit.id)
        if (updated) {
          postTurnStart = updated
          this.playerUnits = this.playerUnits.map(u => u.id === updated.id ? updated : u)
          this.enemies     = this.enemies.map(e => snap.get(e.id) ?? e)
        }
      }
      if (!isAlive(postTurnStart)) {
        this.cb.onNarrativeEmit({ type: 'unit_death', actorId: postTurnStart.defId })
        this.unregisterTickInternal(activeUnit.id)
        const allDead = players.every(u => u.id === activeUnit.id ? !isAlive(postTurnStart) : !isAlive(u))
        if (allDead) {
          this.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
          this.cb.onNarrativeEmit({ type: 'battle_defeat' })
          this.endBattle('defeat')
          this.setStep('battle_over')
          this.notify()
          return
        }
        this.setStep('advance_tick')
        this.notify()
        this.drive()
        return
      }
      this.showPlayerTurnUnits(postTurnStart)
      this.setStep('player_turn')
      this.notify()
      return
    }

    // No active units — purge dead stale registrations.
    for (const id of activeIds) {
      const deadInPlayers = players.find(u => u.id === id && !isAlive(u))
      const deadInFoes    = foes.find(e => e.id === id && !isAlive(e))
      if (deadInPlayers ?? deadInFoes) this.unregisterTickInternal(id)
    }
    this.setStep('advance_tick')
    this.notify()
    this.drive()
  }

  // ── Step: enemy_telegraph ─────────────────────────────────────────────────────

  private runEnemyTelegraph(): void {
    const current    = this.tickValue
    const ticks      = this.registeredTicks
    const controlled = this.controlledIds
    const players    = this.playerUnits
    const foes       = this.enemies

    const activeIds = new Set<string>()
    for (const [id, tick] of ticks) {
      if (tick === current) activeIds.add(id)
    }

    const activeAIAllies = players.filter(u => activeIds.has(u.id) && !controlled.has(u.id) && isAlive(u))
    const activeEnemies  = foes.filter(e => activeIds.has(e.id) && isAlive(e))
    const allAIUnits     = [...activeAIAllies, ...activeEnemies].sort((a, b) => b.stats.speed - a.stats.speed)

    if (!allAIUnits.length) {
      for (const id of activeIds) {
        const deadInPlayers = players.find(u => u.id === id && !isAlive(u))
        const deadInFoes    = foes.find(e => e.id === id && !isAlive(e))
        if (deadInPlayers ?? deadInFoes) this.unregisterTickInternal(id)
      }
      this.setStep('advance_tick')
      this.notify()
      this.drive()
      return
    }

    // Fire onUnitTurnStart effects — may kill units before they act.
    if (this.fireAITurnStart(allAIUnits, players, foes, current) !== 'ok') return

    const firstAIUnit = allAIUnits[0]
    const remainingDice = this.diceActive
      ? Math.max(0, DICE_RESULT_DISMISS_MS - (Date.now() - this.diceShowTime))
      : 0

    // Pre-check to use short delay for skip/no_targets.
    const preCheckUnit   = (firstAIUnit.isAlly ? this.playerUnits : this.enemies)
      .find(u => u.id === firstAIUnit.id) ?? firstAIUnit
    const preCheckSkills = this.unitSkillsMap.get(firstAIUnit.id) ?? []
    const preCheckResult = computeAITurn(preCheckUnit, preCheckSkills, this.playerUnits, this.enemies)
    const thinkDelay     = preCheckResult.type === 'attack'
      ? randomMs(AI_THINKING_MIN_MS, AI_THINKING_MAX_MS)
      : BETWEEN_TURN_PAUSE_MS

    this.setStep('enemy_acting')
    this.notify()

    this.telegraphTimer = setTimeout(() => {
      if (this.step !== 'enemy_acting') return
      const thinkPlayers = this.playerUnits
      const thinkEnemies = this.enemies

      const freshAIUnit = (firstAIUnit.isAlly ? thinkPlayers : thinkEnemies)
        .find(u => u.id === firstAIUnit.id) ?? firstAIUnit
      const freshSkills = this.unitSkillsMap.get(firstAIUnit.id) ?? []
      const result      = computeAITurn(freshAIUnit, freshSkills, thinkPlayers, thinkEnemies)

      if (result.type === 'skip') {
        this.handleAISkip(firstAIUnit, freshAIUnit, thinkPlayers, thinkEnemies, 'gathering strength')
        return
      }

      if (result.type === 'no_targets') {
        this.handleAISkip(firstAIUnit, freshAIUnit, thinkPlayers, thinkEnemies, 'no valid targets')
        return
      }

      const { skillInst, target, allTargets } = result
      const skill    = getCachedSkill(skillInst)
      const actingMf = this.manifests.get(firstAIUnit.defId) ?? null
      const targetMf = this.manifests.get(target.defId) ?? null

      this.cb.onSetTurnState(freshAIUnit.defId, target.defId, actingMf, targetMf, {
        acting: unitIsDamaged(freshAIUnit, actingMf),
        target: unitIsDamaged(target, targetMf),
      })

      const inputMs = randomMs(AI_INPUT_MIN_MS, AI_INPUT_MAX_MS)

      this.showTurnDisplay(
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
            shieldHp:    this.sumShieldHp(freshAIUnit.statusSlots),
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
            shieldHp:    this.sumShieldHp(target.statusSlots),
          },
          isAlly: freshAIUnit.isAlly,
        },
        inputMs + DICE_RESULT_DISMISS_MS,
      )

      if (this.applyTimer) clearTimeout(this.applyTimer)
      this.applyTimer = setTimeout(() => {
        if (this.step !== 'enemy_acting') return
        const execPlayers = this.playerUnits
        const execEnemies = this.enemies
        const snap               = makeSnapshot(execPlayers, execEnemies)
        const preStatusSnapshot  = new Map(
          [...snap].map(([uid, u]) => [uid, new Set(u.statusSlots.map(s => s.id))])
        )
        const thisTick = this.tickValue

        this.applySkillAPCost(firstAIUnit.id, skill.apCost, snap, thisTick)

        const { outcome, damage: primaryDamage } = this.runAttack(freshAIUnit, target, skillInst, snap)

        if (allTargets.length > 1) {
          this.applySplashEffects(freshAIUnit, skillInst, allTargets.slice(1), snap, outcome, thisTick)
        }

        const withCooldown = applyCooldown(freshAIUnit, skillInst, skill)
        const updatedMap = new Map(this.unitSkillsMap)
        const aiSkills = updatedMap.get(firstAIUnit.id) ?? []
        updatedMap.set(firstAIUnit.id, aiSkills.map(s => s.defId === skillInst.defId ? withCooldown : s))
        this.unitSkillsMap = updatedMap

        const aiEffectiveTu = getEffectiveTuCost(skill.tuCost, snap.get(firstAIUnit.id) ?? freshAIUnit)

        this.pendingAITurn = {
          aiUnit:            freshAIUnit,
          snap,
          effectiveTu:       aiEffectiveTu,
          primaryTarget:     target,
          primaryDamage,
          outcome,
          isAlly:            freshAIUnit.isAlly,
          preStatusSnapshot,
        }
        this.notify()

        const aiManifest = this.manifests.get(firstAIUnit.defId) ?? null
        const aiDamaged  = unitIsDamaged(freshAIUnit, aiManifest)
        const { isMelee: aiIsMelee, dashDx: aiDashDx, projectile: aiProjectile, customSequence: aiSequence } =
          this.buildAttackAnimConfig(firstAIUnit.defId, skill.id, skill.tags, aiDamaged)

        this.cb.onPlayDice(outcome)
        if (this.attackTimer) clearTimeout(this.attackTimer)
        this.pendingAttackCb = () => {
          this.pendingAttackCb = null
          this.cb.onPlayAttack(
            freshAIUnit.defId, target.defId, outcome, primaryDamage, aiIsMelee, aiDashDx,
            aiProjectile, buildOutcomeLabel(outcome), outcomeColour(outcome),
            aiSequence,
          )
          if (this.applyTimer) clearTimeout(this.applyTimer)
          this.applyTimer = setTimeout(() => {
            if (this.step === 'enemy_acting') {
              this.setStep('enemy_applying')
              this.notify()
              this.drive()
            }
          }, ANIM_TIMEOUT_MS)
        }
        this.attackTimer = setTimeout(this.pendingAttackCb, DICE_RESULT_DISMISS_MS)
      }, inputMs)

    }, remainingDice + thinkDelay)
  }

  // ── Step: enemy_applying ──────────────────────────────────────────────────────

  private runEnemyApplying(): void {
    const pending = this.pendingAITurn
    if (!pending) return
    this.pendingAITurn = null

    const { aiUnit, snap, effectiveTu, primaryTarget, isAlly: aiIsAlly, preStatusSnapshot } = pending
    const currentPlayers = this.playerUnits
    const currentEnemies = this.enemies

    this.detectNewActivations(snap, preStatusSnapshot)
    this.playerUnits = this.playerUnits.map(u => snap.get(u.id) ?? u)
    this.enemies     = this.enemies.map(e => snap.get(e.id) ?? e)

    const fromTick = aiUnit.tickPosition
    this.cb.onHistory(makeHistoryEntry(aiUnit.id, aiUnit.defId, aiUnit.name, fromTick, aiUnit.isAlly))
    this.registerTickInternal(aiUnit.id, advanceTick(fromTick, effectiveTu))
    this.globalBattleTick += effectiveTu
    fireBattleTickIntervalPassives(
      this.globalBattleTick, snap,
      this.passiveDefs,
      this.lastIntervalFire,
      this.lastIntervalApAccum,
      this.globalApAccum,
    )

    this.cb.onHideTurnDisplay()

    const updatedPlayers = currentPlayers.map(u => snap.get(u.id) ?? u)
    const updatedEnemies = currentEnemies.map(e => snap.get(e.id) ?? e)
    const deadPlayers    = updatedPlayers.filter(u => !isAlive(u))
    const deadEnemies    = updatedEnemies.filter(e => !isAlive(e))
    deadPlayers.forEach(u => { this.cb.onNarrativeEmit({ type: 'unit_death', actorId: u.defId }); this.unregisterTickInternal(u.id) })
    deadEnemies.forEach(e => { this.cb.onNarrativeEmit({ type: 'unit_death', actorId: e.defId }); this.unregisterTickInternal(e.id) })

    if (updatedPlayers.every(u => !isAlive(u))) {
      this.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
      this.cb.onNarrativeEmit({ type: 'battle_defeat' })
      this.endBattle('defeat')
      this.setStep('battle_over')
      this.notify()
      return
    }
    if (updatedEnemies.every(e => !isAlive(e))) {
      this.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
      this.cb.onNarrativeEmit({ type: 'battle_victory' })
      this.endBattle('victory')
      this.setStep('battle_over')
      this.notify()
      return
    }

    void primaryTarget

    const primaryVictim = !aiIsAlly ? deadPlayers[0] : deadEnemies[0]
    if (primaryVictim) {
      this.notify()
      this.cb.onPlayDeath(primaryVictim.defId)
      setTimeout(() => {
        this.cb.onClearTurn()
        this.playPendingExpiryAnims(snap)
        this.playPendingActivationAnims()
        if (this.step === 'enemy_applying') {
          this.setStep('advance_tick')
          this.notify()
          this.drive()
        }
      }, ANIM_TIMEOUT_MS)
      return
    }
    this.notify()
    this.cb.onClearTurn()
    this.playPendingExpiryAnims(snap)
    this.playPendingActivationAnims()
    this.setStep('advance_tick')
    this.notify()
    this.drive()
  }

  // ── Step: player_applying ─────────────────────────────────────────────────────

  private runPlayerApplying(): void {
    const pending = this.pendingPlayerTurn
    if (!pending) return
    this.pendingPlayerTurn = null

    const { snap, actor, effectiveTu, primaryTarget, preStatusSnapshot } = pending
    const currentPlayers = this.playerUnits
    const currentEnemies = this.enemies

    this.detectNewActivations(snap, preStatusSnapshot)

    this.playerUnits = this.playerUnits.map(u => {
      const updated = snap.get(u.id) ?? u
      return u.id === actor.id ? incrementActionCount(updated) : updated
    })
    this.enemies = this.enemies.map(e => snap.get(e.id) ?? e)

    const nextTick = advanceTick(actor.tickPosition, effectiveTu)
    this.registerTickInternal(actor.id, nextTick)
    this.globalBattleTick += effectiveTu
    fireBattleTickIntervalPassives(
      this.globalBattleTick, snap,
      this.passiveDefs,
      this.lastIntervalFire,
      this.lastIntervalApAccum,
      this.globalApAccum,
    )

    const snapEnemies = currentEnemies.map(e => snap.get(e.id) ?? e)
    const snapPlayers = currentPlayers.map(u => snap.get(u.id) ?? u)
    const deadEnemies = snapEnemies.filter(e => !isAlive(e))
    const deadPlayers = snapPlayers.filter(u => !isAlive(u))
    deadEnemies.forEach(e => { this.cb.onNarrativeEmit({ type: 'unit_death', actorId: e.defId }); this.unregisterTickInternal(e.id) })
    deadPlayers.forEach(u => { this.cb.onNarrativeEmit({ type: 'unit_death', actorId: u.defId }); this.unregisterTickInternal(u.id) })

    this.cb.onHideTurnDisplay()

    if (snapPlayers.every(u => !isAlive(u))) {
      this.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
      this.cb.onNarrativeEmit({ type: 'battle_defeat' })
      this.endBattle('defeat')
      this.setStep('battle_over')
      this.notify()
      return
    }
    if (snapEnemies.every(e => !isAlive(e))) {
      this.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
      this.cb.onNarrativeEmit({ type: 'battle_victory' })
      this.endBattle('victory')
      this.setStep('battle_over')
      this.notify()
      return
    }

    void primaryTarget

    const firstDead = deadEnemies[0]
    if (firstDead) {
      this.notify()
      this.cb.onPlayDeath(firstDead.defId)
      setTimeout(() => {
        this.cb.onClearTurn()
        this.playPendingExpiryAnims(snap)
        this.playPendingActivationAnims()
        if (this.step === 'player_applying') {
          this.setStep('advance_tick')
          this.notify()
          this.drive()
        }
      }, ANIM_TIMEOUT_MS)
    } else {
      this.notify()
      this.cb.onClearTurn()
      this.playPendingExpiryAnims(snap)
      this.playPendingActivationAnims()
      this.setStep('advance_tick')
      this.notify()
      this.drive()
    }
  }

  // ── AI skip helper ────────────────────────────────────────────────────────────

  private handleAISkip(
    firstAIUnit: Unit,
    freshAIUnit: Unit,
    thinkPlayers: Unit[],
    thinkEnemies: Unit[],
    reason: string,
  ): void {
    const fromTick  = firstAIUnit.tickPosition
    const apFrozen  = freshAIUnit.statusSlots.some(s => s.payload?.freezesApRegen === true)
    const apGained  = apFrozen ? 0 : calculateApGained(SKIP_TU_COST, freshAIUnit.apRegenRate)
    this.cb.onHistory(makeHistoryEntry(firstAIUnit.id, firstAIUnit.defId, firstAIUnit.name, fromTick, firstAIUnit.isAlly))
    this.globalBattleTick += SKIP_TU_COST
    const skipSnap  = makeSnapshot(thinkPlayers, thinkEnemies)
    const skipEntry = skipSnap.get(freshAIUnit.id) ?? freshAIUnit
    skipSnap.set(freshAIUnit.id, { ...skipEntry, ap: Math.min(skipEntry.maxAp, skipEntry.ap + apGained) })
    const { unit: skipTicked, expired: skipExpired } = tickStatusDurations(skipSnap.get(freshAIUnit.id)!)
    skipSnap.set(freshAIUnit.id, skipTicked)
    for (const slot of skipExpired) this.fireExpiryChain(freshAIUnit.defId, slot.id, skipSnap)
    this.playPendingExpiryAnims(skipSnap)
    fireBattleTickIntervalPassives(
      this.globalBattleTick, skipSnap,
      this.passiveDefs,
      this.lastIntervalFire,
      this.lastIntervalApAccum,
      this.globalApAccum,
    )
    this.playerUnits = this.playerUnits.map(u => skipSnap.get(u.id) ?? u)
    this.enemies     = this.enemies.map(e => skipSnap.get(e.id) ?? e)
    this.registerTickInternal(firstAIUnit.id, advanceTick(fromTick, SKIP_TU_COST))

    const skipDeadPlayers = thinkPlayers.map(u => skipSnap.get(u.id) ?? u).filter(u => !isAlive(u))
    const skipDeadEnemies = thinkEnemies.map(e => skipSnap.get(e.id) ?? e).filter(e => !isAlive(e))
    for (const u of [...skipDeadPlayers, ...skipDeadEnemies]) {
      this.cb.onNarrativeEmit({ type: 'unit_death', actorId: u.defId })
      this.unregisterTickInternal(u.id)
    }

    if (thinkPlayers.map(u => skipSnap.get(u.id) ?? u).every(u => !isAlive(u))) {
      this.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
      this.cb.onNarrativeEmit({ type: 'battle_defeat' })
      this.endBattle('defeat')
      this.setStep('battle_over')
      this.notify()
      return
    }
    if (thinkEnemies.map(e => skipSnap.get(e.id) ?? e).every(e => !isAlive(e))) {
      this.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
      this.cb.onNarrativeEmit({ type: 'battle_victory' })
      this.endBattle('victory')
      this.setStep('battle_over')
      this.notify()
      return
    }

    const msg = reason === 'gathering strength'
      ? `${firstAIUnit.name} is gathering strength…`
      : `${firstAIUnit.name} has no valid targets.`
    this.appendLog({ text: msg, colour: 'var(--text-muted)' })
    this.cb.onClearTurn()
    this.setStep('advance_tick')
    this.notify()
    this.drive()
  }

  // ── Shared helpers ────────────────────────────────────────────────────────────

  private applySkillAPCost(
    actorId: string,
    apCost: number,
    snap: Map<string, Unit>,
    currentTick: number,
  ): void {
    if (apCost <= 0) return
    const actorSnap = snap.get(actorId)
    if (!actorSnap) return
    const hpApSwapped = actorSnap.statusSlots.some(s => s.payload?.hpApSwapped === true)
    const withCost = hpApSwapped
      ? addApSpent({ ...actorSnap, hp: Math.max(0, actorSnap.hp - apCost) }, apCost)
      : addApSpent({ ...actorSnap, ap: Math.max(0, actorSnap.ap - apCost) }, apCost)
    snap.set(actorId, withCost)
    this.globalApAccum += apCost
    fireOnApSpent(withCost, this.passiveDefs.get(actorId) ?? null, snap, currentTick)
  }

  private applySplashEffects(
    caster: Unit,
    skillInst: SkillInstance,
    extraTargets: Unit[],
    snap: Map<string, Unit>,
    outcome: DiceOutcome,
    currentTick: number,
  ): void {
    if (!extraTargets.length) return
    const noDamage = outcome === 'Evade' || outcome === 'Fail'
    const skill = getCachedSkill(skillInst)
    for (const extra of extraTargets) {
      const extraSnap = snap.get(extra.id) ?? extra
      if (!isAlive(extraSnap)) continue
      const ctx: EffectContext = {
        caster,
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
      this.appendLog({ text: `${caster.name} → ${skill.name} on ${extra.name} [${outcome}]`, colour: outcomeColour(outcome) })
    }
  }

  private buildAttackAnimConfig(
    defId: string,
    skillId: string,
    skillTags: string[],
    isDamaged: boolean,
  ): { isMelee: boolean; dashDx: number; projectile: AnimationProjectileDef | null; customSequence: AnimPhase[] | undefined } {
    const manifest = this.manifests.get(defId) ?? null
    const resolved = manifest ? resolveAttackAnimation(manifest, skillId, skillTags, isDamaged) : null
    return {
      isMelee:        resolved?.isMelee ?? false,
      dashDx:         resolved?.dashDx  ?? 0,
      projectile:     manifest?.projectile ?? null,
      customSequence: this.animSequences.get(defId)?.[skillId],
    }
  }

  private fireAITurnStart(
    allAIUnits: Unit[],
    players: Unit[],
    foes: Unit[],
    current: number,
  ): 'ended' | 'purged' | 'ok' {
    const snap = makeSnapshot(players, foes)
    for (const aiUnit of allAIUnits) {
      const key = `${aiUnit.id}:${current}`
      if (!this.turnStartFired.has(key)) {
        this.turnStartFired.add(key)
        fireTurnStartEffects(aiUnit, this.statusDefs, snap, current)
      }
    }
    this.playerUnits = this.playerUnits.map(u => snap.get(u.id) ?? u)
    this.enemies     = this.enemies.map(e => snap.get(e.id) ?? e)

    const postPlayers = players.map(u => snap.get(u.id) ?? u)
    const postEnemies = foes.map(e => snap.get(e.id) ?? e)

    if (postPlayers.every(u => !isAlive(u))) {
      this.appendLog({ text: 'Defeat! All allies have been slain.', colour: 'var(--accent-danger)' })
      this.cb.onNarrativeEmit({ type: 'battle_defeat' })
      this.endBattle('defeat')
      this.setStep('battle_over')
      this.notify()
      return 'ended'
    }
    if (postEnemies.every(e => !isAlive(e))) {
      this.appendLog({ text: 'Victory! All enemies defeated.', colour: 'var(--accent-genesis)' })
      this.cb.onNarrativeEmit({ type: 'battle_victory' })
      this.endBattle('victory')
      this.setStep('battle_over')
      this.notify()
      return 'ended'
    }

    let purgedAny = false
    for (const aiUnit of allAIUnits) {
      const post = snap.get(aiUnit.id) ?? aiUnit
      if (!isAlive(post)) {
        this.cb.onNarrativeEmit({ type: 'unit_death', actorId: post.defId })
        this.unregisterTickInternal(aiUnit.id)
        purgedAny = true
      }
    }
    if (purgedAny) {
      this.setStep('advance_tick')
      this.notify()
      this.drive()
      return 'purged'
    }

    return 'ok'
  }

  // ── Attack resolution ─────────────────────────────────────────────────────────

  private runAttack(
    caster: Unit,
    target: Unit,
    skillInst: SkillInstance,
    snap: Map<string, Unit>,
    chainDepth = 0,
  ): { outcome: DiceOutcome; damage: number } {
    const skill = getCachedSkill(skillInst)
    const currentTick = this.tickValue

    const { dodged, expiredStatusIds } = resolveIncomingDodge(target, skill.targeting.range, snap)
    for (const statusId of expiredStatusIds) {
      this.fireExpiryChain(target.defId, statusId, snap)
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

    this.showDiceResult(diceOutcome, buildOutcomeMessage(diceOutcome, caster.name, target.name))
    const targetHpBefore = snap.get(target.id)?.hp ?? target.hp
    const casterHpBefore = snap.get(caster.id)?.hp ?? caster.hp

    this.cb.onNarrativeEmit({ type: 'skill_used', actorId: caster.defId, targetId: target.defId })
    if (diceOutcome === 'Boosted') {
      this.cb.onNarrativeEmit({ type: 'boosted_hit', actorId: caster.defId, targetId: target.defId })
    }
    if (diceOutcome === 'Evade') {
      this.cb.onNarrativeEmit({ type: 'evaded', actorId: target.defId, targetId: caster.defId })
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
        this.appendLog({ text: `★ CRITICAL! +${critAmount} bonus damage`, colour: 'var(--accent-gold)' })
      }

      const deflectHp = resolveIncomingDeflect(target, targetHpBefore, snap)
      if (deflectHp > 0) {
        const targetCurrent = snap.get(target.id) ?? target
        snap.set(target.id, { ...targetCurrent, hp: Math.min(targetCurrent.maxHp, targetCurrent.hp + deflectHp) })
        this.appendLog({ text: `◈ DEFLECT! ${targetCurrent.name} restores ${deflectHp} HP`, colour: 'var(--accent-info)' })
      }
    }

    const logMsg =
      diceOutcome === 'Evade' ? `${target.name} evaded ${skill.name}!` :
      diceOutcome === 'Fail'  ? `${caster.name} missed with ${skill.name}!` :
      `${caster.name} → ${skill.name} on ${target.name} [${diceOutcome}]`
    this.appendLog({ text: logMsg, colour: outcomeColour(diceOutcome) })

    fireOpponentActionEffects(caster, snap, this.passiveDefs, currentTick)

    if (diceOutcome === 'Evade' && isSingleTarget(skill)) {
      const defenderSnap   = snap.get(target.id) ?? target
      const defenderSkills = this.unitSkillsMap.get(target.id) ?? []
      const counterSkill   = findCounterSkill(defenderSkills)
      if (counterSkill && canCounter(defenderSnap, counterSkill)) {
        this.scheduleCounterChain(defenderSnap, caster, counterSkill, snap, chainDepth)
      }
    }

    fireHpThresholdPassives(target.id, targetHpBefore, this.passiveDefs.get(target.id) ?? null, snap, currentTick)
    if (caster.id !== target.id) {
      fireHpThresholdPassives(caster.id, casterHpBefore, this.passiveDefs.get(caster.id) ?? null, snap, currentTick)
    }

    if (shieldBrokeIds.size > 0) {
      const updatedMap = new Map(this.unitSkillsMap)
      for (const [brokenUnitId, breakCd] of shieldBrokeIds) {
        if (!breakCd) continue
        const unitInSnap = snap.get(brokenUnitId)
        if (!unitInSnap) continue
        const skills = updatedMap.get(brokenUnitId) ?? []
        updatedMap.set(brokenUnitId, skills.map(s =>
          s.defId === breakCd.skillId
            ? applyTickCooldown(s, unitInSnap.tickPosition + breakCd.ticks)
            : s,
        ))
      }
      this.unitSkillsMap = updatedMap
    }

    const casterAfter = snap.get(caster.id) ?? caster
    const { unit: casterTicked, expired } = tickStatusDurations(casterAfter)
    let casterFinal = casterTicked

    for (const slot of casterTicked.statusSlots) {
      const def = this.statusDefs.get(slot.id)
      if (!def) continue
      for (const effect of def.effects) {
        if (effect.when.event !== 'onTickInterval') continue
        const interval = (effect.when as { event: 'onTickInterval'; interval: number }).interval
        if (slot.nextIntervalFireTick === 0 || currentTick < slot.nextIntervalFireTick) continue
        const applier = snap.get(slot.source)
        const iCtx: EffectContext = {
          caster: applier ?? casterFinal,
          target: casterFinal,
          battle: snapshotToBattleState(snap),
          source: 'status',
          event:  effect.when,
        }
        applyEffect(effect, iCtx)
        casterFinal = snap.get(caster.id) ?? casterFinal
        casterFinal = updateStatusIntervalTick(casterFinal, slot.id, currentTick + interval)
        snap.set(caster.id, casterFinal)
      }
    }

    snap.set(caster.id, casterFinal)
    for (const expiredSlot of expired) {
      this.fireExpiryChain(caster.defId, expiredSlot.id, snap)
    }

    const damage = Math.max(0, targetHpBefore - (snap.get(target.id)?.hp ?? targetHpBefore))
    return { outcome: diceOutcome, damage }
  }

  // ── Counter chain ─────────────────────────────────────────────────────────────

  private scheduleCounterChain(
    defender: Unit,
    originalCaster: Unit,
    counterSkill: SkillInstance,
    snap: Map<string, Unit>,
    depth: number,
  ): void {
    this.showDiceResult('Evade', `${defender.name} attempts a counter!`)

    const currentTick = this.tickValue
    setTimeout(() => {
      const succeeded     = resolveCounterRoll(depth)
      const chancePercent = Math.round(Math.max(COUNTER_MIN, COUNTER_BASE - depth * COUNTER_STEP) * 100)
      this.showDiceResult(
        succeeded ? 'Hit' : 'Fail',
        succeeded ? `Counter! (${chancePercent}% chance)` : 'Counter blocked!',
      )

      if (!succeeded) return

      this.cb.onNarrativeEmit({ type: 'counter', actorId: defender.defId, targetId: originalCaster.defId })

      if (defender.isAlly && this.controlledIds.has(defender.id)) {
        this.pendingCounterDecision = { defender, originalCaster, counterSkill, snap, depth }
        this.notify()
      } else {
        const defSnap    = snap.get(defender.id) ?? defender
        const shouldFire = defSnap.ap - counterSkill.cachedCosts.apCost >= AI_COUNTER_AP_RESERVE

        if (shouldFire) {
          snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })
          setTimeout(() => {
            this.runAttack(defender, originalCaster, counterSkill, snap, depth + 1)
            fireCounterCastEffects(defender, originalCaster, counterSkill, snap, currentTick)
            fireCounterTriggerEffects(defender, snap, this.passiveDefs, currentTick)
            // snap is the same reference as pendingAITurn.snap — runEnemyApplying
            // will apply it at the correct time; no delayed re-apply here.
          }, DICE_RESULT_DISMISS_MS)
        }
      }
    }, COUNTER_ANNOUNCE_MS)
  }

  // ── Status chip animation helpers ─────────────────────────────────────────────

  private detectNewActivations(
    snap: Map<string, Unit>,
    prior: Map<string, Set<string>>,
  ): void {
    const toSuppress: string[] = []
    for (const [unitId, unit] of snap) {
      const priorIds = prior.get(unitId) ?? new Set<string>()
      for (const slot of unit.statusSlots) {
        if (priorIds.has(slot.id)) continue
        const def = this.statusDefs.get(slot.id)
        if (!def?.activateSequenceId || !def?.ui?.chip) continue
        toSuppress.push(slot.id)
        this.pendingActivationAnims.push({
          ownerDefId: unit.defId,
          sequenceId: def.activateSequenceId,
          slotId:     slot.id,
        })
      }
    }
    if (toSuppress.length) {
      const next = new Set(this.suppressedChipIds)
      toSuppress.forEach(id => next.add(id))
      this.suppressedChipIds = next
    }
  }

  private playPendingExpiryAnims(snap: Map<string, Unit>): void {
    const pending = this.pendingExpiryAnims.splice(0)
    if (!pending.length) return
    const firstLivingEnemy = [...snap.values()].find(u => !u.isAlly && u.hp > 0)
    if (!firstLivingEnemy) return
    for (const { ownerDefId, sequenceId, damage } of pending) {
      const seq = this.animSequences.get(ownerDefId)?.[sequenceId]
      if (!seq) continue
      this.cb.onSetTurnState(ownerDefId, firstLivingEnemy.defId, null, null, { acting: false, target: false })
      this.cb.onPlayAttack(ownerDefId, firstLivingEnemy.defId, 'Hit', damage, false, 0, null, '', '', seq)
    }
  }

  private playPendingActivationAnims(): void {
    const pending = this.pendingActivationAnims.splice(0)
    if (!pending.length) return
    for (const { ownerDefId, sequenceId, slotId } of pending) {
      const seq = this.animSequences.get(ownerDefId)?.[sequenceId]
      const release = () => {
        const next = new Set(this.suppressedChipIds)
        next.delete(slotId)
        this.suppressedChipIds = next
        this.notify()
      }
      if (!seq) { release(); continue }
      this.cb.onSetTurnState(ownerDefId, ownerDefId, null, null, { acting: false, target: false })
      this.cb.onPlayAttack(ownerDefId, ownerDefId, 'Hit', 0, false, 0, null, '', '', seq)
      setTimeout(release, ANIM_TIMEOUT_MS)
    }
  }

  // ── Status expiry chain ───────────────────────────────────────────────────────

  private fireExpiryChain(ownerDefId: string, statusId: string, snap: Map<string, Unit>): void {
    const ownerUnit = [...snap.values()].find(u => u.defId === ownerDefId)
    if (!ownerUnit) return
    const def = this.statusDefs.get(statusId)
    if (!def) return
    const damage = fireStatusExpiry(snap.get(ownerUnit.id) ?? ownerUnit, def, snap)
    if (def.expireSequenceId) {
      this.pendingExpiryAnims.push({ ownerDefId, sequenceId: def.expireSequenceId, damage })
    }
    const linkedUnit = snap.get(ownerUnit.id) ?? ownerUnit
    for (const slot of linkedUnit.statusSlots) {
      const linkedDef = this.statusDefs.get(slot.id)
      if (linkedDef?.expiresWithStatus === statusId) {
        snap.set(ownerUnit.id, {
          ...snap.get(ownerUnit.id) ?? ownerUnit,
          statusSlots: (snap.get(ownerUnit.id) ?? ownerUnit).statusSlots.filter(s => s.id !== slot.id),
        })
        const linkedDamage = fireStatusExpiry(snap.get(ownerUnit.id) ?? ownerUnit, linkedDef, snap)
        if (linkedDef.expireSequenceId) {
          this.pendingExpiryAnims.push({ ownerDefId, sequenceId: linkedDef.expireSequenceId, damage: linkedDamage })
        }
      }
    }
  }

  // ── Dice / turn display helpers ───────────────────────────────────────────────

  private showDiceResult(outcome: DiceOutcome, message: string): void {
    if (this.diceTimer) clearTimeout(this.diceTimer)
    this.diceKey += 1
    this.diceShowTime = Date.now()
    this.diceActive   = true
    this.cb.onShowDiceResult(outcome, message)
    this.diceTimer = setTimeout(() => {
      this.diceActive = false
      this.cb.onClearDiceResult()
    }, DICE_RESULT_DISMISS_MS)
  }

  private showTurnDisplay(d: TurnDisplayData, dismissAfter = TURN_DISPLAY_DISMISS_MS): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer)
    this.cb.onShowTurnDisplay(d, dismissAfter)
    this.dismissTimer = setTimeout(() => this.cb.onHideTurnDisplay(), dismissAfter)
  }

  // Show the acting player + default target in the Phaser arena as soon as player_turn
  // begins so the canvas is never blank while the player deliberates.
  // React's selectSkill will call onSetTurnState again with the actual selected target.
  private showPlayerTurnUnits(actor: Unit): void {
    const firstEnemy = this.enemies.find(isAlive) ?? null
    if (!firstEnemy) return
    const actingMf = this.manifests.get(actor.defId) ?? null
    const targetMf = this.manifests.get(firstEnemy.defId) ?? null
    this.cb.onSetTurnState(actor.defId, firstEnemy.defId, actingMf, targetMf, {
      acting: unitIsDamaged(actor, actingMf),
      target: unitIsDamaged(firstEnemy, targetMf),
    })
  }

  // ── Battle end ────────────────────────────────────────────────────────────────

  private endBattle(outcome: 'victory' | 'defeat'): void {
    if (this.battleEnded) return
    this.battleEnded = true
    const turns    = this.playerUnits.reduce((sum, u) => sum + u.actionCount, 0)
    const xpGained = outcome === 'victory' ? 100 * this.enemies.length : 0
    this.cb.onBattleEnd(outcome, turns, xpGained)
  }

  // ── Log ───────────────────────────────────────────────────────────────────────

  private appendLog(entry: Omit<import('./EngineTypes').LogEntry, 'id'>): void {
    this.cb.onLog(entry)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  // Sum all active shield HP values on a unit's status slots.
  // Multiple shield statuses are additive (e.g. stacked buffs).
  private sumShieldHp(slots: import('../types').StatusEffect[]): number {
    return slots
      .filter(s => typeof s.payload?.shieldHp === 'number' && (s.payload.shieldHp as number) > 0)
      .reduce((sum, s) => sum + (s.payload.shieldHp as number), 0)
  }

  private getActivePlayerUnit(): Unit | null {
    const activeIds = new Set<string>()
    for (const [id, tick] of this.registeredTicks) {
      if (tick === this.tickValue) activeIds.add(id)
    }
    return this.playerUnits.find(
      u => activeIds.has(u.id) && this.controlledIds.has(u.id) && isAlive(u)
    ) ?? null
  }
}
