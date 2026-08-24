// Core attack resolution — dice roll, effect dispatch, crit/deflect, status-tick
// interval effects, and counter-chain scheduling. Used by player turns, AI turns,
// and the counter-reaction chain.

import type { Unit }                          from '../types'
import type { SkillInstance, EffectContext }  from '../effects/types'
import type { DiceOutcome }                   from '../combat/DiceResolver'
import type { BattleEngine }                  from './BattleEngine'
import {
  COUNTER_BASE, COUNTER_STEP, COUNTER_MIN, COUNTER_ANNOUNCE_MS, AI_COUNTER_AP_RESERVE,
  DICE_RESULT_DISMISS_MS,
} from '../constants'
import { tickStatusDurations, updateStatusIntervalTick, takeDamage } from '../unit'
import { calculateApGained }                            from '../combat/TickCalculator'
import { forecastOutcomes }                              from '../combat/OutcomeForecast'
import { roll, resolveCounterRoll }                     from '../combat/DiceResolver'
import { findCounterSkill, canCounter, isSingleTarget } from '../combat/CounterResolver'
import { applyTickCooldown }                            from '../combat/CooldownResolver'
import { applyEffect }                                  from '../effects/applyEffect'
import { getCachedSkill }                               from '../engines/skill/SkillInstance'
import { snapshotToBattleState }                        from './BattleSnapshot'
import {
  resolveIncomingDodge, makeShieldedBattleState, readCritConfig, resolveIncomingDeflect,
} from './BattleDamage'
import {
  fireHpThresholdPassives, fireOpponentActionEffects,
  fireCounterTriggerEffects, fireCounterCastEffects,
} from './BattlePassive'
import { outcomeColour, buildOutcomeMessage } from './BattleResolution'

export function runAttack(
  engine:    BattleEngine,
  caster:    Unit,
  target:    Unit,
  skillInst: SkillInstance,
  snap:      Map<string, Unit>,
  chainDepth = 0,
): { outcome: DiceOutcome; damage: number } {
  const skill = getCachedSkill(skillInst)
  const currentTick = engine.tickValue

  const { dodged, expiredStatusIds } = resolveIncomingDodge(target, skill.targeting.range, snap)
  for (const statusId of expiredStatusIds) {
    engine.fireExpiryChain(target.defId, statusId, snap)
  }

  // Precision comes from the caster's base stats, status bonuses from the live
  // snapshot — forecastOutcomes reads both off the unit it is given, so it is
  // handed a caster carrying the snapshot's statuses.
  const casterForDice = snap.get(caster.id) ?? caster
  const probabilities = forecastOutcomes(
    { ...casterForDice, stats: caster.stats },
    skill,
  )
  const diceOutcome = dodged ? 'Evade' : roll(probabilities)
  const noDamage    = diceOutcome === 'Evade' || diceOutcome === 'Fail'

  engine.showDiceResult(diceOutcome, buildOutcomeMessage(diceOutcome, caster.name, target.name))
  const targetHpBefore = snap.get(target.id)?.hp ?? target.hp
  const casterHpBefore = snap.get(caster.id)?.hp ?? caster.hp

  engine.cb.onNarrativeEmit({ type: 'skill_used', actorId: caster.defId, targetId: target.defId })
  if (diceOutcome === 'Boosted') {
    engine.cb.onNarrativeEmit({ type: 'boosted_hit', actorId: caster.defId, targetId: target.defId })
  }
  if (diceOutcome === 'Evade') {
    engine.cb.onNarrativeEmit({ type: 'evaded', actorId: target.defId, targetId: caster.defId })
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
      engine.appendLog({ text: `★ CRITICAL! +${critAmount} bonus damage`, colour: 'var(--accent-gold)' })
    }

    const deflectHp = resolveIncomingDeflect(target, targetHpBefore, snap)
    if (deflectHp > 0) {
      const targetCurrent = snap.get(target.id) ?? target
      snap.set(target.id, { ...targetCurrent, hp: Math.min(targetCurrent.maxHp, targetCurrent.hp + deflectHp) })
      engine.appendLog({ text: `◈ DEFLECT! ${targetCurrent.name} restores ${deflectHp} HP`, colour: 'var(--accent-info)' })
    }
  }

  const logMsg =
    diceOutcome === 'Evade' ? `${target.name} evaded ${skill.name}!` :
    diceOutcome === 'Fail'  ? `${caster.name} missed with ${skill.name}!` :
    `${caster.name} → ${skill.name} on ${target.name} [${diceOutcome}]`
  engine.appendLog({ text: logMsg, colour: outcomeColour(diceOutcome) })

  fireOpponentActionEffects(caster, snap, engine.passiveDefs, currentTick)

  if (diceOutcome === 'Evade' && isSingleTarget(skill)) {
    const defenderSnap   = snap.get(target.id) ?? target
    const defenderSkills = engine.unitSkillsMap.get(target.id) ?? []
    const counterSkill   = findCounterSkill(defenderSkills)
    if (counterSkill && canCounter(defenderSnap, counterSkill)) {
      scheduleCounterChain(engine, defenderSnap, caster, counterSkill, snap, chainDepth)
    }
  }

  fireHpThresholdPassives(target.id, targetHpBefore, engine.passiveDefs.get(target.id) ?? null, snap, currentTick)
  if (caster.id !== target.id) {
    fireHpThresholdPassives(caster.id, casterHpBefore, engine.passiveDefs.get(caster.id) ?? null, snap, currentTick)
  }

  if (shieldBrokeIds.size > 0) {
    const updatedMap = new Map(engine.unitSkillsMap)
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
    engine.unitSkillsMap = updatedMap
  }

  const casterAfter = snap.get(caster.id) ?? caster
  const { unit: casterTicked, expired } = tickStatusDurations(casterAfter)
  let casterFinal = casterTicked

  for (const slot of casterTicked.statusSlots) {
    const def = engine.statusDefs.get(slot.id)
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
    engine.fireExpiryChain(caster.defId, expiredSlot.id, snap)
  }

  const damage = Math.max(0, targetHpBefore - (snap.get(target.id)?.hp ?? targetHpBefore))
  return { outcome: diceOutcome, damage }
}

