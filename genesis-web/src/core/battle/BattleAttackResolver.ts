// Core attack resolution — dice roll, effect dispatch, crit/deflect, status-tick
// interval effects, and counter-chain scheduling. Used by player turns, AI turns,
// and the counter-reaction chain.

import type { Unit }                          from '../types'
import type { SkillInstance, EffectContext, TargetSelector } from '../effects/types'
import type { DiceOutcome }                   from '../combat/DiceResolver'
import type { BattleEngine }                  from './BattleEngine'
import {
  COUNTER_BASE, COUNTER_STEP, COUNTER_MIN, COUNTER_ANNOUNCE_MS, AI_COUNTER_AP_RESERVE,
  DICE_RESULT_DISMISS_MS, GRAZE_AP_REFUND,
} from '../constants'
import { tickStatusDurations, updateStatusIntervalTick, takeDamage } from '../unit'
import { calculateApGained }                            from '../combat/TickCalculator'
import { forecastOutcomes, strikeChanceFor }             from '../combat/OutcomeForecast'
import {
  strikeTable, reactionTable, reactionChance, combineOutcome,
} from '../combat/PhaseResolver'
import { rollTable, outcomeScale, resolveCounterRoll }                from '../combat/DiceResolver'
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

/** Effect types whose magnitude scales, so they still fire on a graze. */
const GRAZEABLE_EFFECTS = new Set<string>(['damage', 'heal'])

/** Selectors that aim at the caster's own side — these never roll. */
const SELF_SELECTORS = new Set<string>(['self', 'ally', 'all-allies'])

/** TargetSelector also has a `{ tag }` form, which is never self-targeted. */
function isSelfTargeted(selector: TargetSelector): boolean {
  return typeof selector === 'string' && SELF_SELECTORS.has(selector)
}

/**
 * Aiming at yourself skips both phases.
 *
 * There is no opposed party to read the blow, so a reaction roll has nobody to
 * belong to. Paying 20 AP to fail at buffing your own unit was the least
 * defensible roll in the game, and the variance only ever read as cheating.
 */
function selfCastOutcome(skill: { targeting: { selector: TargetSelector } }) {
  return isSelfTargeted(skill.targeting.selector) ? ('Hit' as const) : null
}

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
  const casterForRoll = { ...casterForDice, stats: caster.stats }
  // The defender rolls from their live snapshot state, so a status applied
  // earlier this turn is already reflected in what they can do about this blow.
  const targetForRoll = snap.get(target.id) ?? target
  const probabilities = forecastOutcomes(casterForRoll, skill, targetForRoll)

  // ── Phase 1: the strike ──────────────────────────────────────────────────
  // Same derivation the forecast above used, so the band rolled here is drawn
  // from the same table the player was shown.
  const strike = rollTable(strikeTable(strikeChanceFor(casterForRoll, skill)), 'Solid')

  // ── Phase 2: the reaction ────────────────────────────────────────────────
  // A dodge status still forces a full read, but it is now expressed as the
  // reaction band it always meant rather than as an outcome reached around the
  // dice. Aiming at yourself skips both phases: there is no opposed party to
  // read the blow, and rolling one only ever read as the game cheating.
  const reaction = dodged
    ? 'Read'
    : rollTable(reactionTable(strike, reactionChance(targetForRoll.stats.endurance)), 'Caught')

  const diceOutcome = selfCastOutcome(skill) ?? combineOutcome(strike, reaction)

  // Only an Evade removes the target outright. A Graze keeps its target and
  // scales magnitude down instead of erasing the action.
  const evaded   = diceOutcome === 'Evade'
  const grazed   = diceOutcome === 'Graze'
  const noDamage = evaded
  const scale    = outcomeScale(diceOutcome)

  engine.showDiceResult(
    diceOutcome,
    buildOutcomeMessage(diceOutcome, caster.name, target.name),
    probabilities,
  )
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
  // A graze hands most of the AP back. The cost was committed before the roll,
  // so without this the roll punishes the biggest investments hardest — a 50 AP
  // skill lost ~100 ticks of banking to one die. The tick is still spent.
  const apRefund = grazed ? Math.round(skill.apCost * GRAZE_AP_REFUND) : 0
  const apCredit = apGained + apRefund
  if (apCredit > 0 && casterSnap) {
    snap.set(caster.id, { ...casterSnap, ap: Math.min(casterSnap.maxAp, casterSnap.ap + apCredit) })
  }

  const ctx: EffectContext = {
    caster,
    target:      noDamage ? undefined : target,
    outcomeScale: scale,
    battle,
    source:      'skill',
    event:       { event: 'onCast' },
    dice:        diceOutcome,
    currentTick,
  }

  for (const effect of skillInst.cachedEffects) {
    if (effect.when.event !== 'onCast') continue
    // A graze delivers reduced output, not a reduced version of everything —
    // a missed strike should not still land its debuff. This is an outcome-level
    // rule like Evade suppressing the whole cast, not a per-skill exception.
    if (grazed && !GRAZEABLE_EFFECTS.has(effect.type)) continue
    applyEffect(effect, ctx)
  }

  if (!noDamage) {
    const hitCtx = { ...ctx, event: { event: 'onHit' } as const }
    for (const effect of skillInst.cachedEffects) {
      if (effect.when.event === 'onHit') applyEffect(effect, hitCtx)
    }
  } else if (diceOutcome === 'Evade') {
    // Neutral magnitude, not the Evade scale. `ctx.outcomeScale` is 0 here, and
    // inheriting it multiplied every onEvade payload to nothing — the event
    // existed and could never do anything.
    //
    // An onEvade value is already the author's statement of what happens when
    // the attack is dodged, so scaling it by the dodge applies the penalty
    // twice. Husty's Cached Shockwave is the case: docs/characters/in-game/
    // husty.md documents 250% surge on hit and 125% on evade, and the JSON
    // carries exactly that halving. The engine then zeroed it, so an evaded
    // Shockwave dealt nothing while still spending 25 AP, a 25-tick cooldown
    // and the whole Power Surge pool — against a doc that says in as many
    // words that "a shockwave can't be fully dodged".
    const evadeCtx = { ...ctx, target, outcomeScale: 1, event: { event: 'onEvade' } as const }
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
    diceOutcome === 'Graze' ? `${caster.name} grazed with ${skill.name}!` :
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
  engine.safeTimeout(() => {
    const succeeded     = resolveCounterRoll(depth)
    const chancePercent = Math.round(Math.max(COUNTER_MIN, COUNTER_BASE - depth * COUNTER_STEP) * 100)
    engine.showDiceResult(
      succeeded ? 'Hit' : 'Graze',
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
        engine.safeTimeout(() => {
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
