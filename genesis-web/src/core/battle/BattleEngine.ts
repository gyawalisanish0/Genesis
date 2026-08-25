// BattleEngine — pure TypeScript class that drives the entire battle loop.
// No React, no Phaser, no Capacitor, no service imports.
// All side-effects fire outward through BattleEngineCallbacks.

import type { Unit, AnimationManifest, AnimationProjectileDef, AnimSequenceManifest, AnimPhase } from '../types'
import type { SkillInstance, EffectContext, PassiveDef, StatusDef } from '../effects/types'
import type { DiceOutcome } from '../combat/DiceResolver'
import type { DiceProbabilities } from '../combat/HitChanceEvaluator'
import type {
  BattleEngineConfig, BattleEngineCallbacks, BattleEngineSnapshot,
  PendingPlayerTurnData, PendingAITurnData, CounterDecision, ClashState, TeamCollisionState,
  TurnDisplayData,
} from './EngineTypes'
import type { BattleStep } from './BattleStepMachine'
import { YIELDED_STEPS } from './BattleStepMachine'
import { DICE_RESULT_DISMISS_MS, TURN_DISPLAY_DISMISS_MS, ANIM_TIMEOUT_MS } from '../constants'
import { resolveTickDisplacement } from '../combat/TickDisplacer'
import { isAlive, addApSpent } from '../unit'
import { applyEffect } from '../effects/applyEffect'
import { getCachedSkill } from '../engines/skill/SkillInstance'
import { snapshotToBattleState } from './BattleSnapshot'
import {
  fireStatusExpiry, fireCounterTriggerEffects, fireCounterCastEffects, fireOnApSpent,
} from './BattlePassive'
import { unitIsDamaged, outcomeColour } from './BattleResolution'
import { resolveAttackAnimation } from './AnimationResolver'
import { runAdvanceTick, runClashCheck } from './BattleTickRunner'
import { runEnemyTelegraph } from './BattleEnemyTelegraphRunner'
import { runEnemyApplying, runPlayerApplying } from './BattleApplyRunner'
import { runAttack } from './BattleAttackResolver'
import { executeSkill as executeSkillAction, skipTurn as skipTurnAction } from './BattlePlayerActions'

// ── BattleEngine ───────────────────────────────────────────────────────────────

export class BattleEngine {
  // ── Core state ───────────────────────────────────────────────────────────────
  step:           BattleStep
  playerUnits:    Unit[]
  enemies:        Unit[]
  unitSkillsMap:  Map<string, SkillInstance[]>
  registeredTicks: Map<string, number>
  tickValue:      number
  globalBattleTick:   number
  globalApAccum:      number
  lastIntervalFire:   Map<string, number>
  lastIntervalApAccum: Map<string, number>
  turnStartFired: Set<string>
  battleEnded:    boolean

  // ── Config / maps ────────────────────────────────────────────────────────────
  readonly controlledIds: Set<string>
  readonly passiveDefs:   Map<string, PassiveDef | null>
  readonly statusDefs:    Map<string, StatusDef>
  manifests:    Map<string, AnimationManifest | null>
  animSequences: Map<string, AnimSequenceManifest | null>

  // ── Pending turn data ────────────────────────────────────────────────────────
  pendingPlayerTurn:   PendingPlayerTurnData | null
  pendingAITurn:       PendingAITurnData | null
  clashAnnounceWinner: 'player' | 'enemy' | null

  // ── Decision overlays ────────────────────────────────────────────────────────
  pendingCounterDecision: CounterDecision | null
  pendingClash:           ClashState | null
  pendingTeamCollision:   TeamCollisionState | null
  suppressedChipIds:      Set<string>

  // ── Animation queues ─────────────────────────────────────────────────────────
  pendingExpiryAnims:     Array<{ ownerDefId: string; sequenceId: string; damage: number }>
  pendingActivationAnims: Array<{ ownerDefId: string; sequenceId: string; slotId: string }>

  // ── Dice overlay state ───────────────────────────────────────────────────────
  diceShowTime: number
  diceKey:      number
  diceActive:   boolean

  // ── Pause flags ──────────────────────────────────────────────────────────────
  narrativePaused: boolean
  inspectingSkill: boolean

  // ── Timers ───────────────────────────────────────────────────────────────────
  telegraphTimer:      ReturnType<typeof setTimeout> | null
  applyTimer:          ReturnType<typeof setTimeout> | null
  playerApplyTimer:    ReturnType<typeof setTimeout> | null
  attackTimer:         ReturnType<typeof setTimeout> | null
  pendingAttackCb:     (() => void) | null
  clashAnnounceTimer:  ReturnType<typeof setTimeout> | null
  diceTimer:           ReturnType<typeof setTimeout> | null
  dismissTimer:        ReturnType<typeof setTimeout> | null