export function scheduleCounterChain(
  engine:         BattleEngine,
  defender:       Unit,
  originalCaster: Unit,
  counterSkill:   SkillInstance,
  snap:           Map<string, Unit>,
  depth:          number,
): void {
  engine.showDiceResult('Evade', `${defender.name} attempts a counter!`)

  const currentTick = engine.tickValue
  setTimeout(() => {
    const succeeded     = resolveCounterRoll(depth)
    const chancePercent = Math.round(Math.max(COUNTER_MIN, COUNTER_BASE - depth * COUNTER_STEP) * 100)
    engine.showDiceResult(
      succeeded ? 'Hit' : 'Fail',
      succeeded ? `Counter! (${chancePercent}% chance)` : 'Counter blocked!',
    )

    if (!succeeded) return

    engine.cb.onNarrativeEmit({ type: 'counter', actorId: defender.defId, targetId: originalCaster.defId })

    if (defender.isAlly && engine.controlledIds.has(defender.id)) {
      engine.pendingCounterDecision = { defender, originalCaster, counterSkill, snap, depth }
      engine.notify()
    } else {
      const defSnap    = snap.get(defender.id) ?? defender
      const shouldFire = defSnap.ap - counterSkill.cachedCosts.apCost >= AI_COUNTER_AP_RESERVE

      if (shouldFire) {
        snap.set(defender.id, { ...defSnap, ap: defSnap.ap - counterSkill.cachedCosts.apCost })
        setTimeout(() => {
          runAttack(engine, defender, originalCaster, counterSkill, snap, depth + 1)
          fireCounterCastEffects(defender, originalCaster, counterSkill, snap, currentTick)
          fireCounterTriggerEffects(defender, snap, engine.passiveDefs, currentTick)
          // snap is the same reference as pendingAITurn.snap — runEnemyApplying
          // will apply it at the correct time; no delayed re-apply here.
        }, DICE_RESULT_DISMISS_MS)
      }
    }
  }, COUNTER_ANNOUNCE_MS)
}