  // ── Callbacks ────────────────────────────────────────────────────────────────
  readonly cb: BattleEngineCallbacks

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
    executeSkillAction(this, skillInst, selectedTarget)
  }

  skipTurn(): void {
    skipTurnAction(this)
  }

  confirmCounter(): void {
    if (!this.pendingCounterDecision) return
    const { defender, originalCaster, counterSkill, snap, depth } = this.pendingCounterDecision
    this.pendingCounterDecision = null

    const defSnap = snap.get(defender.id) ?? defender
    snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })

    const currentTick = this.tickValue
    setTimeout(() => {
      runAttack(this, defender, originalCaster, counterSkill, snap, depth + 1)
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

  registerTickInternal(id: string, tick: number): void {
    const finalTick = resolveTickDisplacement(tick, this.registeredTicks, id, this.tickValue)
    // A displaced unit lands somewhere it did not ask for. Without this signal
    // the marker appears to jump at random, since the cause is invisible.
    if (finalTick !== tick) this.cb.onTickDisplaced?.(id, tick, finalTick)
    this.registeredTicks = new Map(this.registeredTicks).set(id, finalTick)
    this.playerUnits = this.playerUnits.map(u => u.id === id ? { ...u, tickPosition: finalTick } : u)
    this.enemies     = this.enemies.map(e => e.id === id ? { ...e, tickPosition: finalTick } : e)
  }

  unregisterTickInternal(id: string): void {
    const next = new Map(this.registeredTicks)
    next.delete(id)
    this.registeredTicks = next
  }

  // ── Internal: step machine ────────────────────────────────────────────────────

  setStep(s: BattleStep): void {
    this.step = s
  }

  notify(): void {
    this.cb.onStateChanged(this.snapshot())
  }

  snapshot(): Readonly<BattleEngineSnapshot> {
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
      runAdvanceTick(this)
      return
    }
    if (this.step === 'clash_check') {
      runClashCheck(this)
      return
    }
    if (this.step === 'enemy_telegraph') {
      runEnemyTelegraph(this)
      return
    }
    if (this.step === 'enemy_applying') {
      runEnemyApplying(this)
      return
    }
    if (this.step === 'player_applying') {
      runPlayerApplying(this)
      return
    }
  }

  // ── Shared helpers ────────────────────────────────────────────────────────────

  applySkillAPCost(
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

  applySplashEffects(
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

  buildAttackAnimConfig(
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

  // ── Status chip animation helpers ─────────────────────────────────────────────

  detectNewActivations(
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

  playPendingExpiryAnims(snap: Map<string, Unit>): void {
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

  playPendingActivationAnims(): void {
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

  fireExpiryChain(ownerDefId: string, statusId: string, snap: Map<string, Unit>): void {
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

  showDiceResult(outcome: DiceOutcome, message: string, probabilities?: DiceProbabilities): void {
    if (this.diceTimer) clearTimeout(this.diceTimer)
    this.diceKey += 1
    this.diceShowTime = Date.now()
    this.diceActive   = true
    this.cb.onShowDiceResult(outcome, message, probabilities)
    this.diceTimer = setTimeout(() => {
      this.diceActive = false
      this.cb.onClearDiceResult()
    }, DICE_RESULT_DISMISS_MS)
  }

  showTurnDisplay(d: TurnDisplayData, dismissAfter = TURN_DISPLAY_DISMISS_MS): void {
    if (this.dismissTimer) clearTimeout(this.dismissTimer)
    this.cb.onShowTurnDisplay(d, dismissAfter)
    this.dismissTimer = setTimeout(() => this.cb.onHideTurnDisplay(), dismissAfter)
  }

  // Show the acting player + default target in the Phaser arena as soon as player_turn
  // begins so the canvas is never blank while the player deliberates.
  // React's selectSkill will call onSetTurnState again with the actual selected target.
  showPlayerTurnUnits(actor: Unit): void {
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

  endBattle(outcome: 'victory' | 'defeat'): void {
    if (this.battleEnded) return
    this.battleEnded = true
    const turns    = this.playerUnits.reduce((sum, u) => sum + u.actionCount, 0)
    const xpGained = outcome === 'victory' ? 100 * this.enemies.length : 0
    this.cb.onBattleEnd(outcome, turns, xpGained)
  }

  // ── Log ───────────────────────────────────────────────────────────────────────

  appendLog(entry: Omit<import('./EngineTypes').LogEntry, 'id'>): void {
    this.cb.onLog(entry)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  // Sum all active shield HP values on a unit's status slots.
  // Multiple shield statuses are additive (e.g. stacked buffs).
  sumShieldHp(slots: import('../types').StatusEffect[]): number {
    return slots
      .filter(s => typeof s.payload?.shieldHp === 'number' && (s.payload.shieldHp as number) > 0)
      .reduce((sum, s) => sum + (s.payload.shieldHp as number), 0)
  }

  getActivePlayerUnit(): Unit | null {
    const activeIds = new Set<string>()
    for (const [id, tick] of this.registeredTicks) {
      if (tick === this.tickValue) activeIds.add(id)
    }
    return this.playerUnits.find(
      u => activeIds.has(u.id) && this.controlledIds.has(u.id) && isAlive(u)
    ) ?? null
  }
}
